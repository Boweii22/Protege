import {z} from 'zod';
import {clientIp,enforceRateLimit,RateLimitError} from '../server/guardrails.js';
import {reportError,requestContext} from '../server/observability.js';

const input=z.object({message:z.string().max(800),stack:z.string().max(4000).optional(),componentStack:z.string().max(4000).optional(),path:z.string().max(300).optional()});
export default async function handler(request,response){
  if(request.method!=='POST')return response.status(405).json({error:'Method not allowed'});const context=requestContext(request,'/api/client-errors');
  try{await enforceRateLimit(response,{identity:clientIp(request),key:'client-errors',limit:12,windowSeconds:3600});const body=input.parse(request.body);const error=new Error(body.message);error.stack=body.stack||body.componentStack;const incidentId=await reportError(error,{...context,route:body.path||context.route},{status:500,kind:'browser'});return response.status(202).json({incidentId})}catch(error){if(error instanceof RateLimitError)return response.status(429).json({error:error.message,retryAfter:error.retryAfter});return response.status(400).json({error:'Invalid error report.'})}
}
