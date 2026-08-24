import {create} from 'zustand';
export type Preferences={reducedMotion:boolean;soundCues:boolean;autoSendVoice:boolean;voiceRate:number;recognitionLanguage:string;highContrast:boolean};
const key='protege.preferences.v1';
const defaults:Preferences={reducedMotion:false,soundCues:true,autoSendVoice:false,voiceRate:1,recognitionLanguage:'en-GB',highContrast:false};
function load():Preferences{try{return {...defaults,...JSON.parse(localStorage.getItem(key)??'{}')} as Preferences}catch{return defaults}}
type PreferenceStore=Preferences&{setPreference:<K extends keyof Preferences>(key:K,value:Preferences[K])=>void;reset:()=>void};
export const usePreferences=create<PreferenceStore>(set=>({...load(),setPreference:(name,value)=>set(state=>{const next={...state,[name]:value};const saved=Object.fromEntries(Object.keys(defaults).map(key=>[key,next[key as keyof Preferences]]));localStorage.setItem(key,JSON.stringify(saved));return next}),reset:()=>{localStorage.setItem(key,JSON.stringify(defaults));set(defaults)}}));
