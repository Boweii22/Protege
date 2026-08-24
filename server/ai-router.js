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
  if(status===429)return new ModelRoutingError('The teaching studio is at capacity. Please wait a moment and retry.',429);
  if(status===402)return new ModelRoutingError('The AI studio has reached its protected spend limit. The owner needs to refresh its credits.',503);
  return new ModelRoutingError();
}

export async function routeStructured({purpose,schema,system,prompt,userId,feature=purpose,description}){
  const models=routeFor(purpose);
  const primary=models[0];
  const started=Date.now();
  try{
    const result=await generateText({
      model:gatewayClient()(primary),
      output:Output.object({schema,name:`protege_${purpose}`,description}),
      system,
      prompt,
      temperature:.35,
      maxOutputTokens:purpose==='student'?900:2200,
      maxRetries:2,
      abortSignal:AbortSignal.timeout(purpose==='student'?26000:45000),
      providerOptions:{gateway:{models:models.slice(1),user:userId,tags:[`feature:${feature}`,`route:${purpose}`,'app:protege','tier:paid']}}
    });
    const resolvedModel=result.response?.modelId||result.providerMetadata?.gateway?.modelId||primary;
    return {data:result.output,model:resolvedModel,usage:result.usage,routing:{purpose,primary,resolvedModel,candidates:models,failover:resolvedModel!==primary,durationMs:Date.now()-started}};
  }catch(error){
    console.error('[ai-router]',{purpose,primary,status:error?.statusCode||error?.status,reason:error instanceof Error?error.message.slice(0,180):'unknown'});
    throw publicError(error);
  }
}

export function routingManifest(){return Object.fromEntries(Object.keys(DEFAULT_ROUTES).map(purpose=>[purpose,routeFor(purpose)]))}
