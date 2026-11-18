import {NextRequest,NextResponse} from "next/server";
import {database} from "@/lib/db"; import {currentSession} from "@/lib/auth";
export async function GET(){
 const db=database(); if(!db)return NextResponse.json({error:"Database is not configured."},{status:503});
 try {const {rows}=await db.query(`SELECT p.paper_id,p.title,p.abstract,p.status,p.submitted_at,u.name AS author,v.name AS venue,NULLIF(avg_review_score(p.paper_id),0) AS average_score,
 COALESCE(array_agg(DISTINCT k.keyword_text) FILTER(WHERE k.keyword_text IS NOT NULL),'{}') AS keywords,
 (SELECT COUNT(*) FROM review_assignments ra WHERE ra.paper_id=p.paper_id) AS reviewer_count,
 (SELECT COUNT(*) FROM reviews r JOIN review_assignments ra ON ra.assignment_id=r.assignment_id WHERE ra.paper_id=p.paper_id) AS completed_reviews
 FROM papers p JOIN users u ON u.user_id=p.primary_author_id LEFT JOIN venues v ON v.venue_id=p.venue_id
 LEFT JOIN paper_keywords pk ON pk.paper_id=p.paper_id LEFT JOIN keywords k ON k.keyword_id=pk.keyword_id
 GROUP BY p.paper_id,u.name,v.name ORDER BY p.submitted_at DESC`); return NextResponse.json({papers:rows});}
 catch(e){console.error(e);return NextResponse.json({error:"Could not load papers."},{status:500});}
}
export async function POST(req:NextRequest){
 const s=await currentSession(); if(!s||!(["AUTHOR","ADMIN"] as string[]).includes(s.role))return NextResponse.json({error:"Only authors and admins can submit papers."},{status:403});
 const body=await req.json().catch(()=>null); if(!body)return NextResponse.json({error:"Invalid JSON."},{status:400});
 const title=String(body.title||"").trim(),abstract=String(body.abstract||"").trim(),venue=String(body.venue||"").trim();
 const keywords=Array.isArray(body.keywords)?body.keywords.map((x:unknown)=>String(x).trim()).filter(Boolean).slice(0,8):[];
 if(title.length<10||abstract.length<40||!venue||!keywords.length)return NextResponse.json({error:"Enter a title (10+ chars), abstract (40+ chars), venue and at least one keyword."},{status:400});
 const db=database();if(!db)return NextResponse.json({error:"PostgreSQL is not connected."},{status:503});
 const c=await db.connect();try{await c.query("BEGIN");await c.query("SELECT set_config('app.user_id',$1,true)",[String(s.userId)]);const result=await c.query("SELECT submit_paper_with_reviewers($1,$2,$3,$4,$5,$6::text[],$7::integer[]) AS paper_id",[title,abstract,s.userId,venue,"CONFERENCE",keywords,[]]);await c.query("COMMIT");return NextResponse.json({ok:true,paperId:result.rows[0].paper_id},{status:201});}
 catch(e){await c.query("ROLLBACK").catch(()=>{});console.error(e);return NextResponse.json({error:(e as {code?:string}).code==="23505"?"A paper with this title already exists.":"Could not submit paper. Check the fields and database."},{status:500});}finally{c.release();}
}
