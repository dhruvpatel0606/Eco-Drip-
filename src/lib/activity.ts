import { supabase } from './supabase';

export enum ActivityType {
  PUMP_TOGGLE = 'PUMP_TOGGLE',
  IRRIGATION_EVENT = 'IRRIGATION_EVENT',
  NODE_TOGGLE = 'NODE_TOGGLE',
  NODE_ADD = 'NODE_ADD',
  SEARCH = 'SEARCH',
  SCAN = 'SCAN',
  AI_ADVICE = 'AI_ADVICE',
  CHAT = 'CHAT',
  HARDWARE_CONNECT = 'HARDWARE_CONNECT',
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
  TAB_CHANGE = 'TAB_CHANGE',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  ALERT = 'ALERT'
}

export async function logWatering(deviceId: string, duration: string, waterUsed: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const { error } = await supabase
      .from('watering_history')
      .insert([
        {
          user_id: user.id,
          device_id: deviceId,
          duration,
          water_used: waterUsed,
          status: 'Completed',
          created_at: new Date().toISOString()
        }
      ]);
    if (error) throw error;
  } catch (err) {
    console.error('Watering history log failed:', err);
  }
}

export async function logInteraction(elementId: string, type: string, context: string = 'global') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    await supabase.from('user_interactions').insert([{
      user_id: user.id,
      element_id: elementId,
      interaction_type: type,
      page_context: context,
      created_at: new Date().toISOString()
    }]);
  } catch (e) {
    console.error('Interaction log fail:', e);
  }
}

export async function logSensors(temp: number, hum: number, moisture: number, light: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    await supabase.from('sensor_readings').insert([{
      user_id: user.id,
      temperature: temp,
      humidity: hum,
      moisture: moisture,
      light_level: light,
      created_at: new Date().toISOString()
    }]);
  } catch (e) {
    console.error('Sensor log fail:', e);
  }
}

export async function logActivity(type: ActivityType, details: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  try {
    const { error } = await supabase
      .from('activity_logs')
      .insert([
        {
          user_id: user.id,
          action: type,
          details,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;
  } catch (error) {
    console.error('Activity Log Error:', error);
  }
}
