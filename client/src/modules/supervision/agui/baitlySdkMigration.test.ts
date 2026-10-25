// @vitest-environment node
import { describe,expect,it,vi } from 'vitest';
import fixture from './baitly/fixtures/baitly-sdk-oracle.json';
import { BaitlyAgUiClient } from './baitly/BaitlyAgUiClient';
import { emptyChat,reduceBaitlyChat } from './baitly/BaitlyChatModel';
import type { BaitlyAgUiEvent } from './baitly/BaitlyAgUiProtocol';
import { parseToolResult } from './renderers/parseToolResult';

describe('frozen pre-removal SDK oracle, no vulnerable test dependency',()=>{
  it.each(['\n','\r\n','\r'])('keeps every reference event across fragmented UTF-8 and framing %j',async newline=>{
    const bytes=new TextEncoder().encode(fixture.frames.map(f=>`data: ${JSON.stringify(f)}${newline}${newline}`).join(''));
    let offset=0;
    const fetch=vi.fn(async()=>new Response(new ReadableStream<Uint8Array>({pull(controller){
      if(offset<bytes.length) controller.enqueue(bytes.slice(offset,offset+=3));else controller.close();
    }}),{headers:{'content-type':'text/event-stream'}}));
    const client=new BaitlyAgUiClient({url:'https://backend.invalid/api/agui/run',getHeaders:()=>({}),fetch,maxFrameBytes:4096});
    const events:BaitlyAgUiEvent[]=[];let model=emptyChat();
    await client.run({threadId:'baitly-oracle-thread',runId:'baitly-oracle-run',messages:[]},event=>{
      events.push(event);model=reduceBaitlyChat(model,event);
    });
    expect(events).toEqual(fixture.events);
    expect(model.state).toEqual({phase:'thinking',count:1});
    expect(model.items.find(i=>i.id==='reply')?.text).toBe('Recette العربية');
    expect(model.items.filter(i=>i.kind==='tool')).toHaveLength(9);
    for(const item of model.items.filter(i=>i.kind==='tool')) expect(parseToolResult(item.result)).toMatchObject({isError:false,data:{fixture:true}});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
