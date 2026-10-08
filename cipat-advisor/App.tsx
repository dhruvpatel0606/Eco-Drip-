import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Home, Cpu, History as HistoryIcon, Bot, Settings as SettingsIcon, Bell, CheckCircle2, Search, CalendarDays, Droplets, Sparkles, ArrowRight, User, MapPin, Phone, Mail, Leaf, MoreHorizontal, ShieldCheck, RefreshCw, Zap, Terminal, AlertCircle, ShieldAlert, Activity, Link, Link2Off, Wifi, Loader2, Users } from 'lucide-react';
import { NavTab, Device, WeatherData, UserProfile, Crop, Schedule } from './types';
import Dashboard from './components/Dashboard';
import DevicesList from './components/DevicesList';
import HistoryLog from './components/HistoryLog';
import AIAdvisor from './components/AIAdvisor';
import Planner from './components/Planner';
import Settings from './components/Settings';
import Discovery from './components/Discovery';
import Community from './components/Community';
import Login from './components/Login';
import AutopilotCore from './components/AutopilotCore';
import CipatAdvisor from './components/CipatAdvisor';

import { supabase } from './src/lib/supabase';
import { logActivity, ActivityType } from './src/lib/activity';

import { App as CapApp } from '@capacitor/app';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { sendPushNotification } from './lib/notifications';
import { requestAllPermissions } from './lib/permissions';

const INITIAL_PROFILE: UserProfile = {
  name: '',
  email: '',
  password: '',
  phone: '',
  location: '',
  gardenType: 'Farm',
  soilType: 'Loam',
  avatar: '',
  gardenSize: 0,
  experience: 'Beginner',
  level: 1,
  xp: 0
};

const MOCK_DEVICES: Device[] = [
  { id: '1', name: 'Front Lawn', group: 'Outdoor', status: 'online', moisture: 42, temperature: 18, ph: 6.5, battery: 85, lastWatered: '2h ago', solarHealth: 92, signalStrength: 88, npk: { n: 65, p: 40, k: 55 }, autoMode: true, moistureThreshold: 30, flowRate: 5.2, waterStatus: 'Normal' },
  { id: '2', name: 'Veggie Garden', group: 'Greenhouse', status: 'online', moisture: 28, temperature: 22, ph: 6.8, battery: 45, lastWatered: '5h ago', solarHealth: 78, signalStrength: 95, npk: { n: 80, p: 70, k: 75 }, autoMode: false, moistureThreshold: 40, flowRate: 0.0, waterStatus: 'Normal' },
];

const MOCK_CROPS: Crop[] = [
  { id: 'c1', name: 'Wheat', variety: 'K-306', status: 'Optimal', health: 94, plantedDate: '2024-02-10', daysToHarvest: 14, moistureLevel: 45 },
  { id: 'c2', name: 'Cotton', variety: 'BT Hybrid', status: 'Stressed', health: 62, plantedDate: '2024-02-15', daysToHarvest: 35, moistureLevel: 28 },
];

const getDynamicMockForecast = () => {
  const forecast = [];
  for (let i = 1; i <= 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    forecast.push({
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      temp: 22 + Math.floor(Math.random() * 5),
      icon: ['☀️', '⛅', '🌧️'][Math.floor(Math.random() * 3)]
    });
  }
  return forecast;
};

const MOCK_WEATHER: WeatherData = {
  temp: 24,
  temperature: 24,
  precipitationProbability: 10,
  condition: 'Sunny',
  humidity: 62,
  windSpeed: 8,
  etIndex: 4.2,
  forecast: getDynamicMockForecast()
};

const TABS = [
  { id: NavTab.Home, icon: Home, label: 'HOME', color: '#2563eb' },
  { id: NavTab.CIPAT, icon: Sparkles, label: 'CIPAT', color: '#059669' },
  { id: NavTab.Discovery, icon: Search, label: 'SCAN', color: '#d97706' },
  { id: NavTab.AI, icon: Bot, label: 'AI', color: '#0d9488' },
  { id: NavTab.Planner, icon: CalendarDays, label: 'PLAN', color: '#e11d48' },
  { id: NavTab.History, icon: HistoryIcon, label: 'LOGS', color: '#475569' },
  { id: NavTab.Settings, icon: SettingsIcon, label: 'MORE', color: '#059669' },
];

const App: React.FC = () => {

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>(NavTab.Home);
  const [prevTabIndex, setPrevTabIndex] = useState(0);
  const [devices, setDevices] = useState<Device[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [weather, setWeather] = useState<WeatherData>(MOCK_WEATHER);
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [isWatering, setIsWatering] = useState(false);


  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isAutopilotArmed, setIsAutopilotArmed] = useState(() => localStorage.getItem('autopilot_armed') === 'true');
  const [autopilotMode, setAutopilotMode] = useState<'conserve' | 'yield'>('conserve');
  const [autopilotTargetMoisture, setAutopilotTargetMoisture] = useState(40);

  // Autopilot safeguards state and refs
  const [sensorError, setSensorError] = useState(false);
  const [autopilotCooldownRemaining, setAutopilotCooldownRemaining] = useState(0);
  const [dailyWateringCapReached, setDailyWateringCapReached] = useState(false);
  const [waitingForHysteresisRecovery, setWaitingForHysteresisRecovery] = useState(false);
  const [avgMoisture, setAvgMoisture] = useState<number | null>(null);

  const isWateringRef = useRef(isWatering);
  useEffect(() => {
    isWateringRef.current = isWatering;
  }, [isWatering]);

  const autopilotMoistureBufferRef = useRef<number[]>([]);
  const lastRawMoistureRef = useRef<number | null>(null);
  const consecutiveIdenticalReadingsRef = useRef(0);
  const waitingForHysteresisRecoveryRef = useRef(false);

  // Restore daily safety cap status on mount
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const saved = localStorage.getItem('autopilot_daily_stats');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.date === todayStr && (parsed.count >= 6 || parsed.seconds >= 600)) {
          setDailyWateringCapReached(true);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Cooldown countdown interval
  useEffect(() => {
    const timer = setInterval(() => {
      setAutopilotCooldownRemaining(prev => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const lastTriggeredScheduleRef = useRef<{ [key: string]: boolean }>({});
  const lastAutopilotTriggerRef = useRef<number>(0);
  const schedulesRef = useRef<Schedule[]>([]);
  const devicesRef = useRef<Device[]>([]);
  const autopilotArmedRef = useRef(isAutopilotArmed);
  const autopilotTargetMoistureRef = useRef(autopilotTargetMoisture);

  useEffect(() => {
    schedulesRef.current = schedules;
  }, [schedules]);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    autopilotArmedRef.current = isAutopilotArmed;
  }, [isAutopilotArmed]);

  useEffect(() => {
    autopilotTargetMoistureRef.current = autopilotTargetMoisture;
  }, [autopilotTargetMoisture]);

  const weatherRef = useRef(weather);
  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);

  const isRainPredicted = useMemo(() => {
    return weather.forecast.some(f => f.icon.includes('🌧️') || f.icon.includes('🌦️') || f.icon.includes('⛈️'));
  }, [weather]);

  const isRainPredictedRef = useRef(isRainPredicted);
  useEffect(() => {
    isRainPredictedRef.current = isRainPredicted;
  }, [isRainPredicted]);

  const requestLiveLocation = (userId?: string) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(4);
          const lon = pos.coords.longitude.toFixed(4);
          const locString = `${lat},${lon}`;
          setProfile(prev => ({ ...prev, location: locString }));
          if (userId) {
            supabase.from('users').update({ location: locString }).eq('id', userId).then();
          }
        },
        (err) => {
          console.warn('Geolocation error:', err.message);
        }
      );
    } else {
      console.warn('Geolocation not supported');
    }
  };
  const [isPumpActive, setIsPumpActive] = useState(false);
  const [showNote, setShowNote] = useState<string | null>(null);
  const [appNotifications, setAppNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const gainXp = async (amount: number) => {
    if (!profile.id) return;
    const newXp = (profile.xp || 0) + amount;
    const newLevel = Math.floor(newXp / 1000) + 1;

    const updatedProfile = { ...profile, xp: newXp, level: newLevel };
    setProfile(updatedProfile);

    try {
      await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('id', profile.id);
      if (newLevel > profile.level) {
        setShowNote(`Level Up! You are now Level ${newLevel}`);
      }
    } catch (e) {
      console.error("XP update error:", e);
    }
  };

  // Connectivity States
  const [serialPort, setSerialPort] = useState<any>(null);
  const [arduinoIp, setArduinoIp] = useState<string | null>(localStorage.getItem('arduino_ip'));
  const [isHardwareConnected, setIsHardwareConnected] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ecodrip_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    // Deep link listener for Capacitor OAuth
    const setupDeepLink = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          CapApp.addListener('appUrlOpen', async (event) => {
            if (event.url.includes('com.ecodrip.app://')) {
              // Parse tokens from the hash part of the deep link
              const hashPart = event.url.split('#')[1];
              if (hashPart) {
                const params = new URLSearchParams(hashPart);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                if (accessToken && refreshToken) {
                  await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                  });
                }
              }
            }
          });
        }
      } catch (e) {
        console.warn("Deep link listener setup failed", e);
      }
    };
    setupDeepLink();

    // Request all required permissions for push notifications, location, and camera
    requestAllPermissions();

    // Safety timeout in case Supabase hangs
    const fallbackTimer = setTimeout(() => {
      if (authLoading) {
        console.warn("Auth check timed out, falling back to guest mode.");
        handleUserSession(null);
      }
    }, 5000);

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(fallbackTimer);
      handleUserSession(session?.user ?? null);
    }).catch((err) => {
      clearTimeout(fallbackTimer);
      console.error("Session check failed:", err);
      handleUserSession(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUserSession(session?.user ?? null);
    });

    // Universal Keyboard/Input Focus Detection
    const handleFocusIn = (e: FocusEvent) => {
      if (!Capacitor.isNativePlatform()) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          setIsKeyboardOpen(true);
        }
      }
    };

    const handleFocusOut = () => {
      if (!Capacitor.isNativePlatform()) {
        setIsKeyboardOpen(false);
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    // Native Mobile Keyboard Detection
    if (Capacitor.isNativePlatform()) {
      Keyboard.addListener('keyboardWillShow', () => {
        setIsKeyboardOpen(true);
      });
      Keyboard.addListener('keyboardWillHide', () => {
        setIsKeyboardOpen(false);
      });
    }

    return () => {
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      if (Capacitor.isNativePlatform()) {
        Keyboard.removeAllListeners();
      }
    };
  }, []);

  useEffect(() => {
    const handleOffline = () => {
      setAppNotifications(prev => [{
        id: Date.now() + Math.random(),
        title: 'System Offline',
        body: 'Network connection lost. Operating in limited local mode.',
        type: 'alert',
        time: 'Just now'
      }, ...prev].slice(0, 10));
      // ✅ Correct
      setShowNotifications(true);

      setShowNote("System Offline");
      setTimeout(() => setShowNote(null), 3000);
    };

    const handleOnline = () => {
      setShowNote("System Online");
      setTimeout(() => setShowNote(null), 3000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);


  // Fetch weather when location changes
  useEffect(() => {
    if (profile.location) {
      import('./src/lib/weather').then(({ fetchWeather }) => {
        fetchWeather(profile.location).then(w => w && setWeather(w));
      });
    }
  }, [profile.location]);

  const handleUserSession = async (user: any) => {
    if (user) {
      setIsLoggedIn(true);

      // Handle Local Test Bypass
      if (user.email === 'test@test.com') {
        const testProfile: UserProfile = {
          id: user.id || 'test_user_id',
          name: 'Test Farmer',
          email: 'test@test.com',
          phone: '9999999999',
          location: 'Test Farm, Earth',
          gardenType: 'Farm',
          soilType: 'Loam',
          gardenSize: 10,
          experience: 'Master',
          avatar: 'T',
          level: 5,
          xp: 4200
        };
        setProfile(testProfile);
        setDevices(MOCK_DEVICES);
        setCrops(MOCK_CROPS);
        setShowSetup(false);
        setIsSyncing(true);
        setAuthLoading(false);
        return;
      }

      // Load profile, devices, and crops from Supabase
      try {
        const fetchPromise = Promise.all([
          supabase.from('users').select('*').eq('id', user.id).single(),
          supabase.from('devices').select('*').eq('user_id', user.id),
          supabase.from('crops').select('*').eq('user_id', user.id),
          supabase.from('watering_schedules').select('*').eq('user_id', user.id)
        ]);

        const timeoutPromise = new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error("Supabase fetch timeout")), 5000)
        );

        const [profileRes, devicesRes, cropsRes, schedulesRes] = await Promise.race([fetchPromise, timeoutPromise]);

        if (profileRes.data && !profileRes.error) {
          const mappedProfile: UserProfile = {
            id: profileRes.data.id,
            name: profileRes.data.full_name || '',
            email: profileRes.data.email || '',
            phone: profileRes.data.phone || '',
            location: profileRes.data.location || '',
            gardenType: profileRes.data.garden_type || 'Farm',
            soilType: profileRes.data.soil_type || 'Loam',
            gardenSize: profileRes.data.garden_size || 0,
            experience: profileRes.data.experience || 'Beginner',
            avatar: profileRes.data.avatar || '',
            level: profileRes.data.level || 1,
            xp: profileRes.data.xp || 0
          };
          setProfile(mappedProfile);
          setShowSetup(false);
          setIsSyncing(true);

          // Request live location to update coordinates and fetch live weather
          requestLiveLocation(user.id);

          // Fallback initial weather fetch if location is already present
          if (mappedProfile.location) {
            import('./src/lib/weather').then(({ fetchWeather }) => {
              fetchWeather(mappedProfile.location).then(w => w && setWeather(w));
            });
          }
        } else {
          setProfile(prev => ({ ...prev, email: user.email || '', id: user.id }));
          setShowSetup(true);
        }

        if (devicesRes.data && !devicesRes.error) {
          setDevices(devicesRes.data.map((d: any) => ({
            ...d,
            npk: d.npk || { n: 50, p: 50, k: 50 }
          })));
        }

        if (cropsRes.data && !cropsRes.error) {
          setCrops(cropsRes.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            variety: c.variety,
            status: c.status,
            health: c.health,
            plantedDate: c.planted_date,
            daysToHarvest: c.days_to_harvest
          })));
        }

        if (schedulesRes && schedulesRes.data && !schedulesRes.error) {
          setSchedules(schedulesRes.data.map((s: any) => ({
            id: s.id,
            moduleId: s.device_id,
            time: s.time.substring(0, 5), // HH:mm
            days: s.days,
            duration: s.duration,
            enabled: s.enabled
          })));
        }
      } catch (error) {
        console.error("Data load error:", error);
      }
    } else {
      setIsLoggedIn(false);
      setProfile(INITIAL_PROFILE);
      setDevices([]);
      setCrops([]);
      setSchedules([]);
      requestLiveLocation();
    }
    setAuthLoading(false);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('ecodrip_theme', theme);
  }, [theme]);

  // Notification Logic (Virtual Monitor)
  useEffect(() => {
    if (devices.length === 0) return;

    const checkVitals = () => {
      const newNotifications: any[] = [];

      // 1. Soil Moisture Alert & Auto-Pilot check
      devices.forEach(d => {
        if (d.status !== 'online') return;

        // Auto-pilot trigger
        if (d.autoMode && d.moistureThreshold && d.moisture <= d.moistureThreshold) {
          newNotifications.push({
            id: Date.now() + Math.random(),
            title: 'Auto-Pilot Engaged',
            body: `${d.name} dropped below ${d.moistureThreshold}%. Irrigation protocol initiated automatically.`,
            type: 'success',
            time: 'Just now'
          });
          // Here, in a real app, we would dispatch sendCommand(`VALVE_${d.id}_ON`)
        } else if (d.moisture < 25) {
          // Manual alert if auto-pilot is off
          newNotifications.push({
            id: Date.now() + Math.random(),
            title: 'Critical Dehydration',
            body: `${d.name} moisture critical (${d.moisture}%). Action required.`,
            type: 'alert',
            time: 'Just now'
          });
        }
      });

      if (newNotifications.length > 0) {
        setAppNotifications(prev => [...newNotifications, ...prev].slice(0, 10));

        // Trigger real push notifications to the device
        newNotifications.forEach(n => {
          sendPushNotification(n.title, n.body);
        });
      }
    };

    const interval = setInterval(checkVitals, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [devices]);

  // Scheduler Loop for watering schedules
  useEffect(() => {
    const checkSchedules = async () => {
      const activeSchedules = schedulesRef.current;
      if (activeSchedules.length === 0) return;

      const now = new Date();
      // Manually construct local HH:mm format to bypass locale/platform quirks
      const currentHHMM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      // Map local weekday number to English abbreviations matching DB schema
      const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const currentDay = DAYS_OF_WEEK[now.getDay()];
      // Construct local YYYY-MM-DD date string to avoid UTC shift issues
      const currentDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

      console.log(`[Scheduler] Running check at ${currentHHMM} (${currentDay}, ${currentDate}). Active schedules: ${activeSchedules.length}`);

      activeSchedules.forEach(async (schedule) => {
        if (!schedule.enabled) return;

        // Extract HH:mm parts and compare safely
        const schedTime = (schedule.time || "").trim().substring(0, 5);
        const matchesTime = schedTime === currentHHMM;

        // Cast to any to bypass TypeScript compiler's static narrowing (since days can run as a string at runtime due to database configurations)
        const daysVal = schedule.days as any;
        let scheduleDays: string[] = [];
        if (Array.isArray(daysVal)) {
          scheduleDays = daysVal;
        } else if (typeof daysVal === 'string') {
          try {
            const parsed = JSON.parse(daysVal);
            if (Array.isArray(parsed)) {
              scheduleDays = parsed;
            } else {
              scheduleDays = [daysVal];
            }
          } catch (e) {
            scheduleDays = daysVal.split(',').map((d: string) => d.trim());
          }
        }

        const matchesDay = scheduleDays.some(d => d.trim() === currentDay);
        const matchesDate = scheduleDays.some(d => d.trim().substring(0, 10) === currentDate);

        console.log(`[Scheduler] Schedule ${schedule.id}: time=${schedTime} (match=${matchesTime}), days=${JSON.stringify(scheduleDays)} (matchDay=${matchesDay}, matchDate=${matchesDate})`);

        if (matchesTime && (matchesDay || matchesDate)) {
          // Use stable moduleId and time instead of unstable schedule.id to prevent double triggering when optimistic ID is swapped with database ID
          const triggerKey = `${currentDate}_${currentHHMM}_${schedule.moduleId}_${schedTime}`;
          // If already triggered in this minute, skip
          if (lastTriggeredScheduleRef.current[triggerKey]) return;
          lastTriggeredScheduleRef.current[triggerKey] = true;

          const deviceName = devicesRef.current.find(d => d.id === schedule.moduleId)?.name || 'Main Node';

          // Rain Skip check
          if (isRainPredictedRef.current) {
            console.log(`[Scheduler] Skipping schedule due to rain: ${schedule.id}`);
            sendCommandRef.current('RAIN_SKIP_ON');
            logActivity(ActivityType.IRRIGATION_EVENT, `Scheduled plan skipped: Zone "${deviceName}" watering suspended due to rain forecast.`);
            return;
          }

          console.log(`[Scheduler] TRIGGERED schedule: ${schedule.id} for device ${schedule.moduleId}`);

          // Execute watering
          setIsWatering(true);
          sendCommandRef.current('WATER_ON');
          sendCommandRef.current(`SCHEDULE_ON?dur=${schedule.duration * 60}`);

          // Log in activity logs and watering history
          logActivity(ActivityType.IRRIGATION_EVENT, `Scheduled plan executed: Zone "${deviceName}" watered for ${schedule.duration} min.`);

          const { logWatering } = await import('./src/lib/activity');
          logWatering(schedule.moduleId, `${schedule.duration}m (Plan)`, `${(schedule.duration * 0.5).toFixed(1)}L`);

          // Run for the actual scheduled duration in minutes (converted to milliseconds)
          const durationMinutes = Number(schedule.duration) || 1;
          const runtimeMs = durationMinutes * 60 * 1000;

          console.log(`[Scheduler] Scheduling turn-off for device ${schedule.moduleId} in ${runtimeMs}ms (${durationMinutes} min)`);

          setTimeout(() => {
            setIsWatering(false);
            sendCommandRef.current('WATER_OFF');
            sendCommandRef.current('SCHEDULE_OFF');
            setShowNote(`Scheduled Cycle for ${deviceName} Completed`);
            setTimeout(() => setShowNote(null), 2500);
          }, runtimeMs);
        }
      });
    };

    const interval = setInterval(checkSchedules, 5000); // Check every 5s for precision
    return () => clearInterval(interval);
  }, []);

  // Autopilot Control Loop (Persistent, unaffected by telemetry updates)
  useEffect(() => {
    const checkAutopilot = async () => {
      // 5. FEATURE COORDINATION
      if (isWateringRef.current) {
        console.log('[Autopilot] Skip: Watering is currently active from another source.');
        return;
      }

      if (!autopilotArmedRef.current) return;

      // Find the active hardware device (usually id '1' or the first online device)
      const currentDevices = devicesRef.current;
      const hardwareDevice = currentDevices.find(d => d.id === '1') || currentDevices[0];
      if (!hardwareDevice || hardwareDevice.status !== 'online') return;

      const moisture = hardwareDevice.moisture;

      // 4. SENSOR FAULT DETECTION
      const isStuck = lastRawMoistureRef.current !== null && lastRawMoistureRef.current === moisture;
      if (isStuck) {
        consecutiveIdenticalReadingsRef.current += 1;
      } else {
        consecutiveIdenticalReadingsRef.current = 0;
      }
      lastRawMoistureRef.current = moisture;

      const isInvalidRange = moisture < 0 || moisture > 100;
      const isSensorFaulty = consecutiveIdenticalReadingsRef.current >= 8 || isInvalidRange;

      setSensorError(isSensorFaulty);

      if (isSensorFaulty) {
        console.warn(`[Autopilot] Sensor error detected: stuck/invalid value (${moisture}%). Skipping trigger.`);
        return;
      }

      // 1. SENSOR AVERAGING
      autopilotMoistureBufferRef.current.push(moisture);
      if (autopilotMoistureBufferRef.current.length > 5) {
        autopilotMoistureBufferRef.current.shift();
      }
      const rollingAvg = autopilotMoistureBufferRef.current.reduce((a, b) => a + b, 0) / autopilotMoistureBufferRef.current.length;
      setAvgMoisture(rollingAvg);

      // 2. LONGER COOLDOWN: 10 minutes (600,000 ms)
      const now = Date.now();
      const cooldownMs = 10 * 60 * 1000;
      const elapsed = now - lastAutopilotTriggerRef.current;
      if (elapsed < cooldownMs) {
        setAutopilotCooldownRemaining(Math.ceil((cooldownMs - elapsed) / 1000));
        return;
      } else {
        setAutopilotCooldownRemaining(0);
      }

      // 6. DAILY SAFETY CAP
      const todayStr = new Date().toISOString().split('T')[0];
      let dailyStats = { date: todayStr, count: 0, seconds: 0 };
      try {
        const saved = localStorage.getItem('autopilot_daily_stats');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.date === todayStr) {
            dailyStats = parsed;
          }
        }
      } catch (e) {
        console.error('Failed to read daily stats:', e);
      }

      const capHit = dailyStats.count >= 6 || dailyStats.seconds >= 600;
      setDailyWateringCapReached(capHit);
      if (capHit) {
        console.warn(`[Autopilot] Daily safety cap hit: count=${dailyStats.count}, seconds=${dailyStats.seconds}. Skipping trigger.`);
        return;
      }

      // 3. HYSTERESIS recovery check
      const targetMoisture = autopilotTargetMoistureRef.current;
      if (waitingForHysteresisRecoveryRef.current) {
        if (rollingAvg >= targetMoisture + 5) {
          waitingForHysteresisRecoveryRef.current = false;
          setWaitingForHysteresisRecovery(false);
          console.log(`[Autopilot] Recovery threshold hit (rollingAvg ${rollingAvg}% >= target ${targetMoisture + 5}%). Autopilot re-armed.`);
        } else {
          console.log(`[Autopilot] Waiting for hysteresis recovery: current rollingAvg is ${rollingAvg}%, target recovery is ${targetMoisture + 5}%`);
          return;
        }
      }

      // Autopilot trigger condition based on strategy target moisture and smoothed rolling average
      if (rollingAvg <= targetMoisture) {
        lastAutopilotTriggerRef.current = now;
        setAutopilotCooldownRemaining(600); // 10 minutes remaining in seconds

        // Enable Hysteresis recovery state on trigger
        waitingForHysteresisRecoveryRef.current = true;
        setWaitingForHysteresisRecovery(true);

        // Dynamic watering duration calculation:
        const moistureDeficit = targetMoisture - rollingAvg;
        const moistureAdjustment = moistureDeficit * 0.4; // 0.4s per percentage point dry

        const temp = hardwareDevice.temperature || 24;
        let tempAdjustment = 0;
        if (temp > 28) {
          tempAdjustment = (temp - 28) * 0.3; // extra hydration for high heat evaporation
        } else if (temp < 15) {
          tempAdjustment = (temp - 15) * 0.2; // reduce duration for cool weather
        }

        const baseTime = 5; // base duration in seconds
        // phAdjustment is removed from calculation as requested
        const calculatedSeconds = Math.max(3, Math.round(baseTime + moistureAdjustment + tempAdjustment));

        console.log(`[Autopilot] Triggered: moisture (avg)=${rollingAvg.toFixed(1)}%, temp=${temp}°C. Calculated run duration: ${calculatedSeconds} seconds.`);

        setIsWatering(true);
        sendCommandRef.current('WATER_ON');
        sendCommandRef.current(`AUTOPILOT_ON?dur=${calculatedSeconds}`);

        const formulaDetails = `Formula: [Base(5s) + Deficit(${moistureDeficit.toFixed(1)}% x 0.4s) + TempAdj(${tempAdjustment.toFixed(1)}s)]`;

        logActivity(
          ActivityType.IRRIGATION_EVENT,
          `AI Autopilot engaged: Zone "${hardwareDevice.name}". Calculated run duration: ${calculatedSeconds}s based on physical vitals. ${formulaDetails}`
        );

        const { logWatering } = await import('./src/lib/activity');
        logWatering(hardwareDevice.id, `AI Auto: ${calculatedSeconds}s`, `${(calculatedSeconds * 0.65).toFixed(2)}L`);

        // Update daily safety cap stats
        dailyStats.count += 1;
        dailyStats.seconds += calculatedSeconds;
        localStorage.setItem('autopilot_daily_stats', JSON.stringify(dailyStats));

        if (dailyStats.count >= 6 || dailyStats.seconds >= 600) {
          setDailyWateringCapReached(true);
          logActivity(ActivityType.ALERT, 'AI Autopilot safety limit reached: Daily watering cap exceeded. Autopilot disabled until tomorrow.');
          sendPushNotification('Autopilot Paused', 'Daily watering limit reached. Resumes tomorrow.');
        }

        // Automatically turn off the motor after the dynamically calculated time
        setTimeout(() => {
          setIsWatering(false);
          sendCommandRef.current('WATER_OFF');
          sendCommandRef.current('AUTOPILOT_OFF');
          setShowNote(`Autopilot Hydration Completed: Ran for ${calculatedSeconds}s`);
          setTimeout(() => setShowNote(null), 2500);
        }, calculatedSeconds * 1000);
      }
    };

    const interval = setInterval(checkAutopilot, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  // Wireless Telemetry Polling
  useEffect(() => {
    if (!arduinoIp) return;

    const poll = async () => {
      try {
        const response = await CapacitorHttp.get({
          url: `http://${arduinoIp}/status`,
          connectTimeout: 3000,
          readTimeout: 3000
        });
        const data = response.data;
        setIsHardwareConnected(true);
        if (data) {
          if (data.pump !== undefined) {
            setIsPumpActive(data.pump === 1 || data.pump === true || String(data.pump).toLowerCase() === 'on');
          }
          if (data.watering !== undefined) {
            setIsWatering(data.watering === 1 || data.watering === true || String(data.watering).toLowerCase() === 'on');
          }
          if (data.m !== undefined || data.t !== undefined || data.ph !== undefined || data.water !== undefined || data.h !== undefined) {
            setDevices(prev => {
              const mVal = data.m !== undefined ? Number(data.m) : 50;
              const tVal = data.t !== undefined ? Number(data.t) : 25;
              const hVal = data.h !== undefined ? Number(data.h) : 60;
              const pVal = data.ph !== undefined ? Number(data.ph) : 7.0;
              const wVal = data.water !== undefined ? Number(data.water) : 0;
              if (prev.length === 0) {
                // Auto-create a main node if user has no devices in their list
                return [{
                  id: '1',
                  name: 'Main Hardware Node',
                  group: 'Outdoor',
                  status: 'online',
                  moisture: mVal,
                  temperature: tVal,
                  humidity: hVal,
                  ph: pVal,
                  waterUsed: wVal,
                  battery: 100,
                  lastWatered: 'Never',
                  solarHealth: 100,
                  signalStrength: 100,
                  npk: { n: 50, p: 50, k: 50 }
                }];
              }
              const hasId1 = prev.some(d => d.id === '1');
              return prev.map((d, i) => {
                const shouldUpdate = hasId1 ? d.id === '1' : i === 0;
                return shouldUpdate ? {
                  ...d,
                  status: 'online',
                  moisture: mVal,
                  temperature: tVal,
                  humidity: hVal,
                  ph: pVal,
                  waterUsed: wVal
                } : d;
              });
            });
          }
        }
      } catch (e) {
        setIsHardwareConnected(false);
      }
    };

    const interval = setInterval(poll, 1000);
    poll();
    return () => clearInterval(interval);
  }, [arduinoIp]);

  // Serial Reader Loop (USB Fallback)
  useEffect(() => {
    if (!serialPort) return;

    let reader: any;
    const readSerial = async () => {
      try {
        while (serialPort.readable) {
          reader = serialPort.readable.getReader();
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              const text = new TextDecoder().decode(value);
              if (text.includes('M:') || text.includes('T:') || text.includes('pH:') || text.includes('Water:') || text.includes('H:') || text.includes('Pump:') || text.includes('Watering:')) {
                const pMatch = text.match(/Pump:(\d+)/i);
                if (pMatch) {
                  setIsPumpActive(parseInt(pMatch[1]) === 1);
                }
                const wMatch = text.match(/Watering:(\d+)/i);
                if (wMatch) {
                  setIsWatering(parseInt(wMatch[1]) === 1);
                }

                setDevices(prev => {
                  const mMatch = text.match(/M:(\d+)/i);
                  const tMatch = text.match(/T:(-?\d+)/i);
                  const hMatch = text.match(/H:(\d+)/i);
                  const phMatch = text.match(/pH:([0-9.]+)/i);
                  const waterMatch = text.match(/Water:([0-9.]+)/i);
                  const mVal = mMatch ? parseInt(mMatch[1]) : 50;
                  const tVal = tMatch ? parseInt(tMatch[1]) : 25;
                  const hVal = hMatch ? parseInt(hMatch[1]) : 60;
                  const pVal = phMatch ? parseFloat(phMatch[1]) : 7.0;
                  const wVal = waterMatch ? parseFloat(waterMatch[1]) : 0;
                  if (prev.length === 0) {
                    return [{
                      id: '1',
                      name: 'Main Hardware Node',
                      group: 'Outdoor',
                      status: 'online',
                      moisture: mVal,
                      temperature: tVal,
                      humidity: hVal,
                      ph: pVal,
                      waterUsed: wVal,
                      battery: 100,
                      lastWatered: 'Never',
                      solarHealth: 100,
                      signalStrength: 100,
                      npk: { n: 50, p: 50, k: 50 }
                    }];
                  }
                  const hasId1 = prev.some(d => d.id === '1');
                  return prev.map((d, i) => {
                    const shouldUpdate = hasId1 ? d.id === '1' : i === 0;
                    if (shouldUpdate) {
                      return {
                        ...d,
                        status: 'online',
                        moisture: mMatch ? parseInt(mMatch[1]) : d.moisture,
                        temperature: tMatch ? parseInt(tMatch[1]) : d.temperature,
                        humidity: hMatch ? parseInt(hMatch[1]) : d.humidity,
                        ph: phMatch ? parseFloat(phMatch[1]) : d.ph,
                        waterUsed: waterMatch ? parseFloat(waterMatch[1]) : d.waterUsed
                      };
                    }
                    return d;
                  });
                });
              }
            }
          } finally {
            reader.releaseLock();
          }
        }
      } catch (e) {
        setIsHardwareConnected(false);
      }
    };

    readSerial();
    return () => { if (reader) reader.cancel(); };
  }, [serialPort]);

  const sendCommand = async (command: string) => {
    // Map watering actions to turn both water valves and the physical pump motor on/off
    let commandsToSend = [command];
    if (command === 'WATER_ON') {
      commandsToSend = ['WATER_ON', 'PUMP_ON'];
      setIsPumpActive(true);
    } else if (command === 'WATER_OFF') {
      commandsToSend = ['WATER_OFF', 'PUMP_OFF'];
      setIsPumpActive(false);
    }

    for (let i = 0; i < commandsToSend.length; i++) {
      const cmd = commandsToSend[i];

      // Try Wireless first
      if (arduinoIp) {
        try {
          await CapacitorHttp.get({
            url: `http://${arduinoIp}/${cmd}`
          });
        } catch (e) {
          console.warn(`Wireless command [${cmd}] transmission failed:`, e);
        }
      }

      // Fallback to USB
      if (serialPort) {
        try {
          const encoder = new TextEncoder();
          const writer = serialPort.writable.getWriter();
          await writer.write(encoder.encode(cmd + '\n'));
          writer.releaseLock();
        } catch (e) {
          console.warn(`Serial command [${cmd}] transmission failed:`, e);
        }
      }

      // 100ms guard delay between consecutive command pushes to physical MCU
      if (commandsToSend.length > 1 && i < commandsToSend.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  };

  const sendCommandRef = useRef(sendCommand);
  useEffect(() => {
    sendCommandRef.current = sendCommand;
  }, [sendCommand]);

  // Sync weather data to hardware LCD
  useEffect(() => {
    if (weather) {
      sendCommandRef.current(`WEATHER?temp=${Math.round(weather.temp)}&rain=${Math.round(weather.precipitationProbability)}`);
    }
  }, [weather]);

  // Sync rain skip state to hardware LCD
  useEffect(() => {
    if (isRainPredicted) {
      sendCommandRef.current('RAIN_SKIP_ON');
    } else {
      sendCommandRef.current('RAIN_SKIP_OFF');
    }
  }, [isRainPredicted]);



  const activeIndex = TABS.findIndex(t => t.id === activeTab);
  const activeTabColor = TABS[activeIndex]?.color || '#0d9488';

  const switchTab = (tabId: NavTab) => {
    setPrevTabIndex(activeIndex);
    setActiveTab(tabId);
    logActivity(ActivityType.TAB_CHANGE, `Switched to ${tabId} tab`);

    // Log silly info: detailed interaction
    import('./src/lib/activity').then(({ logInteraction }) => {
      logInteraction(`NavTab_${tabId}`, 'CLICK', 'Navigation');
    });
  };

  // Periodic sensor logging (Total Data Collection)
  useEffect(() => {
    if (!isLoggedIn || !profile.id) return;

    const interval = setInterval(() => {
      // Prioritize the physical hardware node (id '1') if online
      const physicalNode = devices.find(d => d.id === '1') || devices[0];

      const moistureVal = physicalNode ? (physicalNode.moisture ?? 50) : (devices.length > 0 ? devices.reduce((acc, d) => acc + (d.moisture || 0), 0) / devices.length : 50);
      const tempVal = physicalNode && physicalNode.temperature !== undefined ? physicalNode.temperature : weather.temp;
      const humidityVal = physicalNode && physicalNode.humidity !== undefined ? physicalNode.humidity : weather.humidity;
      const lightVal = 85; // Standard lux fallback reference

      import('./src/lib/activity').then(({ logSensors }) => {
        logSensors(tempVal, humidityVal, moistureVal, lightVal);
      });
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [isLoggedIn, profile, devices, weather]);

  const getAnimationClass = () => {
    if (activeIndex > prevTabIndex) return 'animate-slide-right';
    if (activeIndex < prevTabIndex) return 'animate-slide-left';
    return 'animate-view-in';
  };

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleTogglePump = async (state: boolean) => {
    setIsPumpActive(state);
    sendCommand(state ? 'PUMP_ON' : 'PUMP_OFF');
    setShowNote(state ? "Pump Manual Override Active" : "Pump Stasis Engaged");
    setTimeout(() => setShowNote(null), 2000);

    logActivity(ActivityType.PUMP_TOGGLE, state ? 'User manually enabled main water pump' : 'User manually disabled main water pump');
    if (state) {
      // Log as a generic manual event
      const { logWatering } = await import('./src/lib/activity');
      logWatering('MainPump', 'Manual', 'N/A');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setIsLoggedIn(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };



  if (authLoading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <Loader2 className="text-teal-500 animate-spin" size={48} />
    </div>
  );

  if (!isLoggedIn) return <Login onLogin={() => setIsLoggedIn(true)} />;

  if (showSetup) return <SetupWizard profile={profile} onComplete={async (p) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      // Map camelCase UI profile to snake_case DB schema
      const profileToSave = {
        id: user.id,
        full_name: p.name,
        email: p.email,
        phone: p.phone,
        location: p.location,
        garden_type: p.gardenType,
        garden_size: p.gardenSize,
        experience: p.experience,
        avatar: p.avatar,
        level: p.level,
        xp: p.xp
      };

      const { error } = await supabase
        .from('users')
        .upsert(profileToSave);

      if (error) {
        console.error("Supabase UPSERT error:", error);
        throw error;
      }

      setProfile(p);
      setShowSetup(false);
      setIsSyncing(true);
    } catch (e: any) {
      console.error("Setup save error:", e);
      alert("Verification failed: Please make sure you have run the Refined SQL setup in your Supabase Dashboard.");
    }
  }} />;

  if (isSyncing) {
    setTimeout(() => setIsSyncing(false), 800);
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Loader2 className="text-teal-500 animate-spin" size={32} />
          <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">Syncing Ecosystem...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col lg:flex-row bg-[#f8fafc] dark:bg-[#020617] relative overflow-hidden transition-all duration-300 h-[100dvh]`}>

      {/* Persistent Dynamic Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03] dark:opacity-[0.08] mix-blend-screen"></div>
        <div
          className="absolute -top-[50%] -right-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_#2dd4bf_0%,_transparent_35%)] dark:bg-[radial-gradient(circle_at_center,_#0f766e_0%,_transparent_40%)] opacity-[0.07] dark:opacity-[0.1] blur-[120px] animate-[spin_60s_linear_infinite]"
        />
        <div
          className="absolute -bottom-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_#34d399_0%,_transparent_35%)] dark:bg-[radial-gradient(circle_at_center,_#047857_0%,_transparent_40%)] opacity-[0.07] dark:opacity-[0.1] blur-[120px] animate-[spin_40s_linear_infinite_reverse]"
        />
      </div>

      {/* ===== DESKTOP SIDEBAR NAV (hidden on mobile) ===== */}
      <aside className="hidden lg:flex desktop-sidebar sticky top-0 h-[100dvh]">
        <div className="flex items-center gap-3 px-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: activeTabColor }}>
            <Droplets size={22} />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-white tracking-tighter leading-none">Eco-Drip</h1>
            <p className="text-[8px] font-black uppercase tracking-widest mt-0.5 transition-colors duration-500" style={{ color: activeTabColor }}>{isHardwareConnected ? 'ONLINE' : 'OFFLINE'}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-grow">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                style={isActive ? { color: tab.color } : {}}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span>{tab.label}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-auto pt-4 border-t border-white/5 dark:border-white/5">
          <div
            onClick={() => switchTab(NavTab.Settings)}
            className="sidebar-item cursor-pointer"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm border dark:border-white/10 shadow-sm overflow-hidden"
              style={{ backgroundColor: `${activeTabColor}10`, color: activeTabColor, borderColor: `${activeTabColor}20` }}
            >
              {profile.avatar || profile.name?.[0] || <User size={14} />}
            </div>
            <span className="truncate">{profile.name || 'Profile'}</span>
          </div>
        </div>
      </aside>

      {/* ===== MAIN CONTENT AREA ===== */}
      <div className="flex flex-col flex-grow min-w-0 h-[100dvh]">

      {showNote && (
        <div className="fixed top-8 left-6 right-6 lg:left-[240px] z-[100] bg-slate-900 dark:bg-slate-800 border border-white/10 px-6 py-4 rounded-3xl flex items-center gap-3 animate-view-in shadow-2xl">
          <CheckCircle2 size={20} className="text-teal-500" />
          <span className="text-[11px] font-black uppercase tracking-widest text-white">{showNote}</span>
        </div>
      )}

      <header className={`sticky top-0 z-40 bg-white/90 dark:bg-[#020617]/90 border-b border-slate-100 dark:border-white/5 px-6 py-4 flex items-center justify-between transition-all duration-700 lg:hidden`}>
        <div className="flex items-center gap-3" onClick={() => switchTab(NavTab.Home)}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-all duration-500" style={{ backgroundColor: activeTabColor }}>
            <Droplets size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tighter leading-none">Eco-Drip</h1>
              {isHardwareConnected && (
                <div className="flex gap-0.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
            <p className="text-[8px] font-black uppercase tracking-widest mt-1 transition-colors duration-500" style={{ color: activeTabColor }}>{isHardwareConnected ? (arduinoIp ? 'WIFI MESH ACTIVE' : 'USB LINK ACTIVE') : 'DISCONNECTED'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black cursor-pointer active:scale-90 transition-all border dark:border-white/10 shadow-sm overflow-hidden"
            style={{
              backgroundColor: `${activeTabColor}10`,
              color: activeTabColor,
              borderColor: `${activeTabColor}20`
            }}
            onClick={() => switchTab(NavTab.Settings)}
          >
            {profile.avatar || profile.name?.[0] || <User size={18} />}
          </div>
        </div>
      </header>

      <main key={activeTab} className={`p-4 md:p-8 lg:p-10 flex-grow overflow-y-auto w-full max-w-7xl mx-auto ${isKeyboardOpen ? 'pb-4' : 'pb-[120px] lg:pb-10'} ${getAnimationClass()}`}>
        {activeTab === NavTab.Home && (
          <Dashboard
            devices={devices}
            weather={weather}
            crops={crops}
            setCrops={setCrops}
            onGainXp={gainXp}
            onNavigate={switchTab}
            onWaterAll={async () => {
              setIsWatering(true);
              sendCommand('WATER_ON');
              sendCommand('BOOST_ON');
              logActivity(ActivityType.IRRIGATION_EVENT, 'System-wide manual irrigation protocol initiated by user');
              const { logWatering } = await import('./src/lib/activity');
              logWatering('AllNodes', '4s (Burst)', 'Approx 2.5L');

              setTimeout(() => {
                setIsWatering(false);
                sendCommand('WATER_OFF');
                sendCommand('BOOST_OFF');
                setShowNote("System Purge Completed");
                setTimeout(() => setShowNote(null), 2000);
                gainXp(50);
              }, 4000);
            }}
            isWatering={isWatering}
            isPumpActive={isPumpActive}
            onTogglePump={handleTogglePump}
          />
        )}
        {activeTab === NavTab.CIPAT && (
          <div className="pt-2">
            <CipatAdvisor />
          </div>
        )}
        {activeTab === NavTab.Discovery && <Discovery language={profile.language} />}
        {activeTab === NavTab.AI && <AIAdvisor devices={devices} weather={weather} language={profile.language === 'Hindi' ? 'Hindi' : (profile.language === 'Gujarati' ? 'Gujarati' : 'English')} />}
        {activeTab === NavTab.Planner && (
          <Planner
            devices={devices}
            weather={weather}
            crops={crops}
            schedules={schedules}
            setSchedules={setSchedules}
          />
        )}
        {activeTab === NavTab.Community && <Community onBack={() => setActiveTab(NavTab.Settings)} />}
        {activeTab === NavTab.History && <HistoryLog devices={devices} />}
        {activeTab === NavTab.Autopilot && (
          <AutopilotCore
            onBack={() => switchTab(NavTab.Home)}
            devices={devices}
            weather={weather}
            crops={crops}
            isArmed={isAutopilotArmed}
            setIsArmed={(val) => {
              setIsAutopilotArmed(val);
              localStorage.setItem('autopilot_armed', String(val));
            }}
            aiMode={autopilotMode}
            setAiMode={setAutopilotMode}
            targetMoisture={autopilotTargetMoisture}
            setTargetMoisture={setAutopilotTargetMoisture}
            isWatering={isWatering}
            sensorError={sensorError}
            autopilotCooldownRemaining={autopilotCooldownRemaining}
            dailyWateringCapReached={dailyWateringCapReached}
            waitingForHysteresisRecovery={waitingForHysteresisRecovery}
            avgMoisture={avgMoisture}
            onWater={async () => {
              setIsWatering(true);
              sendCommand('WATER_ON');
              logActivity(ActivityType.IRRIGATION_EVENT, 'Watering sequence initiated via AI Chat Command.');
              const { logWatering } = await import('./src/lib/activity');
              logWatering('AI_Chat', '4s (Burst)', 'Approx 2.5L');

              setTimeout(() => {
                setIsWatering(false);
                sendCommand('WATER_OFF');
                setShowNote("System Purge Completed");
                setTimeout(() => setShowNote(null), 2000);
              }, 4000);
            }}
          />
        )}
        {activeTab === NavTab.Settings && (
          <Settings
            profile={profile}
            onUpdateProfile={setProfile}
            onLogout={handleLogout}
            devices={devices}
            crops={crops}
            theme={theme}
            onToggleTheme={toggleTheme}
            onNavigate={setActiveTab}
          />
        )}
      </main>

      </div>{/* end MAIN CONTENT AREA wrapper */}

      <nav className={`fixed bottom-0 left-0 right-0 glass-nav px-4 pt-3 z-50 transition-all duration-300 lg:hidden ${isKeyboardOpen ? 'opacity-0 pointer-events-none translate-y-full' : ''}`} style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        <div className="relative flex justify-between items-center max-w-md mx-auto h-14 px-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className="relative z-10 flex flex-col items-center justify-center flex-1 transition-all duration-300"
                style={{ color: isActive ? tab.color : (theme === 'dark' ? '#64748b' : '#94a3b8') }}
              >
                <div className={`p-2 transition-all duration-300 ${isActive ? 'scale-125' : 'scale-100 opacity-60'}`}>
                  <Icon size={24} strokeWidth={isActive ? 3 : 2} />
                </div>
                <span className={`text-[7px] font-black uppercase tracking-tighter mt-0.5 transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0 scale-105' : 'opacity-0 translate-y-1 scale-90'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

const SetupWizard: React.FC<{ profile: UserProfile, onComplete: (p: UserProfile) => void }> = ({ profile, onComplete }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [gardenSize, setGardenSize] = useState('0');
  const [landscape, setLandscape] = useState<'Farm' | 'Orchard' | 'Backyard'>('Farm');

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] flex flex-col p-6 md:p-10 animate-view-in transition-all duration-500">
      <div className="mb-10 md:mb-14">
        <div className="w-12 h-12 bg-teal-600 rounded-2xl flex items-center justify-center text-white shadow-xl mb-6 md:mb-8">
          <Sparkles size={24} />
        </div>
        <h1 className="text-3xl md:text-[44px] font-black text-slate-900 dark:text-white tracking-tighter leading-none italic mb-2">Setup Profile</h1>
        <p className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">INITIAL SYSTEM PERSONALIZATION</p>
      </div>

      <div className="space-y-8 md:space-y-10 flex-grow max-w-md w-full mx-auto overflow-y-auto no-scrollbar pb-8">
        <SetupField
          icon={<User size={18} className="text-slate-400" />}
          label="FULL NAME"
          placeholder="Your name"
          value={name}
          onChange={setName}
        />
        <SetupField
          icon={<Phone size={18} className="text-slate-400" />}
          label="MOBILE NUMBER"
          placeholder="10 Digit Number"
          value={phone}
          onChange={setPhone}
        />
        <SetupField
          icon={<MapPin size={18} className="text-slate-400" />}
          label="LOCATION"
          placeholder="Enter Location"
          value={location}
          onChange={setLocation}
        />
        <SetupField
          icon={<Leaf size={18} className="text-slate-400" />}
          label="GARDEN SIZE (ACRES)"
          placeholder="Area in Acres"
          value={gardenSize}
          onChange={setGardenSize}
          type="number"
        />
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Leaf size={14} className="text-slate-400" />
            <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">LANDSCAPE TYPE</label>
          </div>
          <div className="flex bg-slate-50 dark:bg-white/5 p-1 rounded-2xl gap-1">
            {(['Farm', 'Orchard', 'Backyard'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setLandscape(type)}
                className={`flex-1 py-3 md:py-4 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${landscape === type ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 dark:text-slate-500 hover:text-slate-500'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 md:mt-12 max-w-md w-full mx-auto pb-6">
        <button
          onClick={() => {
            if (!name.trim()) return alert("Please enter your name.");
            if (phone.length < 10) return alert("Please enter a valid 10-digit mobile number.");
            if (!location.trim()) return alert("Please enter your location for weather synchronization.");
            if (parseFloat(gardenSize) <= 0) return alert("Please enter a valid garden size.");

            onComplete({ ...profile, name, phone, location, gardenSize: parseFloat(gardenSize) || 0, gardenType: landscape, avatar: name[0]?.toUpperCase() || 'U' });
          }}
          className="w-full py-5 md:py-7 bg-slate-900 dark:bg-teal-600 text-white rounded-[1.5rem] md:rounded-3xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl"
        >
          FINALIZE SETUP <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

const SetupField = ({ icon, label, placeholder, value, onChange, type = "text" }: { icon: React.ReactNode, label: string, placeholder: string, value: string, onChange: (v: string) => void, type?: string }) => (
  <div className="space-y-3 px-1">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
    </div>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full p-5 md:p-6 bg-slate-50 dark:bg-white/5 rounded-2xl font-bold text-slate-900 dark:text-white outline-none border-2 border-transparent focus:border-teal-500 transition-all placeholder:text-slate-200 dark:placeholder:text-white/10 text-sm md:text-base"
    />
  </div>
);

export default App;
