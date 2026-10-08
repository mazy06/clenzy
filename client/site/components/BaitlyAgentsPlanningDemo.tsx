import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import {
  BuildingIcon,
  CalendarCheckIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClipboardCheckIcon,
  EditIcon,
  HomeIcon,
  LayoutGridIcon,
  LayoutListIcon,
  MessageSquareTextIcon,
  OrbitIcon,
  PauseIcon,
  PlayIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  StarIcon,
  UsersIcon,
  Volume2Icon,
  VolumeXIcon,
  WalletIcon,
  WrenchIcon,
} from '../../src/icons/glyphs';
import { Label as TagIcon, WrenchFill } from '../../src/icons';
import BaitlyMarkLogo from '../../src/components/BaitlyMarkLogo';
import type { AgentId } from '../../src/modules/supervision/types';
import { Cursor, useScriptedCursor } from './mockupKit';
import { useBaitlyDemoVisibility } from './useBaitlyDemoVisibility';
import { useBaitlyPlanningTimeline } from './useBaitlyPlanningTimeline';
import { useDemoNarration } from './useDemoNarration';
import BaitlyPlanningCallout, {
  type CalloutGuide,
  type PlanningAnnotation,
} from './BaitlyPlanningCallout';
import {
  Bar,
  BlockedBand,
  CancelledBar,
  DAY_W,
  DAYS,
  DESIGN_WIDTH,
  DateHeaders,
  FRAME_WIDTH,
  HEADER_H,
  PROPERTY_PHOTOS,
  PROP_W,
  RESAS,
  ROW_H,
  Row,
  TODAY_INDEX,
  TOKENS,
  Toolbar,
  UNIT_COUNTS,
  isWeekend,
  usePlanningText,
} from './AnimatedPlanningMockup';
import {
  AgentsBoard,
  INITIAL_AUTONOMY,
  INITIAL_COUNTS,
  PoliceModal,
  ReplyModal,
  ScheduleModal,
  type BoardState,
  type ReplyState,
} from './baitlyAgentsDemoBoard';
import { useSiteLanguage, type SiteLanguage } from '../lib/siteLanguage';
import {
  AGENTS_DEMO_MESSAGES,
  AGENTS_DEMO_PROPERTY_INDEX as IDX,
  type AgentsDemoMessages,
} from '../lib/messages/baitlyAgentsDemo';

/**
 * Démo guidée de la page d'accueil : le planning, puis la constellation
 * d'agents d'un logement déplié, ses cartes HITL et la vue Agents.
 *
 * Gestes rejoués, tous réels dans le PMS (PlanningPage → SupervisionPanel) :
 *  1. déplier un logement (chevron) → planning réduit à ce logement + plateau ;
 *  2. avis Réputation : « Répondre » → brouillon IA → insérer → ajuster → publier ;
 *  3. agent Opérations : batterie de serrure → « Planifier » (date, intervenant) ;
 *  4. vue Agents : fiche de police → confirmation → télédéclarée ;
 *  5. autonomie de l'agent Revenue : « Suggérer » → « Agir puis notifier ».
 *
 * Données locales, aucune requête. Hauteur fixe : la page ne bouge jamais.
 * Voix off optionnelle (coupée par défaut : la lecture sonore exige un geste).
 */

import { demoNumber } from '../lib/planningDemoLocale';

const FRAME_H = 740;
export { FRAME_H as AGENTS_FRAME_HEIGHT };
const TOOLBAR_H = 50;
const FILTERS_H = 57;
const PAGINATION_H = 50;
const PLANNING_BODY_H =
  FRAME_H - TOOLBAR_H - FILTERS_H - HEADER_H - 30 - 2 - PAGINATION_H;
const BOARD_H = FRAME_H - TOOLBAR_H - 8 - HEADER_H - ROW_H - PAGINATION_H - 4;

/* Voix off : un MP3 par étape et par langue, chargés à la demande. */
const CLIPS = import.meta.glob('../assets/voice/agents-demo/*/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const clipUrl = (language: SiteLanguage, step: number) =>
  CLIPS[
    `../assets/voice/agents-demo/${language}/${String(step).padStart(2, '0')}.mp3`
  ];

/**
 * Repères de la voix off, en ms depuis le début de chaque étape : début de la
 * phrase (fin du silence précédent, mesuré par `ffmpeg silencedetect` sur les
 * clips de `assets/voice/agents-demo`) où la voix nomme l'élément montré, et
 * `end` = fin du clip. Régénérer un clip impose de remesurer ses repères.
 * L'arabe, sans voix off, suit le rythme français.
 */
type StepCues = Record<string, number>;
const VOICE_CUES: Record<'fr' | 'en', StepCues[]> = {
  fr: [
    { end: 6300 },
    { click: 1800, board: 2390, end: 6100 },
    { badge: 3040, total: 6100, end: 7350 },
    { card: 3650, cta: 7700, end: 9600 },
    { click: 1250, proposal: 1820, insert: 5740, end: 8780 },
    { edit: 1390, publish: 6150, leave: 7170, end: 8480 },
    { click: 1300, meter: 4570, card: 7840, end: 10870 },
    { open: 1300, assignee: 2900, day: 4130, time: 5660, worker: 6700, done: 7900, end: 8830 },
    { click: 700, list: 1240, top: 4350, autonomy: 6970, end: 8250 },
    { click: 1000, card: 1600, button: 3660, open: 4450, consequences: 5280, confirm: 7470, end: 8100 },
    { change: 2500, locked: 3470, release: 7290, end: 8270 },
  ],
  en: [
    { end: 7230 },
    { click: 2000, board: 2730, end: 7360 },
    { badge: 3240, total: 5990, end: 7500 },
    { card: 4360, cta: 9280, end: 11290 },
    { click: 1050, proposal: 1580, insert: 4600, end: 7880 },
    { edit: 1620, publish: 6760, leave: 7610, end: 8940 },
    { click: 1300, meter: 4840, card: 7620, end: 10160 },
    { open: 1200, assignee: 2600, day: 3950, time: 4610, worker: 5480, done: 6520, end: 8750 },
    { click: 800, list: 1500, top: 4360, autonomy: 6850, end: 8390 },
    { click: 1000, card: 1650, button: 3600, open: 4450, consequences: 5250, confirm: 7460, end: 8110 },
    { change: 2700, locked: 4110, release: 7150, end: 8430 },
  ],
};
/** Le cadre précède légèrement le mot : l'œil est sur l'élément quand la
    voix le nomme (sinon il paraît en retard). */
const FRAME_LEAD_MS = 300;
/** Silence entre deux étapes : le cadre s'efface avec la fin de la phrase. */
const STEP_GAP_MS = 500;
/** Le curseur scripté met 800 ms à rejoindre sa cible (mockupKit). */
const CURSOR_TRAVEL_MS = 750;

const GUIDE_ICONS = [
  CalendarIcon,
  ChevronDownIcon,
  OrbitIcon,
  StarIcon,
  MessageSquareTextIcon,
  EditIcon,
  WrenchIcon,
  ClipboardCheckIcon,
  LayoutListIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
];

const INITIAL_BOARD: BoardState = {
  view: 'orbit',
  selected: 'rep',
  counts: INITIAL_COUNTS,
  autonomy: INITIAL_AUTONOMY,
  leaving: new Set(),
  gone: new Set(),
};

export default function BaitlyAgentsPlanningDemo() {
  const { language, direction } = useSiteLanguage();
  const m = AGENTS_DEMO_MESSAGES[language];
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  /* Voix active à la première lecture, coupée d'office après la première
     boucle (la démo continue de tourner). Si le navigateur refuse la lecture
     sonore sans geste, la voix démarre au premier clic ou à la première
     touche sur la page. */
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceBlocked, setVoiceBlocked] = useState(false);
  const [voiceHint, setVoiceHint] = useState(false);
  const [annotation, setAnnotation] = useState<PlanningAnnotation | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { visibilityRef, active, reduced } = useBaitlyDemoVisibility();
  const playing = active && !paused;
  const voiceAudible = voiceOn && !voiceBlocked;
  const voice = useDemoNarration(clipUrl, language, voiceAudible && playing, () =>
    setVoiceBlocked(true),
  );
  const hasVoice = Boolean(clipUrl(language, 0));
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const loops = useRef(0);

  useEffect(() => {
    if (!voiceBlocked) return;
    const unlock = (event: Event) => {
      // Le bouton de voix gère lui-même son clic.
      if ((event.target as Element | null)?.closest?.('[data-voice-toggle]')) return;
      setVoiceBlocked(false);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [voiceBlocked]);

  const toggleVoice = () => {
    setVoiceHint(false);
    if (voiceAudible) {
      setVoiceOn(false);
      return;
    }
    setVoiceBlocked(false);
    setVoiceOn(true);
  };

  const guide: CalloutGuide = {
    stepLabel: m.stepLabel,
    steps: m.steps,
    icons: GUIDE_ICONS,
  };

  return (
    <div ref={visibilityRef} className="bad-demo">
      <div className="bpm-demo-controls">
        <span>
          <i aria-hidden="true" />
          {m.demo}
          {annotation ? ` · ${m.steps[annotation.step].title}` : ''}
        </span>
        {!reduced && (
          <span className="bad-controls">
            {hasVoice && (
              <button
                type="button"
                data-voice-toggle
                data-attention={voiceHint || voiceBlocked || undefined}
                aria-pressed={voiceAudible}
                onClick={toggleVoice}
              >
                {voiceAudible ? <Volume2Icon /> : <VolumeXIcon />}
                {voiceAudible ? m.voiceOff : m.voiceOn}
              </button>
            )}
            <button
              type="button"
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <PlayIcon /> : <PauseIcon />}
              {paused ? m.play : m.pause}
            </button>
          </span>
        )}
      </div>
      <div className="bpm-planning-stage" ref={stageRef} data-guided={!reduced}>
        <div
          className="bpm-planning-scroll"
          dir={direction}
          tabIndex={0}
          role="region"
          aria-label={m.demo}
        >
          <AgentsScene
            key={language + cycle}
            m={m}
            active={playing}
            reduced={reduced}
            clockRef={voice.clockRef}
            onNarrate={voice.narrate}
            onAnnotationChange={setAnnotation}
            onCycleEnd={() => {
              loops.current += 1;
              if (loops.current === 1 && voiceOnRef.current) {
                setVoiceOn(false);
                setVoiceHint(true);
              }
              setCycle((current) => current + 1);
              setAnnotation(null);
              voice.reset();
            }}
          />
        </div>
        {annotation && !reduced && (
          <BaitlyPlanningCallout
            key={annotation.step}
            annotation={annotation}
            stageRef={stageRef}
            active={playing}
            guide={guide}
          />
        )}
      </div>
    </div>
  );
}

export function AgentsScene({
  m,
  active,
  reduced,
  clockRef,
  onNarrate,
  onAnnotationChange,
  onCycleEnd,
}: {
  m: AgentsDemoMessages;
  active: boolean;
  reduced: boolean;
  clockRef: MutableRefObject<() => number>;
  onNarrate: (step: number) => void;
  onAnnotationChange: (annotation: PlanningAnnotation | null) => void;
  onCycleEnd: () => void;
}) {
  const { language, direction } = useSiteLanguage();
  const planning = usePlanningText();
  const properties = planning.properties;
  const containerRef = useRef<HTMLDivElement>(null);
  const replyBodyRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { cursor, moveTo, park, hide } = useScriptedCursor(containerRef, direction);

  const [expanded, setExpanded] = useState(false);
  const [board, setBoard] = useState<BoardState>(INITIAL_BOARD);
  const [modal, setModal] = useState<'reply' | 'schedule' | 'police' | null>(null);
  const [reply, setReply] = useState<ReplyState>({ inserted: false, text: '', publishing: false });
  const [day, setDay] = useState(27);
  const [assigned, setAssigned] = useState(false);

  /* Sans animation : la constellation dépliée, statique. */
  useEffect(() => {
    if (reduced) setExpanded(true);
  }, [reduced]);

  useLayoutEffect(() => {
    const measure = () =>
      setScale((containerRef.current?.clientWidth ?? FRAME_WIDTH) / FRAME_WIDTH);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const find = (selector: string) =>
    containerRef.current?.querySelector<HTMLElement>(selector) ?? null;

  /** Retour visuel du clic scripté (état :active), sans toucher au DOM réel. */
  const press = (selector: string) => {
    const element = find(selector);
    if (!element) return;
    element.classList.add('bad-press');
    window.setTimeout(() => element.classList.remove('bad-press'), 220);
  };

  const narrated = useRef(-1);
  const explain = (step: number, target: string, frame = true) => {
    onAnnotationChange({ step, target, frame });
    if (narrated.current !== step) {
      narrated.current = step;
      onNarrate(step);
    }
    const element = find(target);
    const scroll = containerRef.current?.closest<HTMLElement>('.bpm-planning-scroll');
    if (element && scroll && scroll.scrollWidth > scroll.clientWidth) {
      const rect = element.getBoundingClientRect();
      const viewport = scroll.getBoundingClientRect();
      scroll.scrollTo({
        left: scroll.scrollLeft + rect.left - viewport.left + rect.width / 2 - viewport.width / 2,
        behavior: 'smooth',
      });
    }
  };

  const select = (agent: AgentId) => setBoard((state) => ({ ...state, selected: agent }));
  const leave = (id: string) =>
    setBoard((state) => ({ ...state, leaving: new Set(state.leaving).add(id) }));
  const resolve = (id: string, agent: AgentId) =>
    setBoard((state) => {
      const leaving = new Set(state.leaving);
      leaving.delete(id);
      return {
        ...state,
        leaving,
        gone: new Set(state.gone).add(id),
        counts: { ...state.counts, [agent]: state.counts[agent] - 1 },
      };
    });

  const draft = m.reply.draftStart + m.reply.vague + m.reply.draftEnd;

  clockRef.current = useBaitlyPlanningTimeline(active, (at) => {
    const cues = VOICE_CUES[language === 'en' ? 'en' : 'fr'];
    const sel = {
      expand: `[data-expand="${IDX}"]`,
      laura: '[data-cta="review-laura"]',
      ops: '[data-orbit-node="ops"] .baitly-orbit-node',
    };
    let t = 500;
    at(t, park);
    t += 400;

    /** Une étape = une phrase de voix off. `cue(nom)` = instant où la voix
        prononce ce dont on parle ; le cadre change à ce moment-là, et
        s'efface quand la voix se tait. */
    const step = (index: number, script: (cue: (name: string) => number) => void) => {
      const begin = t;
      const timings = cues[index];
      script((name) => begin + Math.max(0, timings[name] - FRAME_LEAD_MS));
      t = begin + timings.end;
      at(t, () => onAnnotationChange(null));
      t += STEP_GAP_MS;
    };
    /** Le curseur part assez tôt pour arriver au moment du clic. */
    const click = (when: number, selector: string, run: () => void) => {
      at(Math.max(0, when - CURSOR_TRAVEL_MS), () => moveTo(find(selector)));
      at(when, () => {
        press(selector);
        run();
      });
    };

    // 0 — Le planning du portefeuille (pointé, sans cadre).
    step(0, () => {
      at(t, () => explain(0, '[data-agents-grid]', false));
    });

    // 1 — Déplier un logement.
    step(1, (cue) => {
      at(t, () => explain(1, sel.expand));
      click(cue('click'), sel.expand, () => setExpanded(true));
      at(cue('board'), () => explain(1, '[data-board-header]'));
    });

    // 2 — La constellation : les agents, puis les pastilles, puis le total.
    step(2, (cue) => {
      at(t, () => {
        explain(2, '[data-orbit]');
        moveTo(find('[data-orbit-node="own"] .baitly-orbit-node'));
      });
      at(cue('badge'), () => explain(2, '[data-orbit-node="own"] .baitly-orbit-count'));
      at(cue('total'), () => explain(2, '.bad-board-pending'));
    });

    // 3 — L'agent Réputation, l'avis de Laura, la réponse déjà prête.
    step(3, (cue) => {
      at(t, () => explain(3, '[data-orbit-node="rep"] .baitly-orbit-node'));
      at(cue('card'), () => {
        explain(3, '[data-card="review-laura"]');
        moveTo(find('[data-card="review-laura"] blockquote'));
      });
      at(cue('cta'), () => {
        explain(3, sel.laura);
        moveTo(find(sel.laura));
      });
    });

    // 4 — « Répondre », la proposition de l'IA, « Insérer ».
    step(4, (cue) => {
      at(t, () => explain(4, sel.laura));
      click(cue('click'), sel.laura, () => {
        setModal('reply');
        explain(4, '[data-reply-proposal]');
      });
      at(cue('proposal'), () => explain(4, '[data-reply-proposal]'));
      click(cue('insert'), '[data-reply-insert]', () =>
        setReply({ inserted: true, text: draft, publishing: false }),
      );
      at(cue('insert') + 200, () => {
        explain(4, '[data-reply-text]');
        const body = replyBodyRef.current;
        const field = find('[data-reply-text]');
        if (body && field) body.scrollTo({ top: field.offsetTop - 24, behavior: 'smooth' });
      });
    });

    // 5 — Ajuster pendant que la voix l'explique, publier sur « Je publie ».
    step(5, (cue) => {
      at(t, () => {
        explain(5, '[data-reply-text]');
        moveTo(find('[data-reply-text] textarea'));
      });
      const { draftStart, vague, precise, draftEnd } = m.reply;
      const edit = cue('edit');
      const span = cue('publish') - CURSOR_TRAVEL_MS - 300 - edit;
      const erase = Math.min(900, span * 0.25);
      for (let k = vague.length - 1; k >= 0; k -= 1) {
        at(edit + (erase * (vague.length - k)) / vague.length, () => setReply((r) => ({ ...r, text: draftStart + vague.slice(0, k) + draftEnd })));
      }
      const typing = span - erase;
      for (let k = 1; k <= precise.length; k += 1) {
        at(edit + erase + (typing * k) / precise.length, () =>
          setReply((r) => ({ ...r, text: draftStart + precise.slice(0, k) + draftEnd })),
        );
      }
      click(cue('publish'), '[data-reply-publish]', () => {
        explain(5, '[data-reply-publish]');
        setReply((r) => ({ ...r, publishing: true }));
      });
      at(cue('leave'), () => {
        setModal(null);
        leave('review-laura');
        explain(5, '.bad-board-pending');
      });
      at(cue('leave') + 450, () => resolve('review-laura', 'rep'));
    });

    // 6 — Opérations : l'anneau pivote, la batterie, le risque.
    step(6, (cue) => {
      at(t, () => explain(6, sel.ops));
      click(cue('click'), sel.ops, () => select('ops'));
      at(cue('meter'), () => {
        explain(6, '[data-card="lock"] .baitly-description-meter-group');
        moveTo(find('[data-card="lock"] .baitly-description-meter'));
      });
      at(cue('card'), () => explain(6, '[data-card="lock"]'));
    });

    // 7 — Planifier : date, heure, intervenant, au rythme de la voix.
    step(7, (cue) => {
      at(t, () => explain(7, '[data-cta="lock"]'));
      // Le cadre quitte le bouton dès que la modale le recouvre.
      click(cue('open'), '[data-cta="lock"]', () => {
        setModal('schedule');
        explain(7, '[data-planning-panel="schedule"] .bad-calendar');
      });
      at(cue('assignee'), () => explain(7, '[data-planning-panel="schedule"] .bad-command'));
      click(cue('day'), '[data-day="2026-09-28"]', () => {
        setDay(28);
        explain(7, '[data-day="2026-09-28"]');
      });
      at(cue('time'), () => explain(7, '[data-planning-panel="schedule"] .bad-input'));
      click(cue('worker'), '[data-assignee="youssef"]', () => {
        setAssigned(true);
        explain(7, '[data-assignee="youssef"]');
      });
      click(cue('done'), '[data-schedule-confirm]', () => {
        setModal(null);
        leave('lock');
        explain(7, '[data-queue]');
      });
      at(cue('done') + 450, () => resolve('lock', 'ops'));
    });

    // 8 — La vue Agents : la liste, l'ordre, l'autonomie.
    step(8, (cue) => {
      at(t, () => explain(8, '[data-view-toggle="cards"]'));
      click(cue('click'), '[data-view-toggle="cards"]', () =>
        setBoard((state) => ({ ...state, view: 'cards' })),
      );
      at(cue('list'), () => explain(8, '[data-agent-list]'));
      at(cue('top'), () => explain(8, '[data-agent-row="rep"]'));
      at(cue('autonomy'), () => explain(8, '[data-autonomy="rep"]'));
    });

    // 9 — Conformité : la fiche, ce qui va partir, la confirmation.
    step(9, (cue) => {
      at(t, () => explain(9, '[data-agent-row="cmp"]'));
      click(cue('click'), '[data-agent-select="cmp"]', () => select('cmp'));
      at(cue('card'), () => explain(9, '[data-card="police"]'));
      // Fin de « …sont complètes » : le cadre passe sur le bouton que le
      // curseur va cliquer, au lieu de rester sur toute la carte.
      at(cue('button'), () => explain(9, '[data-cta="police"]'));
      click(cue('open'), '[data-cta="police"]', () => {
        setModal('police');
        explain(9, '[data-planning-panel="police"] .baitly-action-description');
      });
      at(cue('consequences'), () =>
        explain(9, '[data-planning-panel="police"] .baitly-action-modal-section'),
      );
      click(cue('confirm'), '[data-police-confirm]', () => {
        setModal(null);
        leave('police');
        explain(9, '[data-queue]');
      });
      at(cue('confirm') + 450, () => resolve('police', 'cmp'));
    });

    // 10 — L'autonomie de Revenue, puis ce qui reste soumis à validation.
    step(10, (cue) => {
      at(t, () => explain(10, '[data-autonomy="rev"]'));
      click(cue('change'), '[data-autonomy="rev"] select', () =>
        setBoard((state) => ({ ...state, autonomy: { ...state.autonomy, rev: 'notify' } })),
      );
      at(cue('locked'), () => {
        explain(10, '[data-autonomy="cmp"]');
        moveTo(find('[data-autonomy="cmp"]'));
      });
      at(cue('release'), () => {
        hide();
        onAnnotationChange(null);
      });
    });

    t += 1500;
    at(t, onCycleEnd);
  });

  const gridWidth = DAYS * DAY_W;
  const bodyHeight = expanded ? ROW_H : PLANNING_BODY_H;
  const fillerRows = Math.ceil((PLANNING_BODY_H - properties.length * ROW_H) / ROW_H);
  const occupancy = Array.from({ length: DAYS }, (_, d) => {
    const rows = new Set(
      RESAS.filter((r) => d >= r.start && d < r.start + r.nights).map((r) => r.row),
    );
    return Math.round((rows.size / properties.length) * 100);
  });
  const shownProperties = expanded ? [IDX] : properties.map((_, i) => i);

  return (
    <div
      className="relative bpm-planning-canvas"
      lang={language}
      dir={direction}
      ref={containerRef}
      style={{ ...TOKENS, height: FRAME_H * scale }}
    >
      <div
        className="relative overflow-hidden"
        style={{ width: FRAME_WIDTH, height: FRAME_H, transform: `scale(${scale})`, transformOrigin: direction === 'rtl' ? 'top right' : 'top left' }}
        aria-hidden="true"
        {...{ inert: '' }}
      >
        <aside className="bpm-planning-sidebar">
          <div className="bpm-planning-brand" data-playing={active}>
            <BaitlyMarkLogo variant="mark" size={32} tone="dark" />
          </div>
          <LayoutGridIcon />
          <HomeIcon />
          <span>
            <CalendarIcon />
          </span>
          <WrenchFill size={18} />
          <WalletIcon />
          <UsersIcon />
          <BuildingIcon />
          <SettingsIcon />
        </aside>
        <div className="bpm-planning-main">
          <Toolbar mutedChannel={null} agentAsk={expanded ? m.agentAsk : undefined} />
          <div className="bpm-planning-grid" style={expanded ? { marginTop: 8 } : undefined}>
            <div className="relative flex" style={{ width: DESIGN_WIDTH }}>
              <div style={{ width: PROP_W, flexShrink: 0 }}>
                <div className="bad-props-head" style={{ height: HEADER_H }}>
                  {demoNumber(shownProperties.length, language)} {planning.propertiesLabel}
                </div>
                <div style={{ height: bodyHeight, overflow: 'hidden' }}>
                  {shownProperties.map((index) => (
                    <div
                      key={index}
                      data-prop-index={index}
                      className="bpm-property bad-property"
                      data-open={expanded || undefined}
                      style={{ height: ROW_H, ['--bad-lift' as string]: `${IDX * ROW_H}px` }}
                    >
                      <img src={PROPERTY_PHOTOS[index]} alt="" loading="lazy" />
                      <div>
                        <strong>{properties[index].name}</strong>
                        <span>{properties[index].city.split(' · ')[0]}</span>
                      </div>
                      <span className="bpm-property-count">
                        <b>{demoNumber(UNIT_COUNTS[index] + 8, language)}</b>
                        <small>
                          <TagIcon size={10} />
                          {demoNumber(UNIT_COUNTS[index], language)}
                        </small>
                      </span>
                      <span className="bad-expand" data-expand={index}>
                        {expanded ? <ChevronUpIcon size={13} /> : <ChevronDownIcon size={13} />}
                      </span>
                    </div>
                  ))}
                  {!expanded &&
                    Array.from({ length: fillerRows }, (_, i) => (
                      <div key={`fill-${i}`} style={{ height: ROW_H, background: 'var(--pl-card)' }} />
                    ))}
                </div>
              </div>
              <div className="relative" style={{ width: gridWidth }}>
                <DateHeaders />
                <div className="relative overflow-hidden" style={{ height: bodyHeight }} data-agents-grid>
                  <div
                    className="absolute inset-x-0 bad-grid-body"
                    data-open={expanded || undefined}
                    style={{
                      ['--bad-lift' as string]: `${IDX * ROW_H}px`,
                      top: expanded ? -IDX * ROW_H : 0,
                      height: (properties.length + fillerRows) * ROW_H,
                    }}
                  >
                    {properties.map((property, row) => (
                      <Row key={property.name} row={row} selection={null} />
                    ))}
                    {Array.from({ length: fillerRows }, (_, i) => (
                      <div
                        key={`grid-fill-${i}`}
                        className="absolute inset-x-0"
                        style={{
                          top: (properties.length + i) * ROW_H,
                          height: ROW_H,
                          backgroundImage: `repeating-linear-gradient(to ${direction === 'rtl' ? 'left' : 'right'}, transparent 0 ${DAY_W - 1}px, var(--pl-line) ${DAY_W - 1}px ${DAY_W}px)`,
                        }}
                      />
                    ))}
                    {RESAS.map((resa) => (
                      <Bar
                        key={resa.id}
                        resa={resa}
                        muted={false}
                        shift={0}
                        extra={0}
                        dragging={false}
                        conflict={false}
                        infoFilled={false}
                      />
                    ))}
                    <BlockedBand />
                    <CancelledBar />
                    <div
                      className="pointer-events-none absolute top-0 bottom-0 w-[2px]"
                      style={{
                        insetInlineStart: TODAY_INDEX * DAY_W + DAY_W * 0.42,
                        background: 'var(--pl-err)',
                        zIndex: 6,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            {expanded ? (
              <AgentsBoard m={m} state={board} height={BOARD_H} playing={active} />
            ) : (
              <div className="bpm-occupancy">
                <span style={{ width: PROP_W }}>{planning.occupancyLabel}</span>
                <div>
                  {occupancy.map((value, index) => (
                    <small
                      key={index}
                      style={{ width: DAY_W, background: isWeekend(index, language) ? 'var(--pl-we)' : undefined }}
                    >
                      {demoNumber(value / 100, language, { style: 'percent', maximumFractionDigits: 0 })}
                    </small>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="bpm-planning-pagination">
            <span>{expanded ? m.pageRange : planning.pageRange}</span>
            <ChevronLeftIcon className="bpm-directional-icon" size={14} />
            {planning.previous}
            <strong>{demoNumber(1, language)}</strong>
            {planning.next}
            <ChevronRightIcon className="bpm-directional-icon" size={14} />
          </div>
        </div>
        {modal === 'reply' && (
          <ReplyModal m={m} state={reply} maxHeight={FRAME_H - 48} bodyRef={replyBodyRef} />
        )}
        {modal === 'schedule' && (
          <ScheduleModal m={m} day={day} assigned={assigned} maxHeight={FRAME_H - 48} />
        )}
        {modal === 'police' && <PoliceModal m={m} maxHeight={FRAME_H - 48} />}
      </div>
      {!reduced && <Cursor cursor={cursor} />}
    </div>
  );
}
