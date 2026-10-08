import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera as CapCamera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { createPortal } from 'react-dom';
import { Camera, CameraOff, Mic, MicOff, RotateCcw, Send, Volume2, VolumeX, X, ChevronDown, Plus, Settings, Keyboard } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

type Message = { role: 'ai' | 'user'; text: string };
type Props = { 
  messages: Message[]; 
  isResponding: boolean; 
  onTurnComplete: (userText: string, assistantText: string) => Promise<void>; 
  onClose: () => void;
};

// Sentence boundary regex
const sentenceRegex = /([.?!।।]+)\s*/;

const LiveAI: React.FC<Props> = ({ messages, onTurnComplete, onClose }) => {
  const [cameraOn, setCameraOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [draft, setDraft] = useState('');
  
  // Status: connecting -> listening -> speaking/thinking
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'recording' | 'error'>('connecting');
  const [transcript, setTranscript] = useState('Initializing...');
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Language support
  const [language, setLanguage] = useState<'hi-IN' | 'gu-IN' | 'en-US'>('hi-IN');
  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const statusRef = useRef(status);
  const orbRef = useRef<HTMLDivElement>(null);
  const currentScaleRef = useRef(1);
  const animationFrameRef = useRef<number | null>(null);
  
  // Speech Recognition
  const recognitionRef = useRef<any>(null);
  const transcriptValRef = useRef('');
  
  // Audio playback queue
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef(0);
  
  // VAD logic
  const silenceTimerRef = useRef<any>(null);
  const isSpeakingUserRef = useRef<boolean>(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadDataArrayRef = useRef<Uint8Array | null>(null);
  
  // Gemini AI Stream
  const fullAIResponseRef = useRef('');

  useEffect(() => {
    statusRef.current = status;
    if (status !== 'speaking' && status !== 'recording') {
      if (orbRef.current) orbRef.current.style.transform = '';
      currentScaleRef.current = 1;
    }
  }, [status]);

  // Handle Sarvam TTS logic (plays audio queue)
  const playAudioChunk = useCallback(async (base64Data: string) => {
    if (!audioContextRef.current || !speakerOn) return;
    try {
      const ctx = audioContextRef.current;
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      if (nextPlayTimeRef.current < ctx.currentTime) {
        nextPlayTimeRef.current = ctx.currentTime;
      }
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += audioBuffer.duration;
      
      activeSourcesRef.current.push(source);
      
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        if (ctx.currentTime >= nextPlayTimeRef.current - 0.1) {
           if (statusRef.current === 'speaking') {
             // Turn complete
             if (transcriptValRef.current && fullAIResponseRef.current) {
                onTurnComplete(transcriptValRef.current, fullAIResponseRef.current);
             }
             startListening();
           }
        }
      };
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  }, [speakerOn]);

  const stopSpeaking = useCallback(() => {
    activeSourcesRef.current.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
  }, []);

  const sendToSarvamTTS = async (text: string) => {
    if (!text.trim()) return;
    try {
      const sarvamKey = import.meta.env.VITE_SARVAM_API_KEY;
      if (!sarvamKey) return;
      
      const res = await fetch('https://api.sarvam.ai/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': sarvamKey
        },
        body: JSON.stringify({
          inputs: [text.trim()],
          target_language_code: languageRef.current,
          speaker: "meera",
          pitch: 0,
          pace: 1.1,
          loudness: 1.5,
          speech_sample_rate: 16000,
          enable_preprocessing: true,
          model: "bulbul:v1"
        })
      });
      const data = await res.json();
      if (data.audios && data.audios.length > 0) {
        await playAudioChunk(data.audios[0]);
      }
    } catch (e) {
      console.error('Sarvam TTS error:', e);
    }
  };

  const captureFrameBase64 = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth) return null;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
  }, []);

  // Gemini REST Streaming API
  const sendToGemini = async (text: string) => {
    stopSpeaking();
    setStatus('speaking');
    setTranscript('Thinking...');
    
    fullAIResponseRef.current = '';
    
    const keys = [
      import.meta.env.VITE_GEMINI_API_KEY,
      import.meta.env.VITE_LIVE_AI_KEY,
      import.meta.env.VITE_BACKUP_GEMINI_KEY,
      import.meta.env.VITE_BACKUP_GEMINI_KEY_2,
      import.meta.env.VITE_BACKUP_GEMINI_KEY_3,
      import.meta.env.VITE_BACKUP_GEMINI_KEY_4,
      import.meta.env.VITE_BACKUP_GEMINI_KEY_5
    ].filter(Boolean) as string[];

    if (keys.length === 0) {
      setTranscript('No API keys found.');
      setTimeout(startListening, 3000);
      return;
    }

    let success = false;
    for (const key of keys) {
      try {
        const genAI = new GoogleGenerativeAI(key);
        // Use gemini-1.5-flash as it is more stable across different key types, or gemini-2.5-flash
        const modelName = key.startsWith('AQ.') ? 'gemini-flash-latest' : 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
        
        const imageBase64 = cameraOn ? captureFrameBase64() : null;
        const promptParts: any[] = [];
        if (imageBase64) {
          promptParts.push({ inlineData: { data: imageBase64, mimeType: 'image/jpeg' } });
        }
        promptParts.push({ text: `You are EcoBot Live, a highly concise AI agricultural assistant. 
        Respond in exactly the same language the user spoke (${languageRef.current}). 
        Keep it short, conversational, and direct. No markdown.` });
        promptParts.push({ text: text });
        
        const result = await model.generateContentStream(promptParts);
        
        let sentenceBuffer = '';
        success = true;
        
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          sentenceBuffer += chunkText;
          fullAIResponseRef.current += chunkText;
          setTranscript(fullAIResponseRef.current);
          
          // Match sentence boundary
          const match = sentenceBuffer.match(sentenceRegex);
          if (match) {
             const splitIndex = match.index! + match[0].length;
             const completeSentence = sentenceBuffer.substring(0, splitIndex);
             sentenceBuffer = sentenceBuffer.substring(splitIndex);
             
             // Fire and forget to Sarvam TTS for this chunk
             void sendToSarvamTTS(completeSentence);
          }
        }
        
        // Flush remaining buffer
        if (sentenceBuffer.trim().length > 0) {
           void sendToSarvamTTS(sentenceBuffer);
        }
        break; // Stop trying keys if successful
      } catch(e) {
        console.warn('Key failed, trying next:', e);
      }
    }
    
    if (!success) {
      setTranscript('Error reaching AI.');
      setTimeout(startListening, 3000);
    }
  };

  const startListening = useCallback(() => {
    if (muted) return;
    setStatus('listening');
    setTranscript('Listening... speak now');
    transcriptValRef.current = '';
    
    if (recognitionRef.current) {
       try { recognitionRef.current.abort(); } catch(e) {}
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
       const rec = new SpeechRecognition();
       rec.continuous = true; // Use continuous so we handle VAD manually
       rec.interimResults = true;
       rec.lang = languageRef.current;
       
       rec.onstart = () => {
         setStatus('recording');
         isSpeakingUserRef.current = false;
       };
       
       rec.onresult = (event: any) => {
         let interimTranscript = '';
         let finalTranscript = '';
         
         for (let i = event.resultIndex; i < event.results.length; ++i) {
           if (event.results[i].isFinal) {
             finalTranscript += event.results[i][0].transcript;
           } else {
             interimTranscript += event.results[i][0].transcript;
           }
         }
         
         const text = finalTranscript || interimTranscript;
         if (text) {
           transcriptValRef.current = text;
           setTranscript('🎙️ ' + text);
         }
       };
       
       rec.onend = () => {
         const text = transcriptValRef.current.trim();
         if (text) {
           void sendToGemini(text);
         } else {
           if (statusRef.current === 'recording') {
              startListening(); // retry if no speech detected
           }
         }
       };
       
       rec.onerror = (e: any) => {
         if (e.error === 'no-speech' && statusRef.current === 'recording') {
            startListening();
         }
       };
       
       recognitionRef.current = rec;
       try { rec.start(); } catch(e) {}
    }
  }, [muted]);

  const startAudioCapture = async (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      vadDataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      
      const checkSilence = () => {
         if (statusRef.current === 'recording' && analyserRef.current && vadDataArrayRef.current) {
            analyserRef.current.getByteFrequencyData(vadDataArrayRef.current as any);
            let sum = 0;
            for(let i=0; i<vadDataArrayRef.current.length; i++) {
               sum += vadDataArrayRef.current[i];
            }
            const rms = sum / vadDataArrayRef.current.length;
            
            // Orb animation
            if (orbRef.current) {
               const targetScale = 1 + Math.min(rms / 100, 0.4);
               currentScaleRef.current += (targetScale - currentScaleRef.current) * 0.2;
               orbRef.current.style.transform = `scale(${currentScaleRef.current})`;
            }

            if (rms > 5) {
               // Speaking
               isSpeakingUserRef.current = true;
               if (silenceTimerRef.current) {
                  clearTimeout(silenceTimerRef.current);
                  silenceTimerRef.current = null;
               }
            } else {
               // Silence
               if (isSpeakingUserRef.current && !silenceTimerRef.current) {
                  silenceTimerRef.current = setTimeout(() => {
                     // 500ms silence detected, stop recognition instantly
                     if (recognitionRef.current) {
                        try { recognitionRef.current.stop(); } catch(e) {}
                     }
                  }, 500);
               }
            }
         }
         
         if (statusRef.current === 'speaking' && orbRef.current) {
             orbRef.current.style.transform = `scale(1.15)`;
         }
         
         animationFrameRef.current = requestAnimationFrame(checkSilence);
      };
      checkSilence();
      
    } catch(e) {
      console.error('Audio capture error:', e);
    }
  };

  const startMedia = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const capStatus = await CapCamera.checkPermissions();
        if (capStatus.camera !== 'granted') await CapCamera.requestPermissions({ permissions: ['camera'] });
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: { facingMode, width: { ideal: 640 } }
        });
        setCameraOn(true);
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        setCameraOn(false);
      }
      streamRef.current = stream;
      if (videoRef.current && stream.getVideoTracks().length > 0) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn(e));
      }
      startAudioCapture(stream);
      startListening();
    } catch(e) {
      console.error(e);
      setStatus('error');
      setTranscript('Media Permission Denied.');
    }
  };

  useEffect(() => {
    startMedia();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) try { recognitionRef.current.abort(); } catch(e){}
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) audioContextRef.current.close().catch(()=>{});
    };
  }, []);

  const handleOrbClick = () => {
    if (muted) return;
    if (status === 'speaking') {
      stopSpeaking();
      startListening();
    } else if (status === 'recording' && recognitionRef.current) {
      // Manual trigger
      try { recognitionRef.current.stop(); } catch(e) {}
    }
  };

  const submitText = () => {
    if (draft.trim()) {
      if (recognitionRef.current) {
         try { recognitionRef.current.abort(); } catch(e){}
      }
      transcriptValRef.current = draft.trim();
      setDraft('');
      setShowKeyboard(false);
      sendToGemini(transcriptValRef.current);
    }
  };

  const end = () => { onClose(); };
  const switchCamera = () => setFacingMode(mode => mode === 'environment' ? 'user' : 'environment');

  const orbState = muted ? 'muted' : status === 'speaking' ? 'speaking' : status === 'connecting' ? 'thinking' : 'listening';

  return createPortal(<div className="fixed inset-0 z-[99999] bg-black text-white flex flex-col animate-fade-in font-sans">
    <header className="absolute z-20 top-0 inset-x-0 p-4 sm:p-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
      <div className="flex items-center gap-3">
        <button onClick={end} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronDown size={28} />
        </button>
        <div className="flex items-center gap-1 cursor-pointer hover:bg-white/5 px-2 py-1 rounded-lg transition-colors">
          <p className="text-base font-semibold text-white">Live AI (Multi-Lang)</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={switchCamera} disabled={!cameraOn} className="p-2.5 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30">
          <RotateCcw size={22} />
        </button>
        <button onClick={() => setSpeakerOn(!speakerOn)} className={`p-2.5 rounded-full transition-colors ${!speakerOn ? 'text-rose-400' : 'hover:bg-white/10'}`}>
          {!speakerOn ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </button>
        <div className="relative">
          <button onClick={() => setSettingsOpen(!settingsOpen)} className={`p-2.5 rounded-full transition-colors ${settingsOpen ? 'bg-white/20' : 'hover:bg-white/10'}`}>
            <Settings size={22} />
          </button>
          {settingsOpen && (
            <div className="absolute top-14 right-0 w-64 bg-neutral-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl animate-fade-in z-50 flex flex-col gap-4 text-left">
              <div>
                <p className="text-[10px] font-bold text-white/50 mb-2 uppercase tracking-wider">AI Voice Language</p>
                <div className="flex flex-col gap-1">
                  {[
                    { code: 'hi-IN', label: 'Hindi (हिंदी)' },
                    { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)' },
                    { code: 'en-US', label: 'English' }
                  ].map(lang => (
                    <button key={lang.code} onClick={() => { 
                       setLanguage(lang.code as any); 
                       setSettingsOpen(false);
                       if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
                    }} className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${language === lang.code ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/10 text-white'}`}>
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    <main className="flex-1 relative overflow-hidden flex items-center justify-center">
      {cameraOn ? (
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-60" />
      ) : (
        <div className="absolute inset-0 bg-neutral-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30 pointer-events-none" />

      <div className={`absolute flex items-center justify-center pointer-events-none transition-all duration-700 ease-in-out z-20 ${cameraOn ? 'bottom-32 left-6 scale-[0.35] origin-bottom-left' : 'inset-0 scale-100'}`}>
        <div ref={orbRef} onClick={handleOrbClick} className={`live-orb live-orb--${orbState} rounded-full flex items-center justify-center transition-transform cursor-pointer pointer-events-auto`}>
          <span className="live-orb__halo live-orb__halo--one" />
          <span className="live-orb__halo live-orb__halo--two" />
          <span className="live-orb__halo live-orb__halo--three" />
          <span className="live-orb__wave live-orb__wave--one" />
          <span className="live-orb__wave live-orb__wave--two" />
          <span className="live-orb__core">
            <span className="live-orb__shine" />
          </span>
        </div>
      </div>

      {transcript && (
        <div className="absolute bottom-28 inset-x-5 flex justify-center pointer-events-none animate-fade-in">
          <p className="text-sm font-medium text-white/90 bg-black/40 px-4 py-2 rounded-2xl backdrop-blur-md max-w-sm text-center line-clamp-4">
            {transcript}
          </p>
        </div>
      )}
    </main>

    <section className="absolute bottom-0 inset-x-0 p-6 pb-8 flex flex-col gap-4 bg-gradient-to-t from-black via-black/90 to-transparent z-20">
      {showKeyboard && (
        <div className="flex gap-2 mb-2 animate-slide-up">
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitText()} placeholder="Message Live Assistant..." className="flex-1 bg-white/10 rounded-full px-5 py-3.5 text-base outline-none border border-white/5 focus:border-white/20 transition-colors placeholder:text-white/40" autoFocus />
          <button onClick={submitText} disabled={!draft.trim()} className="w-14 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-50 disabled:bg-white/20 disabled:text-white transition-all"><Send size={20} /></button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 sm:gap-2 bg-white/10 rounded-full p-1.5 backdrop-blur-md border border-white/5">
          <input type="file" accept="image/*" ref={fileInputRef} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-full hover:bg-white/10 transition-colors"><Plus size={22} /></button>
          <button onClick={() => setShowKeyboard(!showKeyboard)} className={`p-3 rounded-full transition-colors ${showKeyboard ? 'bg-white/20' : 'hover:bg-white/10'}`}><Keyboard size={22} /></button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 bg-white/10 rounded-full p-1.5 backdrop-blur-md border border-white/5">
          <button onClick={() => setMuted(v => {
            const next = !v;
            if (next && recognitionRef.current) try { recognitionRef.current.abort(); } catch(e){}
            if (!next && status !== 'recording') startListening();
            return next;
          })} className={`p-3 rounded-full transition-colors ${muted ? 'bg-white/20 text-white' : 'hover:bg-white/10'}`}>{muted ? <MicOff size={22} /> : <Mic size={22} />}</button>
          <button onClick={() => { 
            if (cameraOn) { streamRef.current?.getVideoTracks().forEach(t => t.stop()); setCameraOn(false); } 
            else startMedia(); 
          }} className={`p-3 rounded-full transition-colors ${cameraOn ? 'bg-white text-black' : 'hover:bg-white/10'}`}>{cameraOn ? <Camera size={22} /> : <CameraOff size={22} />}</button>
          <button onClick={end} className="p-3 rounded-full bg-rose-600 hover:bg-rose-500 transition-colors text-white ml-1 shadow-lg shadow-rose-900/20"><X size={22} strokeWidth={2.5} /></button>
        </div>
      </div>
    </section>
  </div>, document.body);
};
export default LiveAI;
