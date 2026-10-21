import { runtimeEnvOr } from '../../src/config/runtimeConfig';
import { BaitlyInquiryError } from './baitlyConciergeApi';
import type { BaitlyRecruitmentPage } from '../../src/services/baitlyRecruitment';
const origin=runtimeEnvOr('VITE_API_URL',runtimeEnvOr('VITE_API_BASE_URL','http://localhost:8084')).replace(/\/+$/,'').replace(/\/api$/,'');
const base=`${origin}/api/public/baitly-catalog/recruitment`;
export const baitlyRecruitmentPublicApi={
  async page(id:string,signal:AbortSignal):Promise<BaitlyRecruitmentPage>{
    const response=await fetch(`${base}/${encodeURIComponent(id)}`,{signal,credentials:'omit'});
    if(!response.ok)throw new BaitlyInquiryError(response.status);
    return response.json();
  },
  async apply(id:string,payload:Record<string,unknown>){
    const response=await fetch(`${base}/${encodeURIComponent(id)}/applications`,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify(payload)});
    if(!response.ok)throw new BaitlyInquiryError(response.status);
    const receipt: {status:string}=await response.json();
    if(receipt.status!=='RECEIVED')throw new BaitlyInquiryError(502);
  },
};
