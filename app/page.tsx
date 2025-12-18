"use client";
import { useState } from "react";

export default function Home() {
  const [city, setCity] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!city) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city }),
      });

      const json = await res.json();

      if (json.error) {
        setError("Couldn’t find that location.");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Something went wrong.");
    }

    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        backgroundColor: "#fafafa",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ maxWidth: 640, width: "100%" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
          Why the weather feels this way
        </h1>

        <p style={{ marginBottom: "2rem", color: "#555" }}>
          A short explanation of the atmosphere above you — right now.
        </p>

        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder="Enter your city"
          style={{
            width: "100%",
            padding: "0.75rem 0.5rem",
            fontSize: "1rem",
            border: "none",
            borderBottom: "1px solid #ccc",
            outline: "none",
            background: "transparent",
            marginBottom: "1.5rem",
          }}
        />

        {loading && (
          <p style={{ fontStyle: "italic", color: "#666" }}>
            Listening to the atmosphere…
          </p>
        )}

        {error && <p style={{ color: "#aa0000" }}>{error}</p>}

        {data && (
          <section style={{ marginTop: "2.5rem" }}>
            <h2>{data.location}</h2>
            <p style={{ color: "#444" }}>{data.temp}°F</p>

            <p style={{ lineHeight: 1.7, fontSize: "1.05rem", marginTop: "1rem" }}>
              {data.narrative}
            </p>

            <footer style={{ marginTop: "2.5rem", fontSize: "0.85rem", color: "#777" }}>
              An experimental educational project.
            </footer>
          </section>
        )}
      </div>
    </main>
  );
}
