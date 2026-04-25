export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
}

// Fallback data if offline or API fails
const FALLBACK_WEATHER: WeatherData = {
  temperature: 31,
  humidity: 62,
  windSpeed: 8,
  weatherCode: 0,
};

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather API failed');
    const data = await res.json();
    
    return {
      temperature: data.current_weather.temperature,
      humidity: data.hourly.relative_humidity_2m[0] ?? FALLBACK_WEATHER.humidity,
      windSpeed: data.current_weather.windspeed,
      weatherCode: data.current_weather.weathercode,
    };
  } catch (error) {
    console.error('Weather fetch failed, using fallback:', error);
    return FALLBACK_WEATHER;
  }
}

export function getWeatherCondition(code: number): string {
  // Simple WMO code mapping
  if (code === 0) return 'Sunny';
  if (code >= 1 && code <= 3) return 'Partly Cloudy';
  if (code >= 45 && code <= 48) return 'Foggy';
  if (code >= 51 && code <= 67) return 'Rainy';
  if (code >= 71 && code <= 77) return 'Snowy';
  if (code >= 80 && code <= 82) return 'Heavy Rain';
  if (code >= 95) return 'Thunderstorm';
  return 'Clear';
}
