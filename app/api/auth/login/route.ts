import { NextRequest,NextResponse } from "next/server";
import { database } from "@/lib/db";
import { createSession,SESSION_COOKIE,SESSION_MAX_AGE_SECONDS,Role } from "@/lib/auth";
import { timingSafeEqual } from "crypto";
const safe=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
export async function POST(req:NextRequest) {
 try {
  const body=await req.json().catch(()=>null); if(!body||typeof body!=="object")return NextResponse.json({error:"Request body must be valid JSON."},{status:400}); const role=body.role as Role; const password=body.password; const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
  if(!["ADMIN","AUTHOR","REVIEWER"].includes(role)||typeof password!=="string"||!password) return NextResponse.json({error:"Choose a role and enter its password."},{status:400});
  const envKey=role==="ADMIN"?"ADMIN_DEMO_PASSWORD":role==="AUTHOR"?"AUTHOR_DEMO_PASSWORD":"REVIEWER_DEMO_PASSWORD";
  const expected=process.env[envKey]; if(!expected||!safe(password,expected)) return NextResponse.json({error:"Incorrect demo password. Check your .env.local file."},{status:401});
  const db=database(); if(!db) return NextResponse.json({error:"PostgreSQL is not connected. Start the database and check DATABASE_URL."},{status:503});
  const result=await db.query("SELECT user_id,name,email,role FROM users WHERE role=$1 AND is_active=TRUE AND ($2::text IS NULL OR lower(email)=$2) ORDER BY user_id LIMIT 1",[role,email||null]);
  if(!result.rowCount) return NextResponse.json({error:"No active account matches that role and email. Check the email or run the database schema/seed script."},{status:503});
  const u=result.rows[0]; const token=createSession({userId:u.user_id,role:u.role,name:u.name,email:u.email});
  const res=NextResponse.json({ok:true,role:u.role,name:u.name});
  res.cookies.set(SESSION_COOKIE,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:SESSION_MAX_AGE_SECONDS}); return res;
 } catch(e) { console.error(e); return NextResponse.json({error:"Login failed. Check PostgreSQL and AUTH_SECRET."},{status:500}); }
}
