import {createHash,randomUUID} from 'node:crypto';
import {getSql} from './db.js';

export class RateLimitError extends Error{
  constructor(retryAfter){super(`You’re moving faster than the studio can safely process. Try again in ${retryAfter} seconds.`);this.name='RateLimitError';this.status=429;this.retryAfter=retryAfter}
}

const digest=value=>createHash('sha256').update(String(value)).digest('hex');
export async function enforceRateLimit(response,{identity,key,limit,windowSeconds}){
  const sql=getSql();const hashed=digest(identity);const bucket=`${key}:${windowSeconds}`;
  const rows=await sql`INSERT INTO rate_limit_windows (bucket,identity,window_started,request_count) VALUES (${bucket},${hashed},NOW(),1) ON CONFLICT (bucket,identity) DO UPDATE SET request_count=CASE WHEN rate_limit_windows.window_started<=NOW()-make_interval(secs=>${windowSeconds}) THEN 1 ELSE rate_limit_windows.request_count+1 END,window_started=CASE WHEN rate_limit_windows.window_started<=NOW()-make_interval(secs=>${windowSeconds}) THEN NOW() ELSE rate_limit_windows.window_started END RETURNING request_count,GREATEST(1,CEIL(EXTRACT(EPOCH FROM (window_started+make_interval(secs=>${windowSeconds})-NOW()))))::int AS retry_after`;
  const count=Number(rows[0].request_count);const retryAfter=Number(rows[0].retry_after);
  response.setHeader('RateLimit-Limit',String(limit));response.setHeader('RateLimit-Remaining',String(Math.max(0,limit-count)));response.setHeader('RateLimit-Reset',String(retryAfter));
  if(count>limit){response.setHeader('Retry-After',String(retryAfter));throw new RateLimitError(retryAfter)}
  return {remaining:Math.max(0,limit-count),retryAfter};
}

export async function acquireLease(identity,lane='generation',seconds=55){
  const sql=getSql();const leaseId=randomUUID();const hashed=digest(identity);
  const rows=await sql`INSERT INTO generation_leases (identity,lane,lease_id,expires_at) VALUES (${hashed},${lane},${leaseId},NOW()+make_interval(secs=>${seconds})) ON CONFLICT (identity,lane) DO UPDATE SET lease_id=EXCLUDED.lease_id,expires_at=EXCLUDED.expires_at WHERE generation_leases.expires_at<NOW() RETURNING lease_id`;
  if(!rows[0])throw new RateLimitError(4);
  return async()=>{await sql`DELETE FROM generation_leases WHERE identity=${hashed} AND lane=${lane} AND lease_id=${leaseId}`};
}

export function clientIp(request){return String(request.headers['x-forwarded-for']||request.headers['x-real-ip']||'unknown').split(',')[0].trim()}
