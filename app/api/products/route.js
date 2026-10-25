import {database} from '../../../lib/database';
import {products} from '../../../lib/catalog';
export async function GET(){
 if(!process.env.DATABASE_URL)return Response.json({products,preview:true});
 try{const sql=database();const rows=await sql`SELECT id,name,brand,category,size,price,stock,tag,image FROM products WHERE active = true ORDER BY name`;return Response.json({products:rows,preview:false},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'The catalogue is temporarily unavailable.'},{status:503});}
}
