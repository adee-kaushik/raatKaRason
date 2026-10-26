import {compare} from 'bcryptjs';
import {database} from '../../../../lib/database';
import {hashToken,randomToken,rateLimit,sessionCookie,primaryAdminEmail} from '../../../../lib/admin-auth';
import {json,readJson,sameOrigin,clientIp} from '../../../../lib/http';
export async function POST(request){
 if(!sameOrigin(request))return json({error:'Invalid request origin.'},403);
 if(!process.env.DATABASE_URL)return json({error:'Admin access is waiting for the Neon connection.'},503);
 try{
  const data=await readJson(request,2048);
  if(typeof data.email!=='string'||typeof data.password!=='string'||data.password.length>72||data.email.length>254)return json({error:'Invalid email or password.'},400);
  if(!await rateLimit('login:'+await hashToken(clientIp(request)),10,15))return json({error:'Too many attempts. Please try again in 15 minutes.'},429);
  const sql=database();const email=data.email.trim().toLowerCase();
  const adminHash=(process.env.ADMIN_PASSWORD_HASH||'').trim().replace(/^["']|["']$/g,'');
  let passwordMatches=false;
  if(email===primaryAdminEmail()){
   if(adminHash.startsWith('$2'))passwordMatches=await compare(data.password,adminHash);
   else {const plain=(process.env.ADMIN_PASSWORD||'').trim().replace(/^["']|["']$/g,'');if(plain)passwordMatches=data.password===plain;}
  }else{
   const [account]=await sql`SELECT password_hash FROM admin_accounts WHERE email=${email} AND role='read_only' AND active=true`;
   // Also compare unknown emails to a hash to avoid an immediate account-existence signal.
   const hash=account?.password_hash||adminHash;
   if(hash.startsWith('$2')){const matches=await compare(data.password,hash);passwordMatches=Boolean(account&&matches);}
  }
  if(!passwordMatches)return json({error:'Invalid email or password.'},401);
  const token=randomToken();
  await sql`DELETE FROM admin_sessions WHERE expires_at<now()`;
  await sql`INSERT INTO admin_sessions(token_hash,email,expires_at) VALUES(${await hashToken(token)},${email},now()+interval '12 hours')`;
  const response=json({ok:true});const secure=new URL(request.url).protocol==='https:';
  response.headers.set('Set-Cookie',`${sessionCookie}=${token}; HttpOnly; ${secure?'Secure; ':''}SameSite=Strict; Path=/; Max-Age=43200`);
  return response;
 }catch{return json({error:'Unable to sign in. Please check the connection and try again.'},503);}
}
