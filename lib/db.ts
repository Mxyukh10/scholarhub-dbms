import { Pool } from "pg";
const globalForPg=globalThis as unknown as { scholarHubPool?:Pool };
export function database() {
 if(!process.env.DATABASE_URL) return null;
 if(!globalForPg.scholarHubPool) globalForPg.scholarHubPool=new Pool({connectionString:process.env.DATABASE_URL});
 return globalForPg.scholarHubPool;
}
