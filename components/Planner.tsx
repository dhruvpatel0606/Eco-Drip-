import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { Sprout, Star, Clock, Plus, Trash2, Calendar, Target, Zap, Waves, X, Check, Loader2, CloudRain } from 'lucide-react';
import { Device, Schedule, WeatherData, Crop } from '../types';
import { supabase } from '../src/lib/supabase';
import { chatWithBotanist } from '../aiCore';

interface PlannerProps {
  devices: Device[];
  weather: WeatherData;
  crops?: Crop[];
  schedules: Schedule[];
  setSchedules: React.Dispatch<React.SetStateAction<Schedule[]>>;
}

const Planner: React.FC<PlannerProps> = ({ devices, weather, crops = [], schedules, setSchedules }) => {
  const [loading, setLoading] = useState(false);
  
  const isRainPredicted = useMemo(() => {
    return weather.forecast.some(f => f.icon.includes('🌧️') || f.icon.includes('🌦️') || f.icon.includes('⛈️'));
  }, [weather]);
  const [activeTab, setActiveTab] = useState<'schedule' | 'growth'>('schedule');
  const [showAddForm, setShowAddForm] = useState(false);
  const [growthAdvice, setGrowthAdvice] = useState<string | null>(null);
  const [isFetchingAdvice, setIsFetchingAdvice] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const showListener = Keyboard.addListener('keyboardWillShow', () => setIsKeyboardOpen(true));
      const hideListener = Keyboard.addListener('keyboardWillHide', () => setIsKeyboardOpen(false));
      return () => {
        showListener.then(l => l.remove());
        hideListener.then(l => l.remove());
      };
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'growth' && !growthAdvice && crops.length > 0) {
      setIsFetchingAdvice(true);
      const cropContext = crops.map(c => `${c.name} (${c.health}% health, ${c.status})`).join(', ');
      const prompt = `Based on my current crops: ${cropContext}, provide a brief, actionable growth recommendation (max 40 words) for the current season. Focus on nutrient needs or watering adjustments.`;
      
      chatWithBotanist(prompt, "Botanical Planner Module")
        .then(res => setGrowthAdvice(res))
        .catch(() => setGrowthAdvice("Neural connection failed. Please ensure your Gemini API is active."))
        .finally(() => setIsFetchingAdvice(false));
    }
  }, [activeTab, crops, growthAdvice]);

  // Form State
  const [newModuleId, setNewModuleId] = useState(devices[0]?.id || '');
  const [newTime, setNewTime] = useState('08:00');
  const [selectedHour, setSelectedHour] = useState('08');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  const updateNewTime = (hour: string, minute: string, period: 'AM' | 'PM') => {
    let h = parseInt(hour, 10);
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    const hStr = h.toString().padStart(2, '0');
    setNewTime(`${hStr}:${minute}`);
  };

  const [newDuration, setNewDuration] = useState(10);
  const [newDays, setNewDays] = useState<string[]>(() => {
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return [DAYS[new Date().getDay()]];
  });
  const [scheduleType, setScheduleType] = useState<'weekly' | 'date'>('weekly');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });

  const toggleDay = (day: string) => {
    setNewDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleAddSchedule = async () => {
    const daysToSubmit = scheduleType === 'date' ? [selectedDate] : newDays;
    
    if (scheduleType === 'date' && !selectedDate) {
      alert('Please select a date');
      return;
    }

    // Close form modal immediately
    setShowAddForm(false);

    // Create optimistic schedule object
    const tempId = 'temp_' + Date.now();
    const tempSch: Schedule = {
      id: tempId,
      moduleId: newModuleId,
      time: newTime,
      duration: newDuration,
      days: daysToSubmit,
      enabled: true
    };

    // Optimistically update list instantly
    setSchedules(prev => [...prev, tempSch]);

    try {
      // Use getSession first (local, synchronous storage lookup, super fast)
      const { data: { session } } = await supabase.auth.getSession();
      let user = session?.user;
      
      if (!user) {
        // Fallback to getUser (verifies with server)
        const { data: { user: fetchedUser } } = await supabase.auth.getUser();
        user = fetchedUser;
      }

      if (!user) {
        console.error('No authenticated user found');
        setSchedules(prev => prev.filter(s => s.id !== tempId));
        return;
      }

      const newSchObj = {
        user_id: user.id,
        device_id: newModuleId,
        time: newTime,
        duration: newDuration,
        days: daysToSubmit,
        enabled: true
      };

      const { data, error } = await supabase
        .from('watering_schedules')
        .insert([newSchObj])
        .select()
        .single();

      if (data && !error) {
        const mapped: Schedule = {
          id: data.id,
          moduleId: data.device_id,
          time: data.time.substring(0, 5),
          duration: data.duration,
          days: data.days,
          enabled: data.enabled
        };
        // Swap temp schedule with real DB schedule
        setSchedules(prev => prev.map(s => s.id === tempId ? mapped : s));
      } else {
        // Rollback
        console.error('Failed to create schedule:', error);
        setSchedules(prev => prev.filter(s => s.id !== tempId));
      }
    } catch (e) {
      console.error(e);
      setSchedules(prev => prev.filter(s => s.id !== tempId));
    }
  };

  const deleteSchedule = async (id: string) => {
    const originalSchedules = [...schedules];
    
    // Optimistically remove from list instantly
    setSchedules(prev => prev.filter(s => s.id !== id));

    try {
      const { error } = await supabase
        .from('watering_schedules')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete failed:', error);
        setSchedules(originalSchedules);
      }
    } catch (e) {
      console.error(e);
      setSchedules(originalSchedules);
    }
  };

  const toggleSchedule = async (sch: Schedule) => {
    const originalSchedules = [...schedules];
    
    // Optimistically toggle instantly in the UI
    setSchedules(prev => prev.map(s => s.id === sch.id ? {...s, enabled: !s.enabled} : s));

    try {
      const { error } = await supabase
        .from('watering_schedules')
        .update({ enabled: !sch.enabled })
        .eq('id', sch.id);

      if (error) {
        console.error('Toggle failed:', error);
        // Rollback
        setSchedules(originalSchedules);
      }
    } catch (e) {
      console.error(e);
      // Rollback
      setSchedules(originalSchedules);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10 relative">
      <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded-[1.5rem] border border-slate-100 dark:border-white/5 shadow-sm transition-colors">
        <button onClick={() => setActiveTab('schedule')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'schedule' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
          <Clock size={16}/> Scheduling
        </button>
        <button onClick={() => setActiveTab('growth')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'growth' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
          <Sprout size={16}/> AI Predictor
        </button>
      </div>

      {activeTab === 'schedule' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight italic transition-colors">Active Cycles</h2>
            <button 
              onClick={() => setShowAddForm(true)}
              className="w-12 h-12 bg-slate-900 dark:bg-teal-600 text-white rounded-[1.2rem] flex items-center justify-center shadow-xl active:scale-90 transition-all hover:bg-teal-600"
            >
              <Plus size={24}/>
            </button>
          </div>

          <div className="space-y-4">
            {schedules.map(sch => {
              const device = devices.find(d => d.id === sch.moduleId);
              return (
                <div key={sch.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-4 group animate-slide-up transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${sch.enabled ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500'}`}>
                        <Clock size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 dark:text-white text-lg leading-tight">{device?.name || 'Unknown Module'}</h4>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{sch.time} • {sch.duration} min</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => deleteSchedule(sch.id)}
                        className="p-3 shrink-0 bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 rounded-xl hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={16}/>
                      </button>
                      <button 
                        onClick={() => toggleSchedule(sch)}
                        className={`relative w-12 h-6 shrink-0 rounded-full cursor-pointer transition-colors duration-300 ${sch.enabled ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div 
                          className="absolute w-5 h-5 top-[2px] left-[2px] bg-white rounded-full shadow-sm transition-transform duration-300 ease-in-out" 
                          style={{ transform: sch.enabled ? 'translateX(24px)' : 'translateX(0)' }} 
                        />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full">
                    {sch.days.some(d => d.includes('-')) ? (
                      <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 text-xs font-black select-none border border-teal-100 dark:border-teal-900/40 w-full">
                        <Calendar size={14} className="text-teal-600 dark:text-teal-400" />
                        One-time Cycle on {(() => {
                          const dateStr = sch.days.find(d => d.includes('-')) || '';
                          try {
                            const dateObj = new Date(dateStr);
                            return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                          } catch (e) {
                            return dateStr;
                          }
                        })()}
                      </div>
                    ) : (
                      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <div key={day} className={`flex-1 text-center py-2 rounded-xl text-[9px] font-black uppercase transition-all ${sch.days.includes(day) ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 font-black' : 'text-slate-300 dark:text-slate-600'}`}>
                          {day.charAt(0)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`p-6 rounded-[2rem] border flex items-start gap-4 transition-all ${isRainPredicted ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20' : 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/20'}`}>
             <div className={`p-3 rounded-xl text-white ${isRainPredicted ? 'bg-rose-600' : 'bg-indigo-600'}`}>
               {isRainPredicted ? <CloudRain size={20}/> : <Waves size={20}/>}
             </div>
             <div>
                <h4 className={`font-black uppercase text-[10px] tracking-widest mb-1 ${isRainPredicted ? 'text-rose-900 dark:text-rose-400' : 'text-indigo-900 dark:text-indigo-400'}`}>
                  {isRainPredicted ? 'Rain Skip Active' : 'Smart Optimization Active'}
                </h4>
                <p className={`text-xs font-bold leading-relaxed ${isRainPredicted ? 'text-rose-700/80 dark:text-rose-500' : 'text-indigo-700/80 dark:text-indigo-500'}`}>
                  {isRainPredicted 
                    ? `Precipitation detected in 5-day forecast. Cycles will be suspended until soil moisture stabilizes.` 
                    : `System will automatically skip watering if humidity exceeds 85% or rainfall is detected.`}
                </p>
             </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-900 dark:bg-slate-950 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
            <Star className="absolute -right-10 -top-10 text-white/5 w-48 h-48 rotate-45" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-amber-500 mb-6">
                <Target size={18} fill="currentColor" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Harvest AI Predictor</span>
              </div>
              
              <div className="space-y-8">
                {crops.length > 0 ? (
                  crops.map((crop, index) => {
                    // Simple heuristic to estimate progress based on days to harvest
                    // Assuming a standard 90 day cycle if not specified
                    const plantedDate = new Date(crop.plantedDate);
                    const now = new Date();
                    const daysPassed = Math.floor((now.getTime() - plantedDate.getTime()) / (1000 * 3600 * 24));
                    const totalDays = daysPassed + (crop.daysToHarvest || 30);
                    const progress = Math.min(100, Math.max(0, Math.round((daysPassed / totalDays) * 100)));
                    const colors = ['bg-amber-400', 'bg-emerald-400', 'bg-indigo-400', 'bg-teal-400', 'bg-rose-400'];
                    const color = colors[index % colors.length];
                    
                    return (
                      <PredictorItem 
                        key={crop.id} 
                        name={crop.name} 
                        progress={progress} 
                        est={`${crop.daysToHarvest || 'N/A'} Days`} 
                        color={color} 
                        status={crop.status}
                      />
                    );
                  })
                ) : (
                  <div className="text-center text-slate-400 text-xs italic opacity-70">
                    No crops planted. Enroll species in the Dashboard to begin tracking.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm transition-colors">
             <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl"><Zap size={24}/></div>
                <div>
                   <h4 className="font-black text-slate-800 dark:text-white uppercase text-xs tracking-widest">Growth Recommendation</h4>
                   <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Updated 2m ago</p>
                </div>
             </div>
             {isFetchingAdvice ? (
               <div className="flex items-center gap-3 py-2 text-slate-500">
                 <Loader2 size={16} className="animate-spin" />
                 <span className="text-xs font-bold italic">Consulting Neural Core...</span>
               </div>
             ) : (
               <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed italic">
                 "{growthAdvice || "Plant your first crops to receive personalized AI telemetry and nutrient recommendations."}"
               </p>
             )}
             <button className="w-full mt-6 py-4 bg-slate-900 dark:bg-teal-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-slate-900/20 dark:shadow-teal-900/20 active:scale-95 transition-all">Apply AI Suggestions</button>
          </div>
        </div>
      )}

      {/* Add Schedule Form Sheet */}
      {showAddForm && createPortal(
        <div className={`fixed inset-0 z-[100] flex justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in ${
          isKeyboardOpen ? 'items-start px-4 pt-4 pb-4' : 'items-end px-0 pb-0 sm:px-4 sm:pb-10'
        }`}>
          <div 
            className={`w-full sm:max-w-md bg-white dark:bg-slate-800 p-6 sm:p-8 shadow-2xl animate-slide-up border-t-4 border-teal-500 transition-colors flex flex-col ${
              isKeyboardOpen ? 'rounded-[2rem] max-h-[85vh]' : 'rounded-t-[2.5rem] rounded-b-none sm:rounded-[3rem] max-h-[90dvh]'
            }`}
            style={(!isKeyboardOpen && isMobile) ? { paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' } : undefined}
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight italic">New Cycle</h3>
              <button onClick={() => setShowAddForm(false)} className="p-3 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-2xl"><X size={20}/></button>
            </div>

            <div className="space-y-6 overflow-y-auto pr-1 -mr-1 flex-grow pb-4 no-scrollbar">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-2">Target Module</label>
                <select 
                  value={newModuleId}
                  onChange={(e) => setNewModuleId(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-teal-500 rounded-2xl font-bold outline-none transition-all appearance-none dark:text-white"
                >
                  {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-2">Start Time</label>
                <div className="flex items-center gap-2">
                  <select 
                    value={selectedHour}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedHour(val);
                      updateNewTime(val, selectedMinute, selectedPeriod);
                    }}
                    className="flex-1 p-4 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-teal-500 rounded-2xl font-bold outline-none transition-all dark:text-white appearance-none text-center"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => {
                      const hStr = h.toString().padStart(2, '0');
                      return <option key={hStr} value={hStr}>{hStr}</option>;
                    })}
                  </select>
                  <span className="font-bold text-slate-400 dark:text-slate-500">:</span>
                  <select 
                    value={selectedMinute}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedMinute(val);
                      updateNewTime(selectedHour, val, selectedPeriod);
                    }}
                    className="flex-1 p-4 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-teal-500 rounded-2xl font-bold outline-none transition-all dark:text-white appearance-none text-center"
                  >
                    {Array.from({ length: 60 }, (_, i) => i).map(m => {
                      const mStr = m.toString().padStart(2, '0');
                      return <option key={mStr} value={mStr}>{mStr}</option>;
                    })}
                  </select>
                  <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-2xl border-2 border-transparent select-none">
                    <button 
                      type="button"
                      onClick={() => {
                        setSelectedPeriod('AM');
                        updateNewTime(selectedHour, selectedMinute, 'AM');
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${selectedPeriod === 'AM' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500'}`}
                    >
                      AM
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setSelectedPeriod('PM');
                        updateNewTime(selectedHour, selectedMinute, 'PM');
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${selectedPeriod === 'PM' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500'}`}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-2">Duration (min)</label>
                <input 
                  type="number" 
                  value={newDuration}
                  onChange={(e) => setNewDuration(parseInt(e.target.value))}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-teal-500 rounded-2xl font-bold outline-none transition-all dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-2">Schedule Mode</label>
                <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-2xl border-2 border-transparent">
                  <button 
                    type="button"
                    onClick={() => setScheduleType('weekly')}
                    className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${scheduleType === 'weekly' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500'}`}
                  >
                    Weekly Repeat
                  </button>
                  <button 
                    type="button"
                    onClick={() => setScheduleType('date')}
                    className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${scheduleType === 'date' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500'}`}
                  >
                    One-time Date
                  </button>
                </div>
              </div>

              {scheduleType === 'weekly' ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-2">Repeat Days</label>
                  <div className="flex justify-between gap-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <button 
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all ${newDays.includes(day) ? 'bg-teal-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-700 text-slate-300 dark:text-slate-500'}`}
                      >
                        {day.charAt(0)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-2">Select Date</label>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-teal-500 rounded-2xl font-bold outline-none transition-all dark:text-white"
                  />
                </div>
              )}
            </div>

            <div className="pt-4 shrink-0 border-t border-slate-100 dark:border-white/5">
              <button 
                onClick={handleAddSchedule}
                className="w-full py-4 bg-slate-900 dark:bg-teal-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Check size={18}/> Establish Protocol
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const PredictorItem = ({ name, progress, est, color, status = 'Vegetative Growth' }: any) => (
  <div className="space-y-3">
    <div className="flex justify-between font-black text-sm">
      <span className="text-slate-300">{name}</span>
      <span className="text-white">{progress}% Ready</span>
    </div>
    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${progress}%` }}></div>
    </div>
    <div className="flex items-center justify-between">
       <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Status: {status}</p>
       <p className="text-[9px] font-black text-teal-400 uppercase tracking-widest">Est. {est}</p>
    </div>
  </div>
);

export default Planner;
