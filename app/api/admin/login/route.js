import {compare} from 'bcryptjs';
import {database} from '../../../../lib/database';
import {hashToken,randomToken,rateLimit,sessionCookie} from '../../../../lib/admin-auth';
import {json,readJson,sameOrigin,clientIp} from '../../../../lib/http';
export async function POST(request){
 if(!sameOrigin(request))return json({error:'Invalid request origin.'},403);
 const adminEmail=(process.env.ADMIN_EMAIL||'').trim().replace(/^["']|["']$/g,'').toLowerCase();
 const adminHash=(process.env.ADMIN_PASSWORD_HASH||'').trim().replace(/^["']|["']$/g,'');
 const adminPlain=(process.env.ADMIN_PASSWORD||'').trim().replace(/^["']|["']$/g,'');
 if(!process.env.DATABASE_URL||(!adminHash&&!adminPlain)||!adminEmail)return json({error:'Admin access is waiting for the Neon connection.'},503);
 try{
  const data=await readJson(request,2048);
  if(typeof data.email!=='string'||typeof data.password!=='string'||data.password.length>72||data.email.length>254)return json({error:'Invalid email or password.'},400);
  const ip=clientIp(request);
  const key='login:'+await hashToken(ip);
  if(!await rateLimit(key,10,15))return json({error:'Too many attempts. Please try again in 15 minutes.'},429);
  let passwordMatches=false;
  if(adminHash&&adminHash.startsWith('$2')){
   try{passwordMatches=await compare(data.password,adminHash);}catch(e){console.error('Password hash comparison failed:',e);}
  }
  if(!passwordMatches&&(adminPlain||adminHash)){
   if(adminPlain&&data.password===adminPlain)passwordMatches=true;
   else if(data.password===adminHash)passwordMatches=true;
  }
  const submittedEmail=data.email.trim().toLowerCase();
  if(!passwordMatches||submittedEmail!==adminEmail){
   console.warn(`[Admin Login Failed] Input email: "${submittedEmail}", Configured email: "${adminEmail}", EmailMatch: ${submittedEmail===adminEmail}, PasswordMatch: ${passwordMatches}`);
   return json({error:'Invalid email or password.'},401);
  }
  const sql=database();const token=randomToken();
  await sql`DELETE FROM admin_sessions WHERE expires_at<now()`;
  await sql`INSERT INTO admin_sessions(token_hash,email,expires_at) VALUES(${await hashToken(token)},${adminEmail},now()+interval '12 hours')`;
  const response=json({ok:true});const secure=new URL(request.url).protocol==='https:';
  response.headers.set('Set-Cookie',`${sessionCookie}=${token}; HttpOnly; ${secure?'Secure; ':''}SameSite=Strict; Path=/; Max-Age=43200`);
  return response;
 }catch(err){
  console.error('[Admin Login Error]:',err);
  return json({error:'Unable to sign in. Please check the connection and try again.'},503);
 }
}

