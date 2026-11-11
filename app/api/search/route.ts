import { NextRequest, NextResponse } from "next/server";
import { demoPapers } from "@/lib/demo-data";
import { database } from "@/lib/db";
import { lexicalSearch, parseVector } from "@/lib/search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q) return NextResponse.json({ results: [] });

  const db = database();
  if (!db) {
    return NextResponse.json({
      results: lexicalSearch(q, demoPapers),
      mode: "demo lexical fallback",
    });
  }

  try {
    // 1. Real semantic search: the caller supplies a 768-dim query embedding.
    const vector = parseVector(req.nextUrl.searchParams.get("vector"));
    if (vector) {
      const rows = await db.query(
        `SELECT p.paper_id AS id, p.title, p.abstract, p.year, v.name AS venue,
                1 - (c.embedding <=> $1::vector) AS score
           FROM paper_chunks c
           JOIN papers p ON p.paper_id = c.paper_id
           JOIN venues v ON v.venue_id = p.venue_id
          WHERE c.embedding IS NOT NULL AND p.status = 'PUBLISHED'
          ORDER BY c.embedding <=> $1::vector
          LIMIT 8`,
        [vector]
      );
      return NextResponse.json({ results: rows.rows, mode: "pgvector" });
    }

    // 2. No embedding available: use the full-text GIN index from 01_schema.sql.
    const rows = await db.query(
      `SELECT p.paper_id AS id, p.title, p.abstract, p.year, v.name AS venue,
              ts_rank(to_tsvector('english', p.title || ' ' || p.abstract),
                      plainto_tsquery('english', $1)) AS score
         FROM papers p
         JOIN venues v ON v.venue_id = p.venue_id
        WHERE p.status = 'PUBLISHED'
          AND to_tsvector('english', p.title || ' ' || p.abstract) @@ plainto_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT 8`,
      [q]
    );
    return NextResponse.json({ results: rows.rows, mode: "postgres full-text" });
  } catch {
    return NextResponse.json(
      { results: [], error: "Search failed. Check the database connection." },
      { status: 503 }
    );
  }
}
