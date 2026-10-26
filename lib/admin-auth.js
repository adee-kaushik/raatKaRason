import {cookies} from 'next/headers';
import {database} from './database';
export const sessionCookie='rkr_admin';
export async function hashToken(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
export function randomToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
export function primaryAdminEmail(){return (process.env.ADMIN_EMAIL||'').trim().replace(/^["']|["']$/g,'').toLowerCase();}
export async function getAdmin(){
 if(!process.env.DATABASE_URL)return null;
 const jar=await cookies();const token=jar.get(sessionCookie)?.value;
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const sql=database();const [session]=await sql`SELECT email FROM admin_sessions WHERE token_hash=${await hashToken(token)} AND expires_at>now()`;
 if(!session)return null;
 if(session.email===primaryAdminEmail())return {email:session.email,role:'admin'};
 const [account]=await sql`SELECT email,role FROM admin_accounts WHERE email=${session.email} AND active=true AND credentials_updated_at <= (SELECT created_at FROM admin_sessions WHERE token_hash=${await hashToken(token)})`;
 return account?.role==='read_only'?{email:account.email,role:'read_only'}:null;
}
// Every protected write must require this capability, independent of the UI.
export function canManage(admin){return admin?.role==='admin';}
export async function rateLimit(key,max,minutes){const sql=database();const [row]=await sql`INSERT INTO request_limits(key,attempts,window_start) VALUES(${key},1,now()) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN request_limits.window_start<now()-(${minutes}*interval '1 minute') THEN 1 ELSE request_limits.attempts+1 END,window_start=CASE WHEN request_limits.window_start<now()-(${minutes}*interval '1 minute') THEN now() ELSE request_limits.window_start END RETURNING attempts`;return row.attempts<=max;}
