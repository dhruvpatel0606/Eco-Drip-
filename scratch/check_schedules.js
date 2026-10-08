import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkSchedules() {
  console.log("Trying to sign in with farmer123@gmail.com...");
  let authData = null;
  try {
    const res = await supabase.auth.signInWithPassword({
      email: 'farmer123@gmail.com',
      password: 'password123'
    });
    authData = res.data;
  } catch (e) {
    console.log("farmer123 auth error:", e);
  }
  
  console.log("Fetching schedules...");
  const query = supabase.from('watering_schedules').select('*');
  const { data, error } = await query;
    
  if (error) {
    console.error("Error fetching schedules:", error);
  } else {
    console.log("Schedules in DB:");
    data.forEach(s => {
      console.log(`ID: ${s.id}, UserID: ${s.user_id}, Device: ${s.device_id}, Time (raw): "${s.time}", Time type: ${typeof s.time}, Days: ${JSON.stringify(s.days)}, Enabled: ${s.enabled}`);
    });
  }
}

checkSchedules();
