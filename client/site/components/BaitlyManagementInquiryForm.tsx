import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link,useLocation } from 'react-router-dom';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_CONCIERGES } from '../lib/messages/baitlyConcierges';
import { baitlyConciergeApi, BaitlyInquiryError, type BaitlyConciergeProfile } from '../lib/baitlyConciergeApi';
import { runtimeEnvOr } from '../../src/config/runtimeConfig';
import BaitlyTurnstile from '../../src/components/BaitlyTurnstile';
import '../baitly-contact.css';
import { ownerCriteria,BAITLY_OWNER_SERVICES,BAITLY_OWNER_PROPERTY_TYPES } from '../../src/services/baitlyOwnerCriteria';
import { BAITLY_OWNER_MATCH } from '../lib/messages/baitlyOwnerMatch';
import ProviderCountrySelect from './ProviderCountrySelect';
import { langQuery } from '../lib/siteSeo';

export default function BaitlyManagementInquiryForm({ profile }: { profile: BaitlyConciergeProfile }) {
  const { language } = useSiteLanguage(); const m = BAITLY_CONCIERGES[language];
  const { search }=useLocation(); const [criteria]=useState(() => ownerCriteria(search)); const match=BAITLY_OWNER_MATCH[language];
  const organization = profile.organization || profile.name;
  const [reply,setReply] = useState('EMAIL'); const [pending,setPending] = useState(false);
  const [success,setSuccess] = useState(false); const [error,setError] = useState<number | null>(null);
  const [captcha,setCaptcha] = useState<string | null>(null); const [reset,setReset] = useState(0);
  const siteKey = runtimeEnvOr('VITE_TURNSTILE_SITE_KEY','');
  const captchaEnabled = runtimeEnvOr('VITE_BAITLY_CAPTCHA_ENABLED','false') === 'true';
  const lastSubmission = useRef<{ fingerprint: string; requestId: string }>();
  const [requestId,setRequestId] = useState<string>();
  useEffect(() => setRequestId(globalThis.crypto.randomUUID()), []);
  const [provenance] = useState(() => {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(search);
    let referrerHost: string | undefined;
    try { referrerHost = document.referrer ? new URL(document.referrer).hostname.slice(0,255) : undefined; } catch { /* No referrer. */ }
    return { utmSource: params.get('utm_source')?.slice(0,150), utmMedium: params.get('utm_medium')?.slice(0,150),
      utmCampaign: params.get('utm_campaign')?.slice(0,150), referrerHost };
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(pending) return;
    const form = new FormData(event.currentTarget); setPending(true); setError(null);
    try {
      const payload = { ...Object.fromEntries(form.entries()), ...provenance, requestContact: form.get('requestContact') === 'on',
        countryCode:String(form.get('countryCode') || '').trim().toUpperCase() || undefined,
        requestedServices:form.getAll('requestedServices').map(String),
        maxManagementFeePct:form.get('maxManagementFeePct') ? Number(form.get('maxManagementFeePct')) : undefined };
      const fingerprint = JSON.stringify(payload);
      if (lastSubmission.current?.fingerprint !== fingerprint) lastSubmission.current = { fingerprint,requestId: globalThis.crypto.randomUUID() };
      await baitlyConciergeApi.submit(profile.id,{ ...payload,requestId: lastSubmission.current.requestId,captchaToken: captcha });
      setSuccess(true);
    } catch (failure) { setError(failure instanceof BaitlyInquiryError ? failure.status : 0); }
    finally { setPending(false); setCaptcha(null); setReset(v => v+1); }
  }
  return <section className="bct-form-surface" aria-labelledby="management-inquiry-title">
    <h2 id="management-inquiry-title">{m.form}</h2>
    {success ? <div className="bct-success" role="status"><h3>{m.success}</h3><p>{m.successHelp}</p></div> : <form onSubmit={submit}>
      <p className="bct-hint">{m.required}</p>
      <p className="bct-privacy">{match.requested}</p>
      <fieldset disabled={pending}>
        <label>{m.purpose}<select aria-label={m.purpose} name="purpose" defaultValue="MANAGEMENT">{(['MANAGEMENT','ESTIMATE'] as const).map(v => <option key={v} value={v}>{m[v]}</option>)}</select></label>
        <label>{m.name}<input name="name" autoComplete="name" required maxLength={255} /></label>
        <label>{m.email}<input name="email" type="email" autoComplete="email" required maxLength={255} dir="ltr" /></label>
        <label>{m.replyChannel}<select aria-label={m.replyChannel} name="replyChannel" value={reply} onChange={e => setReply(e.target.value)}><option value="EMAIL">{m.EMAIL}</option><option value="PHONE">{m.PHONE}</option></select></label>
        {reply === 'PHONE' && <label>{m.phone}<input name="phone" type="tel" autoComplete="tel" required maxLength={40} dir="ltr" /></label>}
        <div className="bct-fields"><label>{m.city}<input name="city" required maxLength={150} defaultValue={criteria.city} /></label>
          <label>{m.propertyType}<select aria-label={m.propertyType} name="propertyType" defaultValue={criteria.propertyType}>{BAITLY_OWNER_PROPERTY_TYPES.map(v => <option key={v} value={v}>{match.types[v]}</option>)}</select></label></div>
        <label>{match.country}<ProviderCountrySelect name="countryCode" aria-label={match.country} language={language} defaultValue={criteria.country} placeholder={match.countryAll} /></label>
        <label>{match.fee}<input name="maxManagementFeePct" type="number" min={0} max={100} step="0.01" defaultValue={criteria.maxFee} /></label>
        <fieldset className="bci-services"><legend>{match.services}</legend>{BAITLY_OWNER_SERVICES.map(service => <label className="bci-consent" key={service}>
          <input type="checkbox" name="requestedServices" value={service} defaultChecked={criteria.services.includes(service)} />{m[service]}</label>)}</fieldset>
        <label>{m.message}<textarea name="message" maxLength={3000} rows={3} /></label>
        <label className="bct-trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" maxLength={100} /></label>
        <label className="bci-consent"><input type="checkbox" name="requestContact" required />{m.consent.replace('{name}',organization)}</label>
        <p className="bct-privacy">{m.privacy.replace('{name}',organization)} <Link to={`/legal/confidentialite${langQuery(language)}`}>{m.policy}</Link></p>
        {captchaEnabled && <BaitlyTurnstile siteKey={siteKey} action="management-inquiry" language={language} onToken={setCaptcha} resetKey={reset} />}
        {error !== null && <p className="bct-error" role="alert">{error === 429 ? m.limited : m.failed}</p>}
        <button className="baitly-button bct-submit" type="submit" disabled={pending || !requestId || (captchaEnabled && !captcha)}>{pending ? m.sending : m.send}</button>
      </fieldset>
    </form>}
  </section>;
}
