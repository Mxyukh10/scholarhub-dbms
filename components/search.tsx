"use client";
import { useState } from "react";

type Result = { id: number; title: string; abstract: string; year: number; venue: string; score: number };

export function Search() {
  const [q, setQ] = useState("");
  const [r, setR] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const x = await res.json();
      setR(Array.isArray(x.results) ? x.results : []);
      setMode(x.mode || "");
      if (!res.ok) setError(x.error || "Search failed.");
    } catch {
      setR([]);
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="search" onSubmit={search}>
        <input aria-label="search papers" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try: retrieval, transformers, datasets…" />
        <button disabled={loading}>{loading ? "Searching…" : "Search"}</button>
      </form>
      {error && <p className="notice">{error}</p>}
      {mode && !error && <p className="small">Search mode: {mode}</p>}
      {!loading && !error && mode && r.length === 0 && <p className="meta">No papers matched your search.</p>}
      {r.length > 0 && (
        <div className="cards">
          {r.map((p) => (
            <a className="paper" href={`/papers/${p.id}`} key={p.id}>
              <h3>{p.title}</h3>
              <span className="small">
                {mode === "pgvector" ? "Similarity" : "Match"} {Math.round(p.score * 100)}% · {p.venue} · {p.year}
              </span>
              <p className="meta">{p.abstract}</p>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
