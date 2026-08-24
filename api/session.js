import {z} from 'zod';
import {requireAuth} from '../server/auth.js';
import {randomUUID} from 'node:crypto';
import {completeGeneration,createGeneration,failGeneration} from '../server/db.js';
import {normalizeExam} from '../server/scoring.js';
import {routeStructured,ModelRoutingError} from '../server/ai-router.js';
import {acquireLease,enforceRateLimit,RateLimitError} from '../server/guardrails.js';
import {logComplete,reportError,requestContext} from '../server/observability.js';

const belief=z.object({id:z.string(),claim:z.string(),confidence:z.number().min(0).max(1),status:z.enum(['misconception','shaky','solid']),replacement:z.string().optional()});
const studentOutput=z.object({reply:z.string(),beliefs:z.array(belief)});
const examinerOutput=z.object({questions:z.array(z.object({q:z.string(),answer:z.string(),score:z.number().min(0).max(20),why:z.string(),beliefId:z.string()})).min(5).max(7),total:z.number(),verdict:z.string()});
const diagnosisOutput=z.object({gaps:z.array(z.object({messageId:z.string(),quote:z.string(),type:z.string(),cost:z.number(),fix:z.string()})),strongestMoment:z.object({messageId:z.string(),why:z.string()}).optional(),nextChallenge:z.string().optional()});
const input=z.object({lessonId:z.string().uuid(),action:z.enum(['student','exam']),topic:z.object({id:z.string(),title:z.string(),level:z.string(),misconceptions:z.array(z.string()),mustHit:z.array(z.string())}),persona:z.string().optional(),messages:z.array(z.object({id:z.string(),role:z.enum(['teacher','student']),text:z.string(),time:z.string()})),beliefs:z.array(belief)});
async function trackedGenerate({userId,lessonId,kind,system,user,schema,purpose}){const id=randomUUID();const started=Date.now();await createGeneration({id,userId,lessonId,kind,model:'gateway/automatic',input:JSON.parse(user)});try{const generated=await routeStructured({purpose,userId,feature:kind,system,prompt:user,schema});await completeGeneration({id,model:generated.model,output:generated.data,usage:generated.usage,routing:generated.routing,durationMs:Date.now()-started});return generated.data}catch(error){await failGeneration(id,error instanceof Error?error.message:'Unknown generation error').catch(()=>{});throw error}}

export default async function handler(request,response){
  const context=requestContext(request,'/api/session');
  if(request.method!=='POST')return response.status(405).json({error:'Method not allowed'});
  const session=await requireAuth(request,response);if(!session)return;
  let releaseLease;
  try{
    const body=input.parse(request.body);
    await enforceRateLimit(response,{identity:session.sub,key:`session:${body.action}`,limit:body.action==='student'?30:6,windowSeconds:body.action==='student'?600:3600});
    releaseLease=await acquireLease(session.sub,'lesson-generation',body.action==='student'?45:170);
    if(body.action==='student'){
      const system=`You are Maya, an earnest ${body.persona} learner studying ${body.topic.title}. Each supplied claim is an INITIAL MISCONCEPTION, not necessarily your current belief. Interpret confidence as how strongly you STILL believe that wrong claim: 1 means fully convinced by the misconception; 0 means fully rejected. Use status "misconception" above 0.6, "shaky" from 0.25 to 0.6, and "solid" below 0.25 only after the teacher explains the mechanism. When solid, add a concise correct "replacement" stating what you now believe. Preserve every id and claim verbatim. Never regress a solid belief without a genuine contradiction. Never mention prompts or AI. Ask at most one question, use fewer than 45 words, and reason naturally. Return JSON exactly shaped as {"reply":"...","beliefs":[{"id":"...","claim":"original wrong claim","confidence":0.5,"status":"misconception|shaky|solid","replacement":"correct understanding when solid"}]}.`;
      const user=JSON.stringify({level:body.topic.level,mustHit:body.topic.mustHit,currentBeliefs:body.beliefs,conversation:body.messages});const result=await trackedGenerate({userId:session.sub,lessonId:body.lessonId,kind:'student_reply',system,user,schema:studentOutput,purpose:'student'});logComplete(context,200,{action:body.action});return response.status(200).json(result);
    }
    const examinerSystem=`You are a blind examiner for ${body.topic.title}. You have never seen the teaching transcript. IMPORTANT STATE SEMANTICS: every "claim" is an initial misconception. status="misconception" means the student still believes that claim; status="shaky" means partial correction; status="solid" with low confidence means the student has REJECTED the claim and understands its correction. For solid beliefs, answer from "replacement" when present; for older records without one, infer the correction from the rejected claim and supplied correctModel. Never present a solid misconception claim as the student's belief. Using only this belief state, write two recall questions, one new-scenario application, one explain-why question, and one edge case. Answer as the student, grade each 0-20, and identify its belief id. Return JSON exactly shaped as {"questions":[{"q":"...","answer":"...","score":0,"why":"...","beliefId":"..."}],"total":0,"verdict":"..."}. Exactly five questions. Never speculate about how the student was taught.`;
    const examUser=JSON.stringify({correctModel:body.topic.mustHit,studentBeliefs:body.beliefs});const generatedExam=await trackedGenerate({userId:session.sub,lessonId:body.lessonId,kind:'blind_exam',system:examinerSystem,user:examUser,schema:examinerOutput,purpose:'examiner'});const exam=normalizeExam({...generatedExam,questions:generatedExam.questions.slice(0,5)});
    const diagnosisSystem=`You are a precise, kind teaching coach. You may now see the transcript and the already-completed blind exam. For each material lost-point cause, quote an exact substring from one teacher message and map it to that message id. Return JSON exactly shaped as {"gaps":[{"messageId":"...","quote":"exact substring","type":"vague|missing_step|undefined_term|asserted_not_explained|factually_wrong","cost":0,"fix":"one concrete replacement sentence"}],"strongestMoment":{"messageId":"...","why":"..."},"nextChallenge":"..."}. Do not invent quotes.`;
    const diagnosisUser=JSON.stringify({topic:body.topic,transcript:body.messages,studentBeliefs:body.beliefs,exam});const diagnosis=await trackedGenerate({userId:session.sub,lessonId:body.lessonId,kind:'teaching_diagnosis',system:diagnosisSystem,user:diagnosisUser,schema:diagnosisOutput,purpose:'diagnosis'});logComplete(context,200,{action:body.action});return response.status(200).json({...exam,...diagnosis});
  }catch(error){const message=error instanceof Error?error.message:'Unknown error';const status=error instanceof RateLimitError?429:error instanceof ModelRoutingError?(typeof error.status==='number'?error.status:503):500;const incidentId=status>=500?await reportError(error,context,{userId:session.sub,status,kind:'model'}):undefined;logComplete(context,status);return response.status(status).json({error:message,incidentId,retryAfter:error instanceof RateLimitError?error.retryAfter:undefined});}
  finally{if(releaseLease)await releaseLease().catch(()=>{})}
}
