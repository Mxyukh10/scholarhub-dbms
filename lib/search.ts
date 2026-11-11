import type { DemoPaper } from "@/lib/demo-data";

/** Lowercased words of 3+ letters, used for the lexical fallback search. */
export const words = (s: string): Set<string> =>
  new Set(s.toLowerCase().match(/[a-z]{3,}/g) || []);

/**
 * Lexical fallback used in demo mode (no database, no embeddings).
 * Score = fraction of query words found in the paper's title, abstract or topics.
 * This is keyword overlap, not semantic search.
 */
export function lexicalSearch(query: string, papers: DemoPaper[]) {
  const q = words(query);
  return papers
    .map((p) => {
      const text = words(`${p.title} ${p.abstract} ${p.topics.join(" ")}`);
      const hits = [...q].filter((w) => text.has(w)).length;
      return { ...p, score: hits / Math.max(q.size, 1) };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Parses a pgvector query embedding from a request parameter, e.g. "[0.1,0.2,...]".
 * Returns the normalized "[a,b,c]" string, or null if it is not a valid
 * vector of exactly `dims` finite numbers.
 */
export function parseVector(raw: string | null, dims = 768): string | null {
  if (!raw) return null;
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr.length !== dims) return null;
  if (!arr.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return `[${arr.join(",")}]`;
}
