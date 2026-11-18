import {NextRequest,NextResponse} from "next/server"; import {database} from "@/lib/db"; import {currentSession} from "@/lib/auth";
export async function GET(){const s=await currentSession();if(!s)return NextResponse.json({error:"Sign in first."},{status:401});const db=database();if(!db)return NextResponse.json({error:"Database unavailable."},{status:503});
 try{const args=s.role==="REVIEWER"?[s.userId]:s.role==="AUTHOR"?[s.userId]:[];const where=s.role==="REVIEWER"?"WHERE ra.reviewer_id=$1":s.role==="AUTHOR"?"WHERE p.primary_author_id=$1":"";const {rows}=await db.query(`SELECT ra.assignment_id,ra.status AS assignment_status,p.paper_id,p.title,p.abstract,p.status AS paper_status,NULLIF(avg_review_score(p.paper_id),0) AS average_score,u.name AS author
 FROM review_assignments ra JOIN papers p ON p.paper_id=ra.paper_id JOIN users u ON u.user_id=p.primary_author_id ${where} ORDER BY ra.assigned_at DESC`,args);return NextResponse.json({assignments:rows});}catch(e){console.error(e);return NextResponse.json({error:"Could not load assignments."},{status:500});}}
export async function POST(req:NextRequest){
 const s=await currentSession();
 if(!s||s.role!=="ADMIN")return NextResponse.json({error:"Only admins can assign reviewers."},{status:403});
 const b=await req.json().catch(()=>null);
 const paperId=Number(b?.paperId),reviewerId=Number(b?.reviewerId);
 if(!paperId||!reviewerId)return NextResponse.json({error:"Choose a paper and reviewer."},{status:400});
 const db=database();if(!db)return NextResponse.json({error:"Database unavailable."},{status:503});
 const c=await db.connect();
 try{
  await c.query("BEGIN");
  await c.query("SELECT set_config('app.user_id',$1,true)",[String(s.userId)]);
  // Lock the reviewer row so two simultaneous Admin requests cannot exceed the limit.
  const reviewer=await c.query("SELECT user_id FROM users WHERE user_id=$1 AND role='REVIEWER' AND is_active=TRUE FOR UPDATE",[reviewerId]);
  if(!reviewer.rowCount)throw new Error("Reviewer not found or inactive.");
  // Nested query: count distinct papers that this reviewer still has to review.
  const workload=await c.query(`
   SELECT COUNT(*)::INTEGER AS active_count
   FROM (
    SELECT DISTINCT ra.paper_id
    FROM review_assignments ra
    JOIN papers p ON p.paper_id=ra.paper_id
    WHERE ra.reviewer_id=$1
      AND ra.status='PENDING'
      AND p.status IN ('SUBMITTED','UNDER_REVIEW')
   ) AS active_reviewer_papers
  `,[reviewerId]);
  const activeCount=Number(workload.rows[0]?.active_count||0);
  if(activeCount>=3){
   const error=new Error(`This reviewer already has 3 active papers. They must finish at least one before you can allocate another paper.`) as Error & {code?:string};
   error.code="REVIEWER_LIMIT_REACHED";
   throw error;
  }
  const paper=await c.query("SELECT paper_id FROM papers WHERE paper_id=$1 AND status IN ('SUBMITTED','UNDER_REVIEW') FOR UPDATE",[paperId]);
  if(!paper.rowCount)throw new Error("Paper not found or no longer accepting reviewer assignments.");
  await c.query("INSERT INTO review_assignments(paper_id,reviewer_id) VALUES($1,$2)",[paperId,reviewerId]);
  await c.query("UPDATE papers SET status='UNDER_REVIEW' WHERE paper_id=$1 AND status='SUBMITTED'",[paperId]);
  await c.query("INSERT INTO notifications(user_id,message) VALUES($1,$2)",[reviewerId,"You have a new ScholarHub paper review assignment."]);
  await c.query("COMMIT");
  return NextResponse.json({ok:true,activeCount:activeCount+1},{status:201});
 }catch(e){
  await c.query("ROLLBACK");
  const err=e as Error & {code?:string};
  if(err.code==="REVIEWER_LIMIT_REACHED")return NextResponse.json({error:err.message,code:err.code,activeCount:3},{status:409});
  return NextResponse.json({error:err.code==="23505"?"This reviewer is already assigned to this paper.":err.message||"Assignment failed."},{status:400});
 }finally{c.release();}
}
