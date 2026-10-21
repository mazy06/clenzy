import { useEffect,useState,type FormEvent } from 'react';
import { Link,useLocation,useNavigate } from 'react-router-dom';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_CONCIERGES } from '../lib/messages/baitlyConcierges';
import { BAITLY_OWNER_MATCH } from '../lib/messages/baitlyOwnerMatch';
import { BAITLY_OWNER_SERVICES,BAITLY_OWNER_PROPERTY_TYPES,ownerCriteria,ownerCriteriaParams } from '../../src/services/baitlyOwnerCriteria';
import { baitlyConciergeApi,conciergeProfilePath,type BaitlyConciergeResults } from '../lib/baitlyConciergeApi';
import PagePagination from '../../src/components/PagePagination';
import ProviderCountrySelect from './ProviderCountrySelect';

export default function BaitlyConciergeFinder() {
  const { language }=useSiteLanguage(), { search }=useLocation(),navigate=useNavigate();
  const m=BAITLY_OWNER_MATCH[language],labels=BAITLY_CONCIERGES[language];
  const [criteria]=useState(() => ownerCriteria(search));const [page,setPage]=useState(0);
  const [result,setResult]=useState<BaitlyConciergeResults>();const [error,setError]=useState(false);const [retry,setRetry]=useState(0);
  useEffect(() => {
    const controller=new AbortController();setResult(undefined);setError(false);
    baitlyConciergeApi.matches(criteria,page,controller.signal).then(data => {
      if(controller.signal.aborted)return;
      const lastPage=Math.max(0,Math.ceil(data.totalElements/25)-1);
      if(page>lastPage)setPage(lastPage);else setResult(data);
    })
      .catch(() => {if(!controller.signal.aborted)setError(true);});
    return () => controller.abort();
  },[criteria,page,retry]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();const fields=new FormData(event.currentTarget);setPage(0);
    navigate('/conciergeries?'+ownerCriteriaParams({ city:String(fields.get('city')).trim(),country:String(fields.get('country')).trim().toUpperCase(),
      propertyType:String(fields.get('propertyType')),services:fields.getAll('service').map(String),maxFee:String(fields.get('maxFee')) },language,search));
  }
  return <>
    <form className="bct-form-surface bci-finder" onSubmit={submit}>
      <h2>{m.criteria}</h2>
      <div className="bci-filter-fields">
        <label>{m.city}<input name="city" maxLength={150} defaultValue={criteria.city} /></label>
        <label>{m.country}<ProviderCountrySelect name="country" aria-label={m.country} language={language} defaultValue={criteria.country} placeholder={m.countryAll} /></label>
        <label>{m.type}<select name="propertyType" aria-label={m.type} defaultValue={criteria.propertyType}>{BAITLY_OWNER_PROPERTY_TYPES.map(type => <option key={type} value={type}>{m.types[type]}</option>)}</select></label>
        <label>{m.fee}<input name="maxFee" type="number" min={0} max={100} step="0.01" defaultValue={criteria.maxFee} /></label>
      </div>
      <fieldset className="bci-services"><legend>{m.services}</legend>{BAITLY_OWNER_SERVICES.map(service => <label className="bci-consent" key={service}>
        <input type="checkbox" name="service" value={service} defaultChecked={criteria.services.includes(service)} />{labels[service]}</label>)}</fieldset>
      <details className="bct-privacy"><summary>{m.explain}</summary><p>{m.help}</p><p>{m.countryHelp} {m.feeHelp}</p></details>
      <div className="bci-filter-actions"><button className="baitly-button" type="submit">{m.search}</button>
        <Link className="baitly-text-link" to={`/conciergeries?lang=${language}`}>{m.reset}</Link></div>
    </form>
    {error ? <div role="alert"><p>{labels.error}</p><button className="baitly-button" onClick={() => setRetry(value => value+1)}>{labels.retry}</button></div>
      : !result ? <p role="status" aria-busy="true">{labels.loading}</p> : <>
        <p role="status" className="tabular-nums">{result.totalElements} {result.totalElements===1?m.resultOne:m.result}</p>
        {result.content.length===0 ? <p>{m.empty}</p> : <ul className="bci-directory">{result.content.map(profile => <li key={profile.id}>
          <div><h2><Link to={conciergeProfilePath(profile.id,language,search)}>{profile.organization || profile.name}</Link></h2>
            <p>{profile.city}</p><p>{profile.bio}</p>
            {profile.cityEvidence && <p>{m[profile.cityEvidence]}</p>}
            {!!criteria.country && <p>{profile.countryConfirmed?m.countryConfirmed:m.countryUnknown}</p>}
            <p className="tabular-nums">{profile.managementFeePct==null?m.feeUnknown:`${m.feeKnown} : ${new Intl.NumberFormat(language).format(profile.managementFeePct)} %`}</p>
            <ul>{profile.managementServices.map(service => <li key={service}>{labels[service as keyof typeof labels] || service}</li>)}</ul>
            <Link className="baitly-text-link" to={conciergeProfilePath(profile.id,language,search)}>{labels.open}</Link>
          </div>
        </li>)}</ul>}
        <PagePagination page={page} count={result.totalElements} rowsPerPage={25} onPageChange={setPage} labels={{ previous:m.previous,next:m.next,range:(from,to,total)=>`${from}–${to} / ${total}` }} />
      </>}
  </>;
}
