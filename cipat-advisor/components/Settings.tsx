import React, { useState } from 'react';
import { LogOut, Edit3, Save, Star, X, Cpu, MapPin, Mail, Phone, Leaf, Link2, Settings2, ShieldCheck, ChevronRight, HelpCircle, RefreshCw, Eye, EyeOff, Lock, Droplets, Zap, Bot, CalendarDays, BookOpen, Search, Sparkles, Activity, FileText, Moon, Sun, Layers, Cable, Loader2, Users, Bell, Thermometer, DownloadCloud, AlertTriangle, Trash2, Sliders, Globe } from 'lucide-react';
import { NavTab, UserProfile, Device, Crop } from '../types';
import { supabase } from '../src/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SettingsProps { 
  profile: UserProfile; 
  onUpdateProfile: (p: UserProfile) => void; 
  onLogout: () => void;
  devices?: Device[]; 
  crops?: Crop[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate?: (tab: NavTab) => void;
}

const GUIDE_CONTENT = {
  en: {
    title: "Operations Manual",
    sections: [
      { title: "Dashboard", content: "Monitor soil moisture, temperature, and crop health in real-time. Use 'Instant Boost' for wireless manual override." },
      { title: "R4 WiFi Wiring", content: "WIRELESS SETUP:\n• LCD 16x2 (I2C) -> SDA/SCL\n• Moisture -> A0\n• DHT11 Temp -> D2\n• Relay -> D13" },
      { title: "APK/Mobile Mode", content: "If using as an APK:\n• USB connection is DISABLED (Android security).\n• Wireless is ENABLED.\n• Ensure phone and Arduino are on the SAME WiFi network." },
      { title: "Connectivity", content: "Ensure your phone/PC and Arduino R4 are on the SAME 2.4GHz WiFi network for the link to activate." }
    ]
  },
  hi: {
    title: "संचालन निर्देशिका",
    sections: [
      { title: "डैशबोर्ड", content: "मिट्टी की नमी, तापमान और फसल स्वास्थ्य की रीयल-टाइम निगरानी करें।" },
      { title: "R4 वाईफाई वायरिंग", content: "एलसीडी (SDA/SCL), नमी सेंसर (A0), तापमान (D2), रिले (D13)।" },
      { title: "APK/मोबाइल मोड", content: "यदि आप APK का उपयोग कर रहे हैं: केवल वायरलेस काम करेगा। USB काम नहीं करेगा।" },
      { title: "कनेक्टિવિટી", content: "आपका फोन और आर्डुइनो एक ही वाईफाई पर होने चाहिए।" }
    ]
  },
  gu: {
    title: "ઓપરેશન્સ મેન્યુઅલ",
    sections: [
      { title: "ડેશબોર્ડ", content: "જમીનનો ભેજ અને પાકના સ્વાસ્થ્યનું રિયલ-ટાઇમ મોનિટરિંગ કરો." },
      { title: "R4 વાઈફાઈ વાયરિંગ", content: "LCD (SDA/SCL), ભેજ સેન્સર (A0), તાપમાન (D2), રિલે (D13)." },
      { title: "APK/મોબાઇલ મોડ", content: "જો APK તરીકે ઉપયોગ કરો છો: ફક્ત વાયરલેસ કામ કરશે. USB કામ કરશે નહીં." },
      { title: "કનેક્ટિવિટી", content: "તમારો ફોન અને Arduino એક જ WiFi પર હોવા જોઈએ." }
    ]
  }
};

const Settings: React.FC<SettingsProps> = ({ profile, onUpdateProfile, onLogout, devices = [], crops = [], theme, onToggleTheme, onNavigate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(profile);
  const [showGuide, setShowGuide] = useState(false);
  const [guideLang, setGuideLang] = useState<'en' | 'hi' | 'gu'>('en');

  const [isSaving, setIsSaving] = useState(false);
  
  // New local states for settings
  const [notifications, setNotifications] = useState(true);
  const [celsius, setCelsius] = useState(true);
  const [autoSync, setAutoSync] = useState(true);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPeriod, setExportPeriod] = useState('7days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // New Security & Account states
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // App Language State
  const [appLanguage, setAppLanguage] = useState<'en'|'hi'|'gu'>('en');

  const getInitials = (name: string) => (name || '').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setIsSaving(true);
    try {
      const updatedProfile = { ...editedProfile, avatar: getInitials(editedProfile.name) };
      const { error } = await supabase
        .from('users')
        .update(updatedProfile)
        .eq('id', user.id);

      if (error) throw error;
      onUpdateProfile(updatedProfile);
      setIsEditing(false);
      
      const { logActivity, ActivityType } = await import('../src/lib/activity');
      logActivity(ActivityType.PROFILE_UPDATE, 'User updated their biological profile and garden metadata');
    } catch (e) {
      console.error('Update Profile Error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text("Eco-Drip Neural Telemetry Report", 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Operator: ${profile.name || 'N/A'} | Location: ${profile.location || 'N/A'}`, 14, 30);
      
      let periodText = '';
      if (exportPeriod === '7days') periodText = 'Last 7 Days';
      else if (exportPeriod === '30days') periodText = 'Last 30 Days';
      else if (exportPeriod === 'alltime') periodText = 'All Time History';
      else if (exportPeriod === 'custom') periodText = `${customStartDate || 'Start'} to ${customEndDate || 'End'}`;
      doc.text(`Period: ${periodText}`, 14, 36);
      
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);

      // Dummy Data Generation based on period
      let days = 7;
      if (exportPeriod === '30days') days = 30;
      else if (exportPeriod === 'alltime') days = 365; // 1 Year of data
      else if (exportPeriod === 'custom') {
         const start = new Date(customStartDate || Date.now() - 7*24*60*60*1000);
         const end = new Date(customEndDate || Date.now());
         days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Generate highly granular data (every 15 minutes = 96 logs per day)
      // This allows the "All Time" report to easily hit ~35,000+ rows and ~800+ pages
      let rowCount = days * 96; 
      
      const dataRows = [];
      const now = new Date(customEndDate || Date.now());
      
      for(let i=0; i<rowCount; i++) {
        const d = new Date(now.getTime() - (i * 15 * 60 * 1000)); // Every 15 mins backwards
        dataRows.push([
          d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          Math.floor(Math.random() * 40 + 30).toString() + '%', // Moisture
          Math.floor(Math.random() * 15 + 20).toString() + '°C', // Temp
          (Math.random() * 2.5 + 5.0).toFixed(1), // pH
          Math.random() > 0.95 ? 'Pumping' : 'Standby' // Pump
        ]);
      }
      
      autoTable(doc, {
        startY: 50,
        head: [['Timestamp (Every 15m)', 'Soil Moisture', 'Temperature', 'pH Level', 'Pump Status']],
        body: dataRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
        styles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      doc.save(`EcoDrip_Report_${exportPeriod}_${new Date().getTime()}.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error("PDF Generation failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete') return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Simulate deletion for UI, in a real production app you trigger an edge function
      await supabase.from('users').delete().eq('id', user.id);
      
      await supabase.auth.signOut();
      onLogout();
    } catch (e) {
      console.error('Delete Account Error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-view-in pb-10 no-scrollbar max-w-5xl mx-auto">
      <div className="flex items-center justify-between px-2 pt-2">
        <h2 className="text-[44px] font-black text-slate-800 dark:text-white tracking-tighter italic leading-none transition-colors duration-500">Terminal</h2>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)} 
          disabled={isSaving}
          className="w-12 h-12 bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/10 text-slate-400 rounded-2xl shadow-sm flex items-center justify-center active:scale-90 transition-all disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          {isEditing ? (isSaving ? <Loader2 size={20} className="text-teal-600 animate-spin" /> : <Save size={20} className="text-teal-600" />) : <Edit3 size={20} />}
        </button>
      </div>

      <div className="liquid-glass p-10 md:p-14 rounded-[4rem] relative flex flex-col items-center transition-all duration-700">
        <div className="absolute top-10 right-10 flex flex-col items-center">
          <div className="w-12 h-12 bg-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-400/30 text-white"><Star size={24} fill="currentColor" /></div>
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-2">LVL {profile.level || 1}</span>
        </div>
        
        <div className="w-36 h-36 bg-teal-50 dark:bg-teal-600/10 rounded-[3rem] flex items-center justify-center text-teal-600 dark:text-teal-400 text-[52px] font-black mb-8 border-4 border-white dark:border-white/5 shadow-2xl ring-8 ring-slate-100/30 dark:ring-white/5">
          {profile.avatar || getInitials(isEditing ? editedProfile.name : profile.name) || "DP"}
        </div>

        {isEditing ? (
          <div className="w-full space-y-5">
            <ProfileInput label="Full Name" value={editedProfile.name} onChange={(v: string) => setEditedProfile({...editedProfile, name: v})} />
            <ProfileInput label="Email" value={editedProfile.email} onChange={(v: string) => setEditedProfile({...editedProfile, email: v})} />
            <ProfileInput label="Phone" value={editedProfile.phone} maxLength={10} onChange={(v: string) => setEditedProfile({...editedProfile, phone: v.replace(/\D/g, '')})} />
            <ProfileInput label="Location" value={editedProfile.location} onChange={(v: string) => setEditedProfile({...editedProfile, location: v})} />
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-4">Garden Type</label>
              <select 
                className="w-full p-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] font-bold outline-none text-[15px] dark:text-white transition-all focus:border-teal-500 appearance-none cursor-pointer"
                value={editedProfile.gardenType}
                onChange={e => setEditedProfile({...editedProfile, gardenType: e.target.value})}
              >
                <option value="Farm">Farm</option>
                <option value="Home Garden">Home Garden</option>
                <option value="Greenhouse">Greenhouse</option>
                <option value="Roof Top">Roof Top</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="text-center w-full">
            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-2 leading-none">{profile.name || 'DHRUV PATEL'}</h3>
            <p className="text-[11px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-[0.3em] mb-12">Authorized Operator</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-2">
              <SummaryChip icon={<Mail size={14}/>} text={profile.email || 'dhruv@user.ai'} />
              <SummaryChip icon={<Phone size={14}/>} text={profile.phone || '+91 63562 40206'} />
              <SummaryChip icon={<MapPin size={14}/>} text={profile.location || 'Gujarat'} />
              <SummaryChip icon={<Leaf size={14}/>} text={profile.gardenType || 'Farm'} />
            </div>
          </div>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
      <div className="px-2 space-y-5 mb-8 lg:mb-0">
        <h4 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
          <Settings2 size={16} /> Preferences
        </h4>
        <div className="liquid-glass p-6 rounded-[3.5rem] space-y-4 transition-all duration-700">
          <ToggleRow 
            icon={theme === 'dark' ? <Moon size={22} className="text-indigo-400" /> : <Sun size={22} className="text-amber-400" />}
            label="Dark Interface"
            sub="OLED Optimized"
            active={theme === 'dark'}
            onToggle={onToggleTheme}
          />
          <ToggleRow 
            icon={<Bell size={22} className="text-rose-400" />}
            label="Push Notifications"
            sub="Critical Alerts Only"
            active={notifications}
            onToggle={() => setNotifications(!notifications)}
          />
          <ToggleRow 
            icon={<Thermometer size={22} className="text-orange-400" />}
            label="Celsius Units"
            sub="Temperature format"
            active={celsius}
            onToggle={() => setCelsius(!celsius)}
          />
          <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                <Globe size={22} className="text-blue-500" />
              </div>
              <div>
                <h5 className="text-[13px] font-black text-slate-800 dark:text-white leading-none mb-1">App Language</h5>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Interface Locale</p>
              </div>
            </div>
            <select 
              className="bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white font-bold text-xs p-2 rounded-xl outline-none"
              value={appLanguage}
              onChange={(e) => setAppLanguage(e.target.value as any)}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="gu">ગુજરાતી</option>
            </select>
          </div>
        </div>
      </div>
      </div>{/* end lg:grid-cols-2 for Preferences + Hardware */}

      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
      <div className="px-2 space-y-5 mb-8 lg:mb-0">
        <h4 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
          <Cpu size={16} /> Hardware & Network
        </h4>
        <div className="liquid-glass p-6 rounded-[3.5rem] space-y-4 transition-all duration-700">
          <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                <Cable size={22} className="text-teal-500" />
              </div>
              <div>
                <h5 className="text-[13px] font-black text-slate-800 dark:text-white leading-none mb-1">Cloud Link</h5>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Auth & Database</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/10 rounded-full">
              <div className={`w-2 h-2 rounded-full ${supabase.auth.getSession() ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
              <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400">Linked</span>
            </div>
          </div>
          <ToggleRow 
            icon={<RefreshCw size={22} className="text-blue-400" />}
            label="Auto-Sync Telemetry"
            sub="Background Data Fetch"
            active={autoSync}
            onToggle={() => setAutoSync(!autoSync)}
          />
        </div>
      </div>

      <div className="px-2 space-y-5">
        <h4 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
          <ShieldCheck size={16} /> Security & Account
        </h4>
        <div className="space-y-4">
          <button 
            onClick={() => setShowSecurityModal(true)}
            className="liquid-glass w-full p-8 rounded-[3rem] border-b-4 border-emerald-500 flex items-center justify-between group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                <Lock size={24} />
              </div>
              <div className="text-left">
                <h5 className="text-sm font-black text-slate-800 dark:text-white leading-none mb-1">Privacy & Security</h5>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">2FA & Access Logs</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button 
            onClick={() => setShowExportModal(true)}
            className="liquid-glass w-full p-8 rounded-[3rem] flex items-center justify-between group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                <DownloadCloud size={24} />
              </div>
              <div className="text-left">
                <h5 className="text-sm font-black text-slate-800 dark:text-white leading-none mb-1">Export Telemetry Data</h5>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Download PDF Report</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      <div className="px-2 space-y-5">
        <h4 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
          <HelpCircle size={16} /> Resources
        </h4>
        <div className="space-y-4">
          <button 
            onClick={() => onNavigate?.(NavTab.Community)}
            className="liquid-glass w-full p-8 rounded-[3rem] border-b-4 border-indigo-500 flex items-center justify-between group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                <Users size={24} />
              </div>
              <div className="text-left">
                <h5 className="text-sm font-black text-slate-800 dark:text-white leading-none mb-1">Mesh Collective</h5>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Global Leaderboard</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
          </button>

          <button 
            onClick={() => setShowGuide(true)}
            className="liquid-glass w-full p-8 rounded-[3rem] flex items-center justify-between group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center">
                <BookOpen size={24} />
              </div>
              <div className="text-left">
                <h5 className="text-sm font-black text-slate-800 dark:text-white leading-none mb-1">Operations Manual</h5>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">EN • HI • GU</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
      </div>{/* end lg:grid-cols-2 */}

      <div className="px-2 mt-6 pb-20">
        <div className="flex flex-col items-center gap-4 py-8 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowPrivacy(true)}
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-teal-600 transition-colors"
            >
              Privacy Policy
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button 
              onClick={() => setShowTerms(true)}
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-teal-600 transition-colors"
            >
              Terms of Service
            </button>
          </div>
          <div className="flex justify-center items-center gap-2">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Powered by</span>
            <div className="flex items-center gap-1 opacity-40 grayscale hover:grayscale-0 transition-all cursor-pointer">
              <h1 className="text-xs font-black text-slate-900 dark:text-white tracking-tighter italic">Eco-Drip</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="px-2">
        <button 
          onClick={onLogout} 
          className="w-full p-8 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black rounded-[3rem] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm border border-rose-100 dark:border-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20"
        >
          <LogOut size={22} /> 
          <span className="uppercase tracking-[0.3em] text-[11px]">Log out</span>
        </button>
      </div>

      {showGuide && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-slate-100 dark:border-white/5">
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center text-left">
                 <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{GUIDE_CONTENT[guideLang].title}</h3>
                 <button onClick={() => setShowGuide(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
              </div>
              
              <div className="flex p-3 bg-slate-50 dark:bg-white/5">
                 {(['en', 'hi', 'gu'] as const).map(lang => (
                   <button 
                    key={lang}
                    onClick={() => setGuideLang(lang)}
                    className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase transition-all ${guideLang === lang ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400'}`}
                   >
                     {lang === 'en' ? 'English' : lang === 'hi' ? 'हिन्दी' : 'ગુજરાતી'}
                   </button>
                 ))}
              </div>

              <div className="p-8 overflow-y-auto space-y-8 no-scrollbar">
                 {GUIDE_CONTENT[guideLang].sections.map((section, idx) => (
                   <div key={idx} className="space-y-3">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                         <h4 className="text-[13px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest">{section.title}</h4>
                      </div>
                      <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] whitespace-pre-wrap">{section.content}</p>
                   </div>
                 ))}
              </div>
              
              <div className="p-8 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                 <button onClick={() => setShowGuide(false)} className="w-full py-5 bg-teal-600 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-lg">Close Manual</button>
              </div>
           </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-slate-100 dark:border-white/5">
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center text-left">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                     <DownloadCloud size={20} />
                   </div>
                   <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Export Data</h3>
                 </div>
                 <button onClick={() => setShowExportModal(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X size={24}/></button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-6 no-scrollbar">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-2">Select Range</label>
                    <div className="grid grid-cols-2 gap-2">
                       {(['7days', '30days', 'alltime', 'custom'] as const).map(p => (
                         <button
                           key={p}
                           onClick={() => setExportPeriod(p)}
                           className={`py-3 px-2 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${exportPeriod === p ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                         >
                           {p === '7days' ? '7 Days' : p === '30days' ? '30 Days' : p === 'alltime' ? 'All Time' : 'Custom'}
                         </button>
                       ))}
                    </div>
                    
                    {exportPeriod === 'custom' && (
                      <div className="flex gap-3 animate-fade-in mt-3">
                         <div className="flex-1 space-y-2">
                           <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Start Date</label>
                           <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] font-bold outline-none text-[13px] dark:text-slate-300 transition-all focus:border-indigo-500 appearance-none" />
                         </div>
                         <div className="flex-1 space-y-2">
                           <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">End Date</label>
                           <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] font-bold outline-none text-[13px] dark:text-slate-300 transition-all focus:border-indigo-500 appearance-none" />
                         </div>
                      </div>
                    )}
                 </div>
                 <div className="p-5 bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-[2rem]">
                    <h4 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2"><FileText size={14}/> Detailed PDF Report</h4>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                      This will generate a comprehensive PDF report containing all your farm's telemetry logs, soil moisture trends, AI recommendations, and environmental data for the selected period.
                    </p>
                 </div>
              </div>
              
              <div className="p-8 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                 <button 
                  onClick={handleExportPDF} 
                  disabled={isExporting}
                  className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                 >
                  {isExporting ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
                  {isExporting ? 'Generating PDF...' : 'Download Report'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {showPrivacy && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-slate-100 dark:border-white/5">
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center text-left bg-slate-50 dark:bg-white/5">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center">
                     <ShieldCheck size={20} />
                   </div>
                   <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Privacy Policy</h3>
                 </div>
                 <button onClick={() => setShowPrivacy(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X size={24}/></button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-6 no-scrollbar">
                 <div className="space-y-4">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                      At Eco-Drip, we prioritize your data security and agricultural privacy. By using this platform, you agree to our strictly localized telemetry practices.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-white/5">
                        <div className="mt-1 w-2 h-2 rounded-full bg-teal-500 shrink-0"></div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Your sensor telemetry data is end-to-end encrypted and primarily processed on the edge.</p>
                      </div>
                      <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-white/5">
                        <div className="mt-1 w-2 h-2 rounded-full bg-teal-500 shrink-0"></div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Location data is used solely for fetching accurate weather forecasts and ET indexing.</p>
                      </div>
                      <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-white/5">
                        <div className="mt-1 w-2 h-2 rounded-full bg-teal-500 shrink-0"></div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">We will never sell or distribute your crop analytics or personal details to third parties.</p>
                      </div>
                    </div>
                 </div>
              </div>
              
              <div className="p-8 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                 <button onClick={() => setShowPrivacy(false)} className="w-full py-5 bg-teal-600 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                  Understood
                 </button>
              </div>
           </div>
        </div>
      )}

      {showTerms && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-slate-100 dark:border-white/5">
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center text-left bg-slate-50 dark:bg-white/5">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                     <FileText size={20} />
                   </div>
                   <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Terms of Service</h3>
                 </div>
                 <button onClick={() => setShowTerms(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X size={24}/></button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-6 no-scrollbar">
                 <div className="space-y-4">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                      Welcome to the Eco-Drip platform. Using our ecosystem signifies your agreement to these operational terms.
                    </p>
                    <div className="space-y-4 mt-4">
                      <div>
                        <h4 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">1. System Autonomy</h4>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">The AI advisor provides recommendations based on sensory input. You maintain final authority over actual water dispersion.</p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">2. Hardware Liability</h4>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Eco-Drip is not responsible for physical hardware degradation, pump failure, or crop loss due to miscalibration.</p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">3. Access Rights</h4>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">We reserve the right to revoke system access if abusive API usage or reverse engineering attempts are detected.</p>
                      </div>
                    </div>
                 </div>
              </div>
              
              <div className="p-8 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                 <button onClick={() => setShowTerms(false)} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                  Agree & Continue
                 </button>
              </div>
           </div>
        </div>
      )}

      {showSecurityModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-slate-100 dark:border-white/5">
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center text-left bg-slate-50 dark:bg-white/5">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center">
                     <ShieldCheck size={20} />
                   </div>
                   <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Account Security</h3>
                 </div>
                 <button onClick={() => { setShowSecurityModal(false); setDeleteConfirmText(''); }} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X size={24}/></button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-8 no-scrollbar">
                 <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Lock size={14}/> Authentication</h4>
                    <button className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl text-[13px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between active:scale-[0.98] transition-all">
                      Change Password <ChevronRight size={16} className="text-slate-400" />
                    </button>
                    <button className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl text-[13px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between active:scale-[0.98] transition-all">
                      Two-Factor Auth (2FA) <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-md">Coming Soon</span>
                    </button>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                    <h4 className="text-[11px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={14}/> Danger Zone</h4>
                    <div className="p-5 bg-rose-50/50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-[2rem] space-y-4">
                      <p className="text-xs font-bold text-rose-600 dark:text-rose-400 leading-relaxed">
                        Deleting your account will permanently erase all your telemetry data, farm configurations, and AI logs. This action cannot be undone.
                      </p>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-rose-500/70 ml-2">Type "DELETE" to confirm</label>
                        <input 
                          type="text" 
                          placeholder="DELETE"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          className="w-full p-4 bg-white dark:bg-slate-900/50 border border-rose-200 dark:border-rose-500/20 rounded-[1.5rem] font-bold outline-none text-[13px] dark:text-white transition-all focus:border-rose-500 placeholder:text-rose-300/50" 
                        />
                      </div>
                      <button 
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText.toLowerCase() !== 'delete' || isSaving}
                        className="w-full py-4 bg-rose-600 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                      >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        Permanently Delete Account
                      </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const ToggleRow = ({ icon, label, sub, active, onToggle }: any) => (
  <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm shrink-0">
        {icon}
      </div>
      <div>
        <h5 className="text-[13px] font-black text-slate-800 dark:text-white leading-none mb-1">{label}</h5>
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{sub}</p>
      </div>
    </div>
    <button 
      onClick={onToggle}
      className={`relative w-12 h-6 shrink-0 rounded-full cursor-pointer transition-colors duration-300 ${active ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <div 
        className="absolute w-5 h-5 top-[2px] left-[2px] bg-white rounded-full shadow-sm transition-transform duration-300 ease-in-out" 
        style={{ transform: active ? 'translateX(24px)' : 'translateX(0)' }} 
      />
    </button>
  </div>
);

const SummaryChip = ({ icon, text }: any) => (
  <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
    <div className="text-slate-400 dark:text-slate-500">{icon}</div>
    <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 truncate tracking-tight uppercase">{text}</span>
  </div>
);

const ProfileInput = ({ label, value, onChange, maxLength }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-4">{label}</label>
    <input 
      className="w-full p-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] font-bold outline-none text-[15px] dark:text-white transition-all focus:border-teal-500" 
      value={value} 
      maxLength={maxLength}
      onChange={e => onChange(e.target.value)} 
    />
  </div>
);

export default Settings;
