import {headers} from 'next/headers';
import {database} from '../../../../lib/database';
export async function PATCH(request){
 const h=await headers();const admin=process.env.ADMIN_EMAIL?.trim().toLowerCase();const email=h.get('oai-authenticated-user-email')?.toLowerCase();
 if(!admin||email!==admin)return Response.json({error:'Unauthorized'},{status:403});
 const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)return Response.json({error:'Invalid request origin'},{status:403});
 if(!process.env.DATABASE_URL)return Response.json({error:'Neon is not connected yet.'},{status:503});
 let data;try{data=await request.json();}catch{return Response.json({error:'Invalid request'},{status:400});}
 const {id,price,stock}=data;
 if(typeof id!=='string'||id.length>100||!Number.isInteger(price)||price<0||price>100000||!Number.isInteger(stock)||stock<0||stock>100000)return Response.json({error:'Enter a valid whole-rupee price and stock quantity.'},{status:400});
 try{const sql=database();const rows=await sql`UPDATE products SET price=${price},stock=${stock} WHERE id=${id} RETURNING id,price,stock`;if(!rows.length)return Response.json({error:'Product not found'},{status:404});return Response.json({product:rows[0]});}catch{return Response.json({error:'Unable to update this product.'},{status:503});}
}
