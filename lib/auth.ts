import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
export const SESSION_COOKIE = "scholarhub_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export type Role = "ADMIN" | "AUTHOR" | "REVIEWER";
export type Session = { userId: number; role: Role; name: string; email: string; exp: number };
function secret() {
 const value = process.env.AUTH_SECRET;
 if (!value && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required");
 return value || "local-only-change-this-secret";
}
function signature(value: string) { return createHmac("sha256", secret()).update(value).digest("hex"); }
function equal(a: string,b: string) { const x=Buffer.from(a),y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); }
export function createSession(data: Omit<Session,"exp">) {
 const payload=Buffer.from(JSON.stringify({...data,exp:Date.now()+SESSION_MAX_AGE_SECONDS*1000})).toString("base64url");
 return `${payload}.${signature(payload)}`;
}
export async function currentSession(): Promise<Session|null> {
 const raw=(await cookies()).get(SESSION_COOKIE)?.value; if(!raw) return null;
 const [payload,sig]=raw.split("."); if(!payload||!sig||!equal(sig,signature(payload))) return null;
 try { const data=JSON.parse(Buffer.from(payload,"base64url").toString()) as Session;
  if(data.exp<=Date.now()||!(["ADMIN","AUTHOR","REVIEWER"] as string[]).includes(data.role)) return null;
  return data;
 } catch { return null; }
}
export async function currentRole() { return (await currentSession())?.role ?? null; }
