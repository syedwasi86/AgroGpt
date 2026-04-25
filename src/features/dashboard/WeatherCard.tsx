import { useEffect, useState } from 'react';
import { RefreshCw, CloudRain, Sun, Cloud, Wind, Droplets } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { fetchWeather, getWeatherCondition, type WeatherData } from '../gis/services/weatherService';
import { useTranslation } from 'react-i18next';

export function WeatherCard({ 
  lat, 
  lon, 
  onDataLoad 
}: { 
  lat: number; 
  lon: number; 
  onDataLoad?: (data: WeatherData) => void 
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWeather = async () => {
    setLoading(true);
    const weather = await fetchWeather(lat, lon);
    setData(weather);
    onDataLoad?.(weather);
    setLoading(false);
  };

  useEffect(() => {
    loadWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  const condition = data ? getWeatherCondition(data.weatherCode) : '...';
  
  let Icon = Sun;
  if (condition.includes('Rain') || condition.includes('Thunder')) Icon = CloudRain;
  else if (condition.includes('Cloud') || condition.includes('Fog')) Icon = Cloud;

  return (
    <GlassCard className="p-5 flex flex-col h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/80">
            <Icon size={18} className={condition === 'Sunny' ? 'text-yellow-400' : 'text-blue-300'} />
          </div>
          <div>
            <div className="agro-h2">{t('dashboard.weather', 'Weather')}</div>
            <div className="subtle mt-0.5">{condition}</div>
          </div>
        </div>
        <button 
          onClick={() => void loadWeather()} 
          disabled={loading}
          className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={`text-white/70 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mt-6 flex-1 flex flex-col justify-center items-center">
        <div className="text-5xl font-bold text-white tracking-tighter">
          {data ? `${Math.round(data.temperature)}°C` : '--°C'}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <Droplets size={16} className="text-blue-300" />
            <div className="text-xs text-white/60">Humidity</div>
          </div>
          <div className="text-sm font-semibold text-white">{data ? `${Math.round(data.humidity)}%` : '--'}</div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <Wind size={16} className="text-gray-300" />
            <div className="text-xs text-white/60">Wind</div>
          </div>
          <div className="text-sm font-semibold text-white">{data ? `${Math.round(data.windSpeed)} km/h` : '--'}</div>
        </div>
      </div>
    </GlassCard>
  );
}
