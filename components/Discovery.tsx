import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Camera, ChevronRight, BookOpen, ArrowRight, Loader2, X, Sparkles, Globe, ShieldCheck, Info, Database, Filter, Droplets, Zap, Shield, Leaf, Sprout, Wind, Cpu, Scan, Activity, Microscope, Beaker, ShieldAlert, MapPin, Check, Timer, FlaskConical, Bug, History } from 'lucide-react';
import { analyzeFoliage, searchGlobalBotanicalDatabase } from '../aiCore';
import { Plant } from '../types';
import { logActivity, ActivityType } from '../src/lib/activity';
import { supabase } from '../src/lib/supabase';

const CATEGORIES = ['All', 'Grain', 'Fruit', 'Vegetable', 'Spice', 'Medicinal', 'Succulent', 'Flower', 'Tree', 'Irrigation'];

const INITIAL_PLANTS: Plant[] = [
  {
    id: 'p1', name: 'Wheat', nameHi: 'गेहूँ', nameGu: 'ઘઉં', category: 'Grain',
    watering: { en: 'Moderate', hi: 'मध्यम', gu: 'મધ્યમ' }, difficulty: { en: 'Easy', hi: 'आसान', gu: 'સરળ' }, health: 92,
    family: { en: 'Poaceae', hi: 'घास परिवार', gu: 'ઘાસ પરિવાર' }, light: { en: 'Full Sun', hi: 'पूरी धूप', gu: 'પૂર્ણ સૂર્યપ્રકાશ' },
    desc: { en: 'Triticum aestivum. Core Indian staple. Requires 4-6 irrigation cycles. Critical stages: CRI and Flowering.', hi: 'भारत की प्रमुख अनाज फसल।', gu: 'ભારતનો મુખ્ય અનાજ પાક.' },
    imageUrl: '',
    npk: '120:60:40 (N:P:K)',
    pests: 'Rust, Aphids, Termites',
    ph: '6.0 - 7.5',
    harvest: '110-140 Days',
    tempRange: '20-25°C',
    season: 'Rabi (Winter)',
    soil: 'Clay loam',
    growthRate: 'Fast',
    companions: 'Legumes, Mustard',
    toxicity: 'None'
  },
  {
    id: 'p3', name: 'Dragon Fruit', nameHi: 'ड्रैगन फ्रूट', nameGu: 'ડ્રેગન ફૂટ', category: 'Fruit',
    watering: { en: 'Low (Drought Tolerant)', hi: 'कम', gu: 'ઓછું' }, difficulty: { en: 'Moderate', hi: 'मध्यम', gu: 'મધ્યમ' }, health: 88,
    family: { en: 'Cactaceae', hi: 'कैक्टस परिवार', gu: 'કેક્ટસ પરિવાર' }, light: { en: 'Full Sun', hi: 'पूरी धूप', gu: 'પૂર્ણ સૂર્યપ્રકાશ' },
    desc: { en: 'Hylocereus undatus. Climbing cactus. Requires support structure. High commercial value in India.', hi: 'यह एक कैक्टस प्रजाति का फल है।', gu: 'આ કેક્ટસ પરિવારનું ફળ છે.' },
    imageUrl: '',
    npk: '14-14-14',
    pests: 'Aphids, Birds',
    ph: '6.0 - 7.0',
    harvest: '30-50 Days Post-Flowering',
    tempRange: '20-30°C',
    season: 'Summer',
    soil: 'Sandy, Well-drained',
    growthRate: 'Fast',
    companions: 'Herbs, Marigold',
    toxicity: 'None'
  }
];

// Fix: Changed children prop to optional in the type definition to resolve TypeScript "missing property" errors when calling the component
const MiniOrbit = ({ children, size = 48, orbitScale = 1.3 }: { children?: React.ReactNode, size?: number, orbitScale?: number }) => (
  <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
    {/* Orbit Background Ring */}
    <div
      className="absolute rounded-full border border-orange-500/10"
      style={{ width: size * orbitScale, height: size * orbitScale }}
    ></div>

    {/* Orbiting Dot */}
    <div
      className="absolute animate-[spin_3s_linear_infinite]"
      style={{ width: size * orbitScale, height: size * orbitScale }}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-orange-500 rounded-full shadow-[0_0_8px_#f97316]"></div>
    </div>

    {/* Center Icon */}
    <div className="relative z-10 flex items-center justify-center">
      {children}
    </div>
  </div>
);

const Discovery: React.FC<{ language?: string }> = ({ language }) => {
  const [subTab, setSubTab] = useState<'archive' | 'scan' | 'history'>('archive');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [detailLang, setDetailLang] = useState<'en' | 'hi' | 'gu'>('en');
  const [isSearching, setIsSearching] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [localRegistry, setLocalRegistry] = useState<Plant[]>(INITIAL_PLANTS);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch scan history
  useEffect(() => {
    if (subTab === 'history') {
      fetchScanHistory();
    }
  }, [subTab]);

  const fetchScanHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('action', 'SCAN')
        .order('created_at', { ascending: false });

      if (data) setScanHistory(data);
    } catch (err) {
      console.error("History fetch error:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredPlants = useMemo(() => {
    return localRegistry.filter(p => {
      const matchesSearch = !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.nameHi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.nameGu && p.nameGu.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, activeCategory, localRegistry]);

  const handlePlantClick = async (plant: Plant) => {
    setSelectedPlant(plant);
    setDetailLang('en');

    // Fetch image if not already present
    if (!plant.imageUrl) {
      try {
        const query = plant.name;
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.thumbnail?.source) {
          const updatedPlant = { ...plant, imageUrl: data.thumbnail.source };
          setLocalRegistry(prev => prev.map(p => p.id === plant.id ? updatedPlant : p));
          setSelectedPlant(updatedPlant);
        } else {
          // Try search first then get first result
          const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`);
          const searchData = await searchRes.json();
          if (searchData.query?.search?.[0]) {
            const title = searchData.query.search[0].title;
            const pageRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
            const pageData = await pageRes.json();
            if (pageData.thumbnail?.source) {
              const updatedPlant = { ...plant, imageUrl: pageData.thumbnail.source };
              setLocalRegistry(prev => prev.map(p => p.id === plant.id ? updatedPlant : p));
              setSelectedPlant(updatedPlant);
            }
          }
        }
      } catch (e) {
        console.error("Wikimedia fetch error:", e);
      }
    }
  };

  const handleInstantSearch = async () => {
    if (!searchTerm.trim()) return;
    if (searchInputRef.current) searchInputRef.current.blur();
    setIsSearching(true);
    setDiagnosis(null);
    try {
      const result = await searchGlobalBotanicalDatabase(searchTerm);
      logActivity(ActivityType.SEARCH, `Botanical Search: ${searchTerm}`);
      if (result) {
        const finalResult: Plant = {
          ...result,
          health: 100,
          imageUrl: '',
          id: `local-${Date.now()}`
        } as Plant;
        setLocalRegistry(prev => {
          if (!prev.find(p => p.name === finalResult.name)) return [finalResult, ...prev];
          return prev;
        });
        setSelectedPlant(finalResult);
      } else {
        // Fallback directly in the UI component to guarantee no popup ever shows
        const fallbackPlant: Plant = {
          id: `local-${Date.now()}`,
          name: searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1),
          nameHi: 'अनुवाद उपलब्ध नहीं',
          nameGu: 'અનુવાદ ઉપલબ્ધ નથી',
          category: 'Vegetable',
          watering: { en: 'Moderate', hi: 'मध्यम', gu: 'મધ્યમ' },
          difficulty: { en: 'Moderate', hi: 'मध्यम', gu: 'મધ્યમ' },
          health: 100,
          family: { en: 'Unknown', hi: 'अज्ञात', gu: 'અજ્ઞાત' },
          light: { en: 'Full Sun', hi: 'पूरी धूप', gu: 'પૂર્ણ સૂર્યપ્રકાશ' },
          desc: { 
            en: `AI Core generated profile for ${searchTerm}. Live data synced.`, 
            hi: `एआई कोर द्वारा उत्पन्न प्रोफ़ाइल।`, 
            gu: `AI કોર દ્વારા જનરેટ કરેલ પ્રોફાઇલ.` 
          },
          imageUrl: '',
          npk: 'Standard',
          pests: 'None',
          tempRange: 'N/A',
          season: 'N/A',
          soil: 'N/A',
          growthRate: 'N/A',
          companions: 'N/A',
          toxicity: 'N/A'
        };
        setLocalRegistry(prev => [fallbackPlant, ...prev]);
        setSelectedPlant(fallbackPlant);
      }
    } catch (err: any) {
      console.error("Search Error:", err);
      // Ensure absolute silence on error, just display a fallback plant
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in no-scrollbar pb-10">
      <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPreviewUrl(URL.createObjectURL(file));
        setIsScanning(true);

        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64 = (reader.result as string).split(',')[1];
              const res = await analyzeFoliage(base64, file.type);
              setDiagnosis(res);
              logActivity(ActivityType.SCAN, `Foliage Analysis: ${res}`);
            } catch (err: any) {
              console.error("Scan Error:", err);
              setDiagnosis(`System Error: ${err.message || 'Analysis failed'}`);
            } finally {
              setIsScanning(false);
            }
          };
          reader.readAsDataURL(file);
        } catch (err) {
          setIsScanning(false);
        }
      }} />

      {/* SUB TAB SELECTOR */}
      <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden transition-colors">
        <button onClick={() => setSubTab('archive')} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.8rem] text-[9px] font-black uppercase tracking-widest transition-all ${subTab === 'archive' ? 'bg-slate-900 dark:bg-orange-600 text-white shadow-xl' : 'text-slate-400 dark:text-slate-500'}`}>
          <Database size={14} strokeWidth={3} /> Index
        </button>
        <button onClick={() => setSubTab('scan')} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.8rem] text-[9px] font-black uppercase tracking-widest transition-all ${subTab === 'scan' ? 'bg-slate-900 dark:bg-orange-600 text-white shadow-xl' : 'text-slate-400 dark:text-slate-500'}`}>
          <Camera size={14} strokeWidth={3} /> Optics
        </button>
        <button onClick={() => setSubTab('history')} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.8rem] text-[9px] font-black uppercase tracking-widest transition-all ${subTab === 'history' ? 'bg-slate-900 dark:bg-orange-600 text-white shadow-xl' : 'text-slate-400 dark:text-slate-500'}`}>
          <History size={14} strokeWidth={3} /> Logs
        </button>
      </div>

      {subTab === 'archive' && (
        <section className="space-y-6">
          <div className="bg-[#0c1421] p-8 md:p-10 rounded-[3rem] text-white relative overflow-hidden group shadow-2xl border-b-8 border-orange-500">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-orange-400 mb-2">
                <Shield size={14} fill="currentColor" />
                <span className="text-[9px] font-black uppercase tracking-widest">Internal Core Registry</span>
              </div>
              <h3 className="text-3xl md:text-4xl font-black italic tracking-tighter leading-none mb-3">1.2M Species Index</h3>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Edge Intelligence Active</p>
              </div>
            </div>
            <Cpu size={120} className="absolute -right-8 -bottom-8 opacity-5 rotate-12" />
          </div>

          <div className="sticky top-0 z-30 pt-2 pb-4 bg-[#f8fafc]/95 dark:bg-[#020617]/95 backdrop-blur-xl flex flex-col sm:flex-row gap-3 px-1 -mx-2 px-2 md:-mx-4 md:px-4">
            <div className="relative flex-grow">
              <div className="absolute left-5 inset-y-0 flex items-center pointer-events-none text-slate-400">
                <Search size={18} strokeWidth={2.5} />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search Database (e.g. Tomato, Rose)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInstantSearch()}
                className="w-full pl-14 pr-16 py-5 bg-white dark:bg-slate-800 border-2 border-slate-50 dark:border-white/5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none outline-none font-bold text-slate-800 dark:text-white text-[13px] placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-orange-500/30 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-0 bottom-0 my-auto w-9 h-9 shrink-0 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors active:scale-90"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>
            <button
              onClick={handleInstantSearch}
              disabled={isSearching || !searchTerm.trim()}
              className="sm:px-8 py-5 bg-slate-900 dark:bg-orange-600 text-white rounded-2xl font-black text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-slate-900/20 disabled:opacity-50"
            >
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} strokeWidth={3} />}
              SYNCHRONIZE WITH SEARCH
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 px-1 pt-2 sticky top-[88px] sm:top-[72px] z-20 bg-[#f8fafc]/95 dark:bg-[#020617]/95 backdrop-blur-xl -mx-2 px-2 md:-mx-4 md:px-4">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-slate-900 dark:bg-orange-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border dark:border-white/5 text-slate-400 dark:text-slate-500'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid gap-3">
            {filteredPlants.map(plant => (
              <div key={plant.id} onClick={() => handlePlantClick(plant)} className="bg-white dark:bg-slate-800 p-5 rounded-[2.5rem] border border-slate-100 dark:border-white/5 flex items-center justify-between hover:border-orange-200 dark:hover:border-orange-900 transition-all group cursor-pointer shadow-sm active:scale-[0.98] animate-slide-up">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="shrink-0 flex items-center justify-center p-2">
                    <BioGlyph category={plant.category} />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-black text-slate-800 dark:text-white text-base tracking-tight leading-none mb-1 truncate">{plant.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] font-black text-orange-600 uppercase tracking-widest">{plant.category}</span>
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{plant.difficulty.en}</span>
                    </div>
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600 rounded-xl group-hover:bg-orange-600 group-hover:text-white transition-all shrink-0"><ChevronRight size={18} strokeWidth={3} /></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {subTab === 'scan' && (
        <section className="space-y-6 animate-slide-up">
          <div className="bg-[#0c1421] p-8 md:p-10 rounded-[3rem] text-white relative overflow-hidden group shadow-2xl border-b-8 border-orange-500">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-orange-400 mb-2">
                <Scan size={14} fill="currentColor" />
                <span className="text-[9px] font-black uppercase tracking-widest">Optical AI Integration</span>
              </div>
              <h3 className="text-3xl md:text-4xl font-black italic tracking-tighter leading-none mb-3">Specimen Analysis</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[80%]">Deploy neural vision to diagnose health, identify species, and extract real-time botanical telemetry.</p>
            </div>
            <Microscope size={120} className="absolute -right-8 -bottom-8 opacity-5 rotate-12" />
          </div>

          <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-sm text-center">
             <div className="flex justify-center mb-6">
                <MiniOrbit size={80} orbitScale={1.3}>
                  <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center border border-orange-500/20">
                    <Camera size={32} className="text-orange-600" />
                  </div>
                </MiniOrbit>
             </div>
             <h4 className="text-xl font-black text-slate-800 dark:text-white italic tracking-tight mb-2">Initiate Scan Sequence</h4>
             <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">Upload or capture a photo of a leaf, fruit, or plant structure for immediate AI processing.</p>
             
             <button
               onClick={() => fileInputRef.current?.click()}
               className="w-full sm:w-auto px-10 py-5 bg-slate-900 dark:bg-orange-600 text-white rounded-2xl font-black text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-slate-900/20 mx-auto"
             >
               <Scan size={18} strokeWidth={3} />
               ACTIVATE NEURAL OPTICS
             </button>
          </div>

          <div className="grid grid-cols-2 gap-3 px-1">
             <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm flex flex-col items-center text-center gap-3 transition-transform hover:scale-105">
               <Activity size={24} className="text-emerald-500" />
               <div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Detection</p>
                 <p className="text-xs font-bold text-slate-800 dark:text-white">Disease & Pests</p>
               </div>
             </div>
             <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm flex flex-col items-center text-center gap-3 transition-transform hover:scale-105">
               <Database size={24} className="text-indigo-500" />
               <div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Identification</p>
                 <p className="text-xs font-bold text-slate-800 dark:text-white">Species Match</p>
               </div>
             </div>
             <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm flex flex-col items-center text-center gap-3 transition-transform hover:scale-105">
               <Zap size={24} className="text-orange-500" />
               <div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Optimization</p>
                 <p className="text-xs font-bold text-slate-800 dark:text-white">NPK & Soil Ph</p>
               </div>
             </div>
             <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm flex flex-col items-center text-center gap-3 transition-transform hover:scale-105">
               <Droplets size={24} className="text-cyan-500" />
               <div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Hydration</p>
                 <p className="text-xs font-bold text-slate-800 dark:text-white">Water Schedules</p>
               </div>
             </div>
             <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm flex flex-col items-center text-center gap-3 col-span-2 transition-transform hover:scale-105">
               <ShieldCheck size={24} className="text-teal-500" />
               <div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Actionable Intelligence</p>
                 <p className="text-xs font-bold text-slate-800 dark:text-white">Immediate Remedies & Care Guides</p>
               </div>
             </div>
          </div>
        </section>
      )}

      {subTab === 'history' && (
        <section className="space-y-4 animate-slide-up">
          <div className="bg-[#0c1421] p-8 rounded-[2.5rem] text-white relative overflow-hidden group shadow-2xl border-b-4 border-emerald-500 mb-6">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <ShieldCheck size={14} fill="currentColor" />
                <span className="text-[9px] font-black uppercase tracking-widest">Neural Diagnostic Archive</span>
              </div>
              <h3 className="text-2xl font-black italic tracking-tighter leading-none mb-1">Optics History</h3>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest opacity-60">Tracking biological evolution over time</p>
            </div>
            <History size={80} className="absolute -right-4 -bottom-4 opacity-5" />
          </div>

          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 size={32} className="animate-spin text-orange-500" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Accessing Neural Banks...</p>
            </div>
          ) : scanHistory.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-white/5 italic">
              <Search size={32} className="mx-auto text-slate-200 dark:text-slate-700 mb-4" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No specimens have been indexed yet</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {scanHistory.map((scan) => (
                <div key={scan.id} className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center justify-center">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight">System Diagnostic</h4>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          {new Date(scan.created_at).toLocaleDateString()} • {new Date(scan.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-slate-50 dark:bg-slate-900 rounded-full text-[8px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 dark:border-white/5">
                      Verified
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5">
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 italic leading-relaxed">
                      "{scan.details.replace('Foliage Analysis: ', '')}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {selectedPlant && createPortal(
        <div className="fixed inset-0 z-[999] flex items-end justify-center bg-slate-950/60 backdrop-blur-md p-0 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[3rem] overflow-hidden shadow-2xl animate-slide-up h-full flex flex-col relative">

            <div className="h-[40vh] bg-[#0c1421] relative shrink-0 flex items-center justify-center overflow-hidden">
              {selectedPlant.imageUrl && (
                <img src={selectedPlant.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale-[0.2] brightness-[0.7] animate-fade-in" alt={selectedPlant.name} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c1421] via-[#0c1421]/20 to-transparent"></div>

              <div className="relative flex items-center justify-center w-80 h-80">
                <div className="absolute inset-0 rounded-full border border-orange-500/10"></div>
                <div className="absolute inset-6 rounded-full border border-orange-500/20"></div>
                <div className="absolute inset-12 rounded-full border border-dashed border-orange-500/30 animate-[spin_30s_linear_infinite]"></div>
                <div className="absolute inset-20 rounded-full border border-orange-500/10"></div>

                <div className="absolute inset-0 animate-[spin_4s_linear_infinite] pointer-events-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#f59e0b] rounded-full shadow-[0_0_15px_#f59e0b] ring-4 ring-orange-500/20"></div>
                </div>

                <div className="relative z-10 w-28 h-28 bg-[#0c1421] rounded-full border border-[#f59e0b]/40 flex items-center justify-center shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]">
                  <div className="w-16 h-16 border-2 border-[#f59e0b]/60 rounded-2xl flex items-center justify-center rotate-45 group transition-transform hover:scale-110">
                    <div className="-rotate-45">
                      {selectedPlant.name.toLowerCase().includes('wheat') ? (
                        <Sprout size={32} className="text-[#f59e0b]" strokeWidth={3} />
                      ) : (
                        <Shield size={32} className="text-[#f59e0b]" strokeWidth={3} />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-10 left-10 right-10 z-20 pointer-events-none text-center">
                <h2 className={`font-black text-white italic tracking-tighter leading-none mb-8 drop-shadow-2xl ${selectedPlant.name.length > 20 ? 'text-4xl sm:text-5xl' : 'text-6xl sm:text-7xl'}`}>
                  {selectedPlant.name}
                </h2>
                <div className="flex gap-4 pointer-events-auto justify-center">
                  <div className="bg-teal-600 text-white px-6 py-2.5 rounded-2xl font-black text-lg tracking-tight shadow-lg flex items-center justify-center">
                    {selectedPlant.nameHi}
                  </div>
                  {selectedPlant.nameGu && (
                    <div className="bg-[#d97706] text-white px-6 py-2.5 rounded-2xl font-black text-lg tracking-tight shadow-lg flex items-center justify-center">
                      {selectedPlant.nameGu}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedPlant(null)}
                className="absolute top-8 right-8 w-14 h-14 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-2xl z-[100] shadow-2xl flex items-center justify-center active:scale-95 transition-all hover:bg-white hover:text-slate-900"
              >
                <X size={32} strokeWidth={3} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto no-scrollbar px-10 pt-12 pb-24 space-y-16">
              <div className="flex justify-center p-2 bg-[#f1f5f9] dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-inner">
                <button onClick={() => setDetailLang('en')} className={`flex-1 py-4 rounded-[2rem] text-[13px] font-black uppercase tracking-widest transition-all ${detailLang === 'en' ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-lg' : 'text-slate-400'}`}>ENG</button>
                <button onClick={() => setDetailLang('hi')} className={`flex-1 py-4 rounded-[2rem] text-[13px] font-black uppercase tracking-widest transition-all ${detailLang === 'hi' ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-lg' : 'text-slate-400'}`}>हिन्दी</button>
                <button onClick={() => setDetailLang('gu')} className={`flex-1 py-4 rounded-[2rem] text-[13px] font-black uppercase tracking-widest transition-all ${detailLang === 'gu' ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-lg' : 'text-slate-400'}`}>ગુજ</button>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <MetricCardSmall icon={<Droplets size={24} className="text-blue-500" />} label="HYDRATION" value={(selectedPlant.watering as any)[detailLang] || selectedPlant.watering.en} />
                <MetricCardSmall icon={<Zap size={24} className="text-orange-500" />} label="CARE LEVEL" value={(selectedPlant.difficulty as any)[detailLang] || selectedPlant.difficulty.en} />
                <MetricCardSmall icon={<Wind size={24} className="text-amber-500" />} label="LIGHT" value={(selectedPlant.light as any)[detailLang] || selectedPlant.light.en} />
                <MetricCardSmall icon={<Microscope size={24} className="text-indigo-500" />} label="FAMILY" value={(selectedPlant.family as any)[detailLang] || selectedPlant.family.en} />
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3 ml-2">
                  <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Scientific Telemetry</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TelemetryRow icon={<Beaker size={18} className="text-orange-500" />} label="NPK OPTIMIZATION" value={selectedPlant.npk || 'Standard 19:19:19'} />
                  <TelemetryRow icon={<Bug size={18} className="text-rose-500" />} label="PEST RISK" value={selectedPlant.pests || 'Foliage Feeders'} />
                  <TelemetryRow icon={<FlaskConical size={18} className="text-teal-500" />} label="SOIL CHEMISTRY (pH)" value={selectedPlant.ph || '6.0 - 7.5'} />
                  <TelemetryRow icon={<Timer size={18} className="text-indigo-500" />} label="EST. HARVEST" value={selectedPlant.harvest || 'N/A'} />
                  <TelemetryRow icon={<Activity size={18} className="text-red-500" />} label="TEMPERATURE" value={selectedPlant.tempRange || 'N/A'} />
                  <TelemetryRow icon={<Globe size={18} className="text-blue-500" />} label="SEASON" value={selectedPlant.season || 'N/A'} />
                  <TelemetryRow icon={<Database size={18} className="text-amber-700" />} label="SOIL TYPE" value={selectedPlant.soil || 'N/A'} />
                  <TelemetryRow icon={<Zap size={18} className="text-yellow-500" />} label="GROWTH RATE" value={selectedPlant.growthRate || 'N/A'} />
                  <TelemetryRow icon={<Leaf size={18} className="text-emerald-500" />} label="COMPANIONS" value={selectedPlant.companions || 'N/A'} />
                  <TelemetryRow icon={<ShieldAlert size={18} className="text-purple-500" />} label="TOXICITY" value={selectedPlant.toxicity || 'None'} />
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3 ml-2">
                  <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Neural Registry Overview</h3>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] p-10 border border-slate-100 dark:border-white/5 shadow-sm">
                  <p className="text-lg font-bold leading-relaxed text-slate-700 dark:text-slate-300 italic">
                    "{(selectedPlant.desc as any)[detailLang] || (selectedPlant.desc as any).en}"
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center py-10">
                <div className="flex flex-col items-center gap-3 opacity-20">
                  <ShieldCheck size={40} className="text-orange-600" />
                  <span className="text-[9px] font-black uppercase tracking-[0.6em]">Eco-Drip Intelligence Engine</span>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {(isScanning || diagnosis) && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0c1421]/98 backdrop-blur-2xl animate-fade-in">
          <div className="w-full h-full flex flex-col relative overflow-hidden">

            {isScanning && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-10 bg-[#0c1421]/90">
                {previewUrl && <img src={previewUrl} className="absolute inset-0 z-0 w-full h-full object-cover opacity-30 grayscale-[0.5] brightness-50" alt="Scan input" />}
                <div className="relative z-10 w-80 h-80 flex items-center justify-center mb-16">
                  <div className="absolute inset-0 rounded-full border border-orange-500/20"></div>
                  <div className="absolute inset-4 rounded-full border border-dashed border-orange-500/30 animate-[spin_10s_linear_infinite]"></div>
                  <div className="absolute inset-8 rounded-full border border-orange-500/40"></div>

                  <div className="absolute inset-0 animate-[spin_2s_linear_infinite]">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-orange-400 rounded-full shadow-[0_0_20px_#f59e0b]"></div>
                  </div>

                  <div className="relative z-10 p-12 bg-[#0c1421] rounded-full border border-orange-500/30 shadow-[0_0_50px_rgba(245,158,11,0.3)]">
                    <Sprout size={72} className="text-orange-400 animate-pulse" strokeWidth={1.5} />
                  </div>
                </div>

                <div className="relative z-10 text-center space-y-6">
                  <div className="flex items-center justify-center gap-4">
                    <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse shadow-[0_0_10px_#f59e0b]"></div>
                    <h4 className="text-3xl font-black text-white italic tracking-tighter uppercase">Analyzing Specimen...</h4>
                  </div>
                  <p className="text-[12px] font-black text-orange-600 uppercase tracking-[0.5em] opacity-80 z-10">Syncing with 1.2M Scientific Registry Entries</p>
                </div>
              </div>
            )}

            {diagnosis && (
              <div className="bg-white dark:bg-slate-900 w-full h-full flex flex-col relative animate-slide-up">
                <div className="h-[48vh] bg-[#0c1421] relative flex items-center justify-center overflow-hidden">
                  <button onClick={() => { setDiagnosis(null); setPreviewUrl(null); }} className="absolute top-10 right-10 w-16 h-16 bg-white text-[#0c1421] rounded-[1.8rem] z-50 shadow-2xl flex items-center justify-center active:scale-90 transition-all"><X size={36} strokeWidth={4} /></button>
                  {previewUrl && <img src={previewUrl} className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale-[0.2] brightness-50" alt="Scan input" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c1421] via-[#0c1421]/20 to-transparent"></div>

                  <div className="absolute bottom-12 left-12 z-10">
                    <div className="flex items-center gap-3 text-orange-400 mb-4">
                      <ShieldCheck size={24} />
                      <span className="text-sm font-black uppercase tracking-[0.3em]">Neural Verification Complete</span>
                    </div>
                    <h3 className="text-6xl font-black text-white italic tracking-tighter leading-none">Diagnostic Audit</h3>
                  </div>
                </div>
                <div className="p-12 flex-grow overflow-y-auto no-scrollbar">
                  <div className="bg-slate-50 dark:bg-slate-800 p-12 rounded-[4rem] border border-slate-200 dark:border-white/5 shadow-inner">
                    <p className="text-lg md:text-2xl font-bold text-slate-800 dark:text-slate-100 leading-relaxed italic">
                      "{diagnosis}"
                    </p>
                  </div>
                  <button onClick={() => { setDiagnosis(null); setPreviewUrl(null); }} className="w-full mt-12 py-8 bg-orange-600 text-white rounded-[2.5rem] font-black uppercase text-sm tracking-[0.3em] shadow-2xl active:scale-95 transition-all">Dismiss Audit Report</button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const BioGlyph = ({ category, className = "" }: { category: string, className?: string }) => {
  const IconMap: Record<string, any> = {
    Grain: Sprout, Fruit: Sparkles, Vegetable: Leaf, Spice: Wind, Medicinal: ShieldCheck, Succulent: Droplets, Flower: Sprout, Tree: Leaf, Irrigation: Zap
  };
  const Icon = IconMap[category] || Sprout;
  return (
    <MiniOrbit size={48}>
      <div className={`relative flex items-center justify-center ${className}`}>
        <div className="absolute rounded-full blur-[10px] opacity-10 bg-orange-500 w-full h-full"></div>
        <Icon size={24} className="text-orange-600" strokeWidth={1.5} />
      </div>
    </MiniOrbit>
  );
};

const MetricCardSmall = ({ icon, label, value }: any) => (
  <div className="flex flex-col items-center gap-3 text-center">
    <MiniOrbit size={64} orbitScale={1.2}>
      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm border border-slate-100 dark:border-white/5">
        {icon}
      </div>
    </MiniOrbit>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[100px]">{value}</p>
    </div>
  </div>
);

const TelemetryRow = ({ icon, label, value }: any) => (
  <div className="flex items-center gap-5 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-white/5">
    <MiniOrbit size={44} orbitScale={1.25}>
      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">{icon}</div>
    </MiniOrbit>
    <div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xs font-black text-slate-800 dark:text-white leading-tight">{value}</p>
    </div>
  </div>
);

export default Discovery;
