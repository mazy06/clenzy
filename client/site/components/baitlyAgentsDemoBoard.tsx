import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckIcon, SearchIcon, SendIcon, StarIcon } from '../../src/icons/glyphs';
import {
  AccessTime,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit,
  GridView,
  Info,
  Lock,
  Orbit,
  Radar,
  Schedule,
  ViewList,
  VisibilityOff,
} from '../../src/icons';
import { Button } from '../../src/components/ui/button';
import { Badge } from '../../src/components/ui/badge';
import { Textarea } from '../../src/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
} from '../../src/components/ui/native-select';
import { AGENT_IDS, AGENT_META } from '../../src/modules/supervision/constants';
import AgentIcon from './SiteAgentIcon';
import { useElementSize } from '../../src/modules/supervision/core/useElementSize';
import {
  fitOrbitSide,
  orbitRadiusFor,
  orbitVerticalLayout,
  ORBIT_NODE_SIZE as NODE_SIZE,
  ORBIT_LABEL_ROOM_PX as LABEL_ROOM_PX,
} from '../../src/modules/supervision/core/orbitGeometry';
import {
  MARK_PATH,
  MARK_VIEWBOX,
  STROKE_WIDTH,
} from '../../src/components/BaitlyMarkLogo';
import {
  DATA_FLOW_STYLES,
  FLOW_DASH,
  FLOW_STROKE,
  flowPacketStyle,
} from '../../src/modules/supervision/core/dataFlow';
import type {
  AgentId,
  AutonomyLevel,
} from '../../src/modules/supervision/types';
/* Les feuilles RÉELLES des surfaces de supervision : la démo porte les mêmes
   classes que le PMS, elle ne réinvente pas leur dessin. */
import '../../src/modules/supervision/supervision-surfaces.css';
import '../../src/modules/supervision/renderers/orbit-diagram.css';
import '../../src/modules/supervision/components/action-description.css';
import '../../src/modules/supervision/components/action-illustration.css';
import '../../src/modules/supervision/components/action-modal.css';
import '../../src/modules/supervision/components/constellation-agent-list.css';
import '../../src/modules/supervision/components/constellation-toolbar.css';
import reviewsVisual from '../../public/images/hitl/reviews.webp';
import maintenanceVisual from '../../public/images/hitl/maintenance.webp';
import preventiveVisual from '../../public/images/hitl/property-maintenance.webp';
import policeVisual from '../../public/images/hitl/traveler-form.webp';
import mandateVisual from '../../public/images/hitl/management-contract.webp';
import type { AgentsDemoMessages } from '../lib/messages/baitlyAgentsDemo';
import { useSiteLanguage, type SiteLanguage } from '../lib/siteLanguage';
import { demoCalendarMonth, demoDateLabel, demoDigits, demoNumber, DEMO_TODAY } from '../lib/planningDemoLocale';

/* ─── Données ───────────────────────────────────────────────────────────────── */

/** Décisions en attente par agent — répartition réelle du logement de démo
    (environnement local, 27 suggestions ouvertes). */
export const INITIAL_COUNTS: Record<AgentId, number> = {
  rep: 15,
  own: 4,
  ops: 2,
  cmp: 2,
  gst: 1,
  rev: 1,
  sync: 1,
  com: 1,
  fin: 0,
  gro: 0,
};

/** Crans d'autonomie ; `null` = agent toujours soumis à validation. */
export const INITIAL_AUTONOMY: Record<AgentId, AutonomyLevel | null> = {
  rep: 'suggest',
  fin: 'notify',
  own: null,
  cmp: null,
  com: 'notify',
  rev: 'suggest',
  ops: 'full',
  sync: null,
  gst: null,
  gro: null,
};

export type BoardView = 'orbit' | 'cards';

interface DemoCard {
  id: string;
  agent: AgentId;
  visual: string;
  title: string;
  deadline: string;
  urgent?: boolean;
  review?: { rating: number; meta: string; quote: string; note: string };
  meter?: { label: string; value: number };
  motif?: string;
  cta: string;
  ctaIcon: 'edit' | 'schedule' | 'check' | 'send';
}

function demoCards(m: AgentsDemoMessages, language: SiteLanguage): DemoCard[] {
  const c = m.cards;
  const expires = (hours: number, minutes: number) => {
    const time = language === 'ar'
      ? `${demoNumber(hours, language)} س ${demoNumber(minutes, language)} د`
      : `${hours} h ${String(minutes).padStart(2, '0')}`;
    return `${m.board.expiresIn} ${time}`;
  };
  return [
    {
      id: 'review-laura',
      agent: 'rep',
      visual: reviewsVisual,
      title: c.review.title,
      deadline: expires(8, 22),
      review: { rating: 4, meta: c.review.meta, quote: c.review.quote, note: c.review.note },
      cta: c.review.cta,
      ctaIcon: 'edit',
    },
    {
      id: 'review-marc',
      agent: 'rep',
      visual: reviewsVisual,
      title: c.review2.title,
      deadline: expires(8, 22),
      review: { rating: 4, meta: c.review2.meta, quote: c.review2.quote, note: c.review.note },
      cta: c.review.cta,
      ctaIcon: 'edit',
    },
    {
      id: 'review-sophie',
      agent: 'rep',
      visual: reviewsVisual,
      title: c.review3.title,
      deadline: expires(8, 22),
      review: { rating: 5, meta: c.review3.meta, quote: c.review3.quote, note: c.review.note },
      cta: c.review.cta,
      ctaIcon: 'edit',
    },
    {
      id: 'lock',
      agent: 'ops',
      visual: maintenanceVisual,
      title: c.lock.title,
      deadline: expires(9, 34),
      meter: { label: c.lock.meter, value: 12 },
      motif: c.lock.motif,
      cta: c.lock.cta,
      ctaIcon: 'schedule',
    },
    {
      id: 'maintenance',
      agent: 'ops',
      visual: preventiveVisual,
      title: c.maintenance.title,
      deadline: expires(9, 34),
      motif: c.maintenance.motif,
      cta: c.lock.cta,
      ctaIcon: 'schedule',
    },
    {
      id: 'police',
      agent: 'cmp',
      visual: policeVisual,
      title: c.police.title,
      deadline: expires(0, 48),
      urgent: true,
      motif: c.police.motif,
      cta: c.police.cta,
      ctaIcon: 'check',
    },
    {
      id: 'mandate',
      agent: 'cmp',
      visual: mandateVisual,
      title: c.mandate.title,
      deadline: expires(11, 5),
      motif: c.mandate.motif,
      cta: c.mandate.cta,
      ctaIcon: 'send',
    },
  ];
}


/* ─── Plateau ───────────────────────────────────────────────────────────────── */

export interface BoardState {
  view: BoardView;
  selected: AgentId;
  counts: Record<AgentId, number>;
  autonomy: Record<AgentId, AutonomyLevel | null>;
  /** Cartes traitées : elles quittent la file (animation), puis disparaissent. */
  leaving: ReadonlySet<string>;
  gone: ReadonlySet<string>;
}

export function AgentsBoard({
  m,
  state,
  height,
  playing,
}: {
  m: AgentsDemoMessages;
  state: BoardState;
  height: number;
  playing: boolean;
}) {
  const { language } = useSiteLanguage();
  const total = Object.values(state.counts).reduce((a, b) => a + b, 0);
  const cards = demoCards(m, language).filter(
    (card) => card.agent === state.selected && !state.gone.has(card.id),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={rootRef}
      className="baitly-supervision-surface bad-board"
      data-agents-board
      style={{ height }}
    >
      <style>{DATA_FLOW_STYLES}</style>
      <header className="baitly-constellation-toolbar" data-board-header>
        <div className="baitly-constellation-toolbar__identity">
          <div className="baitly-constellation-toolbar__heading">
            <h2>{m.board.title}</h2>
            <span className="baitly-constellation-toolbar__pending bad-board-pending">
              <b>{demoNumber(total, language)}</b> {m.board.toValidate}
            </span>
          </div>
          <div className="baitly-constellation-toolbar__meta">
            <span><b>{demoNumber(10, language)}</b> {m.board.agents}</span>
            <span><b>{demoNumber(1, language)}</b> {m.board.acting}</span>
            <span className="baitly-constellation-toolbar__state" data-state="online"><i />{m.board.active}</span>
          </div>
        </div>
        <div className="baitly-constellation-toolbar__controls">
          <span className="baitly-constellation-views flex" role="group">
            <span className="baitly-constellation-view" data-view-toggle="cards" data-state={state.view === 'cards' ? 'on' : 'off'} title={m.board.cardsView}>
              <GridView size={15} strokeWidth={1.75} />{m.board.cardsLabel}
            </span>
            <span className="baitly-constellation-view" data-view-toggle="orbit" data-state={state.view === 'orbit' ? 'on' : 'off'} title={m.board.orbitView}>
              <Orbit size={15} strokeWidth={1.75} />{m.board.orbitLabel}
            </span>
            <span className="baitly-constellation-view" data-state="off">
              <ViewList size={15} strokeWidth={1.75} />{m.board.activity}
            </span>
          </span>
          <span className="baitly-constellation-tool"><Info size={15} />{m.board.report}</span>
          <span className="baitly-constellation-tool baitly-constellation-tool--scan"><Radar size={15} />{m.board.scan}</span>
        </div>
      </header>

      <div className="bad-board-content">
        {state.view === 'orbit' ? (
          <OrbitView
            m={m}
            selected={state.selected}
            counts={state.counts}
            playing={playing}
          />
        ) : (
          <AgentList m={m} state={state} />
        )}
        <div className="bad-queue" data-queue>
          <section className="baitly-supervision-surface baitly-hitl-queue baitly-hitl-queue-compact flex min-w-0 flex-col gap-3">
            {cards.map((card) => (
              <HitlCard
                key={card.id}
                card={card}
                dismiss={m.board.dismiss}
                leaving={state.leaving.has(card.id)}
              />
            ))}
          </section>
        </div>
        {state.view === 'orbit' && (
          <Tethers rootRef={rootRef} playing={playing} revision={`${state.selected}-${cards.length}`} />
        )}
      </div>
    </div>
  );
}

/* ─── Constellation (OrbitDiagram) ─────────────────────────────────────────── */

const CORE_SIZE = 15;
const FLOW_LEG_START = CORE_SIZE / 2 + 1.3;

const polar = (angle: number, radius: number) => {
  const rad = (angle * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
};

function OrbitView({
  m,
  selected,
  counts,
  playing,
}: {
  m: AgentsDemoMessages;
  selected: AgentId;
  counts: Record<AgentId, number>;
  playing: boolean;
}) {
  const { language, direction } = useSiteLanguage();
  const rtl = direction === 'rtl';
  const angleFor = (slot: number) => rtl ? 180 - slot * 36 : slot * 36;
  const slotAngle = rtl ? -135 : -45;
  const [orbitRef, box] = useElementSize<HTMLDivElement>();
  const squareRef = useRef<HTMLDivElement>(null);
  const [vertical, setVertical] = useState({ room: LABEL_ROOM_PX, offset: 0 });
  const side = fitOrbitSide(box.width, box.height, vertical.room);
  const radius = orbitRadiusFor(side);
  const index = AGENT_IDS.indexOf(selected);
  // Comme dans le PMS, les portraits ne gardent aucune couche tournée au repos.
  const rotationRef = useRef(slotAngle - angleFor(index));
  const [rotation, setRotation] = useState(rotationRef.current);
  const [settledRotation, setSettledRotation] = useState(rotationRef.current);
  const [rotating, setRotating] = useState(false);
  useEffect(() => {
    let target = slotAngle - (rtl ? 180 - index * 36 : index * 36);
    while (target - rotationRef.current > 180) target -= 360;
    while (target - rotationRef.current < -180) target += 360;
    const changed = Math.abs(target - rotationRef.current) > 0.5;
    rotationRef.current = target;
    setRotation(target);
    if (!changed || !playing) {
      setSettledRotation(target);
      setRotating(false);
      return;
    }
    setRotating(true);
    const timer = window.setTimeout(() => {
      setSettledRotation(target);
      setRotating(false);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [index, rtl, slotAngle, playing]);
  const visualRotation = rotation - settledRotation;

  useLayoutEffect(() => {
    const square = squareRef.current;
    if (!square || side <= 0 || rotating) return;
    const elements = [...square.querySelectorAll<HTMLElement>(
      '.baitly-orbit-node, .baitly-orbit-count, .bad-orbit-label, .baitly-orbit-core',
    )];
    const measure = () => {
      const origin = square.getBoundingClientRect();
      const scale = origin.height / side;
      if (scale <= 0) return;
      const bounds = elements.map(element => element.getBoundingClientRect()).filter(rect => rect.height > 0);
      if (!bounds.length) return;
      const next = orbitVerticalLayout(side,
        (Math.min(...bounds.map(rect => rect.top)) - origin.top) / scale,
        (Math.max(...bounds.map(rect => rect.bottom)) - origin.top) / scale);
      setVertical(previous => Math.abs(previous.room - next.room) < .5 && Math.abs(previous.offset - next.offset) < .5 ? previous : next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    elements.forEach(element => observer.observe(element));
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [side, selected, counts, language, rotating, settledRotation, box.width, box.height]);

  return (
    <div ref={orbitRef} className="baitly-supervision-surface baitly-orbit bad-orbit" data-orbit data-rotating={rotating || undefined}>
      <div
        ref={squareRef}
        data-supervision-constellation
        className="relative aspect-square shrink-0"
        style={side > 0
          ? { width: side, height: side, transform: `translateY(${vertical.offset}px)` }
          : { width: '100%' }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          <circle cx="50" cy="50" r={radius} fill="none" className="baitly-orbit-track" vectorEffect="non-scaling-stroke" strokeWidth="1" />
        </svg>
        <div className="oc-ring absolute inset-0" style={{ transform: rotating ? `rotate(${visualRotation}deg)` : 'none' }}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
            {AGENT_IDS.map((id, i) => {
              const from = polar(angleFor(i) + settledRotation, FLOW_LEG_START);
              const to = polar(angleFor(i) + settledRotation, radius - NODE_SIZE / 2 - 0.6);
              const length = radius - NODE_SIZE / 2 - 0.6 - FLOW_LEG_START;
              const focused = id === selected;
              return (
                <g key={id} className="oc-flow" data-focused={focused || undefined} data-selected={(focused && playing) || undefined}>
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} vectorEffect="non-scaling-stroke" strokeWidth="1" className="baitly-orbit-spoke" />
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    strokeWidth={FLOW_STROKE}
                    className="oc-packet baitly-data-packet"
                    style={flowPacketStyle(length, FLOW_DASH, '0ms')}
                  />
                </g>
              );
            })}
          </svg>
          {AGENT_IDS.map((id, i) => {
            const point = polar(angleFor(i) + settledRotation, radius);
            const pending = counts[id];
            const isSelected = id === selected;
            const working = id === 'gro';
            const waiting = pending > 0;
            return (
              <div
                key={id}
                className="oc-node absolute"
                data-orbit-node={id}
                data-selected={isSelected || undefined}
                data-waiting={waiting || undefined}
                data-working={working || undefined}
                data-animating={(working && playing) || undefined}
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  width: `${NODE_SIZE}%`,
                  height: `${NODE_SIZE}%`,
                  transform: rotating ? `translate(-50%, -50%) rotate(${-visualRotation}deg)` : 'translate(-50%, -50%)',
                }}
              >
                <svg className="baitly-orbit-rim" viewBox="0 0 100 100" aria-hidden>
                  <circle className="baitly-orbit-rim-track" cx="50" cy="50" r="47" />
                  {working && (
                    <circle className="baitly-orbit-progress" data-indeterminate cx="50" cy="50" r="47" pathLength="100" strokeDasharray="24 100" />
                  )}
                </svg>
                <span
                  className="baitly-orbit-node"
                  data-status={waiting ? 'wait' : working ? 'act' : 'veille'}
                  aria-pressed={isSelected}
                >
                  <span className="baitly-orbit-icon" aria-hidden>
                    <AgentIcon token={AGENT_META[id].icon} size={28} strokeWidth={1.6} />
                  </span>
                  {pending > 0 ? (
                    <span className="baitly-orbit-count" data-kind="pending">
                      <bdi dir="ltr">{demoNumber(pending, language)}</bdi>
                    </span>
                  ) : null}
                  {working && <span className="baitly-orbit-activity-dot" aria-hidden />}
                </span>
                {isSelected && (
                  /* Anneau serré : seule la légende de l'agent ouvert, posée
                     AU-DESSUS du nœud (moitié haute) et poussée vers
                     l'extérieur — comme OrbitAgentLabel du diagramme réel. */
                  <span className="bad-orbit-label" data-above>
                    <span className="baitly-orbit-name text-xs font-medium whitespace-nowrap">
                      {m.agents[id][0]}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div
          className="baitly-orbit-core absolute inset-0 m-auto flex items-center justify-center rounded-full"
          style={{ width: `${CORE_SIZE}%`, height: `${CORE_SIZE}%` }}
        >
          <svg viewBox={MARK_VIEWBOX} className="size-1/2" fill="none" aria-hidden>
            <path d={MARK_PATH} stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/** Attaches agent de tête → cartes de la file (SupervisionTethers). */
function Tethers({
  rootRef,
  playing,
  revision,
}: {
  rootRef: React.RefObject<HTMLDivElement>;
  playing: boolean;
  revision: string;
}) {
  const { direction } = useSiteLanguage();
  const rtl = direction === 'rtl';
  const [paths, setPaths] = useState<{ d: string; length: number; key: string }[]>([]);
  useLayoutEffect(() => {
    let frame = 0;
    let previous = '';
    let settleUntil = performance.now() + 900;
    const measure = () => {
      const root = rootRef.current;
      const content = root?.querySelector<HTMLElement>('.bad-board-content');
      const node = root?.querySelector<HTMLElement>('[data-orbit-node][data-selected] .baitly-orbit-node');
      const queue = root?.querySelector<HTMLElement>('[data-queue]');
      if (!root || !content || !node || !queue) return;
      const scale = root.getBoundingClientRect().width / root.offsetWidth || 1;
      const base = content.getBoundingClientRect();
      const clip = queue.getBoundingClientRect();
      const n = node.getBoundingClientRect();
      const x1 = ((rtl ? n.left : n.right) - base.left) / scale;
      const y1 = (n.top + n.height / 2 - base.top) / scale;
      const next = [...root.querySelectorAll<HTMLElement>('[data-hitl-card]:not([data-leaving])')]
        .map((card) => {
          const r = card.getBoundingClientRect();
          const y = Math.max(r.top + 40, Math.min(r.bottom - 40, r.top + 60));
          if (y < clip.top || y > clip.bottom) return null;
          const x2 = ((rtl ? r.right : r.left) - base.left) / scale;
          const y2 = (y - base.top) / scale;
          const dx = (rtl ? -1 : 1) * Math.max(30, Math.abs(x2 - x1) / 2);
          return {
            key: card.dataset.card ?? '',
            d: `M${x1.toFixed(1)} ${y1.toFixed(1)} C${(x1 + dx).toFixed(1)} ${y1.toFixed(1)} ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
            length: Math.hypot(x2 - x1, y2 - y1) * 1.12,
          };
        })
        .filter((p): p is { d: string; length: number; key: string } => p !== null);
      const signature = JSON.stringify(next);
      if (signature !== previous) {
        previous = signature;
        setPaths(next);
      }
    };
    const follow = () => {
      measure();
      if (playing || performance.now() < settleUntil) frame = requestAnimationFrame(follow);
    };
    follow();
    // La maquette peut être redimensionnée en pause : ses attaches doivent
    // suivre le même repère que les nœuds, même sans boucle d'animation.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const content = rootRef.current?.querySelector<HTMLElement>('.bad-board-content');
    const orbit = rootRef.current?.querySelector<HTMLElement>('[data-supervision-constellation]');
    if (content) observer?.observe(content);
    if (orbit) observer?.observe(orbit);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      settleUntil = 0;
    };
  }, [rootRef, playing, revision, rtl]);
  return (
    <svg className="bad-tethers" aria-hidden>
      {paths.map((p) => (
        <g key={p.key}>
          <path d={p.d} className="bad-tether" />
          {playing && (
            <path d={p.d} className="baitly-data-packet" strokeWidth={1.5} style={flowPacketStyle(p.length, 14, '0ms')} />
          )}
        </g>
      ))}
    </svg>
  );
}

/* ─── Vue agents (ConstellationAgentCards) ─────────────────────────────────── */

function AgentList({ m, state }: { m: AgentsDemoMessages; state: BoardState }) {
  const { language } = useSiteLanguage();
  // Ce qui réclame une décision d'abord, la veille en bas.
  const ordered = [...AGENT_IDS].sort((a, b) => {
    const wa = state.counts[a] > 0;
    const wb = state.counts[b] > 0;
    if (wa !== wb) return wa ? -1 : 1;
    if (a === 'gro') return -1;
    if (b === 'gro') return 1;
    return state.counts[b] - state.counts[a];
  });
  return (
    <section className="baitly-supervision-surface baitly-agent-list" data-agent-list>
      <ul className="baitly-agent-list-rows">
        {ordered.map((id) => {
          const pending = state.counts[id];
          const working = id === 'gro';
          const level = state.autonomy[id];
          return (
            <li
              key={id}
              data-agent-row={id}
              data-selected={id === state.selected || undefined}
              data-working={working || undefined}
              className="baitly-agent-list-row"
            >
              <span className="baitly-agent-list-select" data-agent-select={id}>
                <span className="baitly-agent-list-emblem" aria-hidden="true">
                  <AgentIcon token={AGENT_META[id].icon} size={18} strokeWidth={1.75} />
                  {working && <span className="baitly-agent-list-activity" />}
                </span>
                <span className="baitly-agent-list-identity">
                  <span className="baitly-agent-list-name">{m.agents[id][0]}</span>
                </span>
                <span className="baitly-agent-list-state">
                  {pending > 0 ? (
                    <Badge variant="warning" className="baitly-agent-list-count whitespace-normal">
                      <strong>{demoNumber(pending, language)}</strong>{' '}
                      <span className="baitly-agent-list-count-label">{m.board.toValidate}</span>
                    </Badge>
                  ) : (
                    <span className="baitly-agent-list-status">
                      <span className="baitly-agent-list-dot" aria-hidden="true" />
                      <span>{working ? m.growthTask : m.status.veille}</span>
                    </span>
                  )}
                </span>
              </span>
              <div className="baitly-agent-list-autonomy" data-autonomy={id}>
                {level ? (
                  <NativeSelect value={level} onChange={() => {}} tabIndex={-1} className="baitly-agent-list-mode">
                    {(['suggest', 'notify', 'full'] as const).map((choice) => (
                      <NativeSelectOption key={choice} value={choice}>
                        {m.autonomy[choice]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <span className="baitly-agent-list-locked">
                    <Lock size={14} aria-hidden="true" />
                    {m.board.alwaysValidated}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ─── Carte HITL (ConstellationQueue, mode compact) ────────────────────────── */

const CTA_ICONS = {
  edit: <Edit size={15} />,
  schedule: <Schedule size={15} />,
  check: <Check size={15} />,
  send: <SendIcon size={15} />,
};

function HitlCard({ card, dismiss, leaving }: { card: DemoCard; dismiss: string; leaving: boolean }) {
  const { language } = useSiteLanguage();
  return (
    <article
      className="baitly-hitl-card bad-card"
      data-hitl-card
      data-card={card.id}
      data-urgent={card.urgent || undefined}
      data-leaving={leaving || undefined}
    >
      <div className="baitly-hitl-content">
        <div className="baitly-action-illustrated-heading" data-illustrated>
          <span className="baitly-action-illustration" aria-hidden="true">
            <img src={card.visual} alt="" width={80} height={80} loading="lazy" />
          </span>
          <div className="baitly-action-heading-copy">
            <h3 dir="auto" className="m-0 text-[15px] leading-snug font-semibold text-foreground [overflow-wrap:anywhere]">
              {card.title}
            </h3>
            <span className="baitly-hitl-deadline inline-flex w-fit items-center gap-1.5 tabular-nums">
              <Schedule size={12} aria-hidden />
              {card.deadline}
            </span>
          </div>
        </div>
        <div className="baitly-supervision-surface baitly-action-description">
          {card.review ? (
            <>
              <div className="baitly-description-review-meta">
                <span className="baitly-description-rating">
                  <StarIcon size={15} aria-hidden />
                  <strong><bdi dir="ltr">{demoDigits(`${card.review.rating}/5`, language)}</bdi></strong>
                </span>
                <span dir="auto">{card.review.meta}</span>
              </div>
              <blockquote dir="auto" className="baitly-description-quote">
                {card.review.quote}
              </blockquote>
              <div className="baitly-description-narrative">
                <p dir="auto">{card.review.note}</p>
              </div>
            </>
          ) : (
            <>
              {card.meter && (
                <div className="baitly-description-meter-group">
                  <div className="baitly-description-meter-label">
                    <span>{card.meter.label}</span>
                    <strong>{demoNumber(card.meter.value / 100, language, { style: 'percent' })}</strong>
                  </div>
                  <div className="baitly-description-meter">
                    <span style={{ width: `${card.meter.value}%` }} />
                  </div>
                </div>
              )}
              <div className="baitly-description-narrative">
                <p dir="auto">{card.motif}</p>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="baitly-hitl-actions flex flex-wrap items-center gap-2">
        <Button size="sm" tabIndex={-1} className="baitly-hitl-primary" data-cta={card.id}>
          {CTA_ICONS[card.ctaIcon]}
          {card.cta}
        </Button>
        <Button size="sm" variant="ghost" tabIndex={-1} className="baitly-hitl-secondary">
          <VisibilityOff size={14} />
          {dismiss}
        </Button>
      </div>
    </article>
  );
}

/* ─── Modales (ActionModal) ─────────────────────────────────────────────────── */

function DemoModal({
  agent,
  agentName,
  visual,
  title,
  description,
  width,
  maxHeight,
  panel,
  bodyRef,
  footer,
  children,
}: {
  agent: AgentId;
  agentName: string;
  visual: string;
  title: string;
  description: string;
  width: number;
  maxHeight: number;
  panel: string;
  bodyRef?: React.RefObject<HTMLDivElement>;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bad-modal-layer">
      <div
        className="baitly-supervision-surface baitly-action-modal bad-modal"
        data-planning-panel={panel}
        style={{ maxWidth: width, maxHeight }}
      >
        <div data-slot="dialog-header" className="cn-dialog-header flex flex-col baitly-action-modal-header">
          <div className="baitly-action-modal-agent">
            <AgentIcon token={AGENT_META[agent].icon} size={16} strokeWidth={1.75} />
            <span>{agentName}</span>
          </div>
          <div className="baitly-action-illustrated-heading" data-illustrated>
            <span className="baitly-action-illustration" aria-hidden="true">
              <img src={visual} alt="" width={80} height={80} />
            </span>
            <div className="baitly-action-heading-copy">
              <h2 data-slot="dialog-title">{title}</h2>
              <p data-slot="dialog-description">{description}</p>
            </div>
          </div>
        </div>
        <div className="baitly-action-modal-body" ref={bodyRef}>
          {children}
        </div>
        <div data-slot="dialog-footer" className="flex flex-row flex-wrap justify-end">
          {footer}
        </div>
      </div>
    </div>
  );
}

function Consequences({ title, facts }: { title: string; facts: readonly string[] }) {
  return (
    <section className="baitly-action-modal-section">
      <h3>{title}</h3>
      <ul className="baitly-action-modal-facts">
        {facts.map((fact) => (
          <li key={fact}>
            <div className="baitly-description-narrative">
              <p>{fact}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface ReplyState {
  inserted: boolean;
  text: string;
  publishing: boolean;
}

export function ReplyModal({
  m,
  state,
  maxHeight,
  bodyRef,
}: {
  m: AgentsDemoMessages;
  state: ReplyState;
  maxHeight: number;
  bodyRef: React.RefObject<HTMLDivElement>;
}) {
  const r = m.reply;
  const { language } = useSiteLanguage();
  const draft = r.draftStart + r.vague + r.draftEnd;
  return (
    <DemoModal
      agent="rep"
      agentName={m.agents.rep[0]}
      visual={reviewsVisual}
      title={r.title}
      description={m.cards.review.title}
      width={640}
      maxHeight={maxHeight}
      panel="reply"
      bodyRef={bodyRef}
      footer={
        <>
          <Button variant="ghost" tabIndex={-1}>
            {r.cancel}
          </Button>
          <Button tabIndex={-1} disabled={!state.text.trim()} data-reply-publish>
            {r.publish}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <span className="bad-avatar" aria-hidden>
          LD
        </span>
        <span className="min-w-0 flex-1 font-medium">{r.guest}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums">
          <StarIcon className="size-4 text-[var(--bui-warning-ink)]" />{demoNumber(4, language)}
        </span>
      </div>
      <blockquote className="baitly-action-message">{m.cards.review.quote}</blockquote>
      <div className="baitly-review-proposal" data-reply-proposal>
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="text-sm font-semibold">{r.proposalTitle}</h3>
          <Badge variant="warning" className="ms-auto">
            {r.awaiting}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{r.proposalLead}</p>
        <p className="my-3 text-sm leading-relaxed whitespace-pre-wrap">« {draft} »</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="xs" tabIndex={-1} data-reply-insert>
            <CheckIcon className="size-3" />
            {r.insert}
          </Button>
          <Button size="xs" variant="outline" tabIndex={-1}>
            {r.dismiss}
          </Button>
          <span className="ms-auto text-[11px] text-muted-foreground">{r.orWrite}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2" data-reply-text>
        <label className="text-sm font-medium">{r.yourReply}</label>
        <Textarea value={state.text} readOnly rows={5} tabIndex={-1} data-typing={state.inserted || undefined} />
      </div>
      <Consequences title={r.consequences} facts={r.facts} />
    </DemoModal>
  );
}

export function ScheduleModal({
  m,
  day,
  assigned,
  maxHeight,
}: {
  m: AgentsDemoMessages;
  day: number;
  assigned: boolean;
  maxHeight: number;
}) {
  const s = m.schedule;
  const { language } = useSiteLanguage();
  const calendar = useMemo(() => demoCalendarMonth(language), [language]);
  const selectedDate = `2026-09-${day}`;
  return (
    <DemoModal
      agent="ops"
      agentName={m.agents.ops[0]}
      visual={maintenanceVisual}
      title={s.title}
      description={m.cards.lock.title}
      width={720}
      maxHeight={maxHeight}
      panel="schedule"
      footer={
        <>
          <Button variant="ghost" tabIndex={-1}>
            {s.cancel}
          </Button>
          <Button tabIndex={-1} data-schedule-confirm>
            {s.confirm}
          </Button>
        </>
      }
    >
      <div className="baitly-schedule-layout">
        <div className="min-w-0 space-y-4">
          <div className="bad-calendar">
            <div className="bad-calendar-head">
              <ChevronLeft className="bpm-directional-icon" size={15} />
              <strong>{calendar.title}</strong>
              <ChevronRight className="bpm-directional-icon" size={15} />
            </div>
            <div className="bad-calendar-grid">
              {calendar.weekdays.map(({ label, title }) => (
                <span key={title} title={title} className="bad-calendar-weekday">
                  {label}
                </span>
              ))}
              {calendar.cells.map((value, index) =>
                value === null ? (
                  <span key={`blank-${index}`} />
                ) : (
                  <span
                    key={value.toISOString()}
                    data-day={value.toISOString().slice(0, 10)}
                    data-disabled={value < new Date(DEMO_TODAY) || undefined}
                    data-today={value.toISOString().startsWith(DEMO_TODAY) || undefined}
                    data-selected={value.toISOString().startsWith(selectedDate) || undefined}
                    title={demoDateLabel(value, language, { dateStyle: 'full' })}
                    className="bad-calendar-day"
                  >
                    {demoDateLabel(value, language, { day: 'numeric' })}
                  </span>
                ),
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{s.time}</label>
            <span className="bad-input tabular-nums">
              <bdi dir="ltr">{demoDigits('10:00', language)}</bdi>
              <AccessTime size={14} />
            </span>
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <label className="mb-2 text-sm font-medium">{s.assignee}</label>
          <div className="bad-command">
            <div className="bad-command-search">
              <SearchIcon size={15} />
              {s.search}
            </div>
            <p className="bad-command-heading">{s.matching}</p>
            {s.workers.map(([name, role], index) => (
              <Assignee key={name} name={name} role={role} selected={assigned && index === 0} dataKey={index === 0 ? 'youssef' : undefined} />
            ))}
            <p className="bad-command-heading">{s.others}</p>
            {s.otherWorkers.map(([name, role]) => (
              <Assignee key={name} name={name} role={role} selected={false} />
            ))}
            <p className="bad-command-heading">{s.orgTeam}</p>
            <Assignee name={s.myself} role="" selected={false} initials="TM" />
          </div>
        </div>
      </div>
      <p className="baitly-action-modal-readback" data-schedule-readback>
        {assigned ? s.readback : day === 28 ? s.readbackDay : s.readbackBefore}
      </p>
    </DemoModal>
  );
}

function Assignee({
  name,
  role,
  selected,
  dataKey,
  initials,
}: {
  name: string;
  role: string;
  selected: boolean;
  dataKey?: string;
  initials?: string;
}) {
  const letters = initials ?? name.split(' ').map((part) => part[0]).join('').slice(0, 2);
  return (
    <div className="bad-command-item" data-selected={selected || undefined} data-assignee={dataKey}>
      <span className="bad-avatar bad-avatar-sm" aria-hidden>
        {letters}
      </span>
      <span dir="auto" className="min-w-0 flex-1 truncate">
        {name}
      </span>
      <span className="shrink-0 text-xs text-[var(--bui-muted-foreground)]">{role}</span>
      {selected && <Check size={15} className="shrink-0 text-[var(--bui-supervision-ink)]" />}
    </div>
  );
}

export function PoliceModal({ m, maxHeight }: { m: AgentsDemoMessages; maxHeight: number }) {
  return (
    <DemoModal
      agent="cmp"
      agentName={m.agents.cmp[0]}
      visual={policeVisual}
      title={m.police.title}
      description={m.cards.police.title}
      width={520}
      maxHeight={maxHeight}
      panel="police"
      footer={
        <>
          <Button variant="ghost" tabIndex={-1}>
            {m.police.cancel}
          </Button>
          <Button tabIndex={-1} data-police-confirm>
            <Check size={15} />
            {m.cards.police.cta}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="baitly-supervision-surface baitly-action-description">
          <div className="baitly-description-narrative">
            <p dir="auto">{m.cards.police.motif}</p>
          </div>
        </div>
        <Consequences title={m.reply.consequences} facts={m.police.facts} />
      </div>
    </DemoModal>
  );
}
