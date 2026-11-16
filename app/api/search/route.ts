import {NextRequest,NextResponse} from "next/server";import {database} from "@/lib/db";
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams.get("q")?.trim()||"";const rawVector=req.nextUrl.searchParams.get("vector");if(!q&&!rawVector)return NextResponse.json({results:[]});
 const db=database();if(!db)return NextResponse.json({error:"Database unavailable."},{status:503});
 try{
  if(rawVector){let vector:unknown;try{vector=JSON.parse(rawVector);}catch{return NextResponse.json({error:"Vector must be valid JSON."},{status:400});}
   if(!Array.isArray(vector)||vector.length!==384||!vector.every(x=>typeof x==="number"&&Number.isFinite(x)))return NextResponse.json({error:"Semantic query vector must contain 384 finite numbers."},{status:400});
   const pgVector=`[${vector.join(",")}]`;const {rows}=await db.query(`SELECT p.paper_id AS id,p.title,p.abstract,p.status,u.name AS author,v.name AS venue,1-(e.embedding <=> $1::vector) AS score FROM paper_embeddings e JOIN papers p ON p.paper_id=e.paper_id JOIN users u ON u.user_id=p.primary_author_id LEFT JOIN venues v ON v.venue_id=p.venue_id ORDER BY e.embedding <=> $1::vector LIMIT 10`,[pgVector]);return NextResponse.json({results:rows,mode:"pgvector cosine similarity"});
  }
  const {rows}=await db.query(`SELECT p.paper_id AS id,p.title,p.abstract,p.status,u.name AS author,v.name AS venue,ts_rank(p.search_vector,plainto_tsquery('english',$1)) AS score FROM papers p JOIN users u ON u.user_id=p.primary_author_id LEFT JOIN venues v ON v.venue_id=p.venue_id WHERE p.search_vector @@ plainto_tsquery('english',$1) ORDER BY score DESC LIMIT 10`,[q]);return NextResponse.json({results:rows,mode:"PostgreSQL full-text search"});
 }catch(e){console.error(e);return NextResponse.json({error:"Search failed."},{status:500});}
}
