import {authenticatedHeaders} from '../auth/token';
import type {LessonSnapshot,LessonSummary} from '../types';
async function databaseRequest<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(path,{...init,headers:{'content-type':'application/json',...await authenticatedHeaders(),...init.headers}});if(!response.ok){const data=await response.json().catch(()=>null) as {error?:string}|null;throw new Error(data?.error||`Archive request failed (${response.status}).`)}return response.json()}
export const saveLesson=(lesson:LessonSnapshot)=>databaseRequest<LessonSnapshot>('/api/lessons',{method:'PUT',body:JSON.stringify(lesson)});
export const listLessons=()=>databaseRequest<LessonSummary[]>('/api/lessons');
export const loadLesson=(id:string)=>databaseRequest<LessonSnapshot>(`/api/lessons?id=${encodeURIComponent(id)}`);
export const deleteLesson=(id:string)=>databaseRequest<{deleted:true}>(`/api/lessons?id=${encodeURIComponent(id)}`,{method:'DELETE'});
