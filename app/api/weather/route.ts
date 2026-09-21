import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const cities = {
  seoul: { name: "首尔", latitude: 37.5665, longitude: 126.978 },
  busan: { name: "釜山", latitude: 35.1796, longitude: 129.0756 },
} as const;

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("city") === "busan" ? "busan" : "seoul";
  const city = cities[key];
  const params = new URLSearchParams({
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
    timezone: "Asia/Seoul",
    forecast_days: "7",
  });
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("weather upstream unavailable");
    const data = await response.json() as { daily?: Record<string, Array<number | string>> };
    const daily = data.daily;
    if (!daily) throw new Error("weather payload missing");
    return NextResponse.json({
      city: city.name,
      days: (daily.time || []).map((date, index) => ({
        date,
        code: daily.weather_code?.[index],
        max: daily.temperature_2m_max?.[index],
        min: daily.temperature_2m_min?.[index],
        rain: daily.precipitation_probability_max?.[index],
        wind: daily.wind_speed_10m_max?.[index],
      })),
    }, { headers: { "cache-control": "public, max-age=900" } });
  } catch (error) {
    console.error("Weather proxy failed", error);
    return NextResponse.json({ error: "天气数据暂时不可用" }, { status: 503 });
  }
}
