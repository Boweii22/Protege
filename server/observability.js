import {createHash,randomUUID} from 'node:crypto';
import {getSql} from './db.js';

const clean=value=>String(value||'Unknown error').replace(/(key|token|secret|authorization)\s*[=:]\s*[^\s,}]+/gi,'$1=[redacted]').slice(0,800);
export function requestContext(request,route){const context={requestId:String(request.headers['x-vercel-id']||request.headers['x-request-id']||randomUUID()),route,started:Date.now()};console.log(JSON.stringify({level:'info',event:'request.start',requestId:context.requestId,route,method:request.method}));return context}
export function logComplete(context,status,extra={}){console.log(JSON.stringify({level:'info',event:'request.complete',requestId:context.requestId,route:context.route,status,durationMs:Date.now()-context.started,...extra}))}
export async function reportError(error,context,{userId=null,status=500,kind='server'}={}){
  const message=clean(error instanceof Error?error.message:error);const stack=clean(error instanceof Error?error.stack:'');const fingerprint=createHash('sha256').update(`${context.route}:${message}:${stack.split('\n')[1]||''}`).digest('hex').slice(0,24);const incidentId=randomUUID().split('-')[0].toUpperCase();
  console.error(JSON.stringify({level:'error',event:'request.failed',incidentId,requestId:context.requestId,route:context.route,status,kind,message,durationMs:Date.now()-context.started,fingerprint}));
  try{const sql=getSql();await sql`INSERT INTO error_events (incident_id,request_id,user_id,route,kind,status_code,message,fingerprint,duration_ms) VALUES (${incidentId},${context.requestId},${userId},${context.route},${kind},${status},${message},${fingerprint},${Date.now()-context.started})`}catch(dbError){console.error(JSON.stringify({level:'error',event:'telemetry.write_failed',incidentId,reason:clean(dbError instanceof Error?dbError.message:dbError)}))}
  return incidentId;
}
