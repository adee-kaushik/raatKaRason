import {headers} from 'next/headers';
import Inventory from './inventory';
import {database} from '../../lib/database';
import {ShieldCheck,ArrowRight} from 'lucide-react';
export const dynamic='force-dynamic';
export default async function Admin(){
 const h=await headers();const email=h.get('oai-authenticated-user-email');const allowed=process.env.ADMIN_EMAIL?.trim().toLowerCase();const authorized=allowed&&email?.toLowerCase()===allowed;
 let rows=[],error='';if(authorized&&process.env.DATABASE_URL){try{const sql=database();rows=await sql`SELECT id,name,price,stock FROM products ORDER BY name`;}catch{error='Unable to load inventory. Check the Neon connection and schema.';}}
 return <main><section className="admin-shell"><a href="/">← Back to the snack store</a><ShieldCheck size={32}/><p className="eyebrow">STORE MANAGEMENT</p><h1>Admin access</h1>{!email?<><p>Sign in to access store management. Customer shopping never needs an account.</p><a className="primary" href="/signin-with-chatgpt?return_to=%2Fadmin" target="_top">Admin sign in <ArrowRight size={16}/></a></>:!allowed?<><p>The admin area is locked until the store owner’s email is configured.</p><p>Product management will be available after the Neon database and administrator access are connected.</p></>:!authorized?<p>This account does not have access to store management.</p>:<><p>You’re signed in as the store administrator.</p><p>Neon connection: {process.env.DATABASE_URL?'Configured':'Awaiting setup'}.</p>{error?<p>{error}</p>:process.env.DATABASE_URL?<Inventory products={rows}/>:<p>Connect Neon to manage product prices and available stock.</p>}</>}</section></main>
}
