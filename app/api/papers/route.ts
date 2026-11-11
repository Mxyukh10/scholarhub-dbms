import { NextRequest, NextResponse } from "next/server";
import { paperInput } from "@/lib/validation";
import { database } from "@/lib/db";
import { currentRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await currentRole())) {
    return NextResponse.json({ error: "Sign in as ADMIN or RESEARCHER first." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = paperInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = database();
  if (!db) {
    return NextResponse.json(
      { message: "Validated in demo mode. Configure DATABASE_URL to persist this paper." },
      { status: 202 }
    );
  }

  const p = parsed.data;
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const venue = await c.query(
      "INSERT INTO venues(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING venue_id",
      [p.venue]
    );
    const paper = await c.query(
      "INSERT INTO papers(title,abstract,year,venue_id,doi,status) VALUES($1,$2,$3,$4,$5,'PUBLISHED') RETURNING paper_id",
      [p.title, p.abstract, p.year, venue.rows[0].venue_id, p.doi || null]
    );
    for (const name of new Set(p.topics)) {
      const topic = await c.query(
        "INSERT INTO topics(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING topic_id",
        [name]
      );
      await c.query(
        "INSERT INTO paper_topics(paper_id,topic_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [paper.rows[0].paper_id, topic.rows[0].topic_id]
      );
    }
    await c.query("COMMIT");
    return NextResponse.json({ id: paper.rows[0].paper_id }, { status: 201 });
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    // 23505 = unique_violation (duplicate title or DOI)
    if ((err as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "A paper with this title or DOI already exists." }, { status: 409 });
    }
    console.error("POST /api/papers failed:", err);
    return NextResponse.json({ error: "Unable to save paper" }, { status: 500 });
  } finally {
    c.release();
  }
}
