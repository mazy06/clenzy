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
import riadPhoto from '../assets/photos/baitly-riad-small.webp';

const SCENARIOS = [
  {
    name: 'Revenue',
    icon: TrendingUpIcon,
    description: 'Le bon tarif, au bon moment.',
    title: 'Trois nuits cherchent leurs voyageurs.',
    copy: 'La demande ralentit du 21 au 24 septembre. Une baisse ciblée peut rendre votre annonce plus attractive.',
    detail: 'Prix par nuit',
    before: '520 SAR',
    after: '470 SAR',
    note: 'Votre plancher de 450 SAR est respecté.',
    action: 'Approuver le tarif',
    done: 'Nouveau tarif appliqué aux dates proposées.',
  },
  {
    name: 'Séjours',
    icon: MessageCircleIcon,
    description: 'La bonne attention, avant l’arrivée.',
    title: 'Leur arrivée est demain. Tout est prêt.',
    copy: 'Le message d’accueil rassemble l’itinéraire, les horaires et le lien vers le livret de votre logement.',
    detail: 'Message proposé',
    before: 'Brouillon',
    after: 'Prêt à envoyer',
    note: '« Bonjour Sophie, nous avons hâte de vous accueillir… »',
    action: 'Envoyer le message',
    done: 'Message d’accueil envoyé. Historique mis à jour.',
  },
  {
    name: 'Opérations',
    icon: CheckCheckIcon,
    description: 'Une équipe qui sait quoi faire.',
    title: 'Un départ à 11 h. Une arrivée à 16 h.',
    copy: 'La mission de ménage est préparée entre les deux séjours, avec la checklist propre au logement.',
    detail: 'Créneau proposé',
    before: 'Départ · 11 h',
    after: 'Ménage · 11 h 30',
    note: 'Checklist et consignes prêtes pour votre équipe.',
    action: 'Valider la mission',
    done: 'Mission validée. L’équipe retrouve ses consignes.',
  },
  {
    name: 'Distribution',
    icon: RefreshCwIcon,
    description: 'Tous vos canaux à l’unisson.',
    title: 'Une réservation. Tous les calendriers à jour.',
    copy: 'Le séjour reçu sur Airbnb ferme les mêmes dates sur vos autres canaux connectés.',
    detail: 'Dates du séjour',
    before: '14 sept.',
    after: '18 sept.',
    note: 'Airbnb, Booking.com et votre site direct.',
    action: 'Voir la synchronisation',
    done: 'Disponibilités synchronisées sur les canaux connectés.',
  },
];

/** Démonstration locale : aucune action ne modifie un logement ni une réservation. */
function useAgentDemo() {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [approved, setApproved] = useState(false);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const scenario = SCENARIOS[selected];

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
      setSelected((index) => (index + 1) % SCENARIOS.length);
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
    selectScenario,
    setApproved,
    setPlaying,
  };
}

export default function BaitlyAgentDemo() {
  const demo = useAgentDemo();
  const { selected, sectionRef, selectScenario } = demo;

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
              <SparklesIcon /> L’intelligence qui passe à l’action
            </p>
            <h2 id="agents-title">
              Une équipe en coulisses.
              <br />
              Vous, aux commandes.
            </h2>
          </div>
          <p>
            Ils repèrent, préparent et vous proposent.
            <br />
            Vous gardez le dernier mot.
          </p>
        </Reveal>
        <div className="baitly-agent-layout">
          <div
            className="baitly-agent-choices"
            aria-label="Choisir un agent à découvrir"
          >
            {SCENARIOS.map((agent, index) => (
              <button
                type="button"
                key={agent.name}
                aria-pressed={selected === index}
                aria-controls="baitly-agent-scene"
                onClick={() => selectScenario(index)}
              >
                <agent.icon />
                <span>
                  <strong>Agent {agent.name}</strong>
                  <small>{agent.description}</small>
                </span>
                <ArrowRightIcon />
              </button>
            ))}
            <Link to="/produit/agents-ia" className="baitly-text-link">
              Faire connaissance avec les agents <ArrowRightIcon />
            </Link>
          </div>
          <AgentScene demo={demo} />
        </div>
        <p className="baitly-demo-caption">
          Données et actions d’illustration. Dans votre espace, vous définissez
          les règles et le niveau d’autonomie de chaque agent.
        </p>
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
    setApproved,
    setPlaying,
  } = demo;
  return (
    <div className="baitly-demo-window" id="baitly-agent-scene">
      <div className="baitly-demo-top">
        <span>
          <SparklesIcon /> Baitly <span>/</span> Votre espace de décision
        </span>
        <span className="baitly-demo-badge">Démo interactive</span>
      </div>
      <div className="baitly-demo-property">
        <img src={riadPhoto} alt="" width="56" height="56" loading="lazy" />
        <div>
          <strong>Riad Azur</strong>
          <span>Riyad · Exemple de logement</span>
        </div>
        <CalendarDaysIcon />
      </div>
      <div className="baitly-demo-content" key={selected}>
        <p className="baitly-demo-agent">
          <scenario.icon /> Agent {scenario.name}
          <span>{approved ? 'Terminé' : 'À votre attention'}</span>
        </p>
        <h3>{scenario.title}</h3>
        <p>{scenario.copy}</p>
        <div className="baitly-demo-proposal">
          <span>{scenario.detail}</span>
          <div>
            <span>{scenario.before}</span>
            <ArrowRightIcon />
            <strong>{scenario.after}</strong>
          </div>
        </div>
        <p className="baitly-demo-note">
          <CircleCheckIcon aria-hidden="true" />
          {scenario.note}
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
              <span>Vous décidez.</span>
            </>
          )}
        </div>
      </div>
      <div className="baitly-demo-controls">
        <span>
          <i />
          {playing && inView
            ? 'Scénario en lecture'
            : 'Essayez : choisissez un agent et approuvez.'}
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
            {playing ? 'Pause' : 'Lire la démo'}
          </button>
        )}
      </div>
    </div>
  );
}
