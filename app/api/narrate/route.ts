import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { city } = await req.json();

  // 1. Geocode city → lat/lon
  const geoRes = await fetch(
    `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${process.env.OPENWEATHER_API_KEY}`
  );
  const geo = await geoRes.json();

  if (!geo[0]) {
    return NextResponse.json({ error: "Location not found" }, { status: 400 });
  }

  const { lat, lon, name, country } = geo[0];

  // 2. Fetch weather using lat/lon
  const weatherRes = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${process.env.OPENWEATHER_API_KEY}`
  );
  const weather = await weatherRes.json();

  const summary = {
    location: `${name}, ${country}`,
    temp: Math.round(weather.main.temp),
    clouds: weather.clouds.all,
    wind: weather.wind.speed,
    pressure: weather.main.pressure,
  };

  // 3. Ask OpenAI for the narrative (Responses API)
  const openaiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a concise atmospheric narrator. Assume the reader understands Earth science basics. Explain why the weather feels like this right now using jet stream position, air masses, geography, and radiative balance. No basic explanations. No forecasts. Tone: precise, elegant, calm. Length: 80–120 words.",
        },
        {
          role: "user",
          content: `
Location: ${summary.location}
Temperature: ${summary.temp}°F
Cloud cover: ${summary.clouds}%
Wind speed: ${summary.wind} mph
Pressure: ${summary.pressure} hPa
Explain why it feels like this right now.
          `,
        },
      ],
    }),
  });

  const completion = await openaiRes.json();

  const narrative =
    completion.output_text ||
    completion.output?.[0]?.content?.[0]?.text;

  if (!narrative) {
    return NextResponse.json(
      {
        error: "OpenAI did not return narrative",
        openaiResponse: completion,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ...summary,
    narrative,
  });
}
