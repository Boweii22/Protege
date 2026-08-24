import {z} from 'zod';
import type {Belief,ExamResult,Message,Topic} from '../types';
import {authenticatedHeaders} from '../auth/token';
import {apiError} from './http';

const beliefSchema=z.object({id:z.string(),claim:z.string(),confidence:z.number().min(0).max(1),status:z.enum(['misconception','shaky','solid']),replacement:z.string().optional()});
const studentSchema=z.object({reply:z.string(),beliefs:z.array(beliefSchema)});
const examSchema=z.object({questions:z.array(z.object({q:z.string(),answer:z.string(),score:z.number().min(0).max(20),why:z.string(),beliefId:z.string()})),total:z.number().min(0).max(100),verdict:z.string(),gaps:z.array(z.object({messageId:z.string(),quote:z.string(),type:z.string(),cost:z.number(),fix:z.string()})),strongestMoment:z.object({messageId:z.string(),why:z.string()}).optional(),nextChallenge:z.string().optional()});

async function request<T>(body:unknown,schema:z.ZodType<T>):Promise<T>{
  const response=await fetch('/api/session',{method:'POST',headers:{'content-type':'application/json',...await authenticatedHeaders()},body:JSON.stringify(body)});
  if(!response.ok)throw await apiError(response,response.status===503?'The live teaching studio is temporarily unavailable.':`Model request failed (${response.status}).`)
  return schema.parse(await response.json());
}
export const teachStudent=(lessonId:string,topic:Topic,persona:string,messages:Message[],beliefs:Belief[])=>request({lessonId,action:'student',topic,persona,messages,beliefs:beliefs.map(({x:_x,y:_y,...belief})=>belief)},studentSchema);
export const runBlindExam=(lessonId:string,topic:Topic,messages:Message[],beliefs:Belief[]):Promise<ExamResult>=>request({lessonId,action:'exam',topic,messages,beliefs:beliefs.map(({x:_x,y:_y,...belief})=>belief)},examSchema);
