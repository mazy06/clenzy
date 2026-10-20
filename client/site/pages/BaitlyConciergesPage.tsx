import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_CONCIERGES } from '../lib/messages/baitlyConcierges';
import { baitlyConciergeApi, conciergePhotoUrl, type BaitlyConciergeProfile } from '../lib/baitlyConciergeApi';
import { ownerCriteria,ownerCriteriaParams } from '../../src/services/baitlyOwnerCriteria';
import BaitlyManagementInquiryForm from '../components/BaitlyManagementInquiryForm';
import BaitlyConciergeFinder from '../components/BaitlyConciergeFinder';
import '../baitly-concierges.css';

export default function BaitlyConciergesPage() {
  const { id } = useParams();
  const { search }=useLocation(); const { language }=useSiteLanguage(); const m=BAITLY_CONCIERGES[language];
  if(!id)return <section className="site-shell bci-page"><h1>{m.directory}</h1><p className="bci-bio">{m.intro}</p><BaitlyConciergeFinder key={search} /></section>;
  return <BaitlyConciergesContent key={id} id={id} />;
}
function BaitlyConciergesContent({ id }: { id: string }) {
  const { language } = useSiteLanguage(); const m = BAITLY_CONCIERGES[language];
  const { search }=useLocation();
  const [profiles,setProfiles] = useState<BaitlyConciergeProfile[] | null>(null);
  const [error,setError] = useState(false); const [retry,setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(false); setProfiles(null);
    const task = baitlyConciergeApi.detail(id,controller.signal).then(p => p.role === 'CONCIERGE' ? [p] : []);
    task.then(value => { if(!controller.signal.aborted) setProfiles(value); }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [id,retry]);
  const profile = id ? profiles?.[0] : undefined;
  return <section className="site-shell bci-page">
    <Link className="baitly-text-link" to={'/conciergeries?'+ownerCriteriaParams(ownerCriteria(search),language,search)}>{m.back}</Link>
    {error ? <div role="alert"><p>{m.error}</p><button className="baitly-button" onClick={() => setRetry(v => v+1)}>{m.retry}</button></div>
      : profiles === null ? <p role="status" aria-busy="true">{m.loading}</p>
      : profile ? <div className="bci-layout">
        <article>
          {profile.coverUrl && <img className="bci-cover" src={conciergePhotoUrl(profile.coverUrl)} alt="" />}
          <h1>{profile.organization || profile.name}</h1><p>{profile.city}</p><p className="bci-bio">{profile.bio}</p>
          {!!profile.managementServices.length && <section><h2>{m.services}</h2><ul>{profile.managementServices.map(service => <li key={service}>{m[service as keyof typeof m] || service}</li>)}</ul></section>}
          {!!profile.properties.length && <section><h2>{m.homes}</h2>{profile.properties.map(home => <div className="bci-home" key={home.id}>
            {home.photos[0] && <img src={conciergePhotoUrl(home.photos[0])} alt={home.name} loading="lazy" />}
            <div><h3>{home.name}</h3><p>{home.city}</p></div>
          </div>)}</section>}
        </article>
        <BaitlyManagementInquiryForm key={profile.id+search} profile={profile} />
      </div> : <p role="status">{m.error}</p>}
  </section>;
}
