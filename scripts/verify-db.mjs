import {neon} from '@neondatabase/serverless';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is missing');
const sql=neon(process.env.DATABASE_URL);
const tables=await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('lessons','ai_generations','generated_topics') ORDER BY table_name`;
const indexes=await sql`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('lessons','ai_generations','generated_topics') ORDER BY indexname`;
const routingColumns=await sql`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_name='routing' AND table_name IN ('ai_generations','generated_topics') ORDER BY table_name`;
console.log(JSON.stringify({tables:tables.map(row=>row.table_name),indexes:indexes.map(row=>row.indexname),routingColumns}));
if(tables.length!==3||indexes.length<6||routingColumns.length!==2)process.exit(1);
