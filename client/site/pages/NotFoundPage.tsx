import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_CONTACT_MESSAGES } from '../lib/messages/baitlyContact';

export default function NotFoundPage() {
  const { language } = useSiteLanguage();
  const m = BAITLY_CONTACT_MESSAGES[language];
  return (
    <section className="site-shell bct-page">
      <div className="bct-copy">
        <p className="bct-eyebrow">404 · Baitly</p>
        <h1>{m.notFound}</h1>
        <p className="bct-lead">{m.notFoundCopy}</p>
        <Link className="bct-explore" to={`/?lang=${language}`}>
          {m.back}
          <ArrowRightIcon size={18} aria-hidden="true" />
        </Link>
      </div>
      <div className="bct-form-surface">
        <h2>{m.explore}</h2>
        <Link
          className="bct-explore"
          to={`/produit/pms-channel-manager?lang=${language}`}
        >
          {m.products}
          <ArrowRightIcon size={18} aria-hidden="true" />
        </Link>
        <br />
        <Link className="bct-explore" to={`/contact?lang=${language}`}>
          {m.contact}
          <ArrowRightIcon size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
