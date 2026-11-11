import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "paperlens_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Signing secret. The insecure fallback is only allowed outside production. */
export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set in production");
  }
  return "local-demo-secret-change-me";
}

export function sign(value: string): string {
  return createHmac("sha256", authSecret()).update(value).digest("hex");
}

/** Constant-time comparison that is safe for strings of different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const x = createHmac("sha256", "cmp").update(a).digest();
  const y = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(x, y);
}

export async function currentRole(): Promise<"ADMIN" | "RESEARCHER" | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [p, s] = raw.split(".");
  if (!p || !s) return null;
  if (!safeEqual(s, sign(p))) return null;
  try {
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    return d.exp > Date.now() && ["ADMIN", "RESEARCHER"].includes(d.role) ? d.role : null;
  } catch {
    return null;
  }
}
