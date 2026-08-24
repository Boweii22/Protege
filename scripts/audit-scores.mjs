import {neon} from '@neondatabase/serverless';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is missing');
const sql=neon(process.env.DATABASE_URL);
const rows=await sql`SELECT created_at, input->'studentBeliefs' AS beliefs, output->>'total' AS reported_total, output->'questions' AS questions, (SELECT COALESCE(SUM((question->>'score')::int),0) FROM jsonb_array_elements(output->'questions') question) AS calculated_total FROM ai_generations WHERE kind='blind_exam' AND status='complete' ORDER BY created_at DESC LIMIT 5`;
console.log(JSON.stringify(rows.map(row=>({createdAt:row.created_at,reported:Number(row.reported_total),calculated:Number(row.calculated_total),beliefs:row.beliefs,questions:row.questions.map(question=>({score:question.score,beliefId:question.beliefId,why:question.why}))})),null,2));
