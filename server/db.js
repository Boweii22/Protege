import {neon} from '@neondatabase/serverless';

let client;
export function getSql(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_NOT_CONFIGURED');if(!client)client=neon(process.env.DATABASE_URL);return client}

export async function createGeneration({id,userId,lessonId,kind,model,input}){const sql=getSql();const rows=await sql`INSERT INTO ai_generations (id,user_id,lesson_id,kind,model,input,status) SELECT ${id},${userId},id,${kind},${model},${JSON.stringify(input)}::jsonb,'pending' FROM lessons WHERE id=${lessonId} AND user_id=${userId} RETURNING id`;if(!rows[0])throw new Error('LESSON_NOT_FOUND')}
export async function completeGeneration({id,model,output,usage,durationMs}){const sql=getSql();await sql`UPDATE ai_generations SET model=${model},output=${JSON.stringify(output)}::jsonb,token_usage=${JSON.stringify(usage||{})}::jsonb,duration_ms=${durationMs},status='complete',completed_at=NOW() WHERE id=${id}`}
export async function failGeneration(id,error){const sql=getSql();await sql`UPDATE ai_generations SET status='error',error=${String(error).slice(0,500)},completed_at=NOW() WHERE id=${id}`}
