import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  BotIcon,
  CalendarSyncIcon,
  CheckIcon,
  LayoutGridIcon,
  MessageSquareIcon,
  MousePointerClickIcon,
  OrbitIcon,
  PencilIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
  WrenchIcon,
  XIcon,
} from 'lucide-react';
import {
  Badge,
  Button,
  Progress,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import PageHeader from '../../../components/baitly/PageHeader';
import { Money } from '../../../components/baitly/Money';
import { MARK_PATH, MARK_VIEWBOX, STROKE_WIDTH } from '../../../components/BaitlyMarkLogo';
import { cn } from '../../../utils/cn';

/**
 * Projection — Constellation des agents IA : les agents, le feed d'activité et
 * la file de cartes HITL (validation humaine). Galerie only.
 *
 * <h3>Parti pris visuel</h3>
 * Langage inspiré de Notion, appliqué au registre « product » :
 * <ul>
 *   <li><b>La surface signale l'action.</b> Seuls les blocs sur lesquels on agit
 *       reçoivent un fond : les propositions à valider, et les cartes agent qui
 *       portent l'interrupteur auto/validation. Ce qui se lit seulement (feed,
 *       diagramme) vit sur le fond de page, séparé par des filets d'1px. Une
 *       surface n'existe que si l'élévation porte du sens.</li>
 *   <li><b>Un seul accent.</b> L'ambre ne désigne QUE « ça attend une décision
 *       de votre part ». Tout le reste est neutre — y compris les états
 *       « actif » et « auto », qui sont la norme et n'ont donc pas à être
 *       colorés. On signale l'exception, pas la règle.</li>
 *   <li><b>Aucune boucle au repos.</b> Le mouvement répond à un geste (survol,
 *       focus clavier) ou porte un état (l'agent qui attend). Un écran de
 *       supervision reste ouvert toute la journée : l'animation ambiante y est
 *       une fatigue, pas une qualité.</li>
 * </ul>
 */

// ─── Données ─────────────────────────────────────────────────────────────────

interface AgentNode {
  name: string;
  role: string;
  icon: React.ReactNode;
  status: 'active' | 'idle' | 'waiting';
  tasksToday: number;
  lastRun: string;
  auto: boolean;
}

const AGENTS: AgentNode[] = [
  { name: 'Revenue', role: 'Yield & tarifs', icon: <TrendingUpIcon />, status: 'waiting', tasksToday: 6, lastRun: 'il y a 4 min', auto: false },
  { name: 'Messaging', role: 'Relances & réponses guests', icon: <MessageSquareIcon />, status: 'active', tasksToday: 14, lastRun: 'à l\'instant', auto: true },
  { name: 'Ops', role: 'Interventions & équipes', icon: <WrenchIcon />, status: 'active', tasksToday: 9, lastRun: 'il y a 12 min', auto: true },
  { name: 'Sync', role: 'Canaux & calendriers', icon: <CalendarSyncIcon />, status: 'idle', tasksToday: 31, lastRun: 'il y a 25 min', auto: true },
];

/**
 * Statuts : une pastille + un mot. Seul « attend validation » sort du gris,
 * c'est le seul état qui appelle une action humaine. La pastille porte l'ambre
 * clair (elle est pleine, donc lisible), le texte porte l'encre ambrée
 * (`warning-ink`) : écrire en `text-warning` donnerait 2,17:1 sur fond clair.
 */
const AGENT_STATUS = {
  active: { label: 'Actif', dot: 'bg-foreground/45', text: 'text-muted-foreground' },
  idle: { label: 'En veille', dot: 'bg-muted-foreground/30', text: 'text-muted-foreground' },
  waiting: { label: 'Attend validation', dot: 'bg-warning', text: 'text-warning-ink' },
};

// ─── File de propositions ────────────────────────────────────────────────────

/** [libellé du bouton, icône, participe passé pour la trace]. */
interface Action {
  label: string;
  icon: React.ReactNode;
  done: string;
}

interface PendingItem {
  id: string;
  agent: string;
  title: string;
  motif: string;
  /**
   * Minutes restantes avant échéance. C'est le pendant de `expiresAt` du module
   * de supervision réel, en valeur relative pour que la démo reste stable.
   */
  expiresInMin: number;
  actions: [primary: Action, secondary: Action, dismiss: Action];
  /** Contenu enrichi propre à la proposition (chiffres, message proposé). */
  extra?: React.ReactNode;
}

/** Action déjà lancée par l'agent : elle s'observe, elle ne se valide pas. */
interface RunningItem {
  agent: string;
  label: string;
}

const VALIDATE: Action = { label: 'Appliquer', icon: <CheckIcon />, done: 'appliquée' };
const ADJUST: Action = { label: 'Ajuster', icon: <SlidersHorizontalIcon />, done: 'ouverte pour ajustement' };
const REFUSE: Action = { label: 'Refuser', icon: <XIcon />, done: 'refusée' };
const SEND: Action = { label: 'Envoyer', icon: <CheckIcon />, done: 'envoyée' };
const EDIT: Action = { label: 'Modifier', icon: <PencilIcon />, done: 'ouverte en édition' };
const IGNORE: Action = { label: 'Ignorer', icon: <XIcon />, done: 'ignorée' };

const PENDING: PendingItem[] = [
  {
    id: 'rev-block',
    agent: 'Revenue',
    title: 'Blocage calendrier sur Villa Palmeraie',
    motif: 'Trois nuits isolées entre deux séjours, invendables en l\'état. Blocage proposé pour éviter un ménage à perte.',
    expiresInMin: 55,
    actions: [VALIDATE, ADJUST, REFUSE],
  },
  {
    id: 'rev-weekend',
    agent: 'Revenue',
    title: 'Hausse sur les week-ends de septembre',
    motif: 'Occupation à 88 % sur les 4 week-ends. Hausse de 8 % proposée, plafond de gamme respecté.',
    expiresInMin: 300,
    actions: [VALIDATE, ADJUST, REFUSE],
  },
  {
    id: 'rev-yield',
    agent: 'Revenue',
    title: 'Baisse tarifaire sur Riad Yasmine',
    motif: '9 nuits invendues du 18 au 27 août. Baisse de 12 % sur ces dates seulement, prix plancher respecté.',
    expiresInMin: 1320,
    actions: [VALIDATE, ADJUST, REFUSE],
    extra: (
      <>
        {/* Chiffres en ligne : un encadré gris dans un bloc déjà surfacé serait
            une surface imbriquée. La hiérarchie passe par la graisse.
            Le revenu attendu est l'espérance réelle (9 nuits × 70 € × 74 %). */}
        <p className="m-0 mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            Nuitée <span className="tabular-nums"><Money value={80} decimals={0} /></span>
            <span className="mx-1">→</span>
            <span className="font-medium text-foreground tabular-nums"><Money value={70} decimals={0} /></span>
          </span>
          <span className="text-muted-foreground">
            Revenu attendu{' '}
            <span className="font-medium text-foreground tabular-nums">
              +<Money value={466} decimals={0} />
            </span>
          </span>
        </p>
        <div className="mt-2.5 flex items-center gap-2.5">
          <Progress value={74} className="h-1 w-28 shrink-0" />
          <span className="text-xs text-muted-foreground tabular-nums">
            74 % de probabilité de remplissage
          </span>
        </div>
      </>
    ),
  },
  {
    id: 'com-late',
    agent: 'Messaging',
    title: 'Demande de départ tardif — Sofia Marchetti',
    motif: 'Départ à 15 h demandé sur le Duplex Guéliz. Aucune arrivée le jour même, le ménage reste tenable.',
    expiresInMin: 175,
    actions: [SEND, EDIT, IGNORE],
  },
  {
    id: 'com-cart',
    agent: 'Messaging',
    title: 'Relance de Karim El Fassi',
    motif: '2 nuits au Duplex Guéliz, 940 €, panier abandonné il y a 26 h. Message proposé :',
    expiresInMin: 700,
    actions: [SEND, EDIT, IGNORE],
    extra: (
      <blockquote className="m-0 mt-2 rounded-sm bg-muted px-2.5 py-2 text-xs text-foreground">
        Bonjour Karim, votre séjour du 14 au 16 août au Duplex Guéliz est toujours disponible.
        Réservez avant ce soir et profitez du petit-déjeuner offert.
      </blockquote>
    ),
  },
  {
    id: 'ops-clean',
    agent: 'Ops',
    title: 'Réaffectation du ménage de RES-1042',
    motif: 'Nadia Berrada est déjà sur deux départs à 11 h. Bascule proposée vers Youssef Amrani, disponible et à 900 m.',
    expiresInMin: 40,
    actions: [VALIDATE, EDIT, REFUSE],
  },
];

/** Ce que les agents exécutent en ce moment, sans validation humaine. */
const RUNNING: RunningItem[] = [
  { agent: 'Revenue', label: 'Recalcul des prix sur 12 logements' },
  { agent: 'Messaging', label: 'Traduction de 3 réponses en arabe' },
  { agent: 'Ops', label: 'Création de 4 interventions de ménage' },
  { agent: 'Ops', label: 'Synchronisation des disponibilités prestataires' },
  { agent: 'Sync', label: 'Réconciliation Airbnb et Booking' },
];

/**
 * Tri des propositions : échéance croissante.
 *
 * C'est la règle de production. Contrairement à ce qu'on pourrait supposer,
 * `PendingAction` ne porte AUCUN champ de priorité ou de sévérité côté
 * supervision — vérifié dans `src/modules/supervision/types.ts`. La seule
 * hiérarchie réelle est l'ordre des piles par agent (`TYPE_ORDER` dans
 * `components/TaskDeckQueue.tsx`) puis, à l'intérieur d'une pile, le tri par
 * `expiresAt` croissant. Une pile ne contenant qu'un agent, il ne reste ici
 * que l'échéance.
 */
function waitingFor(agent: string, decided: Record<string, string>) {
  return PENDING.filter((item) => item.agent === agent && !decided[item.id]).sort(
    (a, b) => a.expiresInMin - b.expiresInMin
  );
}

function runningFor(agent: string) {
  return RUNNING.filter((item) => item.agent === agent);
}

/**
 * Agent pré-sélectionné : celui qui porte le plus de propositions, l'échéance
 * la plus proche départageant les ex aequo.
 *
 * Écart assumé avec la production, où `SupervisionPanel` initialise la
 * sélection à `null` et n'ouvre le tiroir que sur clic. Ici l'écran s'ouvre
 * déjà sur le travail à faire plutôt que sur un panneau vide.
 */
function busiestAgent(decided: Record<string, string>) {
  return [...AGENTS].sort((a, b) => {
    const wa = waitingFor(a.name, decided);
    const wb = waitingFor(b.name, decided);
    if (wa.length !== wb.length) return wb.length - wa.length;
    return (wa[0]?.expiresInMin ?? Infinity) - (wb[0]?.expiresInMin ?? Infinity);
  })[0].name;
}

/** Reprend le formatage de `remainingLabel` (TaskDeckQueue de production). */
function formatRemaining(minutes: number) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  }
  if (minutes >= 1) return `${minutes} min`;
  return '< 1 min';
}

/**
 * Micro-label de section (h2 : le PageHeader porte le h1). 12 px minimum,
 * comme tout le texte de la section : la densité vient du rythme des lignes,
 * pas du rapetissement du texte.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="m-0 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

// ─── Vue cartes ──────────────────────────────────────────────────────────────

/**
 * Une carte par agent, sur quatre colonnes. En lignes pleine largeur, ces mêmes
 * données laissaient un vide de plusieurs centaines de pixels au milieu de
 * l'écran et coûtaient quatre fois la hauteur ; la carte referme l'espace
 * horizontal et rend l'ensemble scannable d'un coup d'œil.
 *
 * La carte porte une surface parce qu'on agit dessus (l'interrupteur
 * auto/validation). Elle reste dans le langage de la refonte : pas de bordure
 * (la surface suffit), rayon serré, et l'état ne sort du gris que lorsqu'il
 * appelle une décision.
 */
function AgentCard({
  agent,
  auto,
  onAutoChange,
  waiting,
  running,
}: {
  agent: AgentNode;
  auto: boolean;
  onAutoChange: (auto: boolean) => void;
  waiting: number;
  running: number;
}) {
  // Statut dérivé de la file, comme le fait le provider de supervision réel :
  // un agent qui porte une proposition passe en attente, les autres suivent
  // leur activité. Le champ `status` des données ne sert plus que de repli.
  const status = waiting
    ? AGENT_STATUS.waiting
    : running
      ? AGENT_STATUS.active
      : AGENT_STATUS.idle;
  return (
    <article className="flex flex-col gap-2.5 rounded-md bg-card p-3">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
          {agent.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-sm font-medium text-foreground">Agent {agent.name}</h3>
          <p className="m-0 text-xs text-muted-foreground">{agent.role}</p>
        </div>
      </div>

      <p className={cn('m-0 flex items-center gap-1.5 text-xs', status.text)}>
        <span className={cn('size-1.5 shrink-0 rounded-[2px]', status.dot)} aria-hidden />
        {status.label}
      </p>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5 text-xs text-muted-foreground">
        <span className="text-foreground tabular-nums">{agent.tasksToday} tâches</span>
        <span>{agent.lastRun}</span>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-muted-foreground">
        {auto ? 'Auto-application' : 'Validation humaine'}
        <Switch
          checked={auto}
          onCheckedChange={onAutoChange}
          aria-label={`Mode auto — Agent ${agent.name}`}
        />
      </label>
    </article>
  );
}

// ─── Vue constellation orbitale ──────────────────────────────────────────────

/**
 * Géométrie de l'orbite, exprimée en % du côté du canvas (toujours carré) —
 * tout reste donc proportionnel quelle que soit la largeur disponible.
 */
const ORBIT_RADIUS = 33;
/** Le noyau ancre la composition mais n'encode rien : il ne doit pas écraser
 *  les agents, qui eux portent toute l'information. */
const CORE_SIZE = 15;
const NODE_MAX = 19;
const NODE_MIN = 9.5;

/**
 * Angle d'un agent, en degrés (0 = 3 h, sens horaire), DÉRIVÉ de son index.
 * Le décalage de −45° met les deux premiers agents (ceux qui produisent des
 * propositions) côté file, pour que les traits de rattachement partent vers
 * elle sans se croiser. Dérivé plutôt que codé par nom : un cinquième agent se
 * place tout seul au lieu de produire un NaN.
 */
function orbitAngle(index: number, total: number) {
  return -45 + (index * 360) / total;
}

/**
 * Diamètre du nœud : c'est l'AIRE qui est proportionnelle au volume de tâches,
 * donc le diamètre suit √volume. Un agent 4× plus chargé occupe 4× la surface —
 * pas 4× le diamètre, qui exagérerait l'écart.
 */
function nodeDiameter(tasks: number, maxTasks: number) {
  return Math.max(NODE_MIN, NODE_MAX * Math.sqrt(tasks / maxTasks));
}

/** Point de l'orbite pour un angle donné, en % du canvas. */
function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

/**
 * Feuille scopée par préfixe `bo-`, plutôt qu'ajoutée à baitly-ui.css : ce sont
 * des règles de projection, elles n'ont pas à polluer la couche partagée du kit.
 *
 * Budget de mouvement au repos : UNE animation, le halo de l'agent qui attend
 * une validation — la seule qui porte un état. Le flux request/response du mark
 * Baitly (packet aller bleu, retour teal dans le logo) est conservé comme
 * grammaire, mais il ne se déclenche qu'au survol ou au focus clavier d'un
 * agent : le mouvement devient une réponse au geste, pas un bruit de fond.
 */
const ORBIT_STYLES = `
.bo-node, .bo-flow, .bo-tether { transition: opacity .15s cubic-bezier(.25,1,.5,1); }
.bo-view { animation: bo-view-in .16s cubic-bezier(.25,1,.5,1) both; }
@keyframes bo-view-in { from { opacity: 0; } to { opacity: 1; } }

/* ── Rotation de l'anneau à la sélection ─────────────────────────────── */
/* L'anneau porte la rotation, chaque nœud porte la rotation inverse : même
   durée et même courbe des deux côtés, sinon les libellés partiraient de
   travers en cours de route. Les agents glissent ainsi le long de l'orbite
   au lieu de sauter en travers du diagramme. */
.bo-ring, .bo-node { transition: transform 720ms cubic-bezier(.25,1,.5,1); }

/* ── Flux request/response : masqué au repos, joué au survol/focus ────── */
.bo-packet {
  display: none;
  fill: none;
  stroke-linecap: round;
  stroke-dasharray: 14 200;
}
.bo-packet-request { animation: bo-flow-out 1.5s linear infinite; }
.bo-packet-response { animation: bo-flow-back 1.5s linear infinite; }
@keyframes bo-flow-out { 0% { stroke-dashoffset: 16; } 45%, 100% { stroke-dashoffset: -115; } }
@keyframes bo-flow-back { 0%, 50% { stroke-dashoffset: -115; } 95%, 100% { stroke-dashoffset: 16; } }

/* ── Halo de l'agent qui attend : la seule boucle au repos ───────────── */
.bo-ripple { opacity: 0; transform-origin: center; animation: bo-ripple 3.6s cubic-bezier(.25,1,.5,1) infinite; }
@keyframes bo-ripple { 0% { transform: scale(1); opacity: .45; } 100% { transform: scale(1.4); opacity: 0; } }

/* ── Survol : l'agent visé s'isole, son flux se déclenche ────────────── */
.bo-wrap:has(.bo-hit:is(:hover, :focus-visible)) .bo-node:not(:has(.bo-hit:is(:hover, :focus-visible))) { opacity: .3; }
${AGENTS.map(
  (agent) => `.bo-wrap:has(.bo-hit[data-agent="${agent.name}"]:is(:hover, :focus-visible)) :is(.bo-flow, .bo-tether):not([data-agent="${agent.name}"]) { opacity: .15; }
.bo-wrap:has(.bo-hit[data-agent="${agent.name}"]:is(:hover, :focus-visible)) .bo-flow[data-agent="${agent.name}"] .bo-packet { display: inline; }`
).join('\n')}

/* ── Mouvement réduit : plus rien ne bouge, rien d'essentiel ne part ─── */
@media (prefers-reduced-motion: reduce) {
  .bo-ripple { display: none; }
  .bo-view, .bo-packet { animation: none; }
  /* La sélection reste fonctionnelle : l'agent rejoint sa place sans trajet. */
  .bo-ring, .bo-node { transition: none; }
}
`;

/**
 * Diagramme orbital : noyau Baitly au centre, agents en orbite.
 * Positions en `left/top` physiques (et non logiques) : c'est un schéma
 * géométrique, il ne se miroite pas en RTL — seul le rattachement aux cartes
 * s'adapte au sens de lecture (cf. `useTethers`).
 *//**
 * Emplacement de l'agent sélectionné : en haut à droite, face à la file. Tous
 * les autres se répartissent à intervalle régulier à partir de là.
 */
const SLOT_ANGLE = -45;

/** Angle canonique d'un agent, avant rotation de l'anneau. */
function baseAngle(index: number, total: number) {
  return (index * 360) / total;
}

/** Rotation à appliquer pour amener l'agent `index` sur l'emplacement de tête. */
function rotationFor(index: number, total: number) {
  return SLOT_ANGLE - baseAngle(index, total);
}

/**
 * Diagramme orbital : noyau Baitly au centre, agents en orbite.
 *
 * Positions en `left/top` physiques (et non logiques) : c'est un schéma
 * géométrique, il ne se miroite pas en RTL — seul le rattachement aux cartes
 * s'adapte au sens de lecture (cf. `useTethers`).
 *
 * La sélection ne déplace pas les nœuds un à un : elle fait pivoter TOUT
 * l'anneau (`rotation`), si bien que les agents glissent le long de l'orbite au
 * lieu de sauter en travers. Chaque nœud applique la rotation inverse pour
 * rester droit.
 */
function AgentOrbit({
  selected,
  onSelect,
  rotation,
  decided,
  registerNode,
}: {
  selected: string;
  onSelect: (name: string) => void;
  rotation: number;
  decided: Record<string, string>;
  registerNode: (name: string, el: HTMLElement | null) => void;
}) {
  const maxTasks = Math.max(...AGENTS.map((agent) => agent.tasksToday));
  const totalTasks = AGENTS.reduce((sum, agent) => sum + agent.tasksToday, 0);

  return (
    <div className="bo-canvas relative mx-auto aspect-square w-full max-w-[420px]">
      <style>{ORBIT_STYLES}</style>

      {/* L'anneau ne tourne pas : il est invariant par rotation. */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={ORBIT_RADIUS}
          fill="none"
          className="stroke-border"
          strokeWidth="0.25"
          opacity="0.65"
        />
      </svg>

      <div
        className="bo-ring absolute inset-0"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          {AGENTS.map((agent, index) => {
            const angle = baseAngle(index, AGENTS.length);
            const from = polar(angle, CORE_SIZE / 2 + 1.3);
            const to = polar(angle, ORBIT_RADIUS - nodeDiameter(agent.tasksToday, maxTasks) / 2 - 0.6);
            const segment = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
            return (
              <g key={agent.name} className="bo-flow" data-agent={agent.name}>
                <line {...segment} strokeWidth="0.3" className="stroke-border" />
                <line
                  {...segment}
                  pathLength={100}
                  strokeWidth="1.1"
                  className="bo-packet bo-packet-request stroke-info"
                />
                <line
                  {...segment}
                  pathLength={100}
                  strokeWidth="1.1"
                  className="bo-packet bo-packet-response stroke-success"
                />
              </g>
            );
          })}
        </svg>

        {AGENTS.map((agent, index) => {
          const diameter = nodeDiameter(agent.tasksToday, maxTasks);
          const point = polar(baseAngle(index, AGENTS.length), ORBIT_RADIUS);
          const waiting = waitingFor(agent.name, decided);
          const running = runningFor(agent.name);
          const isSelected = agent.name === selected;
          // Le halo ne signale que ce qui n'est PAS déjà ouvert à droite :
          // pulser sur l'agent dont on lit justement la file serait redondant.
          const needsAttention = waiting.length > 0 && !isSelected;
          const status = waiting.length
            ? AGENT_STATUS.waiting
            : running.length
              ? AGENT_STATUS.active
              : AGENT_STATUS.idle;

          return (
            <div
              key={agent.name}
              className="bo-node absolute"
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                width: `${diameter}%`,
                height: `${diameter}%`,
                transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
              }}
            >
              {needsAttention && (
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-[10%] rounded-full ring-1 ring-warning/30"
                  />
                  <span
                    aria-hidden
                    className="bo-ripple pointer-events-none absolute -inset-[10%] rounded-full ring-1 ring-warning/45"
                  />
                </>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-agent={agent.name}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(agent.name)}
                    ref={(el) => {
                      registerNode(agent.name, el);
                    }}
                    aria-label={`Agent ${agent.name} · ${waiting.length} à valider · ${running.length} en cours${isSelected ? ' · file ouverte' : ''}`}
                    className={cn(
                      'bo-hit relative flex size-full cursor-pointer items-center justify-center rounded-full border bg-card transition-colors duration-100 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                      isSelected && 'border-primary/45 text-foreground ring-1 ring-primary/25',
                      !isSelected && needsAttention && 'border-warning/60 text-warning-ink',
                      !isSelected && !needsAttention && 'border-border text-muted-foreground'
                    )}
                  >
                    {/* L'icône identifie l'agent (variable catégorielle), le
                        diamètre encode le volume (variable quantitative) : les
                        faire varier ensemble double l'encodage, vide les gros
                        nœuds et rend les petits illisibles. D'où une taille
                        quasi constante, juste bornée par clamp. */}
                    <span
                      className="flex aspect-square items-center justify-center [&>svg]:size-full"
                      style={{ width: 'clamp(14px, 32%, 22px)' }}
                    >
                      {agent.icon}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[16rem] p-0">
                  <AgentTooltip
                    agent={agent}
                    waiting={waiting}
                    running={running}
                    isSelected={isSelected}
                  />
                </TooltipContent>
              </Tooltip>
              <span className="absolute inset-x-0 top-full mt-2 flex flex-col items-center gap-0.5 leading-tight">
                <span className="text-xs font-medium whitespace-nowrap text-foreground">
                  {agent.name}
                </span>
                <span
                  className={cn(
                    'text-xs whitespace-nowrap tabular-nums',
                    waiting.length ? 'font-medium text-warning-ink' : 'text-muted-foreground'
                  )}
                >
                  {waiting.length
                    ? `${waiting.length} à valider`
                    : running.length
                      ? `${running.length} en cours`
                      : status.label.toLowerCase()}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Le noyau reste au centre, donc hors de l'anneau qui pivote. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute inset-0 m-auto flex cursor-default items-center justify-center rounded-full bg-primary text-primary-foreground"
            style={{ width: `${CORE_SIZE}%`, height: `${CORE_SIZE}%` }}
          >
            <svg viewBox={MARK_VIEWBOX} className="size-1/2" fill="none" aria-hidden>
              <path
                d={MARK_PATH}
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </TooltipTrigger>
        <TooltipContent>Noyau Baitly · {totalTasks} tâches orchestrées aujourd'hui</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** Nombre de lignes montrées dans l'infobulle avant de renvoyer vers la file. */
const TOOLTIP_MAX_ITEMS = 3;

/**
 * Infobulle enrichie : identité de l'agent, puis un aperçu BORNÉ de ce qu'il a
 * en attente et de ce qu'il exécute. Au-delà de trois lignes on ne déroule pas,
 * on invite à ouvrir la file — une infobulle qui déborde n'est plus une
 * infobulle.
 */
function AgentTooltip({
  agent,
  waiting,
  running,
  isSelected,
}: {
  agent: AgentNode;
  waiting: PendingItem[];
  running: RunningItem[];
  isSelected: boolean;
}) {
  const rows = [
    ...waiting.map((item) => ({
      key: item.id,
      label: item.title,
      hint: formatRemaining(item.expiresInMin),
      pending: true,
    })),
    ...running.map((item) => ({
      key: item.label,
      label: item.label,
      hint: 'en cours',
      pending: false,
    })),
  ];
  const shown = rows.slice(0, TOOLTIP_MAX_ITEMS);
  const rest = rows.length - shown.length;

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5">
      <div>
        <p className="m-0 text-xs font-medium">Agent {agent.name}</p>
        <p className="m-0 text-xs opacity-70">{agent.role}</p>
      </div>

      {rows.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {shown.map((row) => (
            <li key={row.key} className="flex items-start gap-1.5 text-xs">
              <span
                aria-hidden
                className={cn(
                  'mt-1 size-1.5 shrink-0 rounded-[2px]',
                  row.pending ? 'bg-warning' : 'bg-current opacity-50'
                )}
              />
              <span className="min-w-0 flex-1">{row.label}</span>
              <span className="shrink-0 tabular-nums opacity-70">{row.hint}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="m-0 flex items-center gap-1 text-xs opacity-70">
        {isSelected ? (
          'File ouverte à droite'
        ) : (
          <>
            <MousePointerClickIcon className="size-3" />
            {rest > 0
              ? `Cliquer pour voir ${rest} autre${rest > 1 ? 's' : ''}`
              : 'Cliquer pour ouvrir la file'}
          </>
        )}
      </p>
    </div>
  );
}

interface Tether {
  name: string;
  urgent: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Mesure les traits qui relient l'agent sélectionné à chacune de ses
 * propositions. Les coordonnées ne sont calculables qu'après layout (les deux
 * extrémités vivent dans des colonnes distinctes) : on lit les rects et on
 * redessine sur resize. Quand les colonnes s'empilent (mobile), aucun trait
 * n'est tracé.
 */
function useTethers(enabled: boolean, selected: string, revision: string | number) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const nodeEls = useRef<Record<string, HTMLElement | null>>({});
  const cardEls = useRef<Record<string, HTMLElement | null>>({});
  const [tethers, setTethers] = useState<Tether[]>([]);

  const registerNode = useCallback((name: string, el: HTMLElement | null) => {
    nodeEls.current[name] = el;
  }, []);
  const registerCard = useCallback((name: string, el: HTMLElement | null) => {
    cardEls.current[name] = el;
  }, []);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!enabled || !wrap) {
      setTethers((prev) => (prev.length ? [] : prev));
      return;
    }

    const measure = () => {
      const base = wrap.getBoundingClientRect();
      const node = nodeEls.current[selected];
      const next: Tether[] = [];
      if (!node) {
        setTethers((prev) => (prev.length ? [] : prev));
        return;
      }
      const n = node.getBoundingClientRect();
      for (const item of waitingFor(selected, {})) {
        const card = cardEls.current[item.id];
        if (!card) continue;
        const c = card.getBoundingClientRect();
        // Carte franchement à droite (LTR) ou à gauche (RTL) du nœud ; sinon les
        // colonnes sont empilées et un trait n'aurait aucun sens.
        const toRight = c.left >= n.right;
        const toLeft = c.right <= n.left;
        if (!toRight && !toLeft) continue;
        next.push({
          name: item.id,
          urgent: item.expiresInMin < 60,
          x1: Math.round((toRight ? n.right : n.left) - base.left),
          y1: Math.round(n.top + n.height / 2 - base.top),
          x2: Math.round((toRight ? c.left : c.right) - base.left),
          y2: Math.round(c.top + 22 - base.top),
        });
      }
      setTethers((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    for (const el of Object.values(cardEls.current)) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [enabled, selected, revision]);

  return { wrapRef, registerNode, registerCard, tethers };
}

function TetherOverlay({ tethers }: { tethers: Tether[] }) {
  if (tethers.length === 0) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
      {tethers.map((tether) => {
        const bend = (tether.x2 - tether.x1) * 0.45;
        return (
          <g
            key={tether.name}
            className={cn('bo-tether', tether.urgent ? 'stroke-warning/70' : 'stroke-border')}
            data-agent={tether.name}
          >
            <path
              fill="none"
              strokeWidth="1"
              d={`M${tether.x1} ${tether.y1} C${tether.x1 + bend} ${tether.y1}, ${tether.x2 - bend} ${tether.y2}, ${tether.x2} ${tether.y2}`}
            />
            <circle
              cx={tether.x2}
              cy={tether.y2}
              r="2"
              strokeWidth="0"
              className={tether.urgent ? 'fill-warning/70' : 'fill-border'}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Propositions à valider ──────────────────────────────────────────────────

/**
 * Bloc de proposition. Il porte une surface (`bg-card`) parce qu'on agit
 * dessus : dans cette section, une surface signale une action possible. Les
 * actions secondaires n'apparaissent qu'au survol ou au focus clavier ;
 * l'action principale reste toujours visible.
 */function ProposalBlock({
  item,
  onDecide,
}: {
  item: PendingItem;
  onDecide: (id: string, decision: string) => void;
}) {
  const [primary, secondary, dismiss] = item.actions;
  // Sous l'heure, l'échéance devient l'information la plus urgente du bloc.
  const urgent = item.expiresInMin < 60;
  return (
    <article className="group/proposal rounded-md bg-card p-3.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn('size-1.5 rounded-[2px]', urgent ? 'bg-warning' : 'bg-muted-foreground/30')}
          aria-hidden
        />
        <span className="font-medium text-foreground">Agent {item.agent}</span>
        <span className={cn('tabular-nums', urgent && 'text-warning-ink')}>
          expire dans {formatRemaining(item.expiresInMin)}
        </span>
      </div>

      <h3 className="m-0 mt-2 text-sm font-medium text-foreground [text-wrap:balance]">
        {item.title}
      </h3>
      <p className="m-0 mt-1 max-w-[60ch] text-xs text-muted-foreground">{item.motif}</p>
      {item.extra}

      <div className="mt-3 flex items-center gap-1">
        <Button size="sm" onClick={() => onDecide(item.id, primary.done)}>
          {primary.icon} {primary.label}
        </Button>
        {/* Secondaires révélées au survol ou au focus clavier, à la manière des
            contrôles de gouttière Notion. L'action principale, elle, reste
            toujours visible : masquer une action primaire serait un piège.
            Sur un pointeur sans survol (tactile), elles restent visibles en
            permanence — sinon elles seraient tout simplement inatteignables. */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-focus-within/proposal:opacity-100 group-hover/proposal:opacity-100 [@media(hover:none)]:opacity-100">
          {[secondary, dismiss].map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => onDecide(item.id, action.done)}
            >
              {action.icon} {action.label}
            </Button>
          ))}
        </div>
      </div>
    </article>
  );
}

/**
 * File de l'agent sélectionné. `registerCard` n'est fourni que par la vue
 * constellation, qui a besoin d'ancrer les traits de rattachement.
 */
function ProposalQueue({
  agent,
  decided,
  onDecide,
  registerCard,
}: {
  agent: string;
  decided: Record<string, string>;
  onDecide: (id: string, decision: string) => void;
  registerCard?: (id: string, el: HTMLElement | null) => void;
}) {
  const waiting = waitingFor(agent, decided);
  const running = runningFor(agent);
  const trace = PENDING.filter((item) => item.agent === agent && decided[item.id]);

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>
        À valider · {agent} · {waiting.length}
      </SectionLabel>

      {waiting.map((item) => (
        <div
          key={item.id}
          ref={(el) => {
            registerCard?.(item.id, el);
          }}
        >
          <ProposalBlock item={item} onDecide={onDecide} />
        </div>
      ))}

      {waiting.length === 0 && (
        <p className="m-0 px-1 py-2 text-xs text-muted-foreground">
          Rien à valider pour cet agent. Il continue en autonomie.
        </p>
      )}

      {trace.map((item) => (
        <p
          key={item.id}
          className="m-0 flex items-center gap-2 px-1 py-1.5 text-xs text-muted-foreground"
        >
          <CheckIcon className="size-3.5 shrink-0" /> {item.title} : {decided[item.id]}
        </p>
      ))}

      {running.length > 0 && (
        <div className="mt-1 flex flex-col gap-1.5">
          <SectionLabel>En cours</SectionLabel>
          <ul className="m-0 list-none p-0">
            {running.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2 border-t border-border px-1 py-2 text-xs text-muted-foreground first:border-t-0"
              >
                <span className="size-1.5 shrink-0 rounded-[2px] bg-foreground/40" aria-hidden />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const FEED = [
  { agent: 'Messaging', icon: <MessageSquareIcon />, text: 'Réponse envoyée à Amina Benali (heure d\'arrivée, lit bébé).', hitl: false, time: 'il y a 2 min' },
  { agent: 'Revenue', icon: <TrendingUpIcon />, text: 'Baisse de 12 % proposée sur 9 nuits (Riad Yasmine).', hitl: true, time: 'il y a 4 min' },
  { agent: 'Ops', icon: <WrenchIcon />, text: 'Intervention ménage créée après l\'annulation de RES-1039 (Villa Palmeraie).', hitl: false, time: 'il y a 18 min' },
  { agent: 'Sync', icon: <CalendarSyncIcon />, text: '3 calendriers réconciliés (Airbnb, Booking), aucun écart.', hitl: false, time: 'il y a 25 min' },
  { agent: 'Revenue', icon: <TrendingUpIcon />, text: '+8 % appliqué sur les week-ends de septembre (occupation > 85 %).', hitl: false, time: 'il y a 1 h' },
];

/**
 * Lecture seule : pas de surface, pas de frise chronologique décorative. Des
 * lignes séparées par des filets. On n'étiquette que l'exception (« validation
 * requise ») — l'exécution autonome est la norme et n'a pas à être signalée.
 */
function ActivityFeed() {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Activité</SectionLabel>
      {/* Plafond de largeur : en pleine largeur, l'horodatage finirait à 1 400 px
          du texte qu'il date. Sans effet quand le feed est déjà en colonne. */}
      <ul className="m-0 max-w-5xl list-none p-0">
        {FEED.map((event, index) => (
          <li
            key={index}
            className="flex items-start gap-3 border-t border-border px-2 py-2.5 transition-colors duration-100 first:border-t-0 hover:bg-muted/60"
          >
            <span className="mt-px text-muted-foreground [&>svg]:size-3.5">{event.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="m-0 max-w-[75ch] text-xs text-foreground">{event.text}</p>
              <p className="m-0 mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                Agent {event.agent}
                {event.hitl && <span className="text-warning-ink">validation requise</span>}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{event.time}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Section complète ────────────────────────────────────────────────────────
// ─── Section complète ────────────────────────────────────────────────────────

/** Durée de la rotation de l'anneau, alignée sur `.bo-ring` dans ORBIT_STYLES. */
const ROTATION_MS = 720;

export function BAgentsConstellationSectionDemo() {
  const [decided, setDecided] = useState<Record<string, string>>({});
  const [view, setView] = useState<'cards' | 'orbit'>('cards');
  const [autoMap, setAutoMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AGENTS.map((agent) => [agent.name, agent.auto]))
  );

  const [selected, setSelected] = useState(() => busiestAgent({}));
  const initialRotation = rotationFor(
    AGENTS.findIndex((agent) => agent.name === busiestAgent({})),
    AGENTS.length
  );
  const [rotation, setRotation] = useState(initialRotation);
  const rotationRef = useRef(initialRotation);
  const [rotating, setRotating] = useState(false);

  const pending = AGENTS.reduce((sum, agent) => sum + waitingFor(agent.name, decided).length, 0);

  /**
   * On ne recale pas chaque nœud : on fait pivoter l'anneau entier pour amener
   * l'agent choisi sur l'emplacement de tête. L'angle cible est « déroulé »
   * autour de l'angle courant afin que la rotation prenne toujours le chemin le
   * plus court — sans ça, passer de 225° à −45° partirait faire trois quarts de
   * tour à l'envers.
   */
  const selectAgent = (name: string) => {
    if (name === selected) return;
    const index = AGENTS.findIndex((agent) => agent.name === name);
    let target = rotationFor(index, AGENTS.length);
    while (target - rotationRef.current > 180) target -= 360;
    while (target - rotationRef.current < -180) target += 360;
    rotationRef.current = target;
    setRotation(target);
    setSelected(name);
    setRotating(true);
  };

  // Les traits de rattachement sont mesurés en pixels : pendant la rotation ils
  // pointeraient vers une position périmée. On les retire, puis on remesure.
  useLayoutEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setRotating(false), ROTATION_MS + 40);
    return () => window.clearTimeout(timer);
  }, [rotating]);

  const { wrapRef, registerNode, registerCard, tethers } = useTethers(
    view === 'orbit' && !rotating,
    selected,
    `${selected}:${Object.keys(decided).length}`
  );

  const decide = (id: string, decision: string) =>
    setDecided((prev) => ({ ...prev, [id]: decision }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Constellation d'agents"
        subtitle="4 agents · 60 tâches aujourd'hui"
        iconBadge={<BotIcon />}
        titleAdornment={
          pending > 0 ? (
            // text-warning-ink : la variante `warning` du Badge écrit en
            // --bui-warning, illisible sur fond clair (2,17:1).
            <Badge variant="warning" className="text-warning-ink">
              {pending} à valider
            </Badge>
          ) : (
            <Badge variant="secondary">À jour</Badge>
          )
        }
        showBackButton={false}
        className="mb-0"
        actions={
          <>
            {/* Segmenté sur rail teinté : le segment actif remonte en surface,
                convention partagée par Notion, Linear et macOS. */}
            <ToggleGroup
              type="single"
              variant="default"
              size="sm"
              spacing={0}
              value={view}
              onValueChange={(next) => next && setView(next as 'cards' | 'orbit')}
              className="rounded-md bg-muted p-0.5"
            >
              <ToggleGroupItem
                value="cards"
                aria-label="Vue cartes"
                title="Vue cartes"
                className="data-[state=on]:bg-card"
              >
                <LayoutGridIcon />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="orbit"
                aria-label="Vue constellation"
                title="Vue constellation"
                className="data-[state=on]:bg-card"
              >
                <OrbitIcon />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm" variant="ghost" className="text-muted-foreground">
              <SlidersHorizontalIcon /> Règles d'autonomie
            </Button>
          </>
        }
      />

      {view === 'cards' ? (
        <div key="cards" className="bo-view flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <SectionLabel>Agents</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {AGENTS.map((agent) => (
                <AgentCard
                  key={agent.name}
                  agent={agent}
                  auto={autoMap[agent.name]}
                  onAutoChange={(auto) => setAutoMap((prev) => ({ ...prev, [agent.name]: auto }))}
                  waiting={waitingFor(agent.name, decided).length}
                  running={runningFor(agent.name).length}
                />
              ))}
            </div>
          </section>
          <div className="grid grid-cols-1 items-start gap-x-8 gap-y-6 lg:grid-cols-[1.1fr_1fr]">
            <ProposalQueue agent={selected} decided={decided} onDecide={decide} />
            <ActivityFeed />
          </div>
        </div>
      ) : (
        <div key="orbit" className="bo-view flex flex-col gap-6">
          <div
            ref={wrapRef}
            className="bo-wrap relative grid grid-cols-1 items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,1fr)]"
          >
            <div className="flex flex-col gap-3">
              <AgentOrbit
                selected={selected}
                onSelect={selectAgent}
                rotation={rotation}
                decided={decided}
                registerNode={registerNode}
              />
              <p className="m-0 max-w-[52ch] text-xs text-muted-foreground">
                L'aire d'un nœud est proportionnelle à ses tâches du jour. Cliquez un agent pour
                amener sa file à droite ; survolez-le pour un aperçu. Les propositions sont triées
                par échéance.
              </p>
            </div>
            <ProposalQueue
              agent={selected}
              decided={decided}
              onDecide={decide}
              registerCard={registerCard}
            />
            <TetherOverlay tethers={tethers} />
          </div>
          <ActivityFeed />
        </div>
      )}
    </div>
  );
}
