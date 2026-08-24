export default async function handler(request,response){
  if(request.method!=='GET')return response.status(405).json({error:'Method not allowed'});
  const key=process.env.GEMINI_API_KEY;
  if(!key)return response.status(503).json({error:'Gemini is not configured'});
  try{
    const upstream=await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    const data=await upstream.json();
    if(!upstream.ok)return response.status(upstream.status).json({error:'Unable to inspect Gemini models'});
    const models=(data.models??[]).filter(model=>model.supportedGenerationMethods?.includes('generateContent')).map(model=>model.name.replace('models/',''));
    return response.status(200).json({models});
  }catch(error){
    console.error('[api/models]',error);
    return response.status(500).json({error:'Unable to inspect Gemini models'});
  }
}
