import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { city } = await req.json();

  // 1. Geocode city → lat/lon
  const geoRes = await fetch(
    "https://api.openweathermap.org/geo/1.0/direct?q=" +
      encodeURIComponent(city) +
      "&limit=1&appid=" +
      process.env.OPENWEATHER_API_KEY
  );
  const geo = await geoRes.json();

  if (!geo[0]) {
    return NextResponse.json({ error: "Location not found" }, { status: 400 });
  }

  const { lat, lon, name, country } = geo[0];

  // 2. Fetch weather using lat/lon
  const weatherRes = await fetch(
    "https://api.openweathermap.org/data/2.5/weather?lat=" +
      lat +
      "&lon=" +
      lon +
      "&units=imperial&appid=" +
      process.env.OPENWEATHER_API_KEY
  );
  const weather = await weatherRes.json();

  const summary = {
    location: name + ", " + country,
    temp: Math.round(weather.main.temp),
    clouds: weather.clouds.all,
    wind: weather.wind.speed,
    pressure: weather.main.pressure,
  };

  // 3. Ask OpenAI for the narrative (Responses API)
  const openaiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.OPENAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You write short, vivid explanations of how the weather looks and feels outside right now " +
            "for an intelligent, curious reader.\n\n" +

            "Assume the reader understands basic Earth science. " +
            "Do not define common terms or explain fundamentals.\n\n" +

            "Begin from perception:\n" +
            "- what the sky, clouds, and light look like\n" +
            "- what someone would notice immediately stepping outdoors\n\n" +

            "Then explain how those visual cues connect to bodily sensation:\n" +
            "- how and why temperature, humidity, wind, and sunlight interact at the level of the skin\n\n" +

            "Finally, explain why this moment exists:\n" +
            "- large-scale atmospheric motion (pressure systems, air masses, jet stream shape)\n" +
            "- regional geography (latitude, proximity to water, terrain)\n" +
            "- whether air is rising, sinking, mixing, or stagnant\n\n" +

            "When appropriate, briefly note subtle responses in the living world " +
            "(plants, insects, birds), but only when they follow directly from the air itself. " +
            "Avoid folklore, prediction, or symbolic interpretation.\n\n" +

            "Writing constraints:\n" +
            "- 90–130 words\n" +
            "- no forecasts\n" +
            "- no lists or headings\n" +
            "- no stock weather-report phrasing\n" +
            "- no moralizing or climate commentary\n" +
            "- accurate, grounded, and written like a short observational essay\n\n" +

            "The goal is to help the reader understand why this moment looks and feels the way it does, " +
            "and to notice the atmosphere differently afterward.",
        },
        {
          role: "user",
          content:
            "Location: " + summary.location + "\n" +
            "Temperature: " + summary.temp + "°F\n" +
            "Cloud cover: " + summary.clouds + "%\n" +
            "Wind speed: " + summary.wind + " mph\n" +
            "Pressure: " + summary.pressure + " hPa\n\n" +
            "Explain why it looks and feels like this right now.",
        },
      ],
    }),
  });

  const completion = await openaiRes.json();

  const narrative =
    completion.output_text ??
    completion.output
      ?.flatMap((o: any) => o.content || [])
      ?.find((c: any) => c.type === "output_text")
      ?.text;

  if (!narrative) {
    return NextResponse.json(
      { error: "OpenAI did not return narrative", openaiResponse: completion },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ...summary,
    narrative,
  });
}
