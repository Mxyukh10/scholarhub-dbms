import {NextRequest,NextResponse} from "next/server";
import {database} from "@/lib/db";
import {currentSession} from "@/lib/auth";

export async function DELETE(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const session=await currentSession();
 if(!session||session.role!=="ADMIN")return NextResponse.json({error:"Only admins can delete papers."},{status:403});
 const {id}=await params;
 const paperId=Number(id);
 if(!Number.isInteger(paperId)||paperId<=0)return NextResponse.json({error:"Invalid paper ID."},{status:400});
 const db=database();
 if(!db)return NextResponse.json({error:"Database unavailable."},{status:503});
 const client=await db.connect();
 try{
  await client.query("BEGIN");
  await client.query("SELECT set_config('app.user_id',$1,true)",[String(session.userId)]);
  const result=await client.query("DELETE FROM papers WHERE paper_id=$1 RETURNING paper_id,title",[paperId]);
  if(!result.rowCount){await client.query("ROLLBACK");return NextResponse.json({error:"Paper not found."},{status:404});}
  // Related rows in assignments, reviews, paper_authors, paper_keywords,
  // embeddings and audit_log are removed through the schema's ON DELETE CASCADE rules.
  await client.query("COMMIT");
  return NextResponse.json({ok:true,deletedPaper:result.rows[0]});
 }catch(error){
  await client.query("ROLLBACK").catch(()=>{});
  console.error("Paper deletion failed:",error);
  return NextResponse.json({error:"Could not delete this paper."},{status:500});
 }finally{client.release();}
}
