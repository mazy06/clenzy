/** Baitly authenticated AG-UI relay. No model, tool execution, shared agent or retry. */
import express from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

export function backendHeaders(headers) {
  const result={Accept:'text/event-stream','Content-Type':'application/json'};
  if(typeof headers.authorization==='string') result.Authorization=headers.authorization;
  if(typeof headers.cookie==='string') result.Cookie=headers.cookie;
  return result;
}
export function createBaitlyRelay({fetchImpl=fetch,backend=process.env.AGUI_BACKEND_URL || 'http://clenzy-server:8080/api/agui/run',
  origin=process.env.COPILOT_ALLOWED_ORIGIN || 'http://localhost:3000',
  basePath=process.env.COPILOT_BASE_PATH || '/api/copilotkit',
  agent=process.env.COPILOT_AGENT_NAME || 'clenzy-supervisor'}={}) {
  const app=express();app.disable('x-powered-by');
  app.use((_req,res,next)=>{
    res.set({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true',
      'Access-Control-Allow-Headers':'Content-Type, Authorization, Accept',
      'Access-Control-Allow-Methods':'GET, POST, OPTIONS',Vary:'Origin','Cache-Control':'no-store'});
    if(_req.method==='OPTIONS') return res.sendStatus(204);
    next();
  });
  app.get('/health',(_req,res)=>res.json({status:'ok',service:'copilot-runtime'}));
  // Compatibility discovery contains no remote diagnostics or backend network address.
  const info=(_req,res)=>res.json({agents:{[agent]:{name:agent,description:'Superviseur Baitly'}}});
  app.get(basePath+'/info',info);
  app.post(basePath+'/info',info);
  const run=async(req,res)=>{
    if(req.params.agentName && req.params.agentName!==agent) return res.sendStatus(404);
    const abort=new AbortController();
    const close=()=>{if(!res.writableEnded) abort.abort();};res.on('close',close);
    const timer=setTimeout(()=>abort.abort(),300_000);timer.unref();
    try {
      const upstream=await fetchImpl(backend,{method:'POST',headers:backendHeaders(req.headers),body:JSON.stringify(req.body),
        signal:abort.signal,redirect:'error'});
      if(!upstream.ok || !upstream.body || !/^text\/event-stream(?:\s*;|$)/i.test(upstream.headers.get('content-type')||'')) {
        await upstream.body?.cancel();return res.status(upstream.status>=400 && upstream.status<500?upstream.status:502).json({error:'BAITLY_RELAY_UNAVAILABLE'});
      }
      res.status(200).set({'Content-Type':'text/event-stream','X-Accel-Buffering':'no'});res.flushHeaders();
      await pipeline(Readable.fromWeb(upstream.body),res,{signal:abort.signal});
    } catch {
      if(!res.headersSent) res.status(502).json({error:'BAITLY_RELAY_UNAVAILABLE'});else res.destroy();
    } finally {clearTimeout(timer);res.off('close',close);}
  };
  const json=express.json({limit:'1mb',strict:true});
  app.post(basePath+'/agent/:agentName/run',json,run);
  app.post(basePath+'/run',json,run);
  app.use((_error,_req,res,_next)=>res.status(400).json({error:'BAITLY_RELAY_INVALID_REQUEST'}));
  return app;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  createBaitlyRelay().listen(process.env.PORT || 8080,()=>console.log('Baitly relay ready'));
}
