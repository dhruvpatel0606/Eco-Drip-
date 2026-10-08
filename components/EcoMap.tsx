import React from 'react';
import { motion } from 'framer-motion';
import { Device } from '../types';
import { MapPin, Droplet, Thermometer, Battery, Signal, Zap } from 'lucide-react';

interface EcoMapProps {
  devices: Device[];
}

const EcoMap: React.FC<EcoMapProps> = ({ devices }) => {
  return (
    <div className="relative w-full aspect-square md:aspect-video bg-[#0c1421] rounded-[3rem] overflow-hidden border-b-8 border-teal-500 shadow-2xl group">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-20" 
           style={{ 
             backgroundImage: 'radial-gradient(circle at 2px 2px, #14b8a6 1px, transparent 0)',
             backgroundSize: '40px 40px' 
           }}>
      </div>

      {/* Atmospheric Depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-teal-500/10 via-transparent to-transparent pointer-events-none"></div>
      
      {/* 3D Scene Rotator */}
      <div className="absolute inset-0 flex items-center justify-center perspective-[1500px]">
        <motion.div 
          initial={{ rotateX: 60, rotateZ: -45, scale: 0.8 }}
          animate={{ rotateZ: [-45, -40, -45] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-[80%] h-[80%] origin-center flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Ground Plane */}
          <div className="absolute inset-0 bg-teal-500/5 border-2 border-teal-500/20 rounded-[2rem] shadow-[0_0_100px_rgba(20,184,166,0.1)] backdrop-blur-sm">
            <div className="absolute inset-0 overflow-hidden rounded-[2rem]">
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="absolute inset-0 border border-teal-500/10" style={{ transform: `scale(${1 - i * 0.08})` }}></div>
                ))}
            </div>
          </div>

          {/* Device Nodes as 3D Pillars */}
          {devices.map((device, index) => {
            // Calculate positions (circular or grid)
            const angle = (index / devices.length) * Math.PI * 2;
            const radius = 120;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <motion.div
                key={device.id}
                initial={{ z: 200, opacity: 0 }}
                animate={{ z: 0, opacity: 1 }}
                transition={{ delay: index * 0.2 }}
                className="absolute"
                style={{ 
                    left: `calc(50% + ${x}px)`, 
                    top: `calc(50% + ${y}px)`,
                    transformStyle: 'preserve-3d',
                    transform: 'translate(-50%, -50%)'
                }}
              >
                {/* Visual Aura */}
                <motion.div 
                  animate={{ scale: device.id === '1' ? [1, 1.8, 1] : [1, 1.5, 1], opacity: device.id === '1' ? [0.3, 0.6, 0.3] : [0.2, 0.4, 0.2] }}
                  transition={{ duration: device.id === '1' ? 1.5 : 3, repeat: Infinity, delay: index * 0.5 }}
                  className={`absolute -inset-10 rounded-full blur-2xl ${device.id === '1' ? 'bg-emerald-400/80' : (device.moisture < 30 ? 'bg-orange-500' : 'bg-teal-400')}`}
                />

                {/* Vertical Pillar */}
                <div className="relative w-12 h-12 flex flex-col items-center" style={{ transform: 'rotateX(-60deg) rotateY(0deg) rotateZ(45deg)' }}>
                   {/* Floating Icon Card */}
                   <motion.div 
                     animate={{ y: [0, -15, 0] }}
                     transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: index * 0.3 }}
                     className="bg-white dark:bg-slate-900 border border-teal-500/30 rounded-2xl p-3 shadow-2xl flex flex-col items-center gap-1.5 z-10 min-w-[75px]"
                   >
                      <div className="flex items-center gap-1">
                         <Zap size={10} className={device.status === 'online' ? 'text-teal-500' : 'text-slate-400'} />
                         <span className="text-[7px] font-black uppercase text-slate-800 dark:text-white truncate max-w-[50px]">{device.name}</span>
                      </div>
                      
                      <div className="flex flex-col items-center gap-0.5 border-t border-slate-100 dark:border-white/5 pt-1 w-full text-center">
                         <span className="text-[9px] font-extrabold text-teal-600 dark:text-teal-400 leading-none">{device.moisture}% Moist</span>
                         <span className="text-[6.5px] font-semibold text-slate-400 dark:text-slate-500 leading-none mt-0.5">pH {device.ph} • {device.temperature}°C</span>
                      </div>

                      {device.id === '1' && (
                         <span className="text-[5px] font-black bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded border border-emerald-400/20 uppercase tracking-widest animate-pulse mt-0.5">
                            Live Model
                         </span>
                      )}
                   </motion.div>

                   {/* Stem connection */}
                   <div className="h-12 w-0.5 bg-gradient-to-t from-teal-500 via-teal-500/50 to-transparent -mt-1 opacity-40"></div>
                   
                   {/* Ground Contact */}
                   <div className="w-4 h-4 bg-teal-500 rounded-full blur-[2px] opacity-40 shadow-[0_0_15px_#14b8a6]"></div>
                </div>

                {/* Telemetry Tooltip on Hover */}
                {/* (Simplified as visual markers) */}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Overlay UI */}
      <div className="absolute top-8 left-8 z-20">
         <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl">
            <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse shadow-[0_0_10px_#2dd4bf]"></div>
            <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Holographic Mesh Active</h4>
         </div>
      </div>

      <div className="absolute bottom-8 right-8 z-20 flex gap-2">
         <div className="flex flex-col items-end">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Signal Fidelity</p>
            <div className="flex gap-1">
               {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`w-1 h-3 rounded-full ${i < 3 ? 'bg-teal-500' : 'bg-slate-700'}`}></div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default EcoMap;
