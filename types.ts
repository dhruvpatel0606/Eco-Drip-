export enum NavTab {
  Home = 'Home',
  Modules = 'Modules',
  Discovery = 'Discovery',
  Community = 'Community',
  Terms = 'Terms',
  Devices = 'Zones',
  History = 'History',
  AI = 'AI Assistant',
  Planner = 'Planner',
  Settings = 'Settings',
  Autopilot = 'Autopilot'
}

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  password?: string;
  phone: string;
  location: string;
  gardenType: string;
  soilType: string;
  avatar: string;
  gardenSize: number;
  experience: 'Beginner' | 'Intermediate' | 'Master';
  language?: string;
  level: number;
  xp: number;
}

export interface Device {
  id: string;
  name: string;
  group: 'Outdoor' | 'Indoor' | 'Greenhouse';
  status: 'online' | 'offline';
  moisture: number;
  temperature: number;
  humidity?: number; // Humidity percentage
  ph: number;
  battery: number;
  lastWatered: string;
  solarHealth: number;
  signalStrength: number;
  npk: { n: number; p: number; k: number; };
  autoMode?: boolean;
  moistureThreshold?: number;
  flowRate?: number; // Liters per minute
  waterUsed?: number; // Total water used in liters
  waterStatus?: 'Normal' | 'Leak Detected' | 'Dry Run' | 'Leaking Valve';
}

export interface Crop {
  id: string;
  name: string;
  variety: string;
  category?: string;
  status: 'Optimal' | 'Stressed' | 'Dormant' | 'Critical';
  health: number;
  plantedDate: string;
  daysToHarvest: number;
  moistureLevel?: number;
}

export interface Plant {
  id: string;
  name: string;
  nameHi: string;
  nameGu?: string;
  category: string;
  watering: { en: string; hi: string; gu?: string };
  difficulty: { en: string; hi: string; gu?: string };
  health: number;
  family: { en: string; hi: string; gu?: string };
  light: { en: string; hi: string; gu?: string };
  desc: { en: string; hi: string; gu: string };
  imageUrl: string;
  npk?: string;
  pests?: string;
  ph?: string;
  harvest?: string;
  tempRange?: string;
  season?: string;
  soil?: string;
  growthRate?: string;
  companions?: string;
  toxicity?: string;
}

export interface WeatherData {
  temp: number;
  temperature?: number;
  precipitationProbability?: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  etIndex: number;
  forecast: { day: string; temp: number; icon: string; }[];
  aqi?: number; // 1 (Good) - 5 (Hazardous) from WeatherAPI
  rainNow?: number; // mm in last hour
  rainAlert?: string; // text description of any active rain alerts
  icon?: string;
}

export interface HistoryEvent {
  id: string;
  moduleId: string;
  deviceName: string;
  duration: string;
  timestamp: string;
  waterUsed: string;
  status: 'Completed' | 'Skipped' | 'Manual';
}

export interface Schedule {
  id: string;
  moduleId: string;
  time: string;
  days: string[];
  duration: number;
  enabled: boolean;
}
