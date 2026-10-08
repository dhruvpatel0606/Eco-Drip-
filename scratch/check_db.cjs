const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, '../.env');
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

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Testing column: start_date...');
  const test1 = await supabase
    .from('watering_schedules')
    .insert([{
      device_id: 'test-device',
      time: '08:00:00',
      duration: 10,
      days: ['Mon'],
      enabled: false,
      start_date: '2026-07-20'
    }]);
  
  if (test1.error) {
    console.log('start_date failed:', test1.error.message);
  } else {
    console.log('start_date SUCCEEDED!');
    // Clean up
    await supabase.from('watering_schedules').delete().eq('device_id', 'test-device');
  }

  console.log('\nTesting column: date...');
  const test2 = await supabase
    .from('watering_schedules')
    .insert([{
      device_id: 'test-device',
      time: '08:00:00',
      duration: 10,
      days: ['Mon'],
      enabled: false,
      date: '2026-07-20'
    }]);

  if (test2.error) {
    console.log('date failed:', test2.error.message);
  } else {
    console.log('date SUCCEEDED!');
    // Clean up
    await supabase.from('watering_schedules').delete().eq('device_id', 'test-device');
  }
}

run();
