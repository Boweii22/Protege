import {createContext,useContext} from 'react';
export type ProtegeUser={firstName:string;email:string;imageUrl?:string};
export type AuthState={configured:boolean;ready:boolean;signedIn:boolean;user:ProtegeUser|null;getToken:()=>Promise<string|null>;openSignIn:()=>void;openSignUp:()=>void;signOut:()=>Promise<void>};
export const unavailableAuth:AuthState={configured:false,ready:true,signedIn:false,user:null,getToken:async()=>null,openSignIn:()=>{},openSignUp:()=>{},signOut:async()=>{}};
export const AuthContext=createContext<AuthState>(unavailableAuth);
export const useProtegeAuth=()=>useContext(AuthContext);
