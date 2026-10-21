import {crmProfessionalImportsApi,type DirectoryImportChoice,type DirectorySearch} from '../../services/api/baitlyProfessionalDirectoryApi';

const pause=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 signal.throwIfAborted();
 const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},1200);
 signal.addEventListener('abort',abort,{once:true});
});
/** A bounded city/service search; page traversal and selection no longer require user actions. */
export async function collectCrmProfessionals(input:Omit<DirectorySearch,'page'>,signal:AbortSignal,onProgress:(count:number)=>void){
 const seen=new Set<string>(),choices:DirectoryImportChoice[]=[];let hasMore=false;
 for(let page=1;page<=10;page++){
  signal.throwIfAborted();if(page>1)await pause(signal);
  let response;
  for(let attempt=0;;attempt++){
   try{response=await crmProfessionalImportsApi.discover({...input,page},signal);break;}
   catch(error){if((error as {status?:number}).status!==429||attempt>=2)throw error;await pause(signal);}
  }
  signal.throwIfAborted();hasMore=!!response.hasNext;
  for(const [index,business] of response.candidates.entries()){
   if(seen.has(business.siret))continue;
   if(choices.length===100){hasMore=true;break;}
   seen.add(business.siret);choices.push({ticket:response.ticket,index});
  }
  onProgress(choices.length);
  if(!hasMore||choices.length===100)break;
 }
 return {choices,hasMore};
}
