import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  PauseIcon,
  PlayIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import BaitlyMarkLogo from '../../src/components/BaitlyMarkLogo';
import {
  AGENT_META,
  autonomyChoicesFor,
  RAD,
} from '../../src/modules/supervision/constants';
import type {
  AgentId,
  AutonomyLevel,
} from '../../src/modules/supervision/types';
import AgentIcon from '../components/SiteAgentIcon';
import BaitlyAgentsHeroDemo from '../components/BaitlyAgentsHeroDemo';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import { useBaitlyDemoVisibility } from '../components/useBaitlyDemoVisibility';
import { SITE_PHOTOS, sitePhotoAlt } from '../data/baitlyPhotography';
import { AGENTS_PAGE_MESSAGES } from '../lib/messages/baitlyAgentsPage';
import { useSiteLanguage, type SiteLanguage } from '../lib/siteLanguage';

export function AgentsConstellation({ language }: { language: SiteLanguage }) {
  const m = AGENTS_PAGE_MESSAGES[language];
  const [selected, setSelected] = useState<AgentId>('ops');
  const [modes, setModes] = useState<Partial<Record<AgentId, AutonomyLevel>>>(
    {},
  );
  const [paused, setPaused] = useState(false);
  const { visibilityRef, active, reduced } = useBaitlyDemoVisibility();
  const detailId = useId();
  const agent = m.agents.find((item) => item.id === selected)!;
  const choices = autonomyChoicesFor(selected);
  const mode = modes[selected] ?? 'suggest';
  const nodes = m.agents.map((item, index) => {
    const id = item.id as AgentId;
    const angle = ((index * 36 - 126) * Math.PI) / 180;
    const radius = (36 * RAD[modes[id] ?? 'suggest']) / RAD.suggest;
    return {
      ...item,
      id,
      x: 50 + radius * Math.cos(angle),
      y: 49 + radius * Math.sin(angle),
    };
  });
  return (
    <div className="bap-constellation-layout" ref={visibilityRef}>
      <div className="bap-orbit-panel">
        <div className="bap-orbit-caption">
          <span>{m.constellation.select}</span>
          {!reduced && (
            <button
              className="bap-icon-button"
              aria-label={paused ? m.play : m.pause}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <PlayIcon size={16} /> : <PauseIcon size={16} />}
            </button>
          )}
        </div>
        <div
          className="bap-orbit"
          data-running={(active && !paused) || undefined}
        >
          <svg
            className="bap-orbit-lines"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <circle cx="50" cy="49" r="36" />
            {nodes.map((node) => (
              <g
                key={node.id}
                data-selected={selected === node.id || undefined}
              >
                <path d={`M50 49L${node.x} ${node.y}`} />
                {selected === node.id && (
                  <path
                    className="bap-orbit-packet"
                    pathLength="100"
                    d={`M50 49L${node.x} ${node.y}`}
                  />
                )}
              </g>
            ))}
          </svg>
          <div className="bap-orbit-core">
            <span>
              <BaitlyMarkLogo
                variant="mark"
                colorMode="inherit"
                disableAnimation
              />
            </span>
            <small>{m.constellation.core}</small>
          </div>
          <div role="group" aria-label={m.constellation.label}>
            {nodes.map((node) => (
              <button
                className="bap-orbit-agent"
                key={node.id}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                aria-pressed={selected === node.id}
                aria-controls={detailId}
                onClick={() => setSelected(node.id)}
              >
                <span className="bap-orbit-disc">
                  <AgentIcon token={AGENT_META[node.id].icon} size={24} />
                  {selected === node.id && (
                    <span className="bap-orbit-selected" aria-hidden="true">
                      <CheckIcon size={10} />
                    </span>
                  )}
                </span>
                <span className="bap-orbit-label">{node.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        className="bap-agent-detail"
        id={detailId}
        role="region"
        aria-label={agent.name}
      >
        <div className="bap-agent-detail-title">
          <AgentIcon token={AGENT_META[selected].icon} size={28} />
          <h3>{agent.name}</h3>
        </div>
        <dl className="bap-agent-role">
          <div>
            <dt>{m.constellation.watches}</dt>
            <dd>{agent.watches}</dd>
          </div>
          <div>
            <dt>{m.constellation.proposes}</dt>
            <dd>{agent.proposes}</dd>
          </div>
        </dl>
        <fieldset className="bap-autonomy">
          <legend>{m.constellation.available}</legend>
          <div>
            {choices.map((choice) => (
              <label key={choice}>
                <input
                  type="radio"
                  name={`${detailId}-autonomy`}
                  value={choice}
                  checked={mode === choice}
                  onChange={() =>
                    setModes((current) => ({ ...current, [selected]: choice }))
                  }
                />
                <span>{m.constellation.modes[choice]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="bap-mode-explanation">
          {m.constellation.descriptions[mode]}
        </p>
        <p className="bap-autonomy-bound">
          <ShieldCheckIcon size={18} />
          <span>
            {choices.length === 1
              ? m.constellation.required
              : m.constellation.bounded}
          </span>
        </p>
        <small className="bap-example">{m.constellation.demoSetting}</small>
      </div>
    </div>
  );
}

export default function BaitlyAgentsPage() {
  const { language } = useSiteLanguage();
  const m = AGENTS_PAGE_MESSAGES[language];
  return (
    <div className="bap-page">
      <section className="bap-hero">
        <div className="site-shell bap-hero-layout">
          <div className="bap-hero-copy">
            <p className="bap-eyebrow">{m.eyebrow}</p>
            <h1>
              {m.title[0]}
              <span>{m.title[1]}</span>
            </h1>
            <p className="bap-intro">{m.intro}</p>
            <div className="bap-hero-actions">
              <SiteAcquisitionLink
                className="bap-button"
                to={`/demo?lang=${language}`}
              >
                {m.cta}
                <ArrowRightIcon size={19} />
              </SiteAcquisitionLink>
              <a className="bap-link" href="#constellation">
                {m.explore}
                <ArrowDownIcon size={17} />
              </a>
            </div>
            <p className="bap-reassurance">
              <ShieldCheckIcon size={18} />
              {m.reassurance}
            </p>
            <div className="bap-hero-photo">
              <img
                src={SITE_PHOTOS.agentsReception}
                alt={sitePhotoAlt('agentsReception', language)}
                width={900}
                height={520}
                decoding="async"
              />
              <span>
                <BaitlyMarkLogo
                  variant="mark"
                  colorMode="inherit"
                  disableAnimation
                />
                Baitly
              </span>
            </div>
          </div>
          <BaitlyAgentsHeroDemo language={language} />
        </div>
      </section>
      <section
        className="bap-section site-shell"
        id="constellation"
        aria-labelledby="bap-constellation-title"
      >
        <div className="bap-section-heading">
          <div>
            <p className="bap-eyebrow">{m.constellation.eyebrow}</p>
            <h2 id="bap-constellation-title">{m.constellation.title}</h2>
          </div>
          <p>{m.constellation.intro}</p>
        </div>
        <AgentsConstellation language={language} />
      </section>
      <section className="bap-workflow" aria-labelledby="bap-workflow-title">
        <div className="site-shell bap-workflow-layout">
          <div className="bap-workflow-photo">
            <img
              src={SITE_PHOTOS.agentsCollaboration}
              alt={sitePhotoAlt('agentsCollaboration', language)}
              width={900}
              height={1000}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div>
            <p className="bap-eyebrow">{m.eyebrow}</p>
            <h2 id="bap-workflow-title">{m.workflow.title}</h2>
            <p className="bap-workflow-intro">{m.workflow.intro}</p>
            <ol className="bap-workflow-steps">
              {m.workflow.steps.map((step, index) => (
                <li key={step.title}>
                  <span>0{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              className="bap-link"
              to={`/produit/pms-channel-manager?lang=${language}`}
            >
              {m.workflow.link}
              <ArrowRightIcon size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section
        className="bap-section bap-faq site-shell"
        aria-labelledby="bap-faq-title"
      >
        <h2 id="bap-faq-title">{m.faqTitle}</h2>
        <div>
          {m.faq.map((item) => (
            <details key={item.q}>
              <summary>
                {item.q}
                <ChevronDownIcon size={20} />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="site-shell bap-final">
        <div>
          <h2>{m.finalTitle}</h2>
          <p>{m.finalCopy}</p>
        </div>
        <div>
          <SiteAcquisitionLink
            className="bap-button"
            to={`/demo?lang=${language}`}
          >
            {m.cta}
            <ArrowRightIcon size={18} />
          </SiteAcquisitionLink>
          <Link className="bap-link" to={`/tarifs?lang=${language}`}>
            {m.pricing}
            <ArrowRightIcon size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
