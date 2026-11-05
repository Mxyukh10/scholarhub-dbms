import { Pool } from "pg";
let pool:Pool|undefined;
export function database(){if(!process.env.DATABASE_URL) return null; pool ??=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:undefined});return pool}
export async function sql(text:string,values:unknown[]=[]){const db=database();if(!db)throw new Error("DATABASE_URL is required for database mode");return (await db.query(text,values)).rows}
