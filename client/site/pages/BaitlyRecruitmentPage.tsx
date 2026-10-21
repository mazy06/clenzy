import { useEffect,useState } from 'react';
import { useLocation,useParams } from 'react-router-dom';
import { useSiteLanguage } from '../lib/siteLanguage';
import { recruitmentMessages,recruitmentTrade } from '../../src/i18n/baitlyRecruitmentMessages';
import type { BaitlyRecruitmentPage as Recruitment } from '../../src/services/baitlyRecruitment';
import { baitlyRecruitmentPublicApi } from '../lib/baitlyRecruitmentApi';
import { BaitlyInquiryError } from '../lib/baitlyConciergeApi';
import BaitlyProviderApplicationForm from '../components/BaitlyProviderApplicationForm';
import { Skeleton } from '../../src/components/ui/skeleton';
import '../baitly-concierges.css';

export default function BaitlyRecruitmentPage(){
  const {id}=useParams();return <RecruitmentContent key={id} id={id??''} />;
}
function RecruitmentContent({id}:{id:string}){
  const {language}=useSiteLanguage();const m=recruitmentMessages(language);const {search}=useLocation();
  const [page,setPage]=useState<Recruitment|null>(null);const [error,setError]=useState<number|null>(null);const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setPage(null);setError(null);
    baitlyRecruitmentPublicApi.page(id,controller.signal).then(value=>{if(!controller.signal.aborted)setPage(value);}).catch(failure=>{if(!controller.signal.aborted)setError(failure instanceof BaitlyInquiryError?failure.status:0);});
    return ()=>controller.abort();
  },[id,retry]);
  return <section className="site-shell bci-page">
    {error!==null?<div role="alert"><h1>{m.closed}</h1>{error!==404&&<button className="baitly-button" onClick={()=>setRetry(value=>value+1)}>{m.retry}</button>}</div>
      :page?.id?<div className="bci-layout"><article><p>{page.recipientName}</p><h1>{page.title}</h1><p>{page.city}{page.countryCode?` (${new Intl.DisplayNames([language],{type:'region'}).of(page.countryCode)})`:''}</p>
        <p className="bci-bio" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{page.description}</p><h2>{m.services}</h2><ul>{page.services.map(code=><li key={code}>{recruitmentTrade(code,language)}</li>)}</ul>
      </article><BaitlyProviderApplicationForm key={id+search} page={{...page,id:page.id}} /></div>
        :<div aria-busy="true" role="status"><h1>{m.title}</h1><p>{m.loading}</p><Skeleton className="h-48 w-full" /></div>}
  </section>;
}
