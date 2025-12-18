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

  const rainMm = weather.rain?.["1h"] || 0;
  const snowMm = weather.snow?.["1h"] || 0;

  const precipitation =
    snowMm > 0
      ? "snow"
      : rainMm > 0
      ? "rain"
      : "none";

  const tempF = Math.round(weather.main.temp);
  const tempC = Math.round((tempF - 32) * 5 / 9);

  const summary = {
    location: name + ", " + country,
    tempF,
    tempC,
    humidity: weather.main.humidity,
    wind: Math.round(weather.wind.speed),
    clouds: weather.clouds.all,
    precipitation,
  };

  const isDaylight =
  weather.dt >= weather.sys.sunrise &&
  weather.dt <= weather.sys.sunset;

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
            "Explain why the weather looks and feels the way it does right now for an informed but busy reader. " +
            "Write 2–3 concise sentences.\n\n" +
        
            "Focus on large-scale geography and motion:\n" +
            "- where the air mass is coming from (direction and source region)\n" +
            "- what pressure pattern or jet stream position is controlling conditions\n" +
            "- how this explains temperature, wind, cloud cover, and humidity\n\n" +
        
            "Be geographically explicit (north/south, ocean/continent, upstream/downstream). " +
            "Avoid poetic language or metaphor.\n\n" +
        
            "If it is dark locally, do not mention sunlight or brightness.\n\n" +
        
            "Optionally end with one short, neutral sentence describing what people commonly wear in these conditions.",
        }
        ,
        {
          role: "user",
          content:
            "Location: " + summary.location + "\n" +
            "Temperature: " + summary.temp + "°F\n" +
            "Cloud cover: " + summary.clouds + "%\n" +
            "Wind speed: " + summary.wind + " mph\n" +
            "Pressure: " + summary.pressure + " hPa\n\n" +
            "Precipitation: " + precipitation + "\n" +
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
