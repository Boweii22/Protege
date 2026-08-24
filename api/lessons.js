import {z} from 'zod';
import {requireAuth} from '../server/auth.js';
import {getSql} from '../server/db.js';

const topic=z.object({id:z.string(),title:z.string(),subject:z.string(),level:z.string(),hook:z.string(),misconceptions:z.array(z.string()),mustHit:z.array(z.string())});
const snapshot=z.object({id:z.string().uuid(),topic,persona:z.string(),stage:z.enum(['teach','exam','results']),messages:z.array(z.object({id:z.string(),role:z.enum(['teacher','student']),text:z.string(),time:z.string()})),beliefs:z.array(z.object({id:z.string(),claim:z.string(),confidence:z.number(),status:z.enum(['misconception','shaky','solid']),x:z.number(),y:z.number()})),exam:z.unknown().nullable(),turn:z.number().int().nonnegative()});
const shape=row=>({id:row.id,topic:row.topic,persona:row.persona,stage:row.stage,messages:row.messages,beliefs:row.beliefs,exam:row.exam,turn:row.turn,status:row.status,createdAt:row.created_at,updatedAt:row.updated_at});

export default async function handler(request,response){
  const session=await requireAuth(request,response);if(!session)return;
  const userId=session.sub;
  try{
    const sql=getSql();
    if(request.method==='GET'){
      if(request.query?.id){const rows=await sql`SELECT * FROM lessons WHERE id=${request.query.id} AND user_id=${userId} LIMIT 1`;return rows[0]?response.status(200).json(shape(rows[0])):response.status(404).json({error:'Lesson not found.'})}
      const rows=await sql`SELECT id,topic,persona,stage,turn,status,created_at,updated_at,exam,jsonb_array_length(messages) AS message_count FROM lessons WHERE user_id=${userId} ORDER BY updated_at DESC LIMIT 20`;
      return response.status(200).json(rows.map(row=>({...shape(row),messageCount:Number(row.message_count),score:row.exam?.total??null,messages:undefined,beliefs:undefined,exam:undefined})));
    }
    if(request.method==='POST'||request.method==='PUT'){
      const body=snapshot.parse(request.body);const completed=body.stage==='results';
      const rows=await sql`INSERT INTO lessons (id,user_id,topic,persona,stage,messages,beliefs,exam,turn,status,completed_at) VALUES (${body.id},${userId},${JSON.stringify(body.topic)}::jsonb,${body.persona},${body.stage},${JSON.stringify(body.messages)}::jsonb,${JSON.stringify(body.beliefs)}::jsonb,${JSON.stringify(body.exam)}::jsonb,${body.turn},${completed?'complete':'active'},${completed?new Date():null}) ON CONFLICT (id) DO UPDATE SET topic=EXCLUDED.topic,persona=EXCLUDED.persona,stage=EXCLUDED.stage,messages=EXCLUDED.messages,beliefs=EXCLUDED.beliefs,exam=EXCLUDED.exam,turn=EXCLUDED.turn,status=EXCLUDED.status,completed_at=EXCLUDED.completed_at,updated_at=NOW() WHERE lessons.user_id=${userId} RETURNING *`;
      return rows[0]?response.status(200).json(shape(rows[0])):response.status(403).json({error:'This lesson belongs to another account.'});
    }
    if(request.method==='DELETE'){const id=z.string().uuid().parse(request.query?.id);const rows=await sql`DELETE FROM lessons WHERE id=${id} AND user_id=${userId} RETURNING id`;return rows[0]?response.status(200).json({deleted:true}):response.status(404).json({error:'Lesson not found.'})}
    return response.status(405).json({error:'Method not allowed'});
  }catch(error){console.error('[api/lessons]',error);return response.status(error instanceof z.ZodError?400:500).json({error:error instanceof z.ZodError?'Invalid lesson data.':'The lesson archive is temporarily unavailable.'})}
}
