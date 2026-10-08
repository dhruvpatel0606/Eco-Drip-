import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Droplets, Thermometer, CalendarDays, ArrowRight, Sparkles,
  CheckCircle2, ChevronDown, Activity, ShieldAlert, Check,
  Mic, MicOff, Volume2, VolumeX, Loader2, Brain, Zap
} from 'lucide-react';
import { runPrologQuery, PrologResult } from '../src/services/prologService';

interface Option { value: string; label: string; icon: string; }
interface GenZSelectProps { options: Option[]; value: string; onChange: (val: string) => void; icon: React.ReactNode; label: string; highlighted?: boolean; }

const GenZSelect: React.FC<GenZSelectProps> = ({ options, value, onChange, icon, label, highlighted }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel = options.find(o => o.value === value) || options[0];
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="space-y-2 relative" ref={ref}>
      <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-400">{icon} {label}</label>
      <div onClick={() => setIsOpen(!isOpen)} className={`w-full border rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98] ${highlighted ? 'bg-teal-500/10 border-teal-400/40 shadow-[0_0_12px_rgba(20,184,166,0.15)]' : 'bg-white/5 hover:bg-white/10 border-white/10'}`}>
        <div className="flex items-center gap-2.5"><span className="text-lg">{sel.icon}</span><span className="font-bold text-sm text-white">{sel.label}</span></div>
        <ChevronDown size={14} className={`text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-slate-900/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50">
          <div className="space-y-1 max-h-56 lg:max-h-72 overflow-y-auto no-scrollbar">
            {options.map(opt => (
              <div key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${value === opt.value ? 'bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/30 text-white' : 'hover:bg-white/5 text-slate-300 border border-transparent'}`}>
                <div className="flex items-center gap-3"><span className="text-lg">{opt.icon}</span><span className="font-bold text-sm lg:text-xs xl:text-sm">{opt.label}</span></div>
                {value === opt.value && <Check size={14} className="text-teal-400" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ConfidenceBar: React.FC<{ value: number; color: string }> = ({ value, color }) => {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 150); return () => clearTimeout(t); }, [value]);
  return (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
      <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${w}%`, backgroundColor: color }} />
    </div>
  );
};

const TIPS = ['Unifying symbolic logic variables…','Resolving inference chains…','Applying agronomic constraint rules…','Ranking crop matches by confidence…','Generating agronomic reasoning…'];

const SOIL_MAP: Record<string,string> = {loamy:'loamy',loam:'loamy',clay:'clay',clayey:'clay',sandy:'sandy',sand:'sandy',black:'black',red:'red'};
const RAIN_MAP: Record<string,string> = {low:'low',less:'low',scarce:'low',little:'low',medium:'medium',moderate:'medium',normal:'medium',high:'high',heavy:'high'};
const CLIM_MAP: Record<string,string> = {cool:'cool',cold:'cool',warm:'warm',hot:'warm',humid:'humid',tropical:'humid',arid:'arid',dry:'arid'};
const SEAS_MAP: Record<string,string> = {kharif:'kharif',monsoon:'kharif',summer:'zaid',rabi:'rabi',winter:'rabi',zaid:'zaid'};
const PH_MAP: Record<string,string> = {acidic:'acidic',acid:'acidic',neutral:'neutral',alkaline:'alkaline',basic:'alkaline'};
const WATR_MAP: Record<string,string> = {scarce:'scarce',moderate:'moderate',medium:'moderate',plentiful:'plentiful',plenty:'plentiful',abundant:'plentiful'};

function parseVoice(t: string) {
  const ws = t.toLowerCase().split(/\s+/);
  const r: Partial<Record<'soil'|'rainfall'|'climate'|'season'|'ph'|'water',string>> = {};
  for (const w of ws) {
    if (!r.soil && SOIL_MAP[w]) r.soil = SOIL_MAP[w];
    if (!r.rainfall && RAIN_MAP[w]) r.rainfall = RAIN_MAP[w];
    if (!r.climate && CLIM_MAP[w]) r.climate = CLIM_MAP[w];
    if (!r.season && SEAS_MAP[w]) r.season = SEAS_MAP[w];
    if (!r.ph && PH_MAP[w]) r.ph = PH_MAP[w];
    if (!r.water && WATR_MAP[w]) r.water = WATR_MAP[w];
  }
  return r;
}

const CROP_EMOJI: Record<string,string> = {wheat:'🌾',rice:'🍚',cotton:'🌸',maize:'🌽',sugarcane:'🎋',mustard:'🌼',groundnut:'🥜',millet:'🌿'};

const CipatAdvisor: React.FC = () => {
  const [soil, setSoil] = useState('loamy');
  const [rainfall, setRainfall] = useState('medium');
  const [climate, setClimate] = useState('warm');
  const [season, setSeason] = useState('kharif');
  const [ph, setPh] = useState('neutral');
  const [water, setWater] = useState('moderate');
  const [results, setResults] = useState<PrologResult[] | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [voiceFields, setVoiceFields] = useState<string[]>([]);
  const recRef = useRef<any>(null);

  useEffect(() => {
    if (!isQuerying) return;
    const t = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 900);
    return () => clearInterval(t);
  }, [isQuerying]);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVoiceStatus('Speech recognition not supported on this browser.'); return; }
    const rec = new SR();
    rec.lang = 'en-IN'; rec.continuous = false; rec.interimResults = false;
    recRef.current = rec;
    rec.onstart = () => { setIsListening(true); setVoiceStatus('Listening… speak your farm conditions'); setVoiceFields([]); };
    rec.onresult = (ev: any) => {
      const transcript = ev.results[0][0].transcript;
      const p = parseVoice(transcript);
      const filled: string[] = [];
      if (p.soil) { setSoil(p.soil); filled.push('Soil'); }
      if (p.rainfall) { setRainfall(p.rainfall); filled.push('Rainfall'); }
      if (p.climate) { setClimate(p.climate); filled.push('Climate'); }
      if (p.season) { setSeason(p.season); filled.push('Season'); }
      if (p.ph) { setPh(p.ph); filled.push('Soil pH'); }
      if (p.water) { setWater(p.water); filled.push('Water Access'); }
      setVoiceFields(filled);
      setVoiceStatus(filled.length > 0 ? '✅ Detected: ' + filled.join(', ') : 'Heard: "' + transcript + '" — No fields matched. Try again.');
    };
    rec.onerror = (ev: any) => { setVoiceStatus('⚠️ ' + (ev.error === 'no-speech' ? 'No speech detected.' : 'Error: ' + ev.error)); setIsListening(false); };
    rec.onend = () => setIsListening(false);
    rec.start();
  }, []);

  const stopListening = useCallback(() => { recRef.current?.stop(); setIsListening(false); }, []);

  const speak = useCallback((text: string) => {
    if (isMuted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN'; u.rate = 0.95; u.pitch = 1.05;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [isMuted]);

  const stopSpeaking = useCallback(() => { window.speechSynthesis?.cancel(); setIsSpeaking(false); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsQuerying(true); setResults(null); setVoiceFields([]); setVoiceStatus(''); stopSpeaking();
    await new Promise(r => setTimeout(r, 300));
    try {
      const qr = await runPrologQuery(soil, rainfall, climate, season, ph, water);
      qr.sort((a, b) => b.confidence - a.confidence);
      setResults(qr);
      if (qr.length > 0) {
        const top = qr[0];
        setTimeout(() => speak('Recommendation complete. Best crop for your conditions is ' + top.crop + ', with ' + top.confidence + ' percent confidence. ' + top.reason), 600);
      } else {
        setTimeout(() => speak('No crops matched your conditions. Please adjust the parameters and try again.'), 400);
      }
    } catch (err) {
      console.error('CIPAT error:', err);
      setResults([]);
      speak('An error occurred in the inference engine. Please try again.');
    } finally { setIsQuerying(false); }
  };

  const getConf = (c: number) => {
    if (c >= 90) return { text:'text-emerald-400', bg:'bg-emerald-400/10', border:'border-emerald-400/20', bar:'#34d399', label:'HIGH MATCH' };
    if (c >= 75) return { text:'text-amber-400', bg:'bg-amber-400/10', border:'border-amber-400/20', bar:'#fbbf24', label:'GOOD MATCH' };
    return { text:'text-rose-400', bg:'bg-rose-400/10', border:'border-rose-400/20', bar:'#f87171', label:'MARGINAL' };
  };

  const FIELD_SUM = [
    {label:'Soil',value:soil,icon:'🪨'},{label:'Rainfall',value:rainfall,icon:'🌧️'},
    {label:'Climate',value:climate,icon:'☀️'},{label:'Season',value:season,icon:'📅'},
    {label:'pH',value:ph,icon:'⚗️'},{label:'Water',value:water,icon:'💧'},
  ];

  return (
    <div className="space-y-6 pb-32 relative z-10 max-w-5xl mx-auto">

      <div className="bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 relative border border-white/5 shadow-2xl">
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-500" />
          <div className="absolute -right-16 -top-16 w-48 h-48 bg-teal-500/10 blur-[80px] rounded-full" />
        </div>

        <div className="flex items-center justify-between relative z-10 mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500/30 to-emerald-500/20 flex items-center justify-center text-teal-400 border border-teal-500/20"><Brain size={20} /></div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">CIPAT Expert System</h2>
              <p className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">6-Variable Prolog Inference Engine</p>
            </div>
          </div>
          <button type="button" onClick={() => { setIsMuted(m => !m); stopSpeaking(); }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${isMuted ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-teal-400 hover:border-teal-400/30'}`}
            title={isMuted ? 'Unmute voice' : 'Mute voice'}
          >{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
        </div>

        <p className="text-xs text-slate-500 mt-3 leading-relaxed relative z-10">Set your farm conditions — or tap the mic and speak them. The Prolog engine reasons through its agronomic knowledge base and returns ranked crop matches, read aloud.</p>

        {isSpeaking && (
          <div className="mt-4 flex items-center gap-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl px-4 py-2.5">
            <Volume2 size={15} className="text-teal-400 shrink-0 animate-pulse" />
            <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">CIPAT is speaking…</span>
            <button onClick={stopSpeaking} className="ml-auto text-[10px] text-slate-400 hover:text-white font-bold uppercase tracking-wider transition-colors">Stop</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 lg:space-y-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 lg:gap-6">
            <GenZSelect label="Soil Type" icon={<Droplets size={12} className="text-amber-400" />} value={soil} onChange={setSoil} highlighted={voiceFields.includes('Soil')}
              options={[{value:'loamy',label:'Loamy',icon:'🪨'},{value:'clay',label:'Clay',icon:'🧱'},{value:'sandy',label:'Sandy',icon:'🏖️'},{value:'black',label:'Black Soil',icon:'🌑'},{value:'red',label:'Red Soil',icon:'🔴'}]} />
            <GenZSelect label="Rainfall" icon={<Droplets size={12} className="text-cyan-400" />} value={rainfall} onChange={setRainfall} highlighted={voiceFields.includes('Rainfall')}
              options={[{value:'low',label:'Low (<500mm)',icon:'🌦️'},{value:'medium',label:'Medium',icon:'🌧️'},{value:'high',label:'High (>1000mm)',icon:'⛈️'}]} />
            <GenZSelect label="Climate" icon={<Thermometer size={12} className="text-rose-400" />} value={climate} onChange={setClimate} highlighted={voiceFields.includes('Climate')}
              options={[{value:'cool',label:'Cool',icon:'❄️'},{value:'warm',label:'Warm',icon:'☀️'},{value:'humid',label:'Humid',icon:'🥵'},{value:'arid',label:'Arid',icon:'🏜️'}]} />
            <GenZSelect label="Season" icon={<CalendarDays size={12} className="text-purple-400" />} value={season} onChange={setSeason} highlighted={voiceFields.includes('Season')}
              options={[{value:'kharif',label:'Kharif (Monsoon)',icon:'🌱'},{value:'rabi',label:'Rabi (Winter)',icon:'❄️'},{value:'zaid',label:'Zaid (Summer)',icon:'☀️'}]} />
            <GenZSelect label="Soil pH" icon={<Activity size={12} className="text-pink-400" />} value={ph} onChange={setPh} highlighted={voiceFields.includes('Soil pH')}
              options={[{value:'acidic',label:'Acidic (<6.5)',icon:'🍋'},{value:'neutral',label:'Neutral (6.5-7.5)',icon:'⚖️'},{value:'alkaline',label:'Alkaline (>7.5)',icon:'🧼'}]} />
            <GenZSelect label="Water Access" icon={<Droplets size={12} className="text-blue-400" />} value={water} onChange={setWater} highlighted={voiceFields.includes('Water Access')}
              options={[{value:'scarce',label:'Scarce',icon:'💧'},{value:'moderate',label:'Moderate',icon:'🚰'},{value:'plentiful',label:'Plentiful',icon:'🌊'}]} />
          </div>

          {voiceStatus && (
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 px-1">
              <Mic size={12} className="text-teal-400 shrink-0" /><span>{voiceStatus}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={isListening ? stopListening : startListening}
              className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-all border ${isListening ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-teal-500/10 hover:border-teal-400/30 hover:text-teal-400'}`}
              title={isListening ? 'Stop listening' : 'Speak your farm conditions'}
            >{isListening ? <MicOff size={22} /> : <Mic size={22} />}</button>
            <button type="submit" disabled={isQuerying}
              className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs shadow-xl shadow-teal-900/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
            >{isQuerying ? <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /><span className="animate-pulse">Running inference…</span></span> : <><Zap size={16} />Run 6-Variable Query<ArrowRight size={16} /></>}</button>
          </div>
        </form>
      </div>

      {isQuerying && (
        <div className="bg-slate-900/70 border border-white/5 rounded-3xl p-8 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center"><Brain size={32} className="text-teal-400" /></div>
            <Loader2 size={20} className="text-teal-400 animate-spin absolute -bottom-1 -right-1" />
          </div>
          <p className="text-xs font-bold text-teal-400 uppercase tracking-widest text-center animate-pulse">{TIPS[tipIndex]}</p>
          <div className="flex gap-1.5">{[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{animationDelay: `${i*0.15}s`}} />)}</div>
        </div>
      )}

      {results !== null && !isQuerying && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 px-1">
            {FIELD_SUM.map(f => (
              <div key={f.label} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                <span className="text-sm">{f.icon}</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{f.label}:</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-white capitalize">{f.value}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-1">
            <Sparkles size={16} className="text-teal-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest">{results.length} Crop{results.length !== 1 ? 's' : ''} Recommended</h3>
          </div>
          {results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((res, idx) => {
                const conf = getConf(res.confidence);
                const emoji = CROP_EMOJI[res.crop.toLowerCase()] || '🌿';
                const isTop = idx === 0;
                return (
                  <div key={idx} className={`relative bg-slate-900/90 border rounded-3xl p-5 overflow-hidden transition-all group shadow-lg ${isTop ? 'border-teal-500/30 shadow-teal-900/20 shadow-xl' : 'border-white/10 hover:border-white/20'}`}>
                    {isTop && <div className="absolute top-4 right-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">★ TOP PICK</div>}
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border group-hover:scale-110 transition-transform ${isTop ? 'bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border-teal-500/20' : 'bg-white/5 border-white/5'}`}>{emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-teal-500 uppercase tracking-widest mb-0.5">Optimal Crop</p>
                        <h4 className="text-xl font-black text-white capitalize leading-tight">{res.crop}</h4>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black tracking-widest ${conf.text} ${conf.bg} ${conf.border}`}>
                            <CheckCircle2 size={9} />{conf.label} — {res.confidence}%
                          </div>
                        </div>
                        <ConfidenceBar value={res.confidence} color={conf.bar} />
                      </div>
                    </div>
                    <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                      <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-2">Agronomic Reasoning</p>
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">{res.reason}</p>
                    </div>
                    {!isMuted && (
                      <button type="button" onClick={() => speak(res.crop + ': ' + res.reason)}
                        className="mt-3 w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-teal-400 transition-colors py-1"
                      ><Volume2 size={12} /> Read Aloud</button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-10 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400"><ShieldAlert size={32} /></div>
              <div>
                <h4 className="text-lg font-black text-white mb-1">No Matches Found</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto font-medium leading-relaxed">The knowledge base has no crops matching all 6 selected conditions simultaneously. Try adjusting the parameters.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {results === null && !isQuerying && (
        <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 shrink-0"><Mic size={18} /></div>
          <div>
            <p className="text-xs font-black text-white uppercase tracking-wider mb-1">Voice Assist Tips</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">Tap the mic and speak naturally, e.g. <span className="text-teal-300 font-semibold">"loamy soil, medium rainfall, warm climate, kharif season"</span>. Matching fields glow and auto-fill. Results are read aloud after inference completes.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CipatAdvisor;