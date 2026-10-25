import { useEffect,useRef,useState,type FormEvent } from 'react';
import { Link,useLocation } from 'react-router-dom';
import { useSiteLanguage } from '../lib/siteLanguage';
import { baitlyRecruitmentPublicApi } from '../lib/baitlyRecruitmentApi';
import { BaitlyInquiryError } from '../lib/baitlyConciergeApi';
import type { BaitlyRecruitmentPage } from '../../src/services/baitlyRecruitment';
import { recruitmentMessages,recruitmentTrade } from '../../src/i18n/baitlyRecruitmentMessages';
import { runtimeEnvOr } from '../../src/config/runtimeConfig';
import BaitlyTurnstile from '../../src/components/BaitlyTurnstile';
import ProviderCountrySelect from './ProviderCountrySelect';
import '../baitly-contact.css';
import { langQuery } from '../lib/siteSeo';

export default function BaitlyProviderApplicationForm({page}:{page:BaitlyRecruitmentPage & {id:string}}){
  const {language}=useSiteLanguage();const m=recruitmentMessages(language);const {search}=useLocation();
  const [reply,setReply]=useState('EMAIL');const [pending,setPending]=useState(false);const [success,setSuccess]=useState(false);
  const [error,setError]=useState<number|null>(null);const [selectionError,setSelectionError]=useState(false);
  const [services,setServices]=useState<string[]>([]);const [captcha,setCaptcha]=useState<string|null>(null);const [reset,setReset]=useState(0);
  const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
  const lastSubmission=useRef<{fingerprint:string;requestId:string}>();
  const captchaEnabled=runtimeEnvOr('VITE_BAITLY_CAPTCHA_ENABLED','false')==='true';
  const [provenance]=useState(()=>{
    const params=new URLSearchParams(search);let referrerHost:string|undefined;
    try{referrerHost=typeof document!=='undefined'&&document.referrer?new URL(document.referrer).hostname.slice(0,255):undefined;}catch{/* Invalid referrer carries no attribution. */}
    return {utmSource:params.get('utm_source')?.slice(0,150),utmMedium:params.get('utm_medium')?.slice(0,150),utmCampaign:params.get('utm_campaign')?.slice(0,150),referrerHost};
  });
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(pending)return;setSelectionError(!services.length);if(!services.length)return;
    const form=new FormData(event.currentTarget);setPending(true);setError(null);
    try{
      const payload={...Object.fromEntries(form.entries()),...provenance,services,countryCode:String(form.get('countryCode')||'')||undefined,requestContact:form.get('requestContact')==='on'};
      const fingerprint=JSON.stringify(payload);
      if(lastSubmission.current?.fingerprint!==fingerprint)lastSubmission.current={fingerprint,requestId:globalThis.crypto.randomUUID()};
      await baitlyRecruitmentPublicApi.apply(page.id,{...payload,requestId:lastSubmission.current.requestId,captchaToken:captcha});setSuccess(true);
    }catch(failure){setError(failure instanceof BaitlyInquiryError?failure.status:0);}
    finally{setPending(false);setCaptcha(null);setReset(value=>value+1);}
  }
  return <section className="bct-form-surface" aria-labelledby="provider-application-title"><h2 id="provider-application-title">{m.apply}</h2>
    {success?<div className="bct-success" role="status"><h3>{m.success}</h3><p>{m.successHelp}</p></div>:<form onSubmit={submit}>
      <p className="bct-privacy">{m.intro.replace('{name}',page.recipientName)}</p>
      <fieldset disabled={pending}>
        <label>{m.name}<input name="name" required maxLength={255} autoComplete="name" /></label>
        <label>{m.email}<input name="email" type="email" required maxLength={255} autoComplete="email" dir="ltr" /></label>
        <label>{m.reply}<select name="replyChannel" value={reply} onChange={e=>setReply(e.target.value)}><option value="EMAIL">{m.EMAIL}</option><option value="PHONE">{m.PHONE}</option></select></label>
        {reply==='PHONE'&&<label>{m.phone}<input name="phone" type="tel" required maxLength={40} autoComplete="tel" dir="ltr" /></label>}
        <div className="bct-fields"><label>{m.city}<input name="city" required maxLength={150} /></label>
          <label>{m.country}<ProviderCountrySelect name="countryCode" language={language} placeholder={m.countryNone} /></label></div>
        <fieldset className="bci-services"><legend>{m.offered}</legend>{page.services.map(code=><label key={code} className="bci-consent"><input type="checkbox" checked={services.includes(code)} onChange={e=>{setSelectionError(false);setServices(values=>e.target.checked?[...values,code]:values.filter(v=>v!==code));}} />{recruitmentTrade(code,language)}</label>)}</fieldset>
        {selectionError&&<p className="bct-error" role="alert">{m.select}</p>}
        <label>{m.availability}<textarea name="availability" maxLength={500} rows={2} /></label>
        <label>{m.message}<textarea name="message" maxLength={3000} rows={3} /></label>
        <label className="bct-trap" aria-hidden="true">Website<input name="website" maxLength={100} autoComplete="off" tabIndex={-1} /></label>
        <label className="bci-consent"><input name="requestContact" type="checkbox" required />{m.consent.replace('{name}',page.recipientName)}</label>
        <p className="bct-privacy">{m.privacy.replace('{name}',page.recipientName)} <Link to={`/legal/confidentialite${langQuery(language)}`}>{m.policy}</Link></p>
        {captchaEnabled&&<BaitlyTurnstile siteKey={runtimeEnvOr('VITE_TURNSTILE_SITE_KEY','')} action="provider-recruitment" language={language} onToken={setCaptcha} resetKey={reset} />}
        {error!==null&&<p role="alert" className="bct-error">{error===429?m.limited:error===404?m.closed:m.error}</p>}
        <button className="baitly-button bct-submit" type="submit" disabled={pending||!ready||(captchaEnabled&&!captcha)}>{pending?m.sending:m.send}</button>
      </fieldset>
    </form>}
  </section>;
}
