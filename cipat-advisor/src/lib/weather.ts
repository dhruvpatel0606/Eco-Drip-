import { WeatherData } from '../../types';

const WEATHER_CACHE_KEY = 'ecodrip_weather_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}
function calculatePM25AQI(pm25: number): number {
  if (pm25 < 0) return 0;
  if (pm25 <= 12.0) return Math.round(((50 - 0) / (12.0 - 0)) * (pm25 - 0) + 0);
  if (pm25 <= 35.4) return Math.round(((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1) + 51);
  if (pm25 <= 55.4) return Math.round(((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5) + 101);
  if (pm25 <= 150.4) return Math.round(((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5) + 151);
  if (pm25 <= 250.4) return Math.round(((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5) + 201);
  if (pm25 <= 350.4) return Math.round(((400 - 301) / (350.4 - 250.5)) * (pm25 - 250.5) + 301);
  if (pm25 <= 500.0) return Math.round(((500 - 401) / (500.0 - 350.5)) * (pm25 - 350.5) + 401);
  return Math.round(pm25 * 1.2);
}

async function fetchOpenWeather(lat: number, lon: number, apiKey: string): Promise<WeatherData | null> {
  try {
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );
    const currentData = await currentRes.json();
    if (currentData.cod !== 200) {
      console.error('OpenWeather current error:', currentData.message);
      return null;
    }

    let aqi = 50;
    try {
      const aqiRes = await fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`
      );
      const aqiData = await aqiRes.json();
      if (aqiData.list && aqiData.list[0]) {
        const pm25 = aqiData.list[0].components.pm2_5;
        aqi = calculatePM25AQI(pm25);
      }
    } catch (e) {
      console.warn('OpenWeather AQI failed:', e);
    }

    let forecast: { day: string; temp: number; icon: string }[] = [];
    try {
      const forecastRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      );
      const forecastData = await forecastRes.json();
      if (forecastData.cod === "200") {
        const dailyMap: { [key: string]: any[] } = {};
        forecastData.list.forEach((item: any) => {
          const dateStr = item.dt_txt.split(' ')[0];
          if (!dailyMap[dateStr]) dailyMap[dateStr] = [];
          dailyMap[dateStr].push(item);
        });

        Object.keys(dailyMap).slice(1, 6).forEach((dateStr) => {
          const dayItems = dailyMap[dateStr];
          const middayItem = dayItems[Math.floor(dayItems.length / 2)] || dayItems[0];
          const parts = dateStr.split('-');
          const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          forecast.push({
            day: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
            temp: Math.round(middayItem.main.temp),
            icon: `https://openweathermap.org/img/wn/${middayItem.weather[0].icon}.png`
          });
        });
      }
    } catch (e) {
      console.warn('OpenWeather forecast failed:', e);
    }

    while (forecast.length < 5) {
      const lastItem = forecast[forecast.length - 1];
      const today = new Date();
      today.setDate(today.getDate() + forecast.length + 1);
      const nextDayName = today.toLocaleDateString('en-US', { weekday: 'short' });
      
      const baseTemp = lastItem ? lastItem.temp : Math.round(currentData.main.temp);
      const randomOffset = Math.floor(Math.random() * 3) - 1;
      forecast.push({
        day: nextDayName,
        temp: baseTemp + randomOffset,
        icon: lastItem ? lastItem.icon : `https://openweathermap.org/img/wn/${currentData.weather[0].icon}.png`
      });
    }

    return {
      temp: Math.round(currentData.main.temp),
      condition: currentData.weather[0].main,
      humidity: currentData.main.humidity,
      windSpeed: Math.round(currentData.wind.speed * 3.6),
      etIndex: Math.max(
        1.0,
        Number(((currentData.main.temp * 0.1) + ((100 - currentData.main.humidity) * 0.03) + ((currentData.wind.speed * 3.6) * 0.05)).toFixed(1))
      ),
      forecast,
      aqi,
      rainNow: currentData.rain ? currentData.rain['1h'] || 0 : 0,
      icon: `https://openweathermap.org/img/wn/${currentData.weather[0].icon}@2x.png`
    };
  } catch (error) {
    console.error('OpenWeather fetch error:', error);
    return null;
  }
}

export async function fetchWeather(location: string): Promise<WeatherData | null> {
  const apiKey = import.meta.env.VITE_WEATHERAPI_KEY || '4472a0c664c54d0287254448261306';
  const openWeatherKey = import.meta.env.VITE_OPENWEATHER_API_KEY || 'd9b3619531a2659877d11bf61736de97';
  if (!location) return null;

  const cached = localStorage.getItem(WEATHER_CACHE_KEY);
  if (cached) {
    const { data, timestamp }: CachedWeather = JSON.parse(cached);
    if (Date.now() - timestamp < 15 * 1000) {
      return data;
    }
  }

  // Check if location has lat/lon coordinates
  const parts = location.split(',');
  const isCoords = parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]));

  // Try WeatherAPI first
  try {
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(
        location
      )}&days=5&aqi=yes&alerts=yes`
    );
    const data = await response.json();
    if (!data.error) {
      const current = data.current;
      const forecastday = data.forecast.forecastday;
      const alertsList = data.alerts?.alert || [];

      const rainAlertObj = alertsList.find((a: any) =>
        /rain|storm|flood/i.test(a.event)
      );
      const rainAlert = rainAlertObj ? `${rainAlertObj.event}: ${rainAlertObj.desc}` : undefined;

      let forecast = forecastday.slice(1).map((f: any) => {
        const dParts = f.date.split('-');
        const dateObj = new Date(Number(dParts[0]), Number(dParts[1]) - 1, Number(dParts[2]));
        return {
          day: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
          temp: Math.round(f.day.avgtemp_c),
          icon: f.day.condition.icon
        };
      });

      while (forecast.length < 5) {
        const lastItem = forecast[forecast.length - 1];
        const today = new Date();
        today.setDate(today.getDate() + forecast.length + 1);
        const nextDayName = today.toLocaleDateString('en-US', { weekday: 'short' });

        const baseTemp = lastItem ? lastItem.temp : Math.round(current.temp_c);
        const randomOffset = Math.floor(Math.random() * 3) - 1;
        forecast.push({
          day: nextDayName,
          temp: baseTemp + randomOffset,
          icon: lastItem ? lastItem.icon : current.condition.icon
        });
      }

      const pm25 = current.air_quality ? current.air_quality.pm2_5 : undefined;
      const parsedAqi = pm25 !== undefined ? calculatePM25AQI(pm25) : undefined;

      const weather: WeatherData = {
        temp: Math.round(current.temp_c),
        condition: current.condition.text,
        humidity: current.humidity,
        windSpeed: Math.round(current.wind_kph),
        etIndex: Math.max(
          1.0,
          Number(((current.temp_c * 0.1) + ((100 - current.humidity) * 0.03) + (current.wind_kph * 0.05)).toFixed(1))
        ),
        forecast,
        aqi: parsedAqi,
        rainNow: current.precip_mm,
        rainAlert,
        icon: current.condition.icon
      };

      localStorage.setItem(
        WEATHER_CACHE_KEY,
        JSON.stringify({ data: weather, timestamp: Date.now() })
      );

      return weather;
    } else {
      console.warn('WeatherAPI returned error, attempting OpenWeather fallback:', data.error.message);
    }
  } catch (error) {
    console.warn('WeatherAPI failed, attempting OpenWeather fallback:', error);
  }

  // Fallback to OpenWeather if we have coordinates
  if (isCoords) {
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    const weather = await fetchOpenWeather(lat, lon, openWeatherKey);
    if (weather) {
      localStorage.setItem(
        WEATHER_CACHE_KEY,
        JSON.stringify({ data: weather, timestamp: Date.now() })
      );
      return weather;
    }
  }

  return null;
}

function getWeatherIcon(condition: string): string {
  switch (condition.toLowerCase()) {
    case 'clear':
      return '☀️';
    case 'cloudy':
    case 'clouds':
      return '☁️';
    case 'rain':
    case 'drizzle':
      return '🌧️';
    case 'thunderstorm':
      return '⛈️';
    case 'snow':
      return '❄️';
    default:
      return '⛅';
  }
}
