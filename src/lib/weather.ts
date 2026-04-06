/**
 * Lightweight weather integration using Open-Meteo (free, no API key needed).
 * Returns current temperature and weather condition for outfit suggestions.
 */

interface WeatherData {
  temp: number; // Fahrenheit
  condition: string; // "sunny", "cloudy", "rainy", "snowy", "stormy"
  description: string; // Human-readable: "72°F and sunny"
  suggestedSeason: string; // Maps weather to season for outfit suggestions
}

const WMO_CONDITIONS: Record<number, string> = {
  0: 'sunny', 1: 'sunny', 2: 'cloudy', 3: 'cloudy',
  45: 'cloudy', 48: 'cloudy',
  51: 'rainy', 53: 'rainy', 55: 'rainy',
  56: 'rainy', 57: 'rainy',
  61: 'rainy', 63: 'rainy', 65: 'rainy',
  66: 'rainy', 67: 'rainy',
  71: 'snowy', 73: 'snowy', 75: 'snowy', 77: 'snowy',
  80: 'rainy', 81: 'rainy', 82: 'rainy',
  85: 'snowy', 86: 'snowy',
  95: 'stormy', 96: 'stormy', 99: 'stormy',
};

function tempToSeason(tempF: number): string {
  if (tempF < 40) return 'winter';
  if (tempF < 60) return 'fall';
  if (tempF < 80) return 'summer';
  return 'summer';
}

export async function getWeather(): Promise<WeatherData | null> {
  try {
    // Get user's location
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
    });

    const { latitude, longitude } = pos.coords;

    // Open-Meteo is free, no API key needed
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();

    const temp = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;
    const condition = WMO_CONDITIONS[code] || 'cloudy';

    return {
      temp,
      condition,
      description: `${temp}°F and ${condition}`,
      suggestedSeason: tempToSeason(temp),
    };
  } catch {
    return null; // Location denied or fetch failed — fall back to calendar season
  }
}
