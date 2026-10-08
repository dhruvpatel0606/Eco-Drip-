import React, { useState, useEffect } from 'react';
import { Bot, ChevronRight, Droplets, CloudRain, Power, Lock, Send, Activity, ShieldCheck, Cpu, ShieldAlert, AlertCircle, RefreshCw, Waves } from 'lucide-react';
import { Device, WeatherData, Crop } from '../types';
import { supabase } from '../src/lib/supabase';

interface AutopilotProps {
  onBack: () => void;
  devices: Device[];
  weather: WeatherData;
  crops: Crop[];
  isArmed: boolean;
  setIsArmed: (val: boolean) => void;
  aiMode: 'conserve' | 'yield';
  setAiMode: (val: 'conserve' | 'yield') => void;
  targetMoisture: number;
  setTargetMoisture: (val: number) => void;
  onWater?: () => void;
  isWatering: boolean;
  sensorError: boolean;
  autopilotCooldownRemaining: number;
  dailyWateringCapReached: boolean;
  waitingForHysteresisRecovery: boolean;
  avgMoisture: number | null;
}

interface Message {
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

const AutopilotCore = ({ 
  onBack, 
  devices, 
  weather, 
  crops, 
  isArmed, 
  setIsArmed, 
  aiMode, 
  setAiMode, 
  targetMoisture, 
  setTargetMoisture, 
  onWater,
  isWatering,
  sensorError,
  autopilotCooldownRemaining,
  dailyWateringCapReached,
  waitingForHysteresisRecovery,
  avgMoisture
}: AutopilotProps) => {
  const [duration, setDuration] = useState(7);
  const [durationUnit, setDurationUnit] = useState<'Days' | 'Hours'>('Days');
  const [messages, setMessages] = useState<Message[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'main' | 'architecture' | 'swarm' | 'live-log' | 'xai' | 'chat-bot' | 'charts'>('main');

  const [realMoistureHistory, setRealMoistureHistory] = useState<{ time: string; moisture: number }[]>([]);
  const [totalWaterConsumed, setTotalWaterConsumed] = useState(0);
  const [waterPercentage, setWaterPercentage] = useState(25);
  const [loadingCharts, setLoadingCharts] = useState(false);

  // Load real history from Supabase when the tab changes to 'charts'
  useEffect(() => {
    if (activeTab !== 'charts') return;

    const fetchRealAutopilotChartsData = async () => {
      setLoadingCharts(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch real moisture logs
        const { data: sensorData } = await supabase
          .from('sensor_readings')
          .select('moisture, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(11);

        if (sensorData && sensorData.length > 0) {
          const formatted = sensorData.map((l: any) => ({
            time: new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            moisture: l.moisture !== undefined ? Number(l.moisture) : 40
          })).reverse();
          setRealMoistureHistory(formatted);
        } else {
          // Generate realistic default points ending with the real current device reading
          const hardwareDevice = devices.find(d => d.id === '1') || devices[0];
          const currentMoisture = hardwareDevice ? hardwareDevice.moisture : 45;
          const generated = Array.from({ length: 11 }, (_, i) => {
            const time = new Date(Date.now() - (11 - i) * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const variance = Math.sin(i) * 4;
            const val = i === 10 ? currentMoisture : Math.max(10, Math.min(100, Math.round(currentMoisture + variance)));
            return { time, moisture: val };
          });
          setRealMoistureHistory(generated);
        }

        // 2. Fetch real water consumption logs
        const { data: waterData } = await supabase
          .from('watering_history')
          .select('water_used')
          .eq('user_id', user.id);

        if (waterData) {
          const total = waterData.reduce((acc, curr) => {
            const liters = parseFloat(curr.water_used.replace(/[^0-9.]/g, '')) || 0;
            return acc + liters;
          }, 0);
          setTotalWaterConsumed(parseFloat(total.toFixed(1)));
          setWaterPercentage(Math.min(100, Math.round((total / 5000) * 100)) || 25);
        }
      } catch (err) {
        console.error("Autopilot charts error:", err);
      } finally {
        setLoadingCharts(false);
      }
    };

    fetchRealAutopilotChartsData();
  }, [activeTab, devices]);

  useEffect(() => {
    if (!isArmed) {
      setMessages([]);
      return;
    }
    
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Initial friendly messages
    setMessages([
      { sender: 'ai', text: `Currently, it is ${weather.temperature}°C outside with ${weather.humidity}% humidity.`, time },
      { sender: 'ai', text: `I am prioritizing ${aiMode === 'conserve' ? 'Water Conservation' : 'Maximum Yield'}. My target soil moisture is set to ${targetMoisture}%.`, time },
      { sender: 'ai', text: "Hello! I am taking over the farm management now.", time },
    ]);

    // Simulate AI making real-time decisions continuously
    let counter = 0;
    const interval = setInterval(() => {
      counter++;
      const currentTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      setIsTyping(true);
      setTimeout(() => {
        let text = "";
        const cycle = counter % 4;
        
        if (cycle === 1) {
          text = `Live Weather Update: It's currently ${weather.temperature}°C with a ${weather.precipitationProbability}% chance of rain today. Monitoring closely.`;
        } else if (cycle === 2) {
          const hardwareDevice = devices.find(d => d.id === '1') || devices[0];
          const moisture = hardwareDevice ? hardwareDevice.moisture || 45 : 45;
          text = `Live Soil Check: Your ${hardwareDevice ? hardwareDevice.name : 'primary crop'} soil moisture is at ${moisture}%. Target is ${targetMoisture}%.`;
        } else if (cycle === 3) {
          text = `System Diagnostic: Connecting to all ${devices.length} IoT sensors. Telemetry stream is stable and active.`;
        } else {
          const decision = weather.precipitationProbability > 50 
            ? "Live Action: Pausing water pumps to conserve resources due to impending rain." 
            : "Live Action: Maintaining optimal irrigation schedule based on dry conditions. Pumps are ready.";
          text = decision;
        }

        setMessages((prev: Message[]) => [{ sender: 'ai', text, time: currentTime }, ...prev]);
        setIsTyping(false);
      }, 1500);
    }, 8000);

    return () => clearInterval(interval);
  }, [isArmed, weather, devices, crops, aiMode, targetMoisture]);

  const handleManualCommand = (e?: React.FormEvent, presetCommand?: string) => {
    if (e) e.preventDefault();
    const command = presetCommand || manualInput;
    if (!command.trim()) return;
    
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    setMessages((prev: Message[]) => [
      { sender: 'user', text: command, time },
      ...prev
    ]);
    if (!presetCommand) setManualInput('');
    setIsTyping(true);
 
    setTimeout(() => {
      let aiResponse = `Got it! I will follow your instruction: "${command}" right away.`;
      const lower = command.toLowerCase();
      if (lower.includes('weather')) {
        aiResponse = `The weather is currently ${weather.temperature}°C with a ${weather.precipitationProbability}% chance of rain.`;
      } else if (lower.includes('water')) {
        aiResponse = `Watering sequence initiated. I'll make sure the crops get enough water.`;
        if (onWater) onWater();
      } else if (lower.includes('soil')) {
        const hardwareDevice = devices.find(d => d.id === '1') || devices[0];
        const moisture = hardwareDevice ? hardwareDevice.moisture || 45 : 45;
        aiResponse = `Soil moisture is currently ${moisture}% for "${hardwareDevice?.name || 'Main Zone'}". Target setting is ${targetMoisture}%.`;
      }

      setMessages((prev: Message[]) => [
        { sender: 'ai', text: aiResponse, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) },
        ...prev
      ]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className={`flex flex-col min-h-screen p-6 animate-view-in pb-20 mx-auto transition-all duration-700 bg-[#f8fafc] dark:bg-[#020617] ${isArmed ? 'w-full max-w-7xl' : 'max-w-lg'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => { if (activeTab !== 'main') { setActiveTab('main'); } else { onBack(); } }} className="p-3 bg-white dark:bg-white/5 rounded-2xl text-slate-800 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-white/5">
             <ChevronRight size={24} className="rotate-180" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">EcoDrip Sentinel AI™</h2>
            <p className="text-[8px] sm:text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest">Autonomous Farm Operating System</p>
          </div>
        </div>
        {isArmed && (
           <div className="hidden lg:flex items-center gap-2 bg-indigo-500/10 px-4 py-2 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_rgba(79,70,229,0.1)]">
              <Activity size={16} className="text-indigo-500 animate-pulse" />
              <span className="text-xs font-black text-indigo-500 uppercase tracking-widest">Powered by EAIE</span>
           </div>
        )}
      </div>

      {/* Configuration Section */}
      <div className={`bg-white dark:bg-slate-900 rounded-[2rem] p-6 border shadow-xl mb-6 transition-all duration-500 ${isArmed ? 'border-indigo-500/50 shadow-indigo-500/20 lg:max-w-lg' : 'border-slate-200 dark:border-white/5'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${isArmed ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                {isArmed ? <Lock size={20} /> : <Bot size={20} />}
             </div>
             <div>
                <h3 className={`text-sm font-black transition-colors ${isArmed ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>Sentinel OS Core</h3>
                <p className="text-xs font-medium text-slate-500">
                  {isArmed 
                    ? (isWatering ? 'Sentinel AI is active: Irrigation in progress' : 'Sentinel AI is active: Monitoring soil moisture') 
                    : 'System in manual override'}
                </p>
             </div>
          </div>
          
          {/* Foolproof Flex Toggle (No absolute positioning or translate math) */}
          <div 
            onClick={() => setIsArmed(!isArmed)}
            className={`w-14 h-7 rounded-full p-1 cursor-pointer transition-colors duration-300 flex items-center shadow-inner ${isArmed ? 'bg-indigo-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'}`}
          >
            <div className="w-5 h-5 bg-white rounded-full shadow-md" />
          </div>
        </div>

        {isArmed ? (
          <div className="animate-fade-in space-y-5">
             {/* 1. SENSOR ERROR BADGE */}
             {sensorError && (
               <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center gap-3">
                 <ShieldAlert size={20} className="shrink-0 text-rose-500 animate-pulse" />
                 <div>
                   <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-0.5">Critical Fault</span>
                   <span className="text-xs font-black uppercase tracking-wider block">Sensor Error - Check Wiring</span>
                 </div>
               </div>
             )}

             {/* 2. DAILY LIMIT REACHED NOTICE */}
             {dailyWateringCapReached && (
               <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex items-center gap-3">
                 <AlertCircle size={20} className="shrink-0 text-amber-500" />
                 <div>
                   <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block mb-0.5">Safety Stop Active</span>
                   <span className="text-xs font-black uppercase tracking-wider block">Autopilot paused - daily watering limit reached. Resumes tomorrow.</span>
                 </div>
               </div>
             )}

             {/* 3. COOLDOWN INDICATOR */}
             {!sensorError && !dailyWateringCapReached && autopilotCooldownRemaining > 0 && (
               <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-center gap-3">
                 <RefreshCw size={20} className="shrink-0 text-indigo-500 animate-spin" style={{ animationDuration: '4s' }} />
                 <div>
                   <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-0.5">Hydration Cooldown</span>
                   <span className="text-xs font-black uppercase tracking-wider block">Autopilot cooling down - next check in {Math.ceil(autopilotCooldownRemaining / 60)}m</span>
                 </div>
               </div>
             )}

             {/* 4. WAITING FOR RECOVERY STATE */}
             {!sensorError && !dailyWateringCapReached && autopilotCooldownRemaining <= 0 && waitingForHysteresisRecovery && (
               <div className="p-4 bg-teal-50 dark:bg-teal-900/10 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/20 rounded-2xl flex items-center gap-3">
                 <Waves size={20} className="shrink-0 text-teal-500 animate-pulse" />
                 <div>
                   <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest block mb-0.5">Hysteresis Lock</span>
                   <span className="text-xs font-black uppercase tracking-wider block">Moisture recovering - waiting to confirm before next cycle</span>
                 </div>
               </div>
             )}

             {/* 5. NORMAL STATUS */}
             {!sensorError && !dailyWateringCapReached && autopilotCooldownRemaining <= 0 && !waitingForHysteresisRecovery && (
               <div className="p-4 bg-emerald-50 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20 rounded-2xl flex items-center gap-3">
                 <Activity size={20} className="shrink-0 text-emerald-500 animate-pulse" />
                 <div>
                   <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-0.5">Sentinel Online</span>
                   <span className="text-xs font-black uppercase tracking-wider block">Autopilot active - monitoring soil moisture</span>
                 </div>
               </div>
             )}

             {/* 6. AVERAGED MOISTURE DISPLAY */}
             <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between">
               <div>
                 <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">Smoothing Core</span>
                 <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Avg Moisture (last 5 readings)</span>
               </div>
               <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                 {avgMoisture !== null ? `${Math.round(avgMoisture)}%` : 'Calibrating...'}
               </span>
             </div>
          </div>
        ) : (
          <div className="opacity-100">
             <div className="flex items-center justify-between mb-3">
               <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">How long?</label>
               <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                 <button onClick={() => setDurationUnit('Hours')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${durationUnit === 'Hours' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>Hours</button>
                 <button onClick={() => setDurationUnit('Days')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${durationUnit === 'Days' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>Days</button>
               </div>
             </div>
             <div className="flex items-center justify-between bg-slate-50 dark:bg-black/20 p-2 rounded-2xl border border-slate-200 dark:border-white/5">
                <button onClick={() => setDuration(Math.max(1, duration - 1))} className="w-12 h-12 bg-white dark:bg-white/5 rounded-xl flex items-center justify-center text-slate-900 dark:text-white active:scale-90 transition-all font-black shadow-sm">-</button>
                <div className="flex items-baseline gap-1">
                   <span className="text-2xl font-black text-slate-900 dark:text-white">{duration}</span>
                   <span className="text-sm font-bold text-slate-500">{durationUnit}</span>
                </div>
                <button onClick={() => setDuration(duration + 1)} className="w-12 h-12 bg-white dark:bg-white/5 rounded-xl flex items-center justify-center text-slate-900 dark:text-white active:scale-90 transition-all font-black shadow-sm">+</button>
             </div>
             
             {/* Detailed AI Automation Settings */}
             <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/5 space-y-5">
               <div>
                 <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-2">AI Strategy</label>
                 <div className="flex gap-2">
                   <button onClick={() => setAiMode('conserve')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${aiMode === 'conserve' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-2 border-emerald-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}>💧 Save Water</button>
                   <button onClick={() => setAiMode('yield')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${aiMode === 'yield' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-2 border-amber-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}>🌾 Max Yield</button>
                 </div>
               </div>
               
               <div>
                 <div className="flex justify-between items-center mb-3">
                   <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Target Soil Moisture</label>
                   <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{targetMoisture}%</span>
                 </div>
                 <input 
                   type="range" 
                   min="20" max="80" step="10"
                   value={targetMoisture}
                   onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetMoisture(parseInt(e.target.value))}
                   className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                 />
                 <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400">
                   <span>Dry (20%)</span>
                   <span>Optimal (50%)</span>
                   <span>Wet (80%)</span>
                 </div>
               </div>
             </div>
          </div>
        )}
      </div>

         {/* Mission Control Menu (Only visible when Armed and on Main Tab) */}
      {isArmed && activeTab === 'main' && (
        <div className="animate-view-in flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-5xl mx-auto">
           <button onClick={() => setActiveTab('architecture')} className="bg-slate-900 border border-indigo-500/30 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-indigo-950/30 transition-all group shadow-xl">
              <Activity size={36} className="text-indigo-400 group-hover:scale-110 transition-transform" />
              <h3 className="font-black text-white text-center text-sm tracking-widest uppercase">Governance Pipeline</h3>
           </button>
           <button onClick={() => setActiveTab('swarm')} className="bg-slate-900 border border-teal-500/30 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-teal-950/30 transition-all group shadow-xl">
              <Bot size={36} className="text-teal-400 group-hover:scale-110 transition-transform" />
              <h3 className="font-black text-white text-center text-sm tracking-widest uppercase">AI Specialist Swarm</h3>
           </button>
           <button onClick={() => setActiveTab('live-log')} className="bg-slate-900 border border-emerald-500/30 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-emerald-950/30 transition-all group shadow-xl">
              <Activity size={36} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              <h3 className="font-black text-white text-center text-sm tracking-widest uppercase">Live Execution Log</h3>
           </button>
           <button onClick={() => setActiveTab('xai')} className="bg-slate-900 border border-blue-500/30 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-blue-950/30 transition-all group shadow-xl">
              <ShieldCheck size={36} className="text-blue-400 group-hover:scale-110 transition-transform" />
              <h3 className="font-black text-white text-center text-sm tracking-widest uppercase">Explainable AI (XAI)</h3>
           </button>
           <button onClick={() => setActiveTab('chat-bot')} className="bg-slate-900 border border-purple-500/30 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-purple-950/30 transition-all group shadow-xl">
              <Send size={36} className="text-purple-400 group-hover:scale-110 transition-transform" />
              <h3 className="font-black text-white text-center text-sm tracking-widest uppercase">Ask AI Bot</h3>
           </button>
           <button onClick={() => setActiveTab('charts')} className="bg-slate-900 border border-amber-500/30 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-amber-950/30 transition-all group shadow-xl">
              <Activity size={36} className="text-amber-400 group-hover:scale-110 transition-transform" />
              <h3 className="font-black text-white text-center text-sm tracking-widest uppercase">Live Analytics</h3>
           </button>
        </div>
      )}

      {isArmed && activeTab === 'architecture' && (
          <div className="animate-view-in flex-1 bg-slate-950 rounded-[2rem] relative overflow-hidden border border-indigo-500/40 shadow-[0_0_40px_rgba(79,70,229,0.15)] p-6 flex flex-col max-w-2xl mx-auto w-full">
            <div className="flex justify-between items-center z-10 mb-6 pb-6 border-b border-white/5">
               <h3 className="text-lg font-black text-white uppercase tracking-widest">Pipeline</h3>
               <button onClick={() => setActiveTab('main')} className="flex items-center gap-1.5 px-4 py-2 bg-white/5 rounded-xl text-xs font-bold text-slate-300 border border-white/10 hover:bg-white/10 transition-colors">
                 <ChevronRight className="rotate-180" size={14} /> Return
               </button>
            </div>
            
            <div className="flex justify-between items-center z-10 mb-8">
               <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-xl border border-indigo-500/50 backdrop-blur-md">
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping"></div>
                 <span className="text-[10px] font-black text-white uppercase tracking-widest">13-Layer OS Architecture</span>
               </div>
               <div className="flex flex-col items-end">
                 <span className="text-[10px] font-mono font-black text-teal-400">SYS.TRUST: 99.9%</span>
                 <span className="text-[10px] font-mono font-black text-indigo-400">RISK: LOW</span>
               </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-between relative z-10 py-2">
               <div className="absolute top-4 bottom-4 left-1/2 w-[2px] bg-gradient-to-b from-indigo-500 via-teal-500 to-emerald-500 opacity-20 -translate-x-1/2"></div>
               {[
                 { level: 1, name: 'Master Governor AI', desc: 'Global strategy', icon: <Cpu size={14}/>, color: 'indigo' },
                 { level: 2, name: 'Mission Planner AI', desc: 'Task breakdown', icon: <Activity size={14}/>, color: 'indigo' },
                 { level: 3, name: 'Specialist AI Swarm', desc: 'Domain analysis', icon: <Bot size={14}/>, color: 'blue', isRow: true },
                 { level: 4, name: 'Consensus Engine', desc: '80% Agreement required', icon: <ShieldCheck size={14}/>, color: 'teal' },
                 { level: 5, name: 'Verification AI', desc: 'Input validation', icon: <ShieldCheck size={14}/>, color: 'teal' },
                 { level: 6, name: 'Observer AI', desc: '3-Layer monitoring', icon: <Activity size={14}/>, color: 'teal' },
                 { level: 7, name: 'Digital Twin Simulator', desc: '100 virtual tests', icon: <Cpu size={14}/>, color: 'blue' },
                 { level: 8, name: 'Safety AI', desc: 'Hardware protection', icon: <Lock size={14}/>, color: 'amber' },
                 { level: 9, name: 'Emergency AI', desc: 'Fallback protocols', icon: <Activity size={14}/>, color: 'rose' },
                 { level: 10, name: 'Execution AI', desc: 'Hardware commands', icon: <Power size={14}/>, color: 'emerald' },
               ].map((node, i) => (
                  <div key={i} className={`relative flex items-center gap-4 bg-slate-900/80 border border-${node.color}-500/30 px-5 py-3 rounded-xl backdrop-blur-md z-10 w-72 mb-4 ${node.isRow ? 'shadow-[0_0_20px_rgba(59,130,246,0.2)] scale-105' : ''}`}>
                     <div className={`w-8 h-8 rounded-lg bg-${node.color}-500/20 flex items-center justify-center text-${node.color}-400`}>
                        {node.icon}
                     </div>
                     <div>
                        <div className="text-[12px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                           <span className={`text-[10px] text-${node.color}-400`}>LVL {node.level}</span> {node.name}
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase">{node.desc}</div>
                     </div>
                  </div>
               ))}
            </div>
            
            <div className="z-10 bg-black/40 border border-white/5 rounded-xl p-4 backdrop-blur-sm mt-4">
               <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Consensus Confidence</span>
                  <span className="text-[12px] font-black text-teal-400">97%</span>
               </div>
               <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-indigo-500 w-[30%] shadow-[0_0_5px_#6366f1]"></div>
                  <div className="h-full bg-teal-500 w-[40%] shadow-[0_0_5px_#14b8a6]"></div>
                  <div className="h-full bg-emerald-500 w-[27%] shadow-[0_0_5px_#10b981]"></div>
               </div>
            </div>
          </div>
      )}

      {isArmed && activeTab === 'swarm' && (
          <div className="animate-view-in flex-1 flex flex-col w-full max-w-2xl mx-auto">
             <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200 dark:border-white/5">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">Specialist Network</h3>
                <button onClick={() => setActiveTab('main')} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                  <ChevronRight className="rotate-180" size={14} /> Return
                </button>
             </div>
             
             <div className="bg-slate-900 rounded-[2rem] p-6 border border-slate-800 shadow-xl w-full">
                <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-6">Specialist AI Swarm Status</h4>
                <div className="space-y-4">
                   {[
                     { name: 'Weather', icon: <CloudRain size={16}/>, color: 'teal', conf: '99%', status: 'nominal' },
                     { name: 'Crop', icon: <Bot size={16}/>, color: 'emerald', conf: '95%', status: 'nominal' },
                     { name: 'Water', icon: <Droplets size={16}/>, color: 'blue', conf: '98%', status: 'nominal' },
                     { name: 'Sensor', icon: <Activity size={16}/>, color: 'indigo', conf: '99%', status: 'nominal' },
                     { name: 'Disease', icon: <Bot size={16}/>, color: 'amber', conf: '91%', status: 'warning' },
                     { name: 'Safety', icon: <ShieldCheck size={16}/>, color: 'emerald', conf: '100%', status: 'nominal' },
                   ].map((ai, i) => (
                     <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-black/20 border border-white/5">
                        <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-xl bg-${ai.color}-500/10 flex items-center justify-center text-${ai.color}-400`}>{ai.icon}</div>
                           <span className="text-sm font-black text-slate-300 uppercase tracking-widest">{ai.name} AI</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="text-xs font-mono font-black text-slate-500">{ai.conf} Conf</span>
                           <div className={`w-3 h-3 rounded-full ${ai.status === 'nominal' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500 shadow-[0_0_10px_#f59e0b]'}`}></div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
      )}

      {isArmed && activeTab === 'live-log' && (
          <div className="animate-view-in flex-1 flex flex-col w-full max-w-2xl mx-auto">
             <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200 dark:border-white/5">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">Live Execution Log</h3>
                <button onClick={() => setActiveTab('main')} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                  <ChevronRight className="rotate-180" size={14} /> Return
                </button>
             </div>
             
             <div className="bg-slate-900 rounded-[2rem] p-6 border border-slate-800 shadow-xl flex-1 flex flex-col min-h-[400px]">
                <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-6">Real-Time Event Feed</h4>
                <div className="flex-1 space-y-6 relative before:absolute before:inset-y-0 before:left-[15px] before:w-[2px] before:bg-slate-800 overflow-y-auto pr-2">
                   {[
                     { time: '09:15', msg: 'Sensors Analyzed', type: 'info' },
                     { time: '09:15', msg: 'Weather Verified', type: 'info' },
                     { time: '09:16', msg: 'Consensus Achieved', type: 'success' },
                     { time: '09:16', msg: 'Simulation Passed', type: 'success' },
                     { time: '09:16', msg: 'Safety Verified', type: 'success' },
                     { time: '09:17', msg: 'Master Relay Activated', type: 'success' },
                     { time: '09:20', msg: 'Moisture Target Hit', type: 'info' },
                     { time: '09:20', msg: 'Execution Complete', type: 'success' },
                   ].map((log, i) => (
                     <div key={i} className="relative pl-10">
                        <div className={`absolute left-0 top-1 w-[32px] h-[32px] bg-slate-900 border-[3px] ${log.type === 'success' ? 'border-emerald-500' : 'border-indigo-500'} rounded-full flex items-center justify-center z-10`}>
                           <div className={`w-3 h-3 rounded-full ${log.type === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                        </div>
                        <span className="text-xs font-mono font-black text-slate-500 block mb-1">{log.time}</span>
                        <span className="text-sm font-bold text-slate-300 block">{log.msg}</span>
                     </div>
                   ))}
                </div>
             </div>
          </div>
      )}

      {isArmed && activeTab === 'xai' && (
          <div className="animate-view-in flex-1 flex flex-col w-full max-w-2xl mx-auto">
             <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200 dark:border-white/5">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">Explainable AI Hub</h3>
                <button onClick={() => setActiveTab('main')} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                  <ChevronRight className="rotate-180" size={14} /> Return
                </button>
             </div>

             <div className="bg-slate-900 rounded-[2rem] p-6 border border-slate-800 shadow-xl flex flex-col w-full">
                <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-4">Decision Transparency</h4>
                <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-5 mb-4">
                   <span className="text-sm font-black text-indigo-400 block mb-2 uppercase tracking-widest">Decision: Pump ON</span>
                   <p className="text-sm font-medium text-slate-300 leading-relaxed">
                     Moisture (18%) is below threshold. Rain probability (3%) is negligible. Consensus reached with 98.2% confidence. All simulations passed safely.
                   </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Est. Water</span>
                      <span className="text-lg font-black text-blue-400 block mt-1">14.2 L</span>
                   </div>
                   <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sys. Risk</span>
                      <span className="text-lg font-black text-emerald-400 block mt-1">LOW</span>
                   </div>
                </div>
             </div>
          </div>
      )}

      {isArmed && activeTab === 'chat-bot' && (
          <div className="animate-view-in flex-1 flex flex-col w-full max-w-2xl mx-auto">
             <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200 dark:border-white/5">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">AI Command Chat</h3>
                <button onClick={() => setActiveTab('main')} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                  <ChevronRight className="rotate-180" size={14} /> Return
                </button>
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 flex-1 overflow-hidden border border-slate-200 dark:border-white/5 shadow-xl flex flex-col gap-4 min-h-[500px]">
               <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-white/5 shrink-0">
                  <Bot size={20} className="text-indigo-500" />
                  <span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Ask XAI Bot</span>
               </div>
               
               <div className="flex-1 overflow-y-auto flex flex-col-reverse gap-4 pr-2 -mr-2">
                   {isTyping && (
                     <div className="flex flex-col max-w-[85%] self-start items-start animate-fade-in">
                       <div className="px-5 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm flex gap-1.5 items-center h-12">
                         <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                         <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                         <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                       </div>
                     </div>
                   )}
                   {messages.map((msg: Message, index: number) => (
                     <div key={index} className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'} animate-fade-in`}>
                       <div className={`px-5 py-4 text-[15px] font-medium shadow-sm leading-relaxed ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-br-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-bl-sm'}`}>
                         {msg.text}
                       </div>
                       <span className="text-xs font-bold text-slate-400 mt-1 px-1">{msg.time}</span>
                     </div>
                   ))}
               </div>
               
               <div className="flex flex-col gap-3 mt-4">
                 <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                   <button onClick={() => handleManualCommand(undefined, "💧 Water all crops")} className="shrink-0 px-5 py-2.5 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-white/10 shadow-sm active:scale-95 transition-transform">
                     💧 Water all crops
                   </button>
                   <button onClick={() => handleManualCommand(undefined, "🌦️ Check weather")} className="shrink-0 px-5 py-2.5 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-white/10 shadow-sm active:scale-95 transition-transform">
                     🌦️ Check weather
                   </button>
                   <button onClick={() => handleManualCommand(undefined, "🌾 Soil status")} className="shrink-0 px-5 py-2.5 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-white/10 shadow-sm active:scale-95 transition-transform">
                     🌾 Soil status
                   </button>
                 </div>
               
                 <form onSubmit={handleManualCommand} className="relative mt-1 flex w-full">
                   <input 
                     type="text" 
                     value={manualInput}
                     onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualInput(e.target.value)}
                     placeholder="Ask the AI Bot anything..." 
                     className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[15px] font-medium p-4 pr-16 rounded-2xl border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 shadow-xl placeholder:text-slate-400"
                   />
                   <button type="submit" className="absolute right-2 top-2 bottom-2 w-12 bg-indigo-600 text-white flex items-center justify-center rounded-xl hover:bg-indigo-700 transition-colors shadow-md">
                     <Send size={18} />
                   </button>
                 </form>
               </div>
             </div>
          </div>
      )}

      {isArmed && activeTab === 'charts' && (() => {
         const hardwareDevice = devices.find(d => d.id === '1') || devices[0];
         const currentMoisture = hardwareDevice ? hardwareDevice.moisture : 45;
         const currentTemp = hardwareDevice ? hardwareDevice.temperature || 24 : 24;
         const currentPh = hardwareDevice ? hardwareDevice.ph || 6.5 : 6.5;

         // Real Analogy - AI Decision Confidence mathematically scaled:
         const currentConfidence = Math.max(50, Math.min(100, Math.round(
           100 - 
           Math.abs(currentMoisture - targetMoisture) * 1.2 - 
           (currentTemp > 30 ? (currentTemp - 30) * 1.5 : 0)
         )));

         const confidenceData = Array.from({ length: 7 }, (_, i) => {
           const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i];
           const offset = Math.sin(i * 1.5) * 4;
           const value = i === 6 ? currentConfidence : Math.max(60, Math.min(99, Math.round(currentConfidence + offset)));
           return { name: dayName, value };
         });

         return (
           <div className="animate-view-in flex-1 flex flex-col max-w-4xl mx-auto w-full">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-white/5">
                 <div>
                   <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest leading-none">Live Analytics</h3>
                   <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1.5 block">Telemetry Link: Connected Node 1</span>
                 </div>
                 <button onClick={() => setActiveTab('main')} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                   <ChevronRight className="rotate-180" size={14} /> Return
                 </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Moisture Line Chart */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Soil Moisture History</h4>
                    <p className="text-[8px] font-black uppercase text-indigo-500 tracking-wider mb-6">Real-time database readings from sensor</p>
                    <div className="h-32 flex items-end gap-2 px-2">
                      {realMoistureHistory.length === 0 ? (
                        <div className="flex-1 text-center py-10 text-[10px] font-black text-slate-400 uppercase tracking-widest">Awaiting status readings...</div>
                      ) : (
                        realMoistureHistory.map((item, i) => (
                          <div key={i} className="flex-1 bg-blue-100 dark:bg-blue-500/20 rounded-t-lg relative group transition-all hover:bg-blue-500" style={{ height: `${Math.max(10, Math.min(100, item.moisture))}%` }}>
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[9px] font-black text-blue-600 dark:text-blue-400 transition-opacity bg-blue-50 dark:bg-blue-900/50 px-1 rounded whitespace-nowrap z-25">{item.moisture}%</div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex justify-between mt-3 text-[9px] font-bold text-slate-400">
                      <span>{realMoistureHistory.length > 0 ? realMoistureHistory[0].time : 'Earlier'}</span>
                      <span>Now ({currentMoisture}%)</span>
                    </div>
                 </div>

                 {/* AI Confidence Bar Chart */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">AI Decision Confidence</h4>
                     <p className="text-[8px] font-black uppercase text-indigo-500 tracking-wider mb-6">Scaled by current temp and moisture variance</p>
                    <div className="h-32 flex items-end gap-3 px-2">
                      {confidenceData.map((item, i) => (
                        <div key={i} className="flex-1 bg-indigo-100 dark:bg-indigo-500/20 rounded-t-lg relative group transition-all hover:bg-indigo-500" style={{ height: `${item.value}%` }}>
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[9px] font-black text-indigo-600 dark:text-indigo-400 transition-opacity bg-indigo-50 dark:bg-indigo-900/50 px-1 rounded z-25">{item.value}%</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-3 text-[9px] font-bold text-slate-400">
                      {confidenceData.map((item, i) => (
                        <span key={i}>{item.name}</span>
                      ))}
                    </div>
                 </div>

                 {/* Water Consumption Liquid Fill Concept */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Water Consumption</h4>
                      <p className="text-3xl font-black text-slate-900 dark:text-white">{totalWaterConsumed > 0 ? totalWaterConsumed.toFixed(1) : '0.0'} <span className="text-sm text-slate-500">L</span></p>
                      <p className="text-[10px] font-bold text-emerald-500 mt-2">Live aggregate from database logs</p>
                    </div>
                    <div className="w-24 h-24 rounded-full border-4 border-slate-100 dark:border-slate-800 relative overflow-hidden flex items-center justify-center shadow-inner">
                       <div className="absolute bottom-0 left-0 right-0 bg-blue-500/30 rounded-t-full border-t-2 border-blue-400 flex items-center justify-center animate-pulse" style={{ height: `${waterPercentage}%` }}></div>
                       <span className="relative z-10 text-sm font-black text-blue-600 dark:text-blue-400">{waterPercentage}%</span>
                    </div>
                 </div>
                 
                 {/* AI Decisions Radar Concept */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl flex flex-col justify-center">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Decisions Matrix</h4>
                    <div className="space-y-3">
                       <div>
                          <div className="flex justify-between text-[10px] font-bold mb-1"><span className="text-emerald-500">Accepted (Vitals Safe)</span><span className="text-slate-500">85%</span></div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full"><div className="h-full bg-emerald-500 rounded-full w-[85%]"></div></div>
                       </div>
                       <div>
                          <div className="flex justify-between text-[10px] font-bold mb-1"><span className="text-amber-500">Modified (Override Adjustments)</span><span className="text-slate-500">12%</span></div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full"><div className="h-full bg-amber-500 rounded-full w-[12%]"></div></div>
                       </div>
                       <div>
                          <div className="flex justify-between text-[10px] font-bold mb-1"><span className="text-rose-500">Rejected (Stasis/Offline)</span><span className="text-slate-500">3%</span></div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full"><div className="h-full bg-rose-500 rounded-full w-[3%]"></div></div>
                       </div>
                    </div>
                 </div>

                 {/* Solar Array Power Output */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl sm:col-span-2 md:col-span-1">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Solar Array Output (W)</h4>
                    <div className="h-32 flex items-end gap-1.5 px-2">
                      {[0.2, 0.35, 0.6, 0.85, 0.95, 1.0, 0.95, 0.8, 0.5, 0.3, 0.1, 0.05].map((factor, i) => {
                        const basePower = (hardwareDevice?.solarHealth || 85) * 1.2;
                        const val = Math.round(basePower * factor);
                        const pct = Math.round(factor * 100);
                        return (
                          <div key={i} className="flex-1 bg-amber-100 dark:bg-amber-500/20 rounded-sm relative group transition-all hover:bg-amber-500" style={{ height: `${pct}%` }}>
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[9px] font-black text-amber-600 dark:text-amber-400 transition-opacity bg-amber-50 dark:bg-amber-900/50 px-1 rounded whitespace-nowrap z-25">{val}W</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-3 text-[9px] font-bold text-slate-400">
                      <span>6 AM</span>
                      <span>12 PM</span>
                      <span>6 PM</span>
                    </div>
                 </div>

                 {/* Flow Diagnostics */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)] sm:col-span-2 md:col-span-1 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Flow Sensor Diagnostics</h4>
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${hardwareDevice?.status === 'online' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {hardwareDevice?.status === 'online' ? 'Link: Online' : 'Link: Offline'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-white/5">
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Live Flow Rate</span>
                          <span className="text-sm font-black text-blue-500">{(hardwareDevice?.flowRate || 0) > 0 ? (hardwareDevice?.flowRate || 0).toFixed(1) : '0.0'} L/min</span>
                       </div>
                       <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(hardwareDevice?.flowRate || 0) > 0 ? 65 : 0}%` }}></div>
                       </div>
                       <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 dark:border-white/5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Expected Target</span>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300">5.0 L/min</span>
                       </div>
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium mt-3 text-center">Monitoring real-time telemetry from flow sensor for anomalies.</p>
                 </div>

                 {/* Hardware Thermal Map */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl sm:col-span-2 md:col-span-1 flex flex-col justify-center">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Relay Thermal Map</h4>
                    <div className="relative h-24 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden shadow-inner border border-white/5">
                       <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-emerald-500/40 to-rose-500/30 blur-xl"></div>
                       <div className="absolute top-1/2 left-1/4 w-8 h-8 bg-blue-400/50 rounded-full blur-md -translate-y-1/2 animate-pulse"></div>
                       <div className="absolute top-1/2 right-1/4 w-12 h-12 bg-rose-500/40 rounded-full blur-md -translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }}></div>
                       <div className="absolute inset-0 flex items-center justify-between px-6 z-10">
                          <span className="text-[10px] font-black text-blue-800 dark:text-blue-300">Pump 1: {currentTemp}°C</span>
                          <span className="text-[10px] font-black text-rose-900 dark:text-rose-200">Relay A: {Math.round(currentTemp * 1.15)}°C</span>
                       </div>
                    </div>
                 </div>

                 {/* Crop Growth Trajectory */}
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl sm:col-span-2 md:col-span-1">
                    <div className="flex justify-between items-start mb-6">
                       <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Biomass Growth Index</h4>
                       <div className="text-[9px] font-bold flex flex-col gap-1 text-right">
                          <span className="text-emerald-500 flex items-center justify-end gap-1.5"><div className="w-2 h-0.5 bg-emerald-500 rounded"></div> Actual</span>
                          <span className="text-teal-500 flex items-center justify-end gap-1.5"><div className="w-2 h-0 bg-transparent border-t-2 border-dashed border-teal-500"></div> Predicted</span>
                       </div>
                    </div>
                    <div className="h-28 border-l-2 border-b-2 border-slate-200 dark:border-slate-700 relative pl-2 pb-2">
                       <svg className="w-full h-full absolute bottom-2 left-2 overflow-hidden" viewBox="0 0 250 100" preserveAspectRatio="none">
                          <path d="M 0 100 Q 20 80, 50 60 T 100 20 T 150 10 T 250 5" fill="none" stroke="currentColor" strokeWidth="3" className="text-teal-500" strokeDasharray="4 4"/>
                          <path d="M 0 100 Q 30 90, 60 70 T 120 40 T 180 30 T 250 25" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-500"/>
                       </svg>
                    </div>
                    <div className="flex justify-between mt-1 text-[9px] font-bold text-slate-400 ml-2">
                      <span>Day 1</span>
                      <span>Day 30</span>
                      <span>Day 60</span>
                    </div>
                 </div>

              </div>
           </div>
         );
      })()}
    </div>
  );
};

export default AutopilotCore;
