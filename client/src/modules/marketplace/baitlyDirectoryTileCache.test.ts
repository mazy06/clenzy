import {afterEach,expect,it,vi} from 'vitest';
import {BaitlyDirectoryTileCache} from './baitlyDirectoryTileCache';
afterEach(()=>vi.useRealTimers());
it('shares an in-flight tile, isolates aborts and returns independent buffers from memory',async()=>{
 const cache=new BaitlyDirectoryTileCache(),a=new AbortController(),b=new AbortController();
 let complete!:(data:ArrayBuffer)=>void;let underlying!:AbortSignal;
 const fetcher=vi.fn((signal:AbortSignal)=>{underlying=signal;return new Promise<ArrayBuffer>(resolve=>{complete=resolve;});});
 const first=cache.load('tile',a.signal,'session',fetcher);const rejected=expect(first).rejects.toHaveProperty('name','AbortError');
 const second=cache.load('tile',b.signal,'session',fetcher);a.abort();await rejected;
 expect(underlying.aborted).toBe(false);complete(new Uint8Array([1,2]).buffer);
 const data=await second;new Uint8Array(data)[0]=9;
 expect(new Uint8Array(await cache.load('tile',new AbortController().signal,'session',fetcher))).toEqual(new Uint8Array([1,2]));
 expect(fetcher).toHaveBeenCalledOnce();
});
it('invalidates on expiry, revision URL changes and session changes, and does not cache failures',async()=>{
 vi.useFakeTimers();const cache=new BaitlyDirectoryTileCache(),signal=new AbortController().signal;
 const fetcher=vi.fn(async()=>new ArrayBuffer(2));
 await cache.load('tile?v=1',signal,'a',fetcher);await cache.load('tile?v=2',signal,'a',fetcher);
 await cache.load('tile?v=2',signal,'b',fetcher);expect(fetcher).toHaveBeenCalledTimes(3);
 vi.advanceTimersByTime(120_001);await cache.load('tile?v=2',signal,'b',fetcher);expect(fetcher).toHaveBeenCalledTimes(4);
 const fail=vi.fn().mockRejectedValueOnce(new Error('HTTP 503')).mockResolvedValue(new ArrayBuffer(2));
 await expect(cache.load('failed',signal,'b',fail)).rejects.toThrow('503');await cache.load('failed',signal,'b',fail);expect(fail).toHaveBeenCalledTimes(2);
});
it('bounds the number of cached tiles',async()=>{
 const cache=new BaitlyDirectoryTileCache(),signal=new AbortController().signal,fetcher=vi.fn(async()=>new ArrayBuffer(2));
 for(let i=0;i<130;i++)await cache.load(String(i),signal,'a',fetcher);
 await cache.load('129',signal,'a',fetcher);expect(fetcher).toHaveBeenCalledTimes(130);
 await cache.load('0',signal,'a',fetcher);expect(fetcher).toHaveBeenCalledTimes(131);
});
it('aborts the network when the final consumer leaves and permits a fresh request',async()=>{
 const cache=new BaitlyDirectoryTileCache(),controller=new AbortController();let network!:AbortSignal;
 const first=cache.load('tile',controller.signal,'a',signal=>{network=signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));});
 const rejection=expect(first).rejects.toHaveProperty('name','AbortError');controller.abort();await rejection;expect(network.aborted).toBe(true);
 const fetcher=vi.fn(async()=>new ArrayBuffer(2));await cache.load('tile',new AbortController().signal,'a',fetcher);expect(fetcher).toHaveBeenCalledOnce();
});
