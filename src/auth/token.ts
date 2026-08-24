let tokenGetter:()=>Promise<string|null>=async()=>null;
export function connectTokenGetter(getter:()=>Promise<string|null>){tokenGetter=getter}
export async function authenticatedHeaders():Promise<Record<string,string>>{const token=await tokenGetter();return token?{authorization:`Bearer ${token}`}:{}}
