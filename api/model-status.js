import {requireAuth} from '../server/auth.js';
import {getSql} from '../server/db.js';
import {routingManifest} from '../server/ai-router.js';

export default async function handler(request,response){
  if(request.method!=='GET')return response.status(405).json({error:'Method not allowed'});
  const session=await requireAuth(request,response);if(!session)return;
  try{
    const sql=getSql();
    const summaryRows=await sql`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE status='complete')::int AS successful,COALESCE(ROUND(AVG(duration_ms) FILTER (WHERE status='complete')),0)::int AS avg_latency_ms,COALESCE(SUM((token_usage->>'totalTokens')::int) FILTER (WHERE status='complete'),0)::int AS total_tokens,COUNT(*) FILTER (WHERE routing->>'failover'='true')::int AS failovers FROM ai_generations WHERE user_id=${session.sub} AND created_at>NOW()-INTERVAL '24 hours'`;
    const recent=await sql`SELECT kind,model,status,duration_ms,routing->>'failover' AS failover,created_at FROM ai_generations WHERE user_id=${session.sub} ORDER BY created_at DESC LIMIT 8`;
    const summary=summaryRows[0];
    return response.status(200).json({status:'operational',window:'24h',summary:{...summary,successRate:summary.total?Math.round(summary.successful/summary.total*100):100},recent:recent.map(row=>({...row,failover:row.failover==='true'})),routes:routingManifest()});
  }catch(error){console.error('[api/model-status]',error);return response.status(500).json({error:'Model telemetry is temporarily unavailable.'})}
}
