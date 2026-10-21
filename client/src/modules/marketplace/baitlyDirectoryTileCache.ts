/** Bounded, session-isolated backend-data cache. A cancelled consumer never cancels another map's request. */
export class BaitlyDirectoryTileCache {
 private session:string|null|undefined;
 private bytes=0;
 private entries=new Map<string,{data:ArrayBuffer;expires:number}>();
 private pending=new Map<string,{controller:AbortController;users:number;promise:Promise<ArrayBuffer>}>();
 async load(url:string,signal:AbortSignal,session:string|null,fetcher:(signal:AbortSignal)=>Promise<ArrayBuffer>):Promise<ArrayBuffer>{
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  if(this.session!==session){
   this.session=session;this.entries.clear();this.bytes=0;
   for(const request of this.pending.values())request.controller.abort();this.pending.clear();
  }
  const cached=this.entries.get(url);
  if(cached&&cached.expires>Date.now()){
   this.entries.delete(url);this.entries.set(url,cached);return cached.data.slice(0);
  }
  if(cached){this.entries.delete(url);this.bytes-=cached.data.byteLength;}
  let request=this.pending.get(url);
  if(!request){
   const controller=new AbortController();
   const created={controller,users:0,promise:Promise.resolve(new ArrayBuffer(0))};
   created.promise=fetcher(controller.signal).then(data=>{
    if(!controller.signal.aborted&&this.session===session&&data.byteLength<=8*1024*1024){
     this.entries.set(url,{data,expires:Date.now()+120_000});this.bytes+=data.byteLength;
     for(const [key,value] of this.entries){
      if(this.entries.size<=128&&this.bytes<=8*1024*1024)break;
      this.entries.delete(key);this.bytes-=value.data.byteLength;
     }
    }
    return data;
   }).finally(()=>{if(this.pending.get(url)===created)this.pending.delete(url);});
   request=created;this.pending.set(url,created);
  }
  const current=request;current.users++;
  return new Promise<ArrayBuffer>((resolve,reject)=>{
   let done=false;
   const finish=(action:()=>void)=>{
    if(done)return;done=true;signal.removeEventListener('abort',abort);current.users--;
    if(!current.users){current.controller.abort();if(this.pending.get(url)===current)this.pending.delete(url);}
    action();
   };
   const abort=()=>finish(()=>reject(new DOMException('Aborted','AbortError')));
   signal.addEventListener('abort',abort,{once:true});
   current.promise.then(data=>finish(()=>resolve(data.slice(0))),error=>finish(()=>reject(error)));
  });
 }
}
