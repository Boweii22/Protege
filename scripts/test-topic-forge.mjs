import {forgeTopic} from '../api/topics.js';
if(!process.env.VERCEL_OIDC_TOKEN)throw new Error('Vercel OIDC configuration is missing');
const result=await forgeTopic({title:'Why aeroplanes can fly',level:'GCSE / high school',context:'Focus on physical intuition'});
console.log(JSON.stringify({title:result.topic.title,subject:result.topic.subject,misconceptions:result.topic.misconceptions.length,mustHit:result.topic.mustHit.length,model:result.model,totalTokens:result.usage.totalTokens}));
