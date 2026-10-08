import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Star, Flame, Users, Droplets, Target, Shield, Award, ChevronRight, Check, ArrowLeft } from 'lucide-react';

const MOCK_LEADERBOARD = [
  { id: 1, name: 'EcoWarrior_99', xp: 12500, saves: '450L', level: 42, avatar: '🌊' },
  { id: 2, name: 'GreenThumb_AI', xp: 11200, saves: '390L', level: 38, avatar: '🌱' },
  { id: 3, name: 'DripMaster', xp: 10800, saves: '385L', level: 36, avatar: '💧' },
  { id: 4, name: 'Botanist_Pro', xp: 9500, saves: '310L', level: 31, avatar: '🔬' },
  { id: 5, name: 'SolarPioneer', xp: 8900, saves: '280L', level: 29, avatar: '☀️' },
];

const ACHIEVEMENTS = [
  { id: 1, title: 'Water Sensei', desc: 'Saved 100L in a single week', icon: <Droplets className="text-blue-400" />, unlocked: true },
  { id: 2, title: 'Neural Farmer', desc: 'Used AI Advice for 30 consecutive days', icon: <Target className="text-teal-400" />, unlocked: true },
  { id: 3, title: 'Solar Guardian', desc: 'Nodes maintained 100% solar health for a month', icon: <Shield className="text-orange-400" />, unlocked: false },
  { id: 4, title: 'Species Hunter', desc: 'Discovered 50 unique plant species', icon: <Star className="text-yellow-400" />, unlocked: false },
];

interface CommunityProps {
  onBack?: () => void;
}

const Community: React.FC<CommunityProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'achievements'>('leaderboard');

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 dark:text-slate-500 font-black uppercase text-[10px] tracking-widest px-2 mb-4 hover:text-indigo-500 transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={3} /> Return to Terminal
        </button>
      )}
      <div className="bg-[#0c1421] p-8 md:p-12 rounded-[3.5rem] text-white relative overflow-hidden group shadow-2xl border-b-8 border-indigo-600">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-indigo-400 mb-4">
            <Users size={16} fill="currentColor" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Global Mesh Network</span>
          </div>
          <h2 className="text-5xl font-black italic tracking-tighter leading-none mb-4">EcoHub</h2>
          <p className="text-[11px] font-bold text-slate-400 max-w-[240px] italic opacity-70">Collaborate with the global collective to maximize biological efficiency.</p>
        </div>
        <Trophy size={120} className="absolute -right-8 -bottom-8 text-indigo-500 opacity-10 group-hover:scale-110 transition-transform duration-700" />
      </div>

      {/* Selector */}
      <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden transition-colors">
        <button onClick={() => setActiveTab('leaderboard')} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'leaderboard' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-xl' : 'text-slate-400 dark:text-slate-500'}`}>
          <Award size={16} strokeWidth={3} /> Global Rank
        </button>
        <button onClick={() => setActiveTab('achievements')} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'achievements' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-xl' : 'text-slate-400 dark:text-slate-500'}`}>
          <Medal size={16} strokeWidth={3} /> Milestones
        </button>
      </div>

      {activeTab === 'leaderboard' ? (
        <div className="space-y-3">
          {MOCK_LEADERBOARD.map((user, index) => (
            <motion.div 
              key={user.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center justify-between p-5 rounded-[2.2rem] bg-white dark:bg-slate-800 border ${index === 0 ? 'border-indigo-500/30 shadow-indigo-500/5' : 'border-slate-100 dark:border-white/5'} shadow-sm transition-all hover:scale-[1.01]`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 flex items-center justify-center text-2xl rounded-2xl ${index === 0 ? 'bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-400/20 shadow-lg shadow-indigo-500/10' : 'bg-slate-50 dark:bg-slate-900'}`}>
                  {user.avatar}
                </div>
                <div>
                   <h4 className="text-[13px] font-black text-slate-800 dark:text-white flex items-center gap-2">
                     {user.name}
                     {index === 0 && <Flame size={12} className="text-orange-500 fill-orange-500" />}
                   </h4>
                   <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[8px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-900 text-slate-400 rounded-full uppercase tracking-widest">LVL {user.level}</span>
                      <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest italic">{user.xp.toLocaleString()} XP</span>
                   </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-black text-slate-900 dark:text-white italic tracking-tighter">-{user.saves}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SAVED</p>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ACHIEVEMENTS.map((ach) => (
            <div key={ach.id} className={`p-6 rounded-[2.5rem] border bg-white dark:bg-slate-800 transition-all ${ach.unlocked ? 'border-slate-100 dark:border-white/5 opacity-100 shadow-sm' : 'border-dashed border-slate-200 dark:border-white/10 opacity-50'}`}>
               <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${ach.unlocked ? 'bg-slate-50 dark:bg-slate-900 shadow-inner' : 'bg-slate-100 dark:bg-slate-950/30'}`}>
                     {ach.icon}
                  </div>
                  {ach.unlocked ? (
                    <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                       <Check size={12} strokeWidth={4} />
                    </div>
                  ) : (
                    <div className="w-2 h-2 bg-slate-300 rounded-full" />
                  )}
               </div>
               <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight mb-1">{ach.title}</h4>
               <p className="text-[10px] font-bold text-slate-400 italic leading-relaxed">{ach.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Community;
