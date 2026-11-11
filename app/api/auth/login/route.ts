import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, safeEqual, sign } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const { role, password } = (body ?? {}) as { role?: unknown; password?: unknown };

  if (role !== "ADMIN" && role !== "RESEARCHER") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const expected = role === "ADMIN" ? process.env.ADMIN_DEMO_PASSWORD : process.env.RESEARCHER_DEMO_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "Set the demo password in .env.local before signing in." }, { status: 503 });
  }
  if (!safeEqual(password, expected)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  let token: string;
  try {
    const payload = Buffer.from(JSON.stringify({ role, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 })).toString("base64url");
    token = `${payload}.${sign(payload)}`;
  } catch {
    return NextResponse.json({ error: "Server auth is not configured (AUTH_SECRET)." }, { status: 503 });
  }

  const res = NextResponse.json({ role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
