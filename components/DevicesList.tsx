import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { Device } from '../types';
import { Power, Droplets, Zap, Battery, FlaskConical, Wifi, Plus, Settings2, X, Check, Trash2, Link, Cable, Radio, LayoutGrid, Globe } from 'lucide-react';
import { logActivity, ActivityType, logInteraction } from '../src/lib/activity';
import { supabase } from '../src/lib/supabase';
import EcoMap from './EcoMap';

interface ModulesListProps {
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  isHardwareConnected?: boolean;
  onHardwareConnect?: (port: any) => void;
  onWirelessConnect?: (ip: string) => void;
  onGainXp?: (amount: number) => void;
  isPumpActive?: boolean;
  onTogglePump?: (state: boolean) => void;
}

const DevicesList: React.FC<ModulesListProps> = ({ devices, setDevices, isHardwareConnected, onHardwareConnect, onWirelessConnect, onGainXp, isPumpActive, onTogglePump }) => {
  const [activeSubTab, setActiveSubTab] = useState<'grid' | 'map'>('grid');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [isWirelessFormOpen, setIsWirelessFormOpen] = useState(false);
  const [ipAddress, setIpAddress] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleGroup, setNewModuleGroup] = useState<'Outdoor' | 'Indoor' | 'Greenhouse'>('Outdoor');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

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
  const connectToArduino = async () => {
    logInteraction('USB_BRIDGE_BTN', 'CLICK', 'Mesh Network');
    if (!('serial' in navigator)) {
      alert("Web Serial not supported. Use Chrome.");
      return;
    }
    try {
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      if (onHardwareConnect) onHardwareConnect(port);
      logActivity(ActivityType.HARDWARE_CONNECT, 'USB Device Connected');
    } catch (e) {}
  };

  const onToggle = async (id: string) => {
    const device = devices.find(d => d.id === id);
    if (!device) return;
    const newStatus = device.status === 'online' ? 'offline' : 'online';
    
    logInteraction(`NodeToggle_${id}`, 'CLICK', 'Mesh Network');
    logActivity(ActivityType.NODE_TOGGLE, `Node ${device.name} status changed to ${newStatus}`);
    
    try {
      const { error } = await supabase
        .from('devices')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      setDevices(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
    } catch (e) {
      console.error("Device toggle error:", e);
    }
  };

  const handleWirelessConnect = async () => {
    if (!ipAddress.trim()) return;
    logInteraction('WIRELESS_LINK_CONFIRM', 'CLICK', 'Mesh Network');
    if (onWirelessConnect) onWirelessConnect(ipAddress);
    logActivity(ActivityType.HARDWARE_CONNECT, `Wireless Node Linked: ${ipAddress}`);
    setIsWirelessFormOpen(false);
  };

  const handleAddModule = async () => {
    if (!newModuleName.trim()) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    logInteraction('ADD_NODE_CONFIRM', 'CLICK', 'Mesh Network');
    const newModule: Device = {
      id: Math.random().toString(36).substr(2, 9),
      name: newModuleName,
      group: newModuleGroup,
      status: 'online',
      moisture: 50,
      temperature: 20,
      ph: 7.0,
      battery: 100,
      lastWatered: 'Never',
      solarHealth: 100,
      signalStrength: 100,
      npk: { n: 50, p: 50, k: 50 }
    };

    try {
      const { error } = await supabase.from('devices').insert([{
        id: newModule.id,
        user_id: user.id,
        name: newModule.name,
        group: newModule.group,
        status: newModule.status,
        moisture: newModule.moisture,
        temperature: newModule.temperature,
        ph: newModule.ph,
        battery: newModule.battery,
        last_watered: newModule.lastWatered,
        solar_health: newModule.solarHealth,
        signal_strength: newModule.signalStrength,
        npk: newModule.npk,
        ip_address: '' 
      }]);

      if (error) throw error;

      setDevices([...devices, newModule]);
      logActivity(ActivityType.NODE_ADD, `New Node Added: ${newModuleName} (${newModuleGroup})`);
      setNewModuleName('');
      setIsAddModalOpen(false);
      if (onGainXp) onGainXp(250);
    } catch (e) {
      console.error("Add device error:", e);
      alert("Failed to add device to cloud.");
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm("De-link this node from your network?")) return;
    try {
      const { error } = await supabase.from('devices').delete().eq('id', id);
      if (error) throw error;
      setDevices(devices.filter(d => d.id !== id));
      logActivity(ActivityType.NODE_TOGGLE, "Node removed from network");
    } catch (e) {
      console.error("Delete device error:", e);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in no-scrollbar pb-10">
      {/* Sub Tab Selector */}
      <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden transition-colors">
        <button onClick={() => setActiveSubTab('grid')} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'grid' ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xl' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
          <LayoutGrid size={16} strokeWidth={3} /> Node Terminal
        </button>
        <button onClick={() => setActiveSubTab('map')} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'map' ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xl' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
          <Globe size={16} strokeWidth={3} /> Eco Map
        </button>
      </div>

      {activeSubTab === 'map' ? (
        <EcoMap devices={devices} />
      ) : (
        <>
          <div className="flex justify-between items-end px-2">
            <div>
              <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight transition-colors">Mesh Network</h2>
              <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">{devices.filter(d => d.status === 'online').length} Nodes Linked</p>
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="w-12 h-12 bg-slate-900 dark:bg-teal-600 text-white rounded-[1.2rem] flex items-center justify-center shadow-xl active:scale-90 transition-all hover:bg-teal-600"
            >
              <Plus size={24} />
            </button>
          </div>

          {/* Connectivity Hub */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={connectToArduino} 
              className={`p-6 rounded-[2.5rem] border-2 flex flex-col items-center gap-3 transition-all ${isHardwareConnected ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-500/20' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-white/5 shadow-sm'}`}
            >
              <Cable size={24} className={isHardwareConnected ? 'text-emerald-500' : 'text-slate-400'} />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">USB Bridge</span>
            </button>
            <button 
              onClick={() => setIsWirelessFormOpen(true)}
              className={`p-6 rounded-[2.5rem] border-2 flex flex-col items-center gap-3 transition-all ${isHardwareConnected ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-500/20' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-white/5 shadow-sm'}`}
            >
              <Radio size={24} className={isHardwareConnected ? 'text-emerald-500' : 'text-slate-400'} />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Wireless Link</span>
            </button>
            <button 
              onClick={() => onTogglePump?.(!isPumpActive)}
              className={`col-span-2 p-6 rounded-[2.5rem] border-2 flex flex-row justify-center items-center gap-4 transition-all ${isPumpActive ? 'bg-teal-600 border-teal-500 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-white/5 shadow-sm text-slate-600 dark:text-slate-300'}`}
            >
              <Power size={24} className={isPumpActive ? 'text-white animate-pulse' : 'text-slate-400'} />
              <div className="text-left">
                <span className="block text-sm font-black uppercase tracking-widest leading-none mb-1">Main Pump</span>
                <span className={`block text-[10px] font-bold uppercase tracking-widest ${isPumpActive ? 'text-teal-200' : 'text-slate-400'}`}>{isPumpActive ? 'Status: ON' : 'Status: OFF'}</span>
              </div>
            </button>
          </div>

          {devices.map(device => (
            <div key={device.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-6 animate-slide-up transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${device.status === 'online' ? 'bg-teal-600 text-white shadow-xl shadow-teal-500/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500'}`}><Droplets /></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-lg text-slate-800 dark:text-white leading-none">{device.name}</h3>
                      {device.status === 'online' && <Wifi size={12} className="text-teal-500" />}
                    </div>
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mt-1 tracking-widest">{device.group} • {device.lastWatered}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                      onClick={() => onToggle(device.id)} 
                      className={`p-4 rounded-2xl transition-all active:scale-90 ${device.status === 'online' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500'}`}
                    >
                      <Power size={20} />
                  </button>
                  <button 
                      onClick={() => handleDeleteDevice(device.id)} 
                      className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-500 active:scale-90 transition-all"
                    >
                      <Trash2 size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 px-1">
                <div className="flex justify-between items-end">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Node Telemetry</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white">{device.moisture}%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-50 dark:bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 transition-all duration-1000" style={{ width: `${device.moisture}%` }}></div>
                </div>
              </div>

              {/* Automation Rules UI */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-4">
                <div className="flex items-center justify-between px-1">
                   <div>
                     <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest block mb-0.5 flex items-center gap-2"><Zap size={12} className="text-amber-500" /> Auto-Pilot</span>
                     <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Smart Irrigation</span>
                   </div>
                   <button 
                     onClick={() => {
                        const newMode = !device.autoMode;
                        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, autoMode: newMode } : d));
                     }}
                     className={`w-10 h-5 rounded-full relative transition-colors ${device.autoMode ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                   >
                      <div className={`absolute w-3 h-3 bg-white rounded-full top-1 transition-transform ${device.autoMode ? 'left-6' : 'left-1'}`}></div>
                   </button>
                </div>

                {device.autoMode && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl animate-fade-in border border-slate-100 dark:border-white/5">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Moisture Trigger Threshold</span>
                       <span className="text-sm font-black text-teal-600 dark:text-teal-400">{device.moistureThreshold || 30}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" max="80" step="5"
                      value={device.moistureThreshold || 30}
                      onChange={(e) => {
                         const val = parseInt(e.target.value);
                         setDevices(prev => prev.map(d => d.id === device.id ? { ...d, moistureThreshold: val } : d));
                      }}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500 outline-none"
                    />
                    <div className="flex justify-between mt-2">
                       <span className="text-[8px] font-bold text-slate-400">Bone Dry (10%)</span>
                       <span className="text-[8px] font-bold text-slate-400">Soaked (80%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Wireless Link Modal */}
      {isWirelessFormOpen && createPortal(
        <div className={`fixed inset-0 z-[100] flex justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in ${
          isKeyboardOpen ? 'items-start pt-10' : 'items-center'
        }`}>
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-[3rem] p-10 shadow-2xl border-t-4 border-teal-500">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight italic mb-8">Node IP Config</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Assigned IP Address</label>
                <input 
                  type="text" 
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="e.g. 192.168.1.100"
                  className="w-full p-5 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-teal-500 rounded-2xl font-bold outline-none dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsWirelessFormOpen(false)} className="flex-1 py-5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Cancel</button>
                <button onClick={handleWirelessConnect} className="flex-[2] py-5 bg-teal-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Link Node</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Module Modal */}
      {isAddModalOpen && createPortal(
        <div className={`fixed inset-0 z-[100] flex justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in ${
          isKeyboardOpen ? 'items-start pt-10' : 'items-center'
        }`}>
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-[3rem] p-8 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight italic mb-8">Add Node</h3>
            <div className="space-y-6">
              <input 
                type="text" 
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                placeholder="Node Label"
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-bold outline-none dark:text-white"
              />
              <div className="flex gap-2">
                <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Cancel</button>
                <button onClick={handleAddModule} className="flex-[2] py-5 bg-teal-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Confirm Node</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DevicesList;
