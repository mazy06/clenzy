import { useState, type ReactNode } from 'react';
import { ArrowUpRight, Check, ChevronDown, KeyRound, ShieldCheck, Volume2, Video } from 'lucide-react';
import type { SiteLanguage } from '../lib/siteLanguage';
import { CONNECTED_HOME_MESSAGES, type ConnectedHomeScenario } from '../lib/messages/connectedHome';
import { SiteAssistantPortrait } from './SiteProductVisuals';
import connectedHome from '../assets/photos/editorial/baitlyConnectedHome.webp';
import '../connected-home.css';

const SCENARIOS = [
  { id: 'access', icon: KeyRound, number: '01' },
  { id: 'noise', icon: Volume2, number: '02' },
  { id: 'entrance', icon: Video, number: '03' },
] as const;
// These are installation references, not a claim of worldwide legal compliance.
const SOURCES = [
  'https://www.paris.fr/pages/boites-a-cles-interdites-sur-l-espace-public-ce-qu-il-faut-savoir-et-faire-29992',
  'https://www.airbnb.fr/help/article/3061',
  'https://www.cnil.fr/fr/la-videosurveillance-videoprotection-chez-soi',
];

/** An illustrative property. Nothing here connects to an actual device or booking. */
export default function ConnectedHomeScenarios({ language, children }: { language: SiteLanguage; children?: ReactNode }) {
  const [selected, setSelected] = useState<ConnectedHomeScenario>('access');
  const m = CONNECTED_HOME_MESSAGES[language];
  const scenario = m.scenarios[selected];
  const DeviceIcon = SCENARIOS.find((item) => item.id === selected)!.icon;

  return (
    <section className="bch-section site-shell" id="fonctionnalites" aria-labelledby="bch-title" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bch-heading">
        <p className="bps-eyebrow">{m.eyebrow}</p>
        <h2 id="bch-title">{m.title}</h2>
        <p>{m.intro}</p>
      </header>

      <div className="bch-choices" role="group" aria-label={m.choose}>
        {SCENARIOS.map(({ id, number, icon: Icon }) => (
          <button key={id} type="button" aria-pressed={selected === id} aria-controls="bch-scenario" onClick={() => setSelected(id)}>
            <span className="bch-choice-number">{number}</span>
            <span><strong>{m.scenarios[id].label}</strong><span>{m.scenarios[id].device}</span></span>
            <Icon aria-hidden="true" size={22} />
          </button>
        ))}
      </div>

      <div className="bch-workspace">
        <figure className="bch-property">
          <div className="bch-property-image">
            <img src={connectedHome} alt={m.illustrationAlt} width={1448} height={1086} loading="lazy" decoding="async" />
            <div role="group" aria-label={m.illustration}>
              {SCENARIOS.map(({ id, number }) => (
                <button key={id} type="button" className={`bch-hotspot bch-hotspot-${id}`}
                  aria-label={`${m.scenarios[id].device} · ${m.scenarios[id].location}`}
                  aria-pressed={selected === id} aria-controls="bch-scenario" onClick={() => setSelected(id)}>
                  {number}
                </button>
              ))}
            </div>
            <span className="bch-location"><DeviceIcon size={16} aria-hidden="true" />{scenario.location}</span>
          </div>
          <figcaption className="bch-benefit" aria-live="polite" aria-atomic="true">
            <Check size={22} aria-hidden="true" />
            <div><span>{m.benefitLabel}</span><p>{scenario.benefit}</p></div>
          </figcaption>
        </figure>

        <article id="bch-scenario" className="bch-scenario" aria-labelledby="bch-scenario-title" aria-live="polite" aria-atomic="true">
          <div key={selected} className="bch-scenario-content">
            <span className="bch-label">{m.problemLabel}</span>
            <h3 id="bch-scenario-title">{scenario.title}</h3>
            <p className="bch-problem">{scenario.problem}</p>
            <div className="bch-response-title"><SiteAssistantPortrait size={46} /><h4>{m.response}</h4></div>
            <ol className="bch-response">
              {scenario.steps.map((step, index) => <li key={step}><span aria-hidden="true">{index + 1}</span><p>{step}</p></li>)}
            </ol>
            <p className="bch-boundary"><ShieldCheck size={17} aria-hidden="true" />{scenario.boundary}</p>
          </div>
        </article>
      </div>

      <p className="bch-compatibility">{m.compatibility}</p>
      <details className="bch-installation">
        <summary><ShieldCheck size={19} aria-hidden="true" /><span>{m.rulesTitle}</span><ChevronDown size={19} aria-hidden="true" /></summary>
        <div className="bch-installation-body">
          <ul>{m.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
          <nav aria-label={m.sources}>{SOURCES.map((source, index) => <a key={source} href={source} target="_blank" rel="noopener noreferrer">{m.sourceNames[index]}<ArrowUpRight size={14} aria-hidden="true" /></a>)}</nav>
        </div>
      </details>
      {children}
    </section>
  );
}
