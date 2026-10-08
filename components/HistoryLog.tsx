import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Droplet, 
  TrendingDown, 
  Activity, 
  Zap, 
  Save, 
  History, 
  TrendingUp, 
  ChevronDown,
  Check
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  AreaChart, 
  Area, 
  ReferenceLine,
  PieChart, 
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../src/lib/supabase';
import { Device } from '../types';

type TimeFilter = '7D' | '30D' | '90D' | 'All';

const FILTER_LABELS: Record<TimeFilter, string> = {
  '7D': 'Last 7 Days',
  '30D': 'Last 30 Days',
  '90D': 'Last 90 Days',
  'All': 'All Time'
};

const COLORS = ['#14b8a6', '#f97316', '#3b82f6', '#22c55e'];

const StatCard: React.FC<{ icon: any, label: string, value: string, color: string, className?: string }> = ({ icon: Icon, label, value, color, className = "" }) => (
  <div className={`bg-slate-900 p-4 rounded-2xl border border-white/5 flex flex-col justify-between h-28 relative overflow-hidden ${className}`}>
    <Icon className={`absolute -right-2 -top-2 opacity-10 w-16 h-16 ${color}`} />
    <div className="flex justify-between items-start">
        <Icon size={16} className={color} />
    </div>
    <div>
        <p className="text-xl font-bold text-white tracking-tight leading-none mb-1">{value}</p>
        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
    </div>
  </div>
);

interface HistoryLogProps {
  devices?: Device[];
}

const HistoryLog: React.FC<HistoryLogProps> = ({ devices = [] }) => {
  const [filter, setFilter] = useState<TimeFilter>('7D');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [limit, setLimit] = useState(5);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState({
    waterUsed: '0L',
    waterSaved: '0L',
    irrigations: '0',
    avgMoisture: '0%'
  });

  const [usageData, setUsageData] = useState<any[]>([]);
  const [moistureData, setMoistureData] = useState<any[]>([]);
  const [irrigationTypes, setIrrigationTypes] = useState<any[]>([]);
  const [deviceHealth, setDeviceHealth] = useState<any[]>([]);

  const [logFilter, setLogFilter] = useState<'All' | 'Irrigation' | 'AI'>('All');
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const liveWaterUsed = useMemo(() => {
    return devices.reduce((sum, d) => sum + (d.waterUsed || 0), 0);
  }, [devices]);

  const displayWaterUsed = useMemo(() => {
    if (liveWaterUsed > 0) {
      return `${liveWaterUsed.toFixed(1)}L`;
    }
    return stats.waterUsed;
  }, [stats.waterUsed, liveWaterUsed]);

  const displayWaterSaved = useMemo(() => {
    if (liveWaterUsed > 0) {
      return `${(liveWaterUsed * 0.4).toFixed(0)}L`;
    }
    return stats.waterSaved;
  }, [stats.waterSaved, liveWaterUsed]);

  const mergedUsageData = useMemo(() => {
    if (liveWaterUsed === 0) return usageData;
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    let found = false;
    const updated = usageData.map(d => {
      if (d.name === todayName) {
        found = true;
        return { ...d, liters: parseFloat(liveWaterUsed.toFixed(1)) };
      }
      return d;
    });
    if (!found && usageData.length > 0) {
      updated[updated.length - 1] = { ...updated[updated.length - 1], liters: parseFloat(liveWaterUsed.toFixed(1)) };
    }
    return updated;
  }, [usageData, liveWaterUsed]);

  const liveMoisture = useMemo(() => {
    const active = devices.filter(d => d.status === 'online');
    const targets = active.length > 0 ? active : devices;
    if (targets.length === 0) return 0;
    return Math.round(targets.reduce((sum, d) => sum + (Number(d.moisture) || 50), 0) / targets.length);
  }, [devices]);

  const displayMoisture = useMemo(() => {
    if (liveMoisture > 0) {
      return `${liveMoisture}%`;
    }
    return stats.avgMoisture;
  }, [stats.avgMoisture, liveMoisture]);

  const mergedMoistureData = useMemo(() => {
    if (devices.length === 0 || liveMoisture === 0) return moistureData;
    const updated = [...moistureData];
    if (updated.length > 0) {
      updated[updated.length - 1] = { ...updated[updated.length - 1], moisture: liveMoisture };
    }
    return updated;
  }, [moistureData, liveMoisture, devices]);

  const liveHumidity = useMemo(() => {
    const active = devices.filter(d => d.status === 'online');
    const targets = active.length > 0 ? active : devices;
    const valid = targets.filter(d => d.humidity !== undefined);
    if (valid.length === 0) return 0;
    return Math.round(valid.reduce((sum, d) => sum + (Number(d.humidity) || 0), 0) / valid.length);
  }, [devices]);

  const displayHumidity = useMemo(() => {
    if (liveHumidity > 0) {
      return `${liveHumidity}%`;
    }
    return '60%';
  }, [liveHumidity]);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'All') return logs;
    if (logFilter === 'Irrigation') return logs.filter(l => l.action === 'IRRIGATION_EVENT');
    if (logFilter === 'AI') return logs.filter(l => l.action?.includes('AI') || l.action === 'ADVICE_GENERATED');
    return logs;
  }, [logs, logFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    const startDate = new Date();
    if (filter === '7D') startDate.setDate(now.getDate() - 7);
    else if (filter === '30D') startDate.setDate(now.getDate() - 30);
    else if (filter === '90D') startDate.setDate(now.getDate() - 90);
    else startDate.setFullYear(now.getFullYear() - 5);

    try {
      const [logsRes, wateringRes, sensorRes, devicesRes] = await Promise.all([
        supabase.from('activity_logs')
          .select('*')
          .eq('user_id', user.id)
          .not('action', 'in', '("NAV_CHANGE","TAB_SWITCH")')
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false }),
        supabase.from('watering_history').select('*').eq('user_id', user.id).gte('created_at', startDate.toISOString()).order('created_at', { ascending: true }),
        supabase.from('sensor_readings').select('*').eq('user_id', user.id).gte('created_at', startDate.toISOString()).order('created_at', { ascending: true }),
        supabase.from('devices').select('*').eq('user_id', user.id)
      ]);

      if (logsRes.data) setLogs(logsRes.data);

      if (wateringRes.data) {
        // Create an aggregation for the last 7 days specifically
        const last7Days: any = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          last7Days[dateStr] = 0;
        }

        wateringRes.data.forEach((curr: any) => {
          const date = curr.created_at.split('T')[0];
          if (last7Days.hasOwnProperty(date)) {
            const liters = parseFloat(curr.water_used.replace(/[^0-9.]/g, '')) || 0;
            last7Days[date] += liters;
          }
        });
        
        const chartData = Object.entries(last7Days).map(([date, liters]) => ({
          name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          liters: parseFloat((liters as number).toFixed(1))
        }));
        
        setUsageData(chartData);

        const totalUsed = wateringRes.data.reduce((acc, curr) => acc + (parseFloat(curr.water_used.replace(/[^0-9.]/g, '')) || 0), 0);
        setStats(prev => ({
          ...prev,
          waterUsed: `${totalUsed.toFixed(1)}L`,
          waterSaved: `${(totalUsed * 0.4).toFixed(0)}L`,
          irrigations: wateringRes.data.length.toString()
        }));

        const typesCount = wateringRes.data.reduce((acc: any, curr: any) => {
          const details = (curr.details || '').toLowerCase();
          let type = 'Manual';
          if (details.includes('schedule') || details.includes('plan')) type = 'Scheduled';
          else if (details.includes('ai') || details.includes('autopilot')) type = 'AI';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
        setIrrigationTypes(Object.entries(typesCount).map(([name, value]) => ({ name, value })));
      }

      if (sensorRes.data) {
        // Sample 7 points from the available data across the period
        let moistureTrend = [];
        if (sensorRes.data.length >= 7) {
          const step = Math.floor(sensorRes.data.length / 7);
          for (let i = 0; i < 7; i++) {
            const l = sensorRes.data[i * step];
            moistureTrend.push({
              time: new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              moisture: l.moisture !== undefined ? Number(l.moisture) : 40
            });
          }
        } else {
          moistureTrend = sensorRes.data.map((l: any) => {
            return {
              time: new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              moisture: l.moisture !== undefined ? Number(l.moisture) : 40
            };
          });
        }
        
        while (moistureTrend.length < 7) {
          const lastVal = moistureTrend.length > 0 ? moistureTrend[moistureTrend.length - 1].moisture : 45;
          moistureTrend.push({ time: `${moistureTrend.length + 1}`, moisture: lastVal });
        }
        
        setMoistureData(moistureTrend);
        
        const avgM = moistureTrend.length > 0 ? Math.round(moistureTrend.reduce((a, b: any) => a + b.moisture, 0) / moistureTrend.length) : 0;
        setStats(prev => ({ ...prev, avgMoisture: `${avgM}%` }));
      }
      if (devicesRes.data && devicesRes.data.length > 0) {
        setDeviceHealth(devicesRes.data.map((d: any) => ({
          name: d.name,
          Battery: d.battery || 85,
          Signal: d.signal_strength || 90,
          Solar: d.solar_health || 95
        })));
      } else {
        setDeviceHealth([{ name: 'Hub', Battery: 85, Signal: 88, Solar: 92 }]);
      }

    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[420px] mx-auto space-y-3 pb-24 px-1 animate-fade-in overflow-x-hidden">
      
      {/* Header & Dropdown */}
      <div className="flex items-center justify-between px-2 pt-2">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Insights</h2>
        <div className="relative" ref={dropdownRef}>
           <button 
             onClick={() => setIsDropdownOpen(!isDropdownOpen)}
             className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-full text-xs font-bold text-white border border-white/5 active:scale-95 transition-all shadow-lg"
           >
             {FILTER_LABELS[filter]}
             <ChevronDown size={14} className={`transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
           </button>
           
           <AnimatePresence>
             {isDropdownOpen && (
               <motion.div 
                 initial={{ opacity: 0, y: 10, scale: 0.95 }}
                 animate={{ opacity: 1, y: 0, scale: 1 }}
                 exit={{ opacity: 0, y: 10, scale: 0.95 }}
                 className="absolute right-0 mt-2 w-48 bg-slate-900 rounded-2xl shadow-2xl border border-white/5 z-50 overflow-hidden"
               >
                 {(['7D', '30D', '90D', 'All'] as TimeFilter[]).map((f) => (
                   <button
                     key={f}
                     onClick={() => {
                       setFilter(f);
                       setIsDropdownOpen(false);
                     }}
                     className="w-full px-5 py-3 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-800 transition-colors border-b border-white/5 last:border-0"
                   >
                     <span className={filter === f ? 'text-teal-400' : 'text-slate-300'}>{FILTER_LABELS[f]}</span>
                     {filter === f && <Check size={14} className="text-teal-400" />}
                   </button>
                 ))}
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      </div>

      {/* 2x2 Stats */}
      <div className="grid grid-cols-2 gap-3 px-1">
        <StatCard icon={Droplet} label="Water Used" value={displayWaterUsed} color="text-teal-400" />
        <StatCard icon={Save} label="Water Saved" value={displayWaterSaved} color="text-blue-400" />
        <StatCard icon={Zap} label="Irrigations" value={stats.irrigations} color="text-orange-400" />
        <StatCard icon={TrendingUp} label="Avg Moisture" value={displayMoisture} color="text-indigo-400" />
        <StatCard icon={Activity} label="Avg Humidity" value={displayHumidity} color="text-rose-400" className="col-span-2" />
      </div>

      {/* Daily Water Usage Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 p-6 rounded-[2rem] border border-white/5 mx-1"
      >
        <div className="mb-4">
          <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest">Daily Water Usage (Liters)</p>
          <p className="text-[9px] text-slate-500 font-bold mt-1">Real-time volume discharged by physical model flow sensors</p>
        </div>
        <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mergedUsageData} margin={{ left: -20, right: 10 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                    <Bar 
                        dataKey="liters" 
                        fill="#14b8a6" 
                        radius={[6, 6, 2, 2]} 
                        barSize={20}
                        animationDuration={1000}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Moisture Stability Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-slate-900 p-6 rounded-[2rem] border border-white/5 mx-1"
      >
        <div className="mb-4">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Moisture Stability (%)</p>
          <p className="text-[9px] text-slate-500 font-bold mt-1">Tracks soil moisture levels. Red dashed line (25%) is critical dehydration limit.</p>
        </div>
        <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mergedMoistureData} margin={{ left: -20, right: 10 }}>
                    <defs>
                        <linearGradient id="moistureGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#64748b', fontWeight: 'bold' }} dy={5} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                    <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'CRITICAL', position: 'insideTopRight', fill: '#ef4444', fontSize: 7, fontWeight: 'black' }} />
                    <Area 
                        type="monotone" 
                        dataKey="moisture" 
                        stroke="#14b8a6" 
                        strokeWidth={2} 
                        fillOpacity={1} 
                        fill="url(#moistureGrad)" 
                        animationDuration={1500}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Double Row Charts */}
      <div className="grid grid-cols-2 gap-3 px-1">
         <div className="bg-slate-900 p-4 rounded-[2rem] border border-white/5 h-[190px] flex flex-col justify-between">
            <div>
               <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Triggers</p>
               <p className="text-[7px] text-slate-500 font-bold leading-tight mt-0.5">Irrigation trigger origin breakdown</p>
            </div>
            <div className="w-full h-24 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={irrigationTypes.length > 0 ? irrigationTypes : [{ name: 'N/A', value: 1 }]}
                            innerRadius={20}
                            outerRadius={35}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {irrigationTypes.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center text-center">
                    <span className="text-sm font-black text-white leading-none">{stats.irrigations}</span>
                </div>
            </div>
            {/* Custom mini-legend */}
            <div className="flex justify-center gap-1.5 text-[7px] font-black text-slate-400">
               {irrigationTypes.map((t, idx) => (
                  <span key={t.name} className="flex items-center gap-0.5">
                     <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                     {t.name}
                  </span>
               ))}
            </div>
         </div>
         
         <div className="bg-slate-900 p-4 rounded-[2rem] border border-white/5 h-[190px] flex flex-col justify-between">
            <div>
               <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Mesh Diagnostic</p>
               <p className="text-[7px] text-slate-500 font-bold leading-tight mt-0.5">Node signal, battery, solar metrics</p>
            </div>
            <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deviceHealth} layout="vertical" margin={{ left: -15, right: 5, top: 0, bottom: 0 }}>
                        <XAxis type="number" hide domain={[0, 100]} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: '#64748b', fontWeight: 'bold' }} width={40} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                        <Bar dataKey="Signal" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={5} />
                        <Bar dataKey="Battery" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={5} />
                        <Bar dataKey="Solar" fill="#f97316" radius={[0, 4, 4, 0]} barSize={5} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {/* Custom mini-legend */}
            <div className="flex justify-center gap-1.5 text-[7px] font-black text-slate-400">
               <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Sig</span>
               <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>Bat</span>
               <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>Sol</span>
            </div>
         </div>
      </div>

      {/* Logs List */}
      <div className="space-y-4 pt-6 px-1">
        <div className="flex flex-col gap-3 px-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Intelligence & Activity</h3>
            <div className="flex gap-2">
                {(['All', 'Irrigation', 'AI'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => {
                            setLogFilter(tab);
                            setLimit(5);
                        }}
                        className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${
                            logFilter === tab 
                            ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' 
                            : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-white/5'
                        }`}
                    >
                        {tab === 'AI' ? 'AI Advice' : tab}
                    </button>
                ))}
            </div>
        </div>

        <div className="space-y-3 px-1">
            <AnimatePresence initial={false}>
                {filteredLogs.slice(0, limit).map((log, index) => {
                    const isAI = log.action?.includes('AI') || log.action === 'ADVICE_GENERATED' || log.action?.includes('ADVICE');
                    const isExpanded = expandedLogs[log.id];
                    
                    return (
                        <motion.div 
                            key={log.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.02 }}
                            onClick={() => {
                                if (log.details.length > 20) {
                                    setExpandedLogs(prev => ({ ...prev, [log.id]: !prev[log.id] }));
                                }
                            }}
                            className={`bg-slate-900 rounded-[1.5rem] border border-white/5 flex flex-col relative overflow-hidden transition-colors duration-500 ${
                                isExpanded 
                                ? 'bg-slate-800/90 shadow-2xl ring-1 ring-white/10' 
                                : 'active:bg-slate-800 hover:bg-slate-800/40'
                            }`}
                        >
                            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-full transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                                log.action === 'IRRIGATION_EVENT' ? 'bg-teal-500' : 
                                (isAI ? 'bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.6)]' : 'bg-blue-500')
                            } ${isExpanded ? 'w-2 h-full opacity-100' : 'w-1 h-3/4 opacity-70 top-1/2 -translate-y-1/2'}`} />
                            
                            <div className="p-4 flex items-center gap-4 w-full">
                                <motion.div 
                                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 ${
                                    log.action === 'IRRIGATION_EVENT' ? 'bg-teal-500/10 text-teal-400' : 
                                    (isAI ? 'bg-indigo-500/10 text-indigo-400' : 'bg-blue-500/10 text-blue-400')
                                } ${isExpanded ? 'scale-110 shadow-lg ring-2 ring-indigo-500/20' : ''}`}>
                                    {log.action === 'IRRIGATION_EVENT' ? <Droplet size={18} /> : (isAI ? <Activity size={18} className={isExpanded ? 'animate-pulse' : ''} /> : <Zap size={18} />)}
                                </motion.div>
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className={`font-bold text-xs tracking-tight transition-colors duration-300 ${isExpanded ? 'text-teal-400' : 'text-white'}`}>{log.action?.replace('_', ' ')}</h4>
                                        {isAI && <span className="text-[7px] font-black bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-widest border border-indigo-400/20">Neural Advisor</span>}
                                    </div>
                                    {!isExpanded && (
                                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-1 transition-opacity duration-300">
                                            {log.details}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                                    <span className="text-[9px] font-bold text-slate-600 tabular-nums">
                                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </span>
                                    <ChevronDown size={12} className={`text-slate-800 transition-transform duration-500 ${isExpanded ? 'rotate-180 text-teal-500' : ''}`} />
                                </div>
                            </div>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ 
                                            height: 'auto', 
                                            opacity: 1,
                                            transition: {
                                                height: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
                                                opacity: { duration: 0.3, delay: 0.2 }
                                            }
                                        }}
                                        exit={{ 
                                            height: 0, 
                                            opacity: 0,
                                            transition: {
                                                height: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
                                                opacity: { duration: 0.1 }
                                            }
                                        }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-4 pb-5 pt-1">
                                            <div className="p-4 bg-slate-950/60 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-2 opacity-5">
                                                    <Activity size={40} className="text-white" />
                                                </div>
                                                <p className="text-[11px] text-slate-200 leading-relaxed font-medium relative z-10">
                                                    {log.details}
                                                </p>
                                                {isAI && (
                                                    <div className="mt-5 flex gap-3 relative z-10">
                                                        <button className="flex-grow py-3 rounded-xl bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/30 hover:bg-indigo-400 active:scale-[0.98] transition-all">
                                                            EXECUTE ACTION
                                                        </button>
                                                        <button className="px-5 py-3 rounded-xl bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">
                                                            DISMISS
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            {limit < filteredLogs.length && (
                <button 
                    onClick={() => setLimit(prev => prev + 5)}
                    className="w-full py-4 text-[10px] font-bold text-teal-500 uppercase tracking-widest border border-dashed border-teal-500/20 rounded-2xl active:bg-teal-500/5 transition-colors mt-2"
                >
                    Expand More Insights
                </button>
            )}

            {!loading && filteredLogs.length === 0 && (
                <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-dashed border-white/5 italic">
                    <History size={32} className="mx-auto text-slate-800 mb-2 opacity-50" />
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No matching logs found for this cycle</p>
                </div>
            )}
        </div>
      </div>

    </div>
  );
};

export default HistoryLog;
