import fs from 'fs';
import path from 'path';

// Load .env file
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

async function getSpec() {
  const url = `${supabaseUrl}/rest/v1/`;
  console.log('Fetching spec from:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    const spec = await res.json();
    
    console.log('--- TABLES IN SCHEMA ---');
    console.log(Object.keys(spec.definitions || {}));
    
    if (spec.definitions && spec.definitions.users) {
      console.log('\n--- USERS TABLE COLUMNS ---');
      console.log(Object.keys(spec.definitions.users.properties));
    }
    
    if (spec.definitions && spec.definitions.sensor_readings) {
      console.log('\n--- SENSOR_READINGS COLUMNS ---');
      console.log(Object.keys(spec.definitions.sensor_readings.properties));
    }

    if (spec.definitions && spec.definitions.watering_history) {
      console.log('\n--- WATERING_HISTORY COLUMNS ---');
      console.log(Object.keys(spec.definitions.watering_history.properties));
    }
  } catch (err) {
    console.error('Error fetching spec:', err);
  }
}

getSpec();
