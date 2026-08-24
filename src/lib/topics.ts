import {authenticatedHeaders} from '../auth/token';
import type {Topic} from '../types';
import {apiError} from './http';
async function topicRequest<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(path,{...init,headers:{'content-type':'application/json',...await authenticatedHeaders(),...init.headers}});if(!response.ok)throw await apiError(response,`Topic request failed (${response.status}).`);return response.json()}
export const listGeneratedTopics=()=>topicRequest<Topic[]>('/api/topics');
export const generateTopic=(title:string,level:string,context:string)=>topicRequest<Topic>('/api/topics',{method:'POST',body:JSON.stringify({title,level,context})});
export const deleteGeneratedTopic=(id:string)=>topicRequest<{deleted:true}>(`/api/topics?id=${encodeURIComponent(id)}`,{method:'DELETE'});
