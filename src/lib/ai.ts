import {z} from 'zod';
import type {Belief,ExamResult,Message,Topic} from '../types';

const beliefSchema=z.object({id:z.string(),claim:z.string(),confidence:z.number().min(0).max(1),status:z.enum(['misconception','shaky','solid'])});
const studentSchema=z.object({reply:z.string(),beliefs:z.array(beliefSchema)});
const examSchema=z.object({questions:z.array(z.object({q:z.string(),answer:z.string(),score:z.number().min(0).max(20),why:z.string(),beliefId:z.string()})),total:z.number().min(0).max(100),verdict:z.string(),gaps:z.array(z.object({messageId:z.string(),quote:z.string(),type:z.string(),cost:z.number(),fix:z.string()})),strongestMoment:z.object({messageId:z.string(),why:z.string()}).optional(),nextChallenge:z.string().optional()});

async function request<T>(body:unknown,schema:z.ZodType<T>):Promise<T>{
  const response=await fetch('/api/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){const data=await response.json().catch(()=>null) as {error?:string}|null;throw new Error(data?.error??(response.status===503?'Live model is not configured on this deployment.':`Model request failed (${response.status}).`))}
  return schema.parse(await response.json());
}
export const teachStudent=(topic:Topic,persona:string,messages:Message[],beliefs:Belief[])=>request({action:'student',topic,persona,messages,beliefs:beliefs.map(({x,y,...belief})=>belief)},studentSchema);
export const runBlindExam=(topic:Topic,messages:Message[],beliefs:Belief[]):Promise<ExamResult>=>request({action:'exam',topic,messages,beliefs:beliefs.map(({x,y,...belief})=>belief)},examSchema);
