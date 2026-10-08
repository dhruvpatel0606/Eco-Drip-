import React, { useState } from 'react';
// Added missing ArrowRight icon to the lucide-react import list
import { Droplets, Activity, Zap, Play, Loader2, Thermometer, Wind, Target, Sprout, Plus, Settings2, X, Check, Heart, Trash2, Sparkles, AlertCircle, ShieldAlert, ShieldCheck, FileText, Download, Share2, Wifi, Battery, TrendingUp, Power, ArrowRight } from 'lucide-react';
import { Device, WeatherData, Crop, NavTab } from '../types';
import { chatWithBotanist } from '../aiCore';
import { supabase } from '../src/lib/supabase';

interface DashboardProps { 
  devices: Device[]; 
  weather: WeatherData; 
  crops: Crop[];
  setCrops: React.Dispatch<React.SetStateAction<Crop[]>>;
  onWaterAll: () => void; 
  isWatering: boolean; 
  isPumpActive?: boolean;
  onTogglePump?: (state: boolean) => void;
  onGainXp?: (amount: number) => void;
  onNavigate?: (tab: NavTab) => void;
}

const MiniOrbit = ({ children, size = 48, orbitScale = 1.3, color = "orange" }: { children?: React.ReactNode, size?: number, orbitScale?: number, color?: string }) => {
  const colorClass = color === "orange" ? "orange-500" : "teal-500";
  const shadowClass = color === "orange" ? "#f97316" : "#14b8a6";
  
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div 
        className={`absolute rounded-full border border-${colorClass}/10`} 
        style={{ width: size * orbitScale, height: size * orbitScale }}
      ></div>
      <div 
        className="absolute animate-[spin_3s_linear_infinite]" 
        style={{ width: size * orbitScale, height: size * orbitScale }}
      >
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-${colorClass} rounded-full shadow-[0_0_8px_${shadowClass}]`}></div>
      </div>
      <div className="relative z-10 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ devices, weather, crops, setCrops, onWaterAll, isWatering, isPumpActive, onTogglePump, onGainXp, onNavigate }) => {
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isEditingCrops, setIsEditingCrops] = useState(false);
  const [newCropName, setNewCropName] = useState('');
  const [newCropVariety, setNewCropVariety] = useState('');

  // Global AI Scan State
  const [isScanningAll, setIsScanningAll] = useState(false);
  const [globalReport, setGlobalReport] = useState<string | null>(null);

  // Health Report State
  const [showHealthReport, setShowHealthReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  


  const activeDevices = devices.filter(d => d.status === 'online');
  const targetDevices = activeDevices.length > 0 ? activeDevices : devices;

  const avgMoisture = Math.round(targetDevices.reduce((acc, d) => acc + (Number(d.moisture) || 50), 0) / (targetDevices.length || 1));
  const hasLiveHumidity = targetDevices.some(d => d.humidity !== undefined);
  const avgHumidity = hasLiveHumidity 
    ? Math.round(targetDevices.reduce((acc, d) => acc + (Number(d.humidity) || 0), 0) / (targetDevices.filter(d => d.humidity !== undefined).length || 1))
    : weather.humidity;
  const avgHealth = crops.length ? Math.round(crops.reduce((a,c)=>a+c.health,0)/crops.length) : 100;
  const onlineCount = devices.filter(d => d.status === 'online').length;
  
  const avgPh = (targetDevices.reduce((acc, d) => acc + (Number(d.ph) || 7.0), 0) / (targetDevices.length || 1)).toFixed(1);
  const avgBatt = Math.round(targetDevices.reduce((acc, d) => acc + (Number(d.battery) || 100), 0) / (targetDevices.length || 1));

  const handleAddCrop = async () => {
    if (!newCropName.trim()) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newCrop: Crop = {
      id: `c${Date.now()}`,
      name: newCropName,
      variety: newCropVariety || 'Standard Hybrid',
      status: 'Optimal',
      health: 100,
      plantedDate: new Date().toISOString().split('T')[0],
      daysToHarvest: 45
    };

    try {
      const { error } = await supabase.from('crops').insert([{
        id: newCrop.id,
        user_id: user.id,
        name: newCrop.name,
        variety: newCrop.variety,
        status: newCrop.status,
        health: newCrop.health,
        planted_date: newCrop.plantedDate,
        days_to_harvest: newCrop.daysToHarvest
      }]);
      
      if (error) throw error;
      
      setCrops([...crops, newCrop]);
      setNewCropName('');
      setNewCropVariety('');
      setIsCropModalOpen(false);
      if (onGainXp) onGainXp(150);
    } catch (e) {
      console.error("Add crop error:", e);
      alert("Failed to sync crop to cloud.");
    }
  };

  const removeCrop = async (id: string) => {
    try {
      const { error } = await supabase.from('crops').delete().eq('id', id);
      if (error) throw error;
      setCrops(crops.filter(c => c.id !== id));
    } catch (e) {
      console.error("Delete crop error:", e);
      alert("Failed to delete crop from cloud.");
    }
  };

  const runGlobalAIScan = async () => {
    if (crops.length === 0) return;
    setIsScanningAll(true);
    setGlobalReport(null);
    
    try {
      const cropData = crops.map(c => `${c.name} (${c.variety}): ${c.health}% Health, Status: ${c.status}`).join('. ');
      const prompt = `Perform a comprehensive biological audit of my entire garden. Here are the crops: ${cropData}. Analyze the overall condition and provide a strategic summary (under 80 words).`;
      const res = await chatWithBotanist(prompt, "Botanical Audit Mode");
      setGlobalReport(res);
    } catch (e: unknown) {
      setGlobalReport("Biological audit offline. Neural Core requires active cloud link for garden-wide analysis.");
    } finally {
      setIsScanningAll(false);
    }
  };

  return (
    <div className="space-y-8 animate-view-in no-scrollbar pb-10">
      {/* Weather Header */}
      <section className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden group border border-white/5">
        <div className="flex justify-between items-start relative z-10">
          <div>
            <h2 className="text-7xl font-extrabold tracking-tighter leading-none">{weather.temp}°</h2>
            <p className="text-[#14b8a6] font-black uppercase text-[10px] tracking-[0.3em] mt-3">ET Index: {weather.etIndex} mm/day</p>
            {weather.aqi !== undefined && (
              <p className="text-amber-400 font-black uppercase text-[9px] tracking-[0.2em] mt-1">
                AQI: {weather.aqi} ({
                  weather.aqi <= 50 ? 'Good' : 
                  weather.aqi <= 100 ? 'Moderate' : 
                  weather.aqi <= 150 ? 'Sensitive Unhealthy' : 
                  weather.aqi <= 200 ? 'Unhealthy' : 
                  weather.aqi <= 300 ? 'Very Unhealthy' : 'Hazardous'
                })
              </p>
            )}
            {/* Current Rain */}
            {weather.rainNow !== undefined && (
              <p className="text-blue-400 font-black uppercase text-[9px] tracking-[0.2em] mt-1">Rain: {weather.rainNow} mm</p>
            )}
            {/* Rain Alert */}
            {weather.rainAlert && (
              <p className="text-red-500 font-black uppercase text-[9px] tracking-[0.2em] mt-1 flex items-center">
                <AlertCircle className="mr-1" size={12} /> {weather.rainAlert}
              </p>
            )}
          </div>
          <div className="text-right flex flex-col items-end gap-1.5">
             <Wind size={20} className="text-slate-400"/>
             <p className="font-extrabold text-sm tracking-wider text-slate-200">{weather.windSpeed} km/h</p>
          </div>
        </div>

        <div className="mt-8 flex justify-between gap-1 border-t border-white/5 pt-6 relative z-10 overflow-x-auto no-scrollbar">
          <ForecastMini 
            day="Now" 
            icon={weather.icon || '☀️'} 
            temp={weather.temp} 
            active 
          />
          {weather.forecast.slice(0, 5).map((f, i) => (
            <ForecastMini key={i} day={f.day} icon={f.icon} temp={f.temp} />
          ))}
        </div>
      </section>

      {/* Hydraulic & Health Command Center */}
      <div className="grid grid-cols-2 gap-4">
        {/* Persistent Pump Toggle Card (ORANGE THEME) */}
        <div className="p-6 rounded-[3rem] bg-[#0c1421] border border-orange-500/10 shadow-2xl flex flex-col justify-between items-center text-center relative overflow-hidden transition-all active:scale-[0.98]">
           <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent"></div>
           
           <MiniOrbit size={64} orbitScale={1.4} color="orange">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isPumpActive ? 'bg-orange-600 text-white shadow-[0_0_25px_rgba(249,115,22,0.4)]' : 'bg-slate-800 text-slate-500'}`}>
                 <Zap size={28} className={isPumpActive ? 'animate-pulse' : ''} />
              </div>
           </MiniOrbit>

           <div className="mt-6">
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em] mb-1">Hydraulic Core</p>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Manual Override</p>
           </div>

           <button 
             onClick={() => onTogglePump?.(!isPumpActive)}
             className={`mt-6 w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest transition-all ${isPumpActive ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}
           >
              {isPumpActive ? <Power size={14} strokeWidth={3} /> : <Zap size={14} strokeWidth={3} />}
              {isPumpActive ? "DEACTIVATE" : "ACTIVATE"}
           </button>
        </div>

        {/* System Health Card */}
        <button onClick={() => setShowHealthReport(true)} className="p-6 rounded-[3rem] flex flex-col justify-between liquid-glass transition-all active:scale-95 text-slate-800 dark:text-white group">
          <div className="flex flex-col items-center text-center gap-4">
            <MiniOrbit size={64} orbitScale={1.4} color="teal">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center">
                <FileText size={24} />
              </div>
            </MiniOrbit>
            <div className="mt-2">
              <p className="font-black text-[10px] uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400">Health Audit</p>
              <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Full Ecosystem Scan</p>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-tighter group-hover:text-teal-500 transition-colors">
            Tap to analyze <TrendingUp size={12} />
          </div>
        </button>
      </div>

      {/* AI AUTOPILOT ENTRY POINT */}
      <div className="px-1 mt-6 mb-2">
        <button 
          onClick={() => onNavigate?.(NavTab.Autopilot as any)} 
          className="w-full p-8 rounded-[3rem] flex items-center justify-between transition-all active:scale-95 bg-slate-900 dark:bg-[#0c1421] border border-white/5 relative overflow-hidden group shadow-xl hover:shadow-indigo-500/10"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-screen"></div>
          
          <div className="relative z-10 flex items-center gap-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center border backdrop-blur-md transition-all bg-white/5 border-white/10 group-hover:border-indigo-400 group-hover:bg-indigo-500/10">
              <ShieldCheck className="text-slate-400 group-hover:text-indigo-400 transition-colors" size={28} />
            </div>
            <div className="text-left">
              <p className="font-black text-2xl tracking-tighter leading-none italic uppercase drop-shadow-md text-slate-300 group-hover:text-white transition-colors">AI Autopilot</p>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-1 text-slate-500 group-hover:text-indigo-400 transition-colors">Configure Swarm</p>
            </div>
          </div>
          <ArrowRight size={32} strokeWidth={3} className="opacity-30 text-slate-400 group-hover:text-indigo-400 transition-colors" />
        </button>
      </div>

      {/* INSTANT BOOST BUTTON (BURST) */}
      <div className="px-1">
        <button 
          onClick={onWaterAll} 
          disabled={isWatering} 
          className={`w-full p-8 rounded-[3rem] flex items-center justify-between transition-all active:scale-95 ${isWatering ? 'bg-slate-100 text-slate-400' : 'bg-teal-600 text-white shadow-2xl shadow-teal-600/30'}`}
        >
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
              {isWatering ? <Loader2 className="animate-spin" size={28} /> : <Play fill="white" size={28} />}
            </div>
            <div className="text-left">
              <p className="font-black text-2xl tracking-tighter leading-none italic uppercase">Instant Boost</p>
              <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.4em] mt-1">Hydrate All Zones • 4s Purge</p>
            </div>
          </div>
          <ArrowRight size={32} strokeWidth={3} className="opacity-30" />
        </button>
      </div>

      {/* VITALITY NETWORK */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-3">
           <div>
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
                <Sprout size={14} className="text-teal-600" /> Vitality Network
              </h3>
              <p className="text-[8px] font-black text-teal-600 uppercase tracking-widest mt-1.5">{crops.length} Species Online</p>
           </div>
           <div className="flex gap-2">
              <button onClick={runGlobalAIScan} disabled={isScanningAll || crops.length === 0} className={`p-3 rounded-2xl transition-all ${isScanningAll ? 'bg-teal-500 text-white animate-pulse' : 'bg-white dark:bg-white/5 text-teal-600 dark:text-teal-400 border border-slate-100 dark:border-white/5 shadow-sm'}`}>
                {isScanningAll ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16}/>}
              </button>
              <button onClick={() => setIsEditingCrops(!isEditingCrops)} className={`p-3 rounded-2xl transition-all ${isEditingCrops ? 'bg-amber-100 text-amber-600' : 'bg-white dark:bg-white/5 text-slate-400 border border-slate-100 dark:border-white/5 shadow-sm'}`}>
                <Settings2 size={16}/>
              </button>
              <button onClick={() => setIsCropModalOpen(true)} className="p-3 bg-slate-900 dark:bg-teal-600 text-white rounded-2xl shadow-xl active:scale-90 transition-all">
                <Plus size={16}/>
              </button>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {crops.map((crop) => (
            <div key={crop.id} className="liquid-glass p-6 rounded-[3rem] transition-all duration-500 group animate-view-in">
              {isEditingCrops && (
                <button onClick={() => removeCrop(crop.id)} className="absolute -top-1 -right-1 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg z-20 border-2 border-white">
                  <Trash2 size={12} />
                </button>
              )}
              
              <div className="flex justify-between items-start mb-6">
                 <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${crop.health > 80 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-500'}`}>
                    <Heart size={18} fill={crop.health > 80 ? 'currentColor' : 'none'} className={crop.health > 80 ? 'opacity-30' : ''}/>
                 </div>
                 <span className={`text-[7px] font-black uppercase px-2 py-1 rounded-full border ${crop.status === 'Optimal' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                    {crop.status}
                 </span>
              </div>

              <h4 className="font-black text-slate-800 dark:text-white text-sm tracking-tight mb-1 truncate">{crop.name}</h4>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-6 truncate">{crop.variety}</p>
              
              <div className="space-y-2">
                 <div className="flex justify-between items-end">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Health Index</span>
                    <span className="text-xs font-black text-slate-900 dark:text-white">{crop.health}%</span>
                 </div>
                 <div className="h-1.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${crop.health > 80 ? 'bg-teal-500' : 'bg-rose-400'}`} style={{ width: `${crop.health}%` }}></div>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Metrics Node Grid */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard icon={<Activity className="text-teal-600" />} label="Soil moisture" value={`${avgMoisture}%`} />
        <MetricCard icon={<Droplets className="text-blue-500" />} label="Ecosystem Humidity" value={`${avgHumidity}%`} />
        <MetricCard icon={<Zap className="text-amber-500" />} label="Power Grid" value="Online" />
        <MetricCard icon={<Thermometer className="text-rose-500" />} label="Avg pH Level" value={avgPh} />
      </div>

      {/* Health Audit Modal */}
      {showHealthReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-3xl animate-fade-in">
           <div className="liquid-glass w-full max-w-sm max-h-[85vh] rounded-[4rem] overflow-hidden flex flex-col border border-white/20 shadow-2xl">
              <div className="px-8 py-8 flex justify-between items-center shrink-0 border-b border-white/10">
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter italic leading-none">Global Health Audit</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">ECODRIP NEURAL CORE • V5.0</p>
                 </div>
                 <button onClick={() => setShowHealthReport(false)} className="w-12 h-12 flex items-center justify-center bg-white/10 text-slate-400 rounded-2xl active:scale-90 transition-all">
                   <X size={24} strokeWidth={3} />
                 </button>
              </div>
              <div className="flex-grow overflow-y-auto no-scrollbar p-8 space-y-8">
                 <div className="p-6 bg-slate-900 rounded-[3rem] text-white relative shadow-2xl border-l-4 border-teal-500">
                    <div className="flex items-center gap-2 mb-3">
                       <ShieldCheck size={14} className="text-teal-400"/>
                       <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-400">AI AGRI-INSIGHT</h4>
                    </div>
                    <p className="text-sm font-bold leading-relaxed italic opacity-95">
                       {isScanningAll 
                          ? "Neural Core is actively scanning all nodes and ecosystems..." 
                          : globalReport 
                            ? `"${globalReport}"` 
                            : `"Ecosystem vigor is currently at ${avgHealth}%. Soil chemistry has stabilized. Local telemetry suggest optimized hydration cycles for ${crops.length} species."`}
                    </p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <ReportStat label="VIGOR INDEX" val={`${avgHealth}%`} color="text-teal-600 dark:text-teal-400" />
                    <ReportStat label="NETWORK" val={`${onlineCount}/${devices.length}`} color="text-slate-900 dark:text-white" />
                 </div>
              </div>
              <div className="p-8 border-t border-white/10 shrink-0">
                 <button onClick={() => setShowHealthReport(false)} className="w-full py-5 bg-slate-900 dark:bg-teal-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">Dismiss Audit</button>
              </div>
           </div>
        </div>
      )}

      {/* Enroll Species Modal */}
      {isCropModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-3xl p-6 animate-fade-in">
           <div className="liquid-glass w-full max-w-sm rounded-[3.5rem] p-10 shadow-2xl animate-view-in border-t-8 border-teal-500">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-2xl font-black text-slate-900 dark:text-white italic tracking-tighter">Enroll Species</h3>
                 <button onClick={() => setIsCropModalOpen(false)} className="p-3 bg-white/10 text-slate-400 rounded-2xl active:scale-90 transition-all"><X size={20} strokeWidth={3}/></button>
              </div>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Common Name</label>
                    <input 
                        type="text" 
                        value={newCropName} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCropName(e.target.value)} 
                        placeholder="e.g. Tomato" 
                        className="w-full p-5 bg-white/50 dark:bg-white/5 border border-white/10 rounded-[2rem] font-bold outline-none text-sm dark:text-white transition-all focus:border-teal-500" 
                    />
                 </div>
                 <button 
                    onClick={handleAddCrop} 
                    className="w-full py-6 bg-slate-900 dark:bg-teal-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest active:scale-95 transition-all shadow-2xl mt-4"
                 >
                    Establish Bio-Link
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

// Internal Components
const ReportStat = ({ label, val, color }: { label: string; val: string | number; color: string }) => (
  <div className="bg-white/40 dark:bg-white/5 p-5 rounded-[2.5rem] border border-white/10 text-center">
    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1.5">{label}</p>
    <p className={`text-2xl font-black ${color} tracking-tighter`}>{val}</p>
  </div>
);

const ForecastMini = ({ day, icon, temp, active }: { day: string; icon: string | React.ReactNode; temp: number; active?: boolean }) => {
  const isUrl = typeof icon === 'string' && (icon.startsWith('http') || icon.startsWith('//'));
  return (
    <div className={`flex flex-col items-center px-4 py-5 rounded-[1.8rem] transition-all min-w-[64px] ${
      active 
        ? 'bg-[#182335] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/5' 
        : 'opacity-50 hover:opacity-80'
    }`}>
      <span className="text-[9px] font-black uppercase tracking-wider mb-3 text-slate-400">{day}</span>
      {isUrl ? (
        <img 
          src={icon.startsWith('//') ? `https:${icon}` : icon} 
          alt="" 
          className="w-7 h-7 object-contain mb-3" 
        />
      ) : (
        <span className="text-xl mb-3">{icon}</span>
      )}
      <span className="font-black text-sm text-white">{temp}°</span>
    </div>
  );
};

const MetricCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div className="liquid-glass p-6 rounded-[3rem] transition-all hover:scale-[1.02] cursor-pointer">
    <div className="mb-4 bg-white/10 dark:bg-white/5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0">{icon}</div>
    <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{value}</p>
    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-2">{label}</p>
  </div>
);

export default Dashboard;
