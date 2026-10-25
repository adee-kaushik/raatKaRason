import {neon} from '@neondatabase/serverless';
import {readFile} from 'node:fs/promises';
import {sqlStatements} from './sql-statements.mjs';
// Run against an isolated test branch first. Credentials come from environment only.
const connection=process.env.DATABASE_URL_UNPOOLED;
if(!connection)throw new Error('Set DATABASE_URL_UNPOOLED to the dedicated Neon branch connection.');
if(new URL(connection).hostname.includes('-pooler'))throw new Error('Use the unpooled URL for schema setup.');
const sql=neon(connection);const schema=await readFile(new URL('../db/store-schema.sql',import.meta.url),'utf8');
await sql.transaction(sqlStatements(schema).map(statement=>sql.query(statement,[])));console.log('Store schema applied. The store starts closed; add real products and supported hostels in admin.');
