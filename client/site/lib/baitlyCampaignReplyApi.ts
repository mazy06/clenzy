import { runtimeEnvOr } from '../../src/config/runtimeConfig';
import { BaitlyInquiryError } from './baitlyConciergeApi';
const origin=runtimeEnvOr('VITE_API_URL',runtimeEnvOr('VITE_API_BASE_URL','http://localhost:8084')).replace(/\/+$/,'').replace(/\/api$/,'');
const base=`${origin}/api/public/baitly-campaign-replies`;
async function post(path:string,body:unknown,signal:AbortSignal){
  const response=await fetch(base+path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  if(!response.ok)throw new BaitlyInquiryError(response.status);return response.json();
}
export const baitlyCampaignReplyApi={
  lookup:(token:string,signal:AbortSignal):Promise<{organization:string}>=>post('/lookup',{token},signal),
  async respond(command:{token:string;response:{requestId:string;decision:string;message:string};website:string;captchaToken:string|null}){
    const receipt=await post('/respond',command,AbortSignal.timeout(15000));if(receipt.status!=='RECEIVED')throw new BaitlyInquiryError(502);
  },
};
