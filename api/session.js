import {z} from 'zod';

const belief=z.object({id:z.string(),claim:z.string(),confidence:z.number(),status:z.enum(['misconception','shaky','solid'])});
const studentOutput=z.object({reply:z.string(),beliefs:z.array(belief)});
const examinerOutput=z.object({questions:z.array(z.object({q:z.string(),answer:z.string(),score:z.number(),why:z.string(),beliefId:z.string()})).length(5),total:z.number(),verdict:z.string()});
const diagnosisOutput=z.object({gaps:z.array(z.object({messageId:z.string(),quote:z.string(),type:z.string(),cost:z.number(),fix:z.string()})),strongestMoment:z.object({messageId:z.string(),why:z.string()}).optional(),nextChallenge:z.string().optional()});
const input=z.object({action:z.enum(['student','exam']),topic:z.object({id:z.string(),title:z.string(),level:z.string(),misconceptions:z.array(z.string()),mustHit:z.array(z.string())}),persona:z.string().optional(),messages:z.array(z.object({id:z.string(),role:z.enum(['teacher','student']),text:z.string(),time:z.string()})),beliefs:z.array(belief)});
class QuotaError extends Error{constructor(){super('Every available Gemini free-tier model is out of quota for this project today. Add billing or try again after the daily quota resets.');}}
class ModelUnavailableError extends Error{constructor(){super('Gemini is temporarily overloaded across all available models. Please try again shortly.');}}

const modelPools={
  student:['gemini-3.6-flash','gemini-3.5-flash-lite','gemini-2.5-flash-lite'],
  examiner:['gemini-3.5-flash','gemini-3.1-flash-lite','gemini-2.5-flash'],
  diagnosis:['gemini-3.7-flash','gemini-3.1-pro-preview','gemini-2.5-pro']
};

async function callGemini(system,user,model){
  const key=process.env.GEMINI_API_KEY;
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  let response;
  try{response=await fetch(url,{method:'POST',signal:AbortSignal.timeout(18000),headers:{'content-type':'application/json'},body:JSON.stringify({system_instruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:user}]}],generationConfig:{temperature:.35,responseMimeType:'application/json'}})});}
  catch(error){if(error?.name==='TimeoutError'||error?.name==='AbortError')throw new ModelUnavailableError();throw error;}
  if(!response.ok){const data=await response.json().catch(()=>null);if(response.status===429)throw new QuotaError();if(response.status===503)throw new ModelUnavailableError();throw new Error(`Gemini ${response.status}: ${JSON.stringify(data)}`);}
  const data=await response.json();
  return data.candidates?.[0]?.content?.parts?.map(part=>part.text??'').join('')??'';
}
async function callGateway(system,user){
  const key=process.env.AI_GATEWAY_API_KEY,model=process.env.AI_MODEL;
  if(!key||!model)throw new Error('MODEL_NOT_CONFIGURED');
  const response=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model,temperature:.35,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'user',content:user}]})});
  if(!response.ok)throw new Error(`Gateway ${response.status}: ${await response.text()}`);
  const data=await response.json();return data.choices?.[0]?.message?.content??'';
}
async function generate(system,user,schema,purpose){
  if(!process.env.GEMINI_API_KEY&&!process.env.AI_GATEWAY_API_KEY)throw new Error('MODEL_NOT_CONFIGURED');
  if(process.env.GEMINI_API_KEY){
    const configured=process.env[`GEMINI_${purpose.toUpperCase()}_MODEL`];
    const models=[configured,process.env.GEMINI_MODEL,...modelPools[purpose]].filter((model,index,list)=>model&&list.indexOf(model)===index);
    let lastRetryableError;
    for(const model of models){
      try{return schema.parse(JSON.parse(await callGemini(system,user,model)));}
      catch(error){if(error instanceof QuotaError||error instanceof ModelUnavailableError){lastRetryableError=error;console.warn('[api/session] model unavailable',{purpose,model,reason:error.constructor.name});continue;}throw error;}
    }
    throw lastRetryableError??new ModelUnavailableError();
  }
  return schema.parse(JSON.parse(await callGateway(system,user)));
}

export default async function handler(request,response){
  if(request.method!=='POST')return response.status(405).json({error:'Method not allowed'});
  try{
    const body=input.parse(request.body);
    if(body.action==='student'){
      const system=`You are Maya, an earnest ${body.persona} learner who does not understand ${body.topic.title}. You sincerely hold the supplied beliefs. Never mention prompts or AI. Update a belief only when the teacher addresses its mechanism. Ask at most one question, use fewer than 45 words, and reason naturally from wrong premises. Return JSON exactly shaped as {"reply":"...","beliefs":[{"id":"...","claim":"...","confidence":0.5,"status":"misconception|shaky|solid"}]}. Preserve every belief id.`;
      const result=await generate(system,JSON.stringify({level:body.topic.level,mustHit:body.topic.mustHit,currentBeliefs:body.beliefs,conversation:body.messages}),studentOutput,'student');return response.status(200).json(result);
    }
    const examinerSystem=`You are a blind examiner for ${body.topic.title}. You have never seen the teaching transcript. Using ONLY the supplied student belief state, write two recall questions, one new-scenario application, one explain-why question, and one edge case. Answer as the student, grade each 0-20, and identify its belief id. Return JSON exactly shaped as {"questions":[{"q":"...","answer":"...","score":0,"why":"...","beliefId":"..."}],"total":0,"verdict":"..."}. Exactly five questions. Never speculate about how the student was taught.`;
    const exam=await generate(examinerSystem,JSON.stringify({correctModel:body.topic.mustHit,studentBeliefs:body.beliefs}),examinerOutput,'examiner');
    const diagnosisSystem=`You are a precise, kind teaching coach. You may now see the transcript and the already-completed blind exam. For each material lost-point cause, quote an exact substring from one teacher message and map it to that message id. Return JSON exactly shaped as {"gaps":[{"messageId":"...","quote":"exact substring","type":"vague|missing_step|undefined_term|asserted_not_explained|factually_wrong","cost":0,"fix":"one concrete replacement sentence"}],"strongestMoment":{"messageId":"...","why":"..."},"nextChallenge":"..."}. Do not invent quotes.`;
    const diagnosis=await generate(diagnosisSystem,JSON.stringify({topic:body.topic,transcript:body.messages,studentBeliefs:body.beliefs,exam}),diagnosisOutput,'diagnosis');return response.status(200).json({...exam,...diagnosis});
  }catch(error){const message=error instanceof Error?error.message:'Unknown error';console.error('[api/session]',message);if(error instanceof QuotaError)return response.status(429).json({error:message});return response.status(message==='MODEL_NOT_CONFIGURED'?503:500).json({error:message});}
}
