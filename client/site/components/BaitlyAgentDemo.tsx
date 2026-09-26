import { SiteMoneyText } from './SiteMoney';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  CheckCheckIcon,
  CircleCheckIcon,
  MessageCircleIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  SparklesIcon,
  TrendingUpIcon,
} from 'lucide-react';
import Reveal from './Reveal';
import { useReducedMotion } from './mockupKit';
import { useSiteLanguage } from '../lib/siteLanguage';
import { MOCKUP_MESSAGES, type MockupMessages } from '../lib/messages/mockups';
import { SITE_PHOTOS } from '../data/baitlyPhotography';

const { agentStay: riadPhoto } = SITE_PHOTOS;

/** Icone par scenario, dans l'ordre du dictionnaire. */
const SCENARIO_ICONS = [
  TrendingUpIcon,
  MessageCircleIcon,
  CheckCheckIcon,
  RefreshCwIcon,
];

/** Démonstration locale : aucune action ne modifie un logement ni une réservation. */
function useAgentDemo() {
  const { language } = useSiteLanguage();
  const m = MOCKUP_MESSAGES[language].demo;
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [approved, setApproved] = useState(false);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const scenario = m.scenarios[selected];
  const step = m.steps[selected];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) setPlaying(false);
  }, [reduced]);

  useEffect(() => {
    if (!playing || !inView || reduced) return;
    const approval = window.setTimeout(() => setApproved(true), 3200);
    const next = window.setTimeout(() => {
      setSelected((index) => (index + 1) % m.scenarios.length);
      setApproved(false);
    }, 6200);
    return () => {
      window.clearTimeout(approval);
      window.clearTimeout(next);
    };
  }, [playing, inView, reduced, selected]);

  function selectScenario(index: number) {
    setSelected(index);
    setApproved(false);
    setPlaying(false);
  }

  return {
    selected,
    playing,
    approved,
    inView,
    sectionRef,
    reduced,
    scenario,
    step,
    m,
    selectScenario,
    setApproved,
    setPlaying,
  };
}

export default function BaitlyAgentDemo() {
  const demo = useAgentDemo();
  const { selected, sectionRef, selectScenario, m } = demo;

  return (
    <section
      id="en-action"
      ref={sectionRef}
      className="baitly-agent-section"
      aria-labelledby="agents-title"
    >
      <div className="site-shell">
        <Reveal className="baitly-section-heading">
          <div>
            <p className="baitly-section-label">
              <SparklesIcon /> {m.sectionLabel}
            </p>
            <h2 id="agents-title">
              {m.sectionTitle[0]}
              <br />
              {m.sectionTitle[1]}
            </h2>
          </div>
          <p>
            {m.sectionCopy[0]}
            <br />
            {m.sectionCopy[1]}
          </p>
        </Reveal>
        <div className="baitly-agent-layout">
          <div className="baitly-agent-choices" aria-label={m.chooseAria}>
            {m.scenarios.map((agent, index) => {
              const AgentIcon = SCENARIO_ICONS[index];
              return (
                <button
                  type="button"
                  key={agent.name}
                  aria-pressed={selected === index}
                  aria-controls="baitly-agent-scene"
                  onClick={() => selectScenario(index)}
                >
                  <AgentIcon />
                  <span>
                    <strong>
                      {m.agentPrefix} {agent.name}
                    </strong>
                    <small>{agent.description}</small>
                  </span>
                  <ArrowRightIcon />
                </button>
              );
            })}
            <Link to="/produit/agents-ia" className="baitly-text-link">
              {m.linkAgents} <ArrowRightIcon />
            </Link>
          </div>
          <AgentScene demo={demo} />
        </div>
        <p className="baitly-demo-caption">{m.caption}</p>
      </div>
    </section>
  );
}

function AgentScene({ demo }: { demo: ReturnType<typeof useAgentDemo> }) {
  const {
    selected,
    playing,
    approved,
    inView,
    reduced,
    scenario,
    step,
    m,
    setApproved,
    setPlaying,
  } = demo;
  const ScenarioIcon = SCENARIO_ICONS[selected];
  return (
    <div className="baitly-demo-window" id="baitly-agent-scene">
      <div className="baitly-demo-top">
        <span>
          <SparklesIcon /> Baitly <span>/</span> {m.brand}
        </span>
        <span className="baitly-demo-badge">{m.badge}</span>
      </div>
      <div className="baitly-demo-property">
        <img src={riadPhoto} alt="" width="56" height="56" loading="lazy" />
        <div>
          <strong>{m.propertyName}</strong>
          <span>{m.propertyCity}</span>
        </div>
        <CalendarDaysIcon />
      </div>
      <div className="baitly-demo-content" key={selected}>
        <p className="baitly-demo-agent">
          <ScenarioIcon /> {m.agentPrefix} {scenario.name}
          <span>{approved ? m.finished : m.pending}</span>
        </p>
        <h3>{scenario.title}</h3>
        <p>{scenario.copy}</p>
        <div className="baitly-demo-proposal">
          <span>
            <SiteMoneyText>{scenario.detail}</SiteMoneyText>
          </span>
          <div>
            <span>
              <SiteMoneyText>{step.before}</SiteMoneyText>
            </span>
            <ArrowRightIcon />
            <strong>
              <SiteMoneyText>{step.after}</SiteMoneyText>
            </strong>
          </div>
        </div>
        <p className="baitly-demo-note">
          <CircleCheckIcon aria-hidden="true" />
          <SiteMoneyText>{scenario.note}</SiteMoneyText>
        </p>
        <div
          className="baitly-demo-action"
          aria-live={playing ? 'off' : 'polite'}
        >
          {approved ? (
            <p>
              <CircleCheckIcon />
              {scenario.done}
            </p>
          ) : (
            <>
              <button
                type="button"
                className="baitly-button"
                onClick={() => {
                  setApproved(true);
                  setPlaying(false);
                }}
              >
                <CheckIcon />
                {scenario.action}
              </button>
              <span>{m.youDecide}</span>
            </>
          )}
        </div>
      </div>
      <div className="baitly-demo-controls">
        <span>
          <i />
          {playing && inView ? m.reading : m.tryIt}
        </span>
        {!reduced && (
          <button
            type="button"
            onClick={() => {
              if (!playing) setApproved(false);
              setPlaying((value) => !value);
            }}
            aria-pressed={playing}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
            {playing ? m.pause : m.play}
          </button>
        )}
      </div>
    </div>
  );
}
