import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_RESOURCE_MESSAGES } from '../lib/messages/baitlyResources';
import type { ResourceKind } from '../data/baitlyResources';
import {
  RevenueCalculator,
  MarketBarometer,
  ObligationsGuide,
  BaitlyAcademy,
  BaitlyJournal,
  ResourceGlossary,
} from '../components/BaitlyResourceTools';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import '../baitly-resources.css';

const TOOLS = {
  calculateur: RevenueCalculator,
  barometre: MarketBarometer,
  obligations: ObligationsGuide,
  academie: BaitlyAcademy,
  blog: BaitlyJournal,
  glossaire: ResourceGlossary,
};
const RELATED: Record<ResourceKind, ResourceKind[]> = {
  calculateur: ['academie', 'barometre'],
  barometre: ['calculateur', 'glossaire'],
  obligations: ['academie', 'blog'],
  academie: ['calculateur', 'glossaire'],
  blog: ['academie', 'calculateur'],
  glossaire: ['barometre', 'academie'],
};

export default function BaitlyResourcePage({ kind }: { kind: ResourceKind }) {
  const { language } = useSiteLanguage();
  const m = BAITLY_RESOURCE_MESSAGES[language];
  const module = m.modules[kind];
  const Tool = TOOLS[kind];
  const Back = language === 'ar' ? ArrowRight : ArrowLeft;
  return (
    <div className={`brs-page brs-tool-page brs-tool-${kind}`}>
      <header className="brs-tool-header site-shell">
        <Link className="brs-back" to={`/ressources?lang=${language}`}>
          <Back size={16} />
          {m.back}
        </Link>
        <span className="brs-eyebrow">
          {module.name} · {module.tag}
        </span>
        <h1>{module.title}</h1>
        <p>{module.intro}</p>
      </header>
      <div className="site-shell brs-tool-content">
        <Tool key={kind} language={language} />
      </div>
      <section className="site-shell brs-related">
        <span className="brs-eyebrow">{m.related}</span>
        <div>
          {RELATED[kind].map((id) => (
            <Link key={id} to={`/ressources/${id}?lang=${language}`}>
              <span>
                <strong>{m.modules[id].name}</strong>
                <small>{m.modules[id].copy}</small>
              </span>
              <ArrowRight size={22} />
            </Link>
          ))}
        </div>
      </section>
      <section className="brs-cta">
        <div className="site-shell">
          <div>
            <h2>{m.cta.title}</h2>
            <p>{m.cta.copy}</p>
          </div>
          <SiteAcquisitionLink
            className="brs-button"
            to={`/demo?lang=${language}`}
          >
            {m.cta.action}
            <ArrowRight size={18} />
          </SiteAcquisitionLink>
        </div>
      </section>
    </div>
  );
}
