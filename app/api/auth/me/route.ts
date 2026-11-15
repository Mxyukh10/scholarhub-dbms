import { NextResponse } from "next/server"; import { currentSession } from "@/lib/auth";
export async function GET(){const session=await currentSession();return NextResponse.json({session:session?{userId:session.userId,role:session.role,name:session.name,email:session.email}:null});}
