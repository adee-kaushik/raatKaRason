import {getAdmin} from '../../../../lib/admin-auth';import {json} from '../../../../lib/http';
export async function GET(){try{const admin=await getAdmin();return admin?json({admin}):json({error:'Please sign in.'},401);}catch{return json({error:'Store connection is unavailable.'},503);}}
