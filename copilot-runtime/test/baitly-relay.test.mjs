import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createBaitlyRelay } from '../server.mjs';

async function recipe(run,fetchImpl=async()=>new Response('data: {"type":"RUN_STARTED"}\n\n',{headers:{'content-type':'text/event-stream'}})) {
  const app=createBaitlyRelay({fetchImpl,backend:'https://backend.invalid/api/agui/run',origin:'https://frontend.invalid'});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('discovery and health never execute the engine or expose backend addresses',async()=>{
  let calls=0;
  await recipe(async url=>{
    for(const path of ['/health','/api/copilotkit/info']) {
      const response=await fetch(url+path);assert.equal(response.status,200);
      assert.doesNotMatch(await response.text(),/backend.invalid|token|cookie/);
    }
    assert.equal(calls,0);
  },async()=>{calls++;throw Error('should not execute');});
});
test('runs stream once, retaining request body, with per-request credentials and no retry',async()=>{
  const calls=[];
  await recipe(async url=>{
    for(const marker of ['synthetic-A','synthetic-B']) {
      const response=await fetch(url+'/api/copilotkit/agent/clenzy-supervisor/run',{method:'POST',
        headers:{'content-type':'application/json',authorization:marker,cookie:'recipe='+marker,'x-forwarded-for':'203.0.113.7'},
        body:JSON.stringify({runId:marker,resume:[],fixture:true})});
      assert.equal(response.status,200);assert.match(await response.text(),/RUN_STARTED/);
      assert.equal(response.headers.get('cache-control'),'no-store');
    }
  },async(url,init)=>{
    calls.push({url,init});return new Response('data: {"type":"RUN_STARTED"}\n\n',{headers:{'content-type':'text/event-stream'}});
  });
  assert.equal(calls.length,2);
  for(let i=0;i<2;i++) {
    assert.equal(calls[i].init.headers.Authorization,i===0?'synthetic-A':'synthetic-B');
    assert.equal(calls[i].init.headers['x-forwarded-for'],undefined);
    assert.equal(calls[i].init.redirect,'error');assert.equal(calls[i].init.method,'POST');
    assert.equal(JSON.parse(calls[i].init.body).fixture,true);
  }
});
for(const status of [401,403,500]) test(`HTTP ${status} diagnostics never escape and do not retry`,async()=>{
  let calls=0;
  await recipe(async url=>{
    const response=await fetch(url+'/api/copilotkit/run',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    assert.equal(response.status,status<500?status:502);
    assert.deepEqual(await response.json(),{error:'BAITLY_RELAY_UNAVAILABLE'});
  },async()=>{calls++;return new Response('synthetic-private-error-token',{status});});
  assert.equal(calls,1);
});
test('invalid JSON, unknown agents and oversized requests never reach upstream',async()=>{
  let calls=0;
  await recipe(async url=>{
    for(const [path,body,status] of [
      ['/api/copilotkit/agent/unknown/run','{}',404],['/api/copilotkit/run','{',400],
      ['/api/copilotkit/run',JSON.stringify({fixture:'x'.repeat(1_048_576)}),400]]) {
      const response=await fetch(url+path,{method:'POST',headers:{'content-type':'application/json'},body});
      assert.equal(response.status,status);assert.doesNotMatch(await response.text(),/synthetic-private|SyntaxError|stack/);
    }
  },async()=>{calls++;throw Error('synthetic-private');});
  assert.equal(calls,0);
});
test('network and non-SSE upstream responses fail closed without details',async()=>{
  for(const kind of ['throw','json']) await recipe(async url=>{
    const response=await fetch(url+'/api/copilotkit/run',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:'BAITLY_RELAY_UNAVAILABLE'});
  },async()=>{if(kind==='throw') throw Error('synthetic-private');return Response.json({secret:'synthetic-private'});});
});
test('CORS preflight retains explicit origin and performs no upstream call',async()=>{
  await recipe(async url=>{
    const response=await fetch(url+'/api/copilotkit/run',{method:'OPTIONS',headers:{origin:'https://attacker.invalid'}});
    assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),'https://frontend.invalid');
  },async()=>{throw Error('should not execute');});
});
