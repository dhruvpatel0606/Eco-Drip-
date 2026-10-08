import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Bot, Send, Loader2, User, Zap, RefreshCw, WifiOff, Database, ShieldCheck, Paperclip, X, History, Camera, Video, FileText, Radio, ChevronRight, Clock3, MessageCircle } from 'lucide-react';
import { Device, WeatherData } from '../types';
import { chatWithBotanist, getIrrigationAdvice } from '../aiCore';
import { logActivity, ActivityType } from '../src/lib/activity';
import { supabase } from '../src/lib/supabase';
import LiveAI from './LiveAI';

const SUGGESTIONS = [
  "Dragon fruit watering?",
  "Wheat irrigation cycle?",
  "Cotton pest control?",
  "Why yellow leaves?",
  "Tomato ph level?"
];

const AIAdvisor: React.FC<{ devices: Device[]; weather: WeatherData; language?: string }> = ({ devices, weather, language = 'English' }) => {
  const [initialAdvice, setInitialAdvice] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user', text: string, attachmentUrl?: string, attachmentType?: string }[]>([
    { role: 'ai', text: language === 'Hindi' ? 'ईको-ड्रिप न्यूरल बोटनिस्ट ऑनलाइन। मैं आज आपकी क्या मदद कर सकता हूँ?' : (language === 'Gujarati' ? 'ઇકો-ડ્રિપ ન્યુરલ બોટનિસ્ટ ઓનલાઇન. આજે હું તમને કેવી રીતે મદદ કરી શકું?' : 'Eco-Drip Neural Botanist online. How can I assist you with your crops today?') }
  ]);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<{ url: string, file: File } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showLiveAI, setShowLiveAI] = useState(false);
  const [attachType, setAttachType] = useState<string>('image/*');

  const triggerFileSelect = (type: string) => {
    setAttachType(type);
    setShowAttachMenu(false);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachment({ url: URL.createObjectURL(file), file });
    }
    if (e.target) e.target.value = '';
  };

  const currentSessionId = useRef<string>('session_' + Date.now());
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<{ sessionId: string | null; title: string; preview: string; date: string }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const loadSessions = async () => {
    setLoadingHistory(true);
    setHistoryError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHistoryError('Sign in to view your saved conversations.');
        return;
      }

      const { data, error } = await supabase
        .from('ai_chats')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) {
        const groups: { [key: string]: { sessionId: string | null; title: string; preview: string; timestamp: Date } } = {};
        data.forEach((row: any) => {
          // Rows created before session IDs existed are a valid legacy conversation.
          const key = row.session_id || '__legacy__';
          if (!groups[key]) {
            groups[key] = {
              sessionId: row.session_id || null,
              title: row.role === 'user' ? row.message : 'Archived Thread',
              preview: row.message || 'Media message',
              timestamp: new Date(row.created_at)
            };
          }
          if (row.role === 'user' && groups[key].title === 'Archived Thread') {
            groups[key].title = row.message || 'Media message';
          }
          groups[key].preview = row.message || 'Media message';
          groups[key].timestamp = new Date(row.created_at);
        });

        const sortedSessions = Object.values(groups).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).map(session => ({
          sessionId: session.sessionId,
          title: session.title.length > 46 ? session.title.substring(0, 46) + '...' : session.title,
          preview: session.preview.length > 62 ? session.preview.substring(0, 62) + '...' : session.preview,
          date: session.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        }));

        setSessions(sortedSessions);
      }
    } catch (e: any) {
      console.error(e);
      setHistoryError(e.message || 'Unable to retrieve conversation history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const selectSession = async (sId: string | null) => {
    setLoadingHistory(true);
    setHistoryError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in to open a saved conversation.');

      let query = supabase
        .from('ai_chats')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      // `eq('session_id', 'archived')` never matched legacy NULL rows. This was the
      // reason those history cards appeared clickable but would not open.
      const { data, error } = await (sId ? query.eq('session_id', sId) : query.is('session_id', null));

      if (error) throw error;
      if (data && data.length) {
        setMessages(data.map((m: any) => ({
          role: m.role as 'ai' | 'user',
          text: m.message
        })));
        currentSessionId.current = sId || 'session_' + Date.now();
        setShowHistory(false);
      } else {
        setHistoryError('This conversation has no messages available.');
      }
    } catch (e: any) {
      console.error(e);
      setHistoryError(e.message || 'Unable to open this conversation.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const startNewChat = () => {
    currentSessionId.current = 'session_' + Date.now();
    setMessages([
      { role: 'ai', text: language === 'Hindi' ? 'ईको-ड्रिप न्यूरल बोटनिस्ट ऑनलाइन। मैं आज आपकी क्या मदद कर सकता हूँ?' : (language === 'Gujarati' ? 'ઇકો-ડ્રિપ ન્યુરલ બોટનિસ્ટ ઓનલાઇન. આજે હું તમને કેવી રીતે મદદ કરી શકું?' : 'Eco-Drip Neural Botanist online. How can I assist you with your crops today?') }
    ]);
  };

  useEffect(() => {
    if (showHistory) {
      loadSessions();
    }
  }, [showHistory]);

  const initializeAI = async () => {
    setIsTyping(true);
    try {
      const mainModule = devices[0] || { moisture: 50 };
      const res = await getIrrigationAdvice(mainModule.moisture, weather.condition, weather.temp, language);
      setInitialAdvice(res);
      logActivity(ActivityType.AI_ADVICE, `Initial Advice Received: ${res}`);
    } catch (e: any) {
      setInitialAdvice(language === 'Hindi' ? "ईको-ड्रिप विशेषज्ञ तैयार है। आपके फार्म की महत्वपूर्ण जानकारी की निगरानी की जा रही है।" : (language === 'Gujarati' ? "Eco-Drip નિષ્ણાત તૈયાર છે. તમારા ફાર્મના મહત્વપૂર્ણ સંકેતોનું નિરીક્ષણ કરી રહ્યાં છીએ." : "Eco-Drip Expert is standing by. Monitoring your farm's vital signs."));
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    initializeAI();
  }, [language]);

  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (customMsg?: string, liveMedia?: { base64: string, mimeType: string }) => {
    const msgToSend = (customMsg || input).trim();
    if (!msgToSend && !attachment) return;

    setInput('');
    const currentAttachment = attachment;
    setAttachment(null);
    if (inputRef.current) inputRef.current.blur();

    setMessages(prev => [...prev, {
      role: 'user',
      text: msgToSend || (currentAttachment?.file.type.startsWith('video') ? '[Video Attached]' : currentAttachment?.file.type.startsWith('image') ? '[Image Attached]' : '[Document Attached]'),
      attachmentUrl: currentAttachment?.url,
      attachmentType: currentAttachment?.file.type
    }]);
    setIsTyping(true);

    // This is deliberately derived from the one shared message list: text, uploads and Live AI
    // therefore all give the model the same immediate conversational memory.
    const recentConversation = messages.slice(-12).map(m => `${m.role === 'user' ? 'User' : 'EcoBot'}: ${m.text}`).join('\n');
    const context = `Farm: Indian. Avg Moisture: ${Math.round(devices.reduce((a, b) => a + b.moisture, 0) / (devices.length || 1))}%. Weather: ${weather.condition}.\nCurrent conversation:\n${recentConversation}`;

    try {
      let mediaPayload = liveMedia;
      if (currentAttachment) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(currentAttachment.file);
        });
        mediaPayload = { base64, mimeType: currentAttachment.file.type };
      }
      const res = await chatWithBotanist(msgToSend || "Please analyze this attached media.", context, language, mediaPayload);
      setMessages(prev => [...prev, { role: 'ai', text: res }]);

      // Persist to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('ai_chats').insert([
          { user_id: user.id, message: msgToSend || (currentAttachment ? '[Media attached]' : '[Live camera frame]'), role: 'user', context, session_id: currentSessionId.current },
          { user_id: user.id, message: res, role: 'ai', context, session_id: currentSessionId.current }
        ]);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `Internal Core Error: ${error.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const persistLiveTurn = async (userText: string, assistantText: string) => {
    if (!userText && !assistantText) return;
    const additions: { role: 'ai' | 'user'; text: string }[] = [];
    if (userText) additions.push({ role: 'user', text: userText });
    if (assistantText) additions.push({ role: 'ai', text: assistantText });
    setMessages(previous => [...previous, ...additions]);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const context = `Live AI session. Farm: Indian. Weather: ${weather.condition}.`;
      await supabase.from('ai_chats').insert(additions.map(message => ({
        user_id: user.id, message: message.text, role: message.role, context, session_id: currentSessionId.current
      })));
    }
  };

  return (
    <div className="flex flex-col h-full animate-scale-in relative max-w-4xl mx-auto w-full">
      <section className="bg-slate-900 px-4 py-5 md:p-5 rounded-[2rem] text-white shadow-xl mb-3 md:mb-4 relative overflow-hidden group shrink-0 mx-0.5">
        <Database className="absolute -right-4 -top-4 w-24 h-24 text-teal-500/10 rotate-12 group-hover:scale-110 transition-transform duration-700" />
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-all bg-teal-600 text-white shadow-teal-500/20 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="font-black uppercase text-[10px] tracking-[0.3em] text-teal-400">
                Neural Link
              </h2>
              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                NEURAL CORE
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={startNewChat} className="px-3 py-2 text-[10px] font-black uppercase tracking-wider bg-teal-600 text-white rounded-xl active:scale-95 transition-all shadow-md shrink-0" title="Start New Chat">
              New Chat
            </button>
            <button onClick={() => setShowHistory(true)} className="p-2.5 bg-white/5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-all border border-white/5 shrink-0" title="Chat History">
              <History size={16} />
            </button>
            <button onClick={initializeAI} className="p-2.5 bg-white/5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-all border border-white/5 shrink-0" title="Refresh Insights">
              <RefreshCw size={16} className={isTyping ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <Zap size={12} className="text-amber-400" />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">System Insight</span>
          </div>
          <p className="text-[11px] font-bold leading-relaxed text-slate-200 italic line-clamp-3">
            {initialAdvice || "Synchronizing with internal agricultural telemetry..."}
          </p>
        </div>
      </section>

      <div
        ref={scrollContainerRef}
        className="flex-grow overflow-y-auto no-scrollbar px-2 space-y-4 pb-4"
      >
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
            <div className={`flex gap-3 max-w-[90%] lg:max-w-[70%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-slate-200 dark:bg-slate-700' : 'bg-teal-600 text-white'}`}>
                {m.role === 'user' ? <User size={16} className="text-slate-600 dark:text-slate-400" /> : <Bot size={16} />}
              </div>
              <div className={`p-4 rounded-3xl text-xs font-bold leading-relaxed shadow-sm flex flex-col gap-2 ${m.role === 'user' ? 'bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-tr-none border border-slate-200 dark:border-white/5' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-200 rounded-tl-none'}`}>
                {m.attachmentUrl && (
                  <div className="w-full max-w-[200px] rounded-xl overflow-hidden border border-white/10 mb-1 flex items-center justify-center bg-black/5 dark:bg-white/5">
                    {m.attachmentType?.startsWith('video') ? (
                      <video src={m.attachmentUrl} className="w-full object-cover" />
                    ) : m.attachmentType?.startsWith('image') ? (
                      <img src={m.attachmentUrl} className="w-full object-cover" />
                    ) : (
                      <div className="p-4 flex flex-col items-center gap-2 text-slate-500">
                        <FileText size={32} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-center break-all">Document</span>
                      </div>
                    )}
                  </div>
                )}
                {m.text}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start animate-pulse">
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center"><Loader2 size={16} className="text-teal-500 animate-spin" /></div>
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 p-4 rounded-3xl rounded-tl-none flex gap-1">
                <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-[76px] lg:bottom-2 sm:bottom-[72px] z-20 bg-[#f8fafc] dark:bg-[#020617] pt-2 pb-2 -mx-2 px-2 md:-mx-4 md:px-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-1 shrink-0">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="whitespace-nowrap px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 bg-white dark:bg-slate-800 border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-600 shadow-sm"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {attachment && (
        <div className="shrink-0 px-4 py-2 flex items-center gap-2 animate-slide-up">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-teal-500 shadow-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            {attachment.file.type.startsWith('video') ? (
              <video src={attachment.url} className="w-full h-full object-cover" />
            ) : attachment.file.type.startsWith('image') ? (
              <img src={attachment.url} className="w-full h-full object-cover" />
            ) : (
              <FileText className="text-teal-500 w-8 h-8" />
            )}
            <button onClick={() => setAttachment(null)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white active:scale-95"><X size={12} /></button>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 z-30 bg-[#f8fafc] dark:bg-[#020617] pb-2 pt-1 -mx-2 px-2 md:-mx-4 md:px-4">
        <div className="shrink-0 p-1.5 rounded-[2.2rem] border border-slate-200 dark:border-white/10 flex items-center bg-white dark:bg-slate-900 shadow-2xl transition-all relative">
          <div className="pl-4 text-teal-600 dark:text-teal-500 shrink-0 hidden sm:block">
            <Bot size={20} strokeWidth={2.5} />
          </div>
          <input type="file" accept={attachType} className="hidden" ref={fileInputRef} onChange={handleAttachment} />

          {showAttachMenu && (
            <div className="absolute bottom-[4.5rem] left-4 sm:left-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col p-2 gap-1 z-50 animate-scale-in origin-bottom-left min-w-[150px]">
              <button onClick={() => triggerFileSelect('image/*')} className="flex items-center gap-3 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-teal-600 dark:hover:text-teal-400 rounded-xl transition-all active:scale-95 text-left">
                <Camera size={16} /> Photo
              </button>
              <button onClick={() => triggerFileSelect('video/*')} className="flex items-center gap-3 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-teal-600 dark:hover:text-teal-400 rounded-xl transition-all active:scale-95 text-left">
                <Video size={16} /> Video
              </button>
              <button onClick={() => triggerFileSelect('.pdf,.doc,.docx,.txt')} className="flex items-center gap-3 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-teal-600 dark:hover:text-teal-400 rounded-xl transition-all active:scale-95 text-left">
                <FileText size={16} /> Document
              </button>
            </div>
          )}

          <button onClick={() => setShowAttachMenu(!showAttachMenu)} className={`pl-3 sm:pl-2 pr-1 transition-colors shrink-0 relative z-10 ${showAttachMenu ? 'text-teal-500' : 'text-slate-400 hover:text-teal-500'}`} title="Attach Media">
            <Paperclip size={20} strokeWidth={2.5} />
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="flex-grow min-w-0 w-full py-4 px-2 font-bold text-sm outline-none bg-transparent text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 h-full"
            placeholder="Message AI..."
          />
          <div className="pr-1 flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowLiveAI(true)}
              className="h-10 w-10 sm:w-auto sm:h-11 sm:px-4 shrink-0 flex items-center gap-1.5 justify-center rounded-full sm:rounded-2xl bg-slate-900 dark:bg-teal-600 text-white shadow-lg active:scale-95 hover:bg-teal-600 transition-all"
              title="Start Live AI"
            >
              <Radio size={16} /><span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider">Live AI</span>
            </button>
            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !attachment) || isTyping}
              className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center rounded-full sm:rounded-2xl transition-all ${(!input.trim() && !attachment) || isTyping ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600' : 'bg-teal-600 text-white shadow-lg active:scale-90 hover:bg-teal-500'}`}
            >
              <Send size={16} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>

      {showHistory && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl z-50 rounded-[2rem] flex flex-col p-5 md:p-6 animate-fade-in border border-white/10">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-teal-400/10 text-teal-300"><History size={18} /></div>
              <div><h3 className="font-black uppercase text-xs tracking-widest text-white">Recent chats</h3><p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Continue any saved conversation</p></div>
            </div>
            <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 transition-all active:scale-90">
              <X size={16} />
            </button>
          </div>
          <button onClick={() => { startNewChat(); setShowHistory(false); }} className="mt-4 mb-3 w-full flex items-center justify-center gap-2 rounded-2xl border border-teal-400/20 bg-teal-400/10 py-3 text-[10px] font-black uppercase tracking-widest text-teal-200 hover:bg-teal-400/20 transition-colors"><MessageCircle size={15} /> Start a new chat</button>
          <div className="flex-grow overflow-y-auto no-scrollbar space-y-2 pr-1">
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <Loader2 className="animate-spin text-teal-500" size={24} />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Retrieving logs...</span>
              </div>
            ) : historyError ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <WifiOff className="text-amber-300 mb-3" size={30} />
                <p className="text-xs font-bold text-slate-300">{historyError}</p>
                <button onClick={loadSessions} className="mt-4 px-4 py-2 rounded-xl bg-white/10 text-[10px] font-black uppercase tracking-wider text-teal-300">Try again</button>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <Bot className="text-slate-600 mb-2" size={32} />
                <p className="text-xs font-bold text-slate-400">No saved conversations yet.</p>
              </div>
            ) : (
              sessions.map((s, idx) => (
                <button
                  key={s.sessionId || `legacy-${idx}`}
                  onClick={() => selectSession(s.sessionId)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group cursor-pointer ${currentSessionId.current === s.sessionId ? 'bg-teal-400/10 border-teal-400/30' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}`}
                >
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="mt-0.5 p-2 rounded-xl bg-white/5 text-teal-300"><MessageCircle size={14} /></div>
                    <div className="min-w-0 flex flex-col gap-1">
                      <span className="truncate text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{s.title}</span>
                      <span className="truncate text-[10px] font-medium text-slate-500">{s.preview}</span>
                      <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500"><Clock3 size={10} /> {s.date}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-600 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {showLiveAI && (
        <LiveAI
          messages={messages}
          isResponding={isTyping}
          onTurnComplete={persistLiveTurn}
          onClose={() => setShowLiveAI(false)}
        />
      )}
    </div>
  );
};

export default AIAdvisor;
