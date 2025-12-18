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
          content: `
            "You write short, vivid explanations of how the weather looks and feels outside right now
            for an intelligent, curious reader.
            
            Assume the reader understands basic Earth science.
            Do not define common terms or explain fundamentals.
            
            Begin from perception:
            – what the sky, clouds, and light look like
            – what someone would notice immediately stepping outdoors
            
            Then explain how those visual cues connect to bodily sensation:
            – how and why temperature, humidity, wind, and sunlight interact at the level of the skin
            
            Finally, explain why this moment exists:
            – large-scale atmospheric motion (pressure systems, air masses, jet stream shape)
            – regional geography (latitude, proximity to water, terrain)
            – whether air is rising, sinking, mixing, or stagnant (and what that means)
            
            When appropriate, briefly note subtle responses in the living world
            (plants, insects, birds), but only when they follow directly from the air itself
            (e.g., stillness, subdued activity, limited moisture loss).
            Avoid folklore, prediction, or symbolic interpretation.
            
            Writing constraints:
            – 90–130 words
            – no forecasts
            – no lists or headings
            – no stock weather-report phrasing
            – no moralizing or climate commentary
            – accurate, grounded, and written like a short observational, engaging essay
            
            The goal is to help the reader understand why this moment looks and feels the way it does,
            and to notice the atmosphere differently afterward."},
        {
          role: "user",
          content: "
            Location: ${summary.location}
            Temperature: ${summary.temp}°F
            Cloud cover: ${summary.clouds}%
            Wind speed: ${summary.wind} mph
            Pressure: ${summary.pressure} hPa
            Explain why it feels like this right now.
          ",
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
