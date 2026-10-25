import {compare} from 'bcryptjs';
import {database} from '../../../../lib/database';
import {hashToken,randomToken,rateLimit,sessionCookie} from '../../../../lib/admin-auth';
import {json,readJson,sameOrigin} from '../../../../lib/http';
export async function POST(request){
 if(!sameOrigin(request))return json({error:'Invalid request origin.'},403);
 if(!process.env.DATABASE_URL||!process.env.ADMIN_PASSWORD_HASH||!process.env.ADMIN_EMAIL)return json({error:'Admin access is waiting for the Neon connection.'},503);
 try{const data=await readJson(request,2048);if(typeof data.email!=='string'||typeof data.password!=='string'||data.password.length>72||data.email.length>254)return json({error:'Invalid email or password.'},400);
 const ip=request.headers.get('cf-connecting-ip')||'unknown';const key='login:'+await hashToken(ip);if(!await rateLimit(key,10,15))return json({error:'Too many attempts. Please try again in 15 minutes.'},429);
 const passwordMatches=await compare(data.password,process.env.ADMIN_PASSWORD_HASH);
 if(!passwordMatches||data.email.trim().toLowerCase()!==process.env.ADMIN_EMAIL.trim().toLowerCase())return json({error:'Invalid email or password.'},401);
 const sql=database();const token=randomToken();const email=process.env.ADMIN_EMAIL.trim().toLowerCase();
 await sql`DELETE FROM admin_sessions WHERE expires_at<now()`;
 await sql`INSERT INTO admin_sessions(token_hash,email,expires_at) VALUES(${await hashToken(token)},${email},now()+interval '12 hours')`;
 const response=json({ok:true});const secure=new URL(request.url).protocol==='https:';response.headers.set('Set-Cookie',`${sessionCookie}=${token}; HttpOnly; ${secure?'Secure; ':''}SameSite=Strict; Path=/; Max-Age=43200`);return response;
 }catch{return json({error:'Unable to sign in. Please check the connection and try again.'},503);}
}
