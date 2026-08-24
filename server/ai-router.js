import {createGateway,generateText,Output} from 'ai';

const DEFAULT_ROUTES={
  topic:['google/gemini-3.7-flash','anthropic/claude-haiku-4.5','openai/gpt-5.4-mini','google/gemini-2.5-flash-lite'],
  student:['anthropic/claude-haiku-4.5','google/gemini-3.7-flash','openai/gpt-5.4-mini','google/gemini-2.5-flash-lite'],
  examiner:['openai/gpt-5.4','anthropic/claude-sonnet-4.6','google/gemini-3.1-pro-preview','google/gemini-2.5-flash-lite'],
  diagnosis:['anthropic/claude-sonnet-4.6','openai/gpt-5.4','google/gemini-3.1-pro-preview','google/gemini-2.5-flash-lite']
};

export class ModelRoutingError extends Error{
  constructor(message='Protégé could not reach any of its teaching models. Please retry in a moment.',status=503){super(message);this.name='ModelRoutingError';this.status=status}
}

const unique=items=>items.filter((item,index,list)=>item&&list.indexOf(item)===index);
export function routeFor(purpose){
  const key=`AI_${purpose.toUpperCase()}_MODELS`;
  const legacy=process.env[`AI_${purpose.toUpperCase()}_MODEL`];
  const configured=(process.env[key]||'').split(',').map(value=>value.trim()).filter(Boolean);
  return unique([...configured,legacy,...(DEFAULT_ROUTES[purpose]||DEFAULT_ROUTES.student)]);
}

function gatewayClient(){
  // Prefer deployment OIDC. Old static keys are frequently forgotten or revoked.
  const apiKey=process.env.VERCEL_OIDC_TOKEN||process.env.AI_GATEWAY_API_KEY;
  if(!apiKey)throw new ModelRoutingError('Live AI is not configured on this deployment.','MODEL_NOT_CONFIGURED');
  return createGateway({apiKey});
}

function publicError(error){
  const status=error?.statusCode||error?.status;
  const message=error instanceof Error?error.message:'';
  if(status===429||/rate.?limit|quota/i.test(message))return new ModelRoutingError('The teaching studio has exhausted its current model allowance. Please retry later or add AI Gateway credits.',429);
  if(status===402||/paid credits|payment required|spend limit/i.test(message))return new ModelRoutingError('The AI studio needs paid Gateway credits before it can continue.',503);
  return new ModelRoutingError();
}

export async function runWithContinuity(models,invoke){
  const primary=models[0],continuity=models.at(-1),attempted=[];let firstError,lastError;
  for(const model of models){const tier=model===continuity&&models.length>1?'continuity':'paid';attempted.push(model);try{return {...await invoke(model,[],tier),primary,attempted,continuityUsed:tier==='continuity'}}catch(error){firstError??=error;lastError=error;console.warn('[ai-router] route attempt failed',{model,tier,reason:error instanceof Error?error.message.slice(0,160):'unknown'})}}
  if(lastError instanceof Error)lastError.cause=firstError;throw lastError;
}

export async function routeStructured({purpose,schema,system,prompt,userId,feature=purpose,description}){
  if(process.env.E2E_TEST_MODE==='true'&&process.env.VERCEL_ENV!=='production'){
    const parsed=JSON.parse(prompt);let data;
    if(purpose==='topic')data={title:parsed.requestedTopic,subject:'E2E Science',level:parsed.learnerLevel,hook:'What would prove your explanation works in a completely new case?',misconceptions:['The visible pattern is the underlying cause','One example proves the rule for every case','A definition alone explains the mechanism','Exceptions make the entire model useless'],mustHit:['Name the causal mechanism','Distinguish evidence from assumption','Transfer the model to a new case','State the boundary conditions']};
    if(purpose==='student')data={reply:'That mechanism helps. So the sign changes because reversing a reversal restores the original direction?',beliefs:parsed.currentBeliefs.map((belief,index)=>({...belief,confidence:index?Math.max(.18,belief.confidence-.25):.12,status:index?'shaky':'solid',...(index?{}:{replacement:'Reversing a negative direction twice produces a positive direction.'})}))};
    if(purpose==='examiner')data={questions:Array.from({length:5},(_,index)=>{const belief=parsed.studentBeliefs[index%parsed.studentBeliefs.length];return {q:`Transfer question ${index+1}`,answer:belief.replacement||`I am still uncertain about ${belief.claim}`,score:belief.status==='solid'?20:12,why:belief.status==='solid'?'The corrected mechanism transfers cleanly.':'The model is only partly corrected.',beliefId:belief.id}}),total:0,verdict:'The explanation created a transferable model with a few edges left to sharpen.'};
    if(purpose==='diagnosis'){const teacher=parsed.transcript.find(message=>message.role==='teacher');data={gaps:teacher?[{messageId:teacher.id,quote:teacher.text.slice(0,Math.min(40,teacher.text.length)),type:'missing_step',cost:8,fix:'Name the reversal mechanism before applying the sign rule.'}]:[],strongestMoment:teacher?{messageId:teacher.id,why:'It connected the rule to a concrete mechanism.'}:undefined,nextChallenge:'Explain the same mechanism with debt and direction.'}}
    return {data:schema.parse(data),model:'test/deterministic',usage:{inputTokens:100,outputTokens:100,totalTokens:200},routing:{purpose,primary:'test/deterministic',resolvedModel:'test/deterministic',candidates:['test/deterministic'],failover:false,durationMs:1}};
  }
  const models=routeFor(purpose);
  const primary=models[0];
  const started=Date.now();
  try{
    const client=gatewayClient();
    const routed=await runWithContinuity(models,async(model,fallbackModels,tier)=>{const result=await generateText({
      model:client(model),
      output:Output.object({schema,name:`protege_${purpose}`,description}),
      system,
      prompt,
      temperature:.35,
      maxOutputTokens:purpose==='student'?900:2200,
      // The route itself retries across independent models; repeating one quota failure only adds latency.
      maxRetries:0,
      abortSignal:AbortSignal.timeout(purpose==='student'?26000:45000),
      providerOptions:{gateway:{models:fallbackModels,user:userId,tags:[`feature:${feature}`,`route:${purpose}`,'app:protege',`tier:${tier}`]}}
    });return {result,requestedModel:model,tier}});
    const resolvedModel=routed.result.response?.modelId||routed.result.providerMetadata?.gateway?.modelId||routed.requestedModel;
    return {data:routed.result.output,model:resolvedModel,usage:routed.result.usage,routing:{purpose,primary,resolvedModel,candidates:models,attempted:routed.attempted,tier:routed.tier,failover:resolvedModel!==primary,continuityUsed:routed.continuityUsed,durationMs:Date.now()-started}};
  }catch(error){
    console.error('[ai-router]',{purpose,primary,status:error?.statusCode||error?.status,reason:error instanceof Error?error.message.slice(0,180):'unknown'});
    throw publicError(error);
  }
}

export function routingManifest(){return Object.fromEntries(Object.keys(DEFAULT_ROUTES).map(purpose=>[purpose,routeFor(purpose)]))}
