import { useEffect,useRef,useState,type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteLanguage } from '../lib/siteLanguage';
import { campaignLabel,campaignMessages } from '../../src/i18n/baitlyCampaignMessages';
import { baitlyCampaignReplyApi } from '../lib/baitlyCampaignReplyApi';
import { BaitlyInquiryError } from '../lib/baitlyConciergeApi';
import { runtimeEnvOr } from '../../src/config/runtimeConfig';
import BaitlyTurnstile from '../../src/components/BaitlyTurnstile';
import { Skeleton } from '../../src/components/ui/skeleton';
import '../baitly-concierges.css';
import '../baitly-contact.css';

export default function BaitlyCampaignReplyPage(){
  const {hash}=useLocation();const {language}=useSiteLanguage();const m=campaignMessages(language);
  const [organization,setOrganization]=useState<string|null>(null);const [failed,setFailed]=useState(false);const [retry,setRetry]=useState(0);
  const token=hash.slice(1);
  useEffect(()=>{
    const controller=new AbortController();setOrganization(null);setFailed(false);
    if(!/^[A-Za-z0-9_-]{43}$/.test(token)){setFailed(true);return ()=>controller.abort();}
    baitlyCampaignReplyApi.lookup(token,controller.signal).then(result=>{if(!controller.signal.aborted)setOrganization(result.organization);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return ()=>controller.abort();
  },[token,retry]);
  return <section className="site-shell bci-page"><h1>{m.responseTitle}</h1>
    {failed?<div role="alert"><p>{m.responseUnavailable}</p><button className="baitly-button" onClick={()=>setRetry(value=>value+1)}>{m.retry}</button></div>:organization?<ReplyForm key={token} token={token} organization={organization} />:<div role="status" aria-busy="true"><Skeleton className="h-40 w-full" /></div>}
  </section>;
}
function ReplyForm({token,organization}:{token:string;organization:string}){
  const {language}=useSiteLanguage();const m=campaignMessages(language);const [decision,setDecision]=useState('INTERESTED');
  const [pending,setPending]=useState(false);const [success,setSuccess]=useState(false);const [error,setError]=useState<number|null>(null);
  const [captcha,setCaptcha]=useState<string|null>(null);const [reset,setReset]=useState(0);const fingerprint=useRef<{value:string;requestId:string}>();
  const captchaEnabled=runtimeEnvOr('VITE_BAITLY_CAPTCHA_ENABLED','false')==='true';
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(pending)return;const data=new FormData(event.currentTarget);
    const response={decision,message:String(data.get('message')??'')};const value=JSON.stringify(response);
    if(fingerprint.current?.value!==value)fingerprint.current={value,requestId:crypto.randomUUID()};setPending(true);setError(null);
    try{await baitlyCampaignReplyApi.respond({token,response:{...response,requestId:fingerprint.current.requestId},website:String(data.get('website')??''),captchaToken:captcha});setSuccess(true);}
    catch(failure){setError(failure instanceof BaitlyInquiryError?failure.status:0);}
    finally{setPending(false);setCaptcha(null);setReset(value=>value+1);}
  }
  return <section className="bct-form-surface" style={{maxWidth:600}}>
    <p className="bci-bio">{m.recipient.replace('{name}',organization)}</p>
    {success?<p role="status">{m.responseSuccess}</p>:<form onSubmit={submit}><fieldset disabled={pending}>
      <label>{m.decision}<select aria-label={m.decision} value={decision} onChange={e=>setDecision(e.target.value)}>{['INTERESTED','NOT_INTERESTED','QUESTION','UNSUBSCRIBE'].map(value=><option key={value} value={value}>{campaignLabel(value,language)}</option>)}</select></label>
      <label>{m.message}<textarea name="message" maxLength={4000} rows={4} required={decision==='QUESTION'} /></label>
      <label className="bct-trap" aria-hidden="true">Website<input name="website" maxLength={100} tabIndex={-1} autoComplete="off" /></label>
      <p className="bct-privacy">{m.responsePrivacy}</p>
      {captchaEnabled&&<BaitlyTurnstile siteKey={runtimeEnvOr('VITE_TURNSTILE_SITE_KEY','')} action="crm-campaign-response" language={language} resetKey={reset} onToken={setCaptcha} />}
      {error!==null&&<p role="alert" className="bct-error">{error===429?m.responseLimited:error===404?m.responseUnavailable:m.error}</p>}
      <button className="baitly-button bct-submit" type="submit" disabled={pending||(captchaEnabled&&!captcha)}>{pending?m.sending:m.respond}</button>
    </fieldset></form>}
  </section>;
}
