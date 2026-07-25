import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  BotIcon,
  CalendarSyncIcon,
  CheckIcon,
  ListIcon,
  MessageSquareIcon,
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
 *       (propositions à valider) reçoivent un fond ; ce qui se lit seulement
 *       (feed, diagramme, liste d'agents) vit sur le fond de page, séparé par
 *       des filets d'1px. Une carte n'existe que si l'élévation porte du sens.</li>
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

// ─── Vue liste ───────────────────────────────────────────────────────────────

/**
 * Les agents en lignes plutôt qu'en grille de cartes identiques : même densité
 * d'information, sans quatre conteneurs qui se répètent. Le survol teinte la
 * ligne, comme une ligne de base Notion.
 */
function AgentRow({
  agent,
  auto,
  onAutoChange,
}: {
  agent: AgentNode;
  auto: boolean;
  onAutoChange: (auto: boolean) => void;
}) {
  const status = AGENT_STATUS[agent.status];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-2 py-3 transition-colors duration-100 first:border-t-0 hover:bg-muted/60">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
        {agent.icon}
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Agent {agent.name}</span>
          <span className={cn('flex items-center gap-1.5 text-xs', status.text)}>
            <span className={cn('size-1.5 rounded-[2px]', status.dot)} aria-hidden />
            {status.label}
          </span>
        </div>
        <p className="m-0 text-xs text-muted-foreground">{agent.role}</p>
      </div>
      {/* Largeurs fixes : sans elles les colonnes de droite flottent d'une
          ligne à l'autre et la liste perd sa verticale de lecture. */}
      <span className="w-20 text-end text-xs text-foreground tabular-nums">
        {agent.tasksToday} tâches
      </span>
      <span className="w-24 text-end text-xs text-muted-foreground">{agent.lastRun}</span>
      <label className="flex cursor-pointer items-center justify-end gap-2 text-xs text-muted-foreground">
        <span className="w-16 text-end">{auto ? 'Auto' : 'Validation'}</span>
        <Switch
          checked={auto}
          onCheckedChange={onAutoChange}
          aria-label={`Mode auto — Agent ${agent.name}`}
        />
      </label>
    </li>
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
}
`;

/**
 * Diagramme orbital : noyau Baitly au centre, agents en orbite.
 * Positions en `left/top` physiques (et non logiques) : c'est un schéma
 * géométrique, il ne se miroite pas en RTL — seul le rattachement aux cartes
 * s'adapte au sens de lecture (cf. `useTethers`).
 */
function AgentOrbit({
  autoMap,
  registerNode,
}: {
  autoMap: Record<string, boolean>;
  registerNode: (name: string, el: HTMLElement | null) => void;
}) {
  const maxTasks = Math.max(...AGENTS.map((agent) => agent.tasksToday));
  const totalTasks = AGENTS.reduce((sum, agent) => sum + agent.tasksToday, 0);

  return (
    <div className="bo-canvas relative mx-auto aspect-square w-full max-w-[420px]">
      <style>{ORBIT_STYLES}</style>

      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        {/* Trait plein très fin plutôt que pointillé : un cercle en tirets se
            lit comme un placeholder, et le motif était l'élément le plus
            bruyant du diagramme alors qu'il n'encode rien. Il ne reste ici que
            pour poser le plan sur lequel les agents sont alignés. */}
        <circle
          cx="50"
          cy="50"
          r={ORBIT_RADIUS}
          fill="none"
          className="stroke-border"
          strokeWidth="0.25"
          opacity="0.65"
        />
        {AGENTS.map((agent, index) => {
          const angle = orbitAngle(index, AGENTS.length);
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

      {AGENTS.map((agent, index) => {
        const diameter = nodeDiameter(agent.tasksToday, maxTasks);
        const point = polar(orbitAngle(index, AGENTS.length), ORBIT_RADIUS);
        const status = AGENT_STATUS[agent.status];
        const waiting = agent.status === 'waiting';
        return (
          <div
            key={agent.name}
            className="bo-node absolute"
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
              width: `${diameter}%`,
              height: `${diameter}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {waiting && (
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
                  ref={(el) => {
                    registerNode(agent.name, el);
                  }}
                  aria-label={`Agent ${agent.name} · ${agent.tasksToday} tâches aujourd'hui · ${status.label} · ${autoMap[agent.name] ? 'auto-application' : 'validation humaine'}`}
                  className={cn(
                    // bg-card, plus CLAIR que la page : le nœud se détache au
                    // lieu de s'enfoncer, comme les blocs de proposition. En
                    // bg-muted il était plus sombre que le fond et disparaissait.
                    'bo-hit relative flex size-full cursor-pointer items-center justify-center rounded-full border bg-card transition-colors duration-100 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                    waiting
                      ? 'border-warning/60 text-warning-ink'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {/* L'icône identifie l'agent (variable catégorielle), le
                      diamètre encode le volume (variable quantitative) : les
                      faire varier ensemble double l'encodage, vide les gros
                      nœuds et rend les petits illisibles. D'où une taille
                      quasi constante, juste bornée par clamp.
                      aspect-square donne une hauteur définie au conteneur :
                      sans elle, le size-full de l'icône n'a rien à résoudre. */}
                  <span
                    className="flex aspect-square items-center justify-center [&>svg]:size-full"
                    style={{ width: 'clamp(14px, 32%, 22px)' }}
                  >
                    {agent.icon}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Agent {agent.name} · {agent.role} · {agent.lastRun}
              </TooltipContent>
            </Tooltip>
            <span className="absolute inset-x-0 top-full mt-2 flex flex-col items-center gap-0.5 leading-tight">
              <span className="text-xs font-medium whitespace-nowrap text-foreground">
                {agent.name}
              </span>
              {/* Le mode auto/validation reste lisible ici : la vue liste porte
                  l'interrupteur, mais basculer de vue ne doit pas faire perdre
                  l'information elle-même.
                  L'aire encode le volume, donc le nœud le plus chargé est le
                  plus gros — pas forcément le plus urgent. La mention « à
                  valider » en ambre rétablit la priorité : la couleur ressort
                  en pré-attentif là où la taille joue contre nous. */}
              <span
                className={cn(
                  'text-xs whitespace-nowrap tabular-nums',
                  waiting ? 'font-medium text-warning-ink' : 'text-muted-foreground'
                )}
              >
                {agent.tasksToday} tâches · {waiting ? 'à valider' : autoMap[agent.name] ? 'auto' : 'validation'}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface Tether {
  name: string;
  waiting: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Mesure les traits qui rattachent chaque proposition à son agent. Les
 * coordonnées ne sont calculables qu'après layout (les deux extrémités vivent
 * dans des colonnes distinctes) : on lit les rects et on redessine sur resize.
 * Quand les colonnes s'empilent (mobile), aucun trait n'est tracé.
 */
function useTethers(enabled: boolean, revision: number) {
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
      const next: Tether[] = [];
      for (const agent of AGENTS) {
        const node = nodeEls.current[agent.name];
        const card = cardEls.current[agent.name];
        if (!node || !card) continue;
        const n = node.getBoundingClientRect();
        const c = card.getBoundingClientRect();
        // Carte franchement à droite (LTR) ou à gauche (RTL) du nœud ; sinon les
        // colonnes sont empilées et un trait n'aurait aucun sens.
        const toRight = c.left >= n.right;
        const toLeft = c.right <= n.left;
        if (!toRight && !toLeft) continue;
        next.push({
          name: agent.name,
          waiting: agent.status === 'waiting',
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
  }, [enabled, revision]);

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
            className={cn('bo-tether', tether.waiting ? 'stroke-warning/70' : 'stroke-border')}
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
              className={tether.waiting ? 'fill-warning/70' : 'fill-border'}
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
 */
function ProposalBlock({
  agent,
  meta,
  urgent,
  title,
  children,
  actions,
  onDecide,
}: {
  agent: string;
  meta: string;
  urgent?: boolean;
  title: string;
  children: React.ReactNode;
  /** [libellé du bouton, icône, participe passé pour la trace]. */
  actions: [primary: Action, secondary: Action, dismiss: Action];
  onDecide: (decision: string) => void;
}) {
  const [primary, secondary, dismiss] = actions;
  return (
    <article className="group/proposal rounded-md bg-card p-3.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn('size-1.5 rounded-[2px]', urgent ? 'bg-warning' : 'bg-muted-foreground/30')}
          aria-hidden
        />
        <span className="font-medium text-foreground">Agent {agent}</span>
        <span className={urgent ? 'text-warning-ink' : undefined}>{meta}</span>
      </div>

      <h3 className="m-0 mt-2 text-sm font-medium text-foreground [text-wrap:balance]">{title}</h3>
      {children}

      <div className="mt-3 flex items-center gap-1">
        <Button size="sm" onClick={() => onDecide(primary.done)}>
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
              onClick={() => onDecide(action.done)}
            >
              {action.icon} {action.label}
            </Button>
          ))}
        </div>
      </div>
    </article>
  );
}

interface Action {
  label: string;
  icon: React.ReactNode;
  /** Participe passé, pour la ligne de trace une fois la décision prise. */
  done: string;
}

function YieldProposal({ onDecide }: { onDecide: (decision: string) => void }) {
  return (
    <ProposalBlock
      agent="Revenue"
      meta="expire dans 22 h"
      urgent
      title="Baisse tarifaire sur Riad Yasmine"
      actions={[
        { label: 'Appliquer', icon: <CheckIcon />, done: 'appliquée' },
        { label: 'Ajuster', icon: <SlidersHorizontalIcon />, done: 'ouverte pour ajustement' },
        { label: 'Refuser', icon: <XIcon />, done: 'refusée' },
      ]}
      onDecide={onDecide}
    >
      <p className="m-0 mt-1 max-w-[60ch] text-xs text-muted-foreground">
        9 nuits invendues du 18 au 27 août. Baisse de <b className="font-medium text-foreground">12 %</b> sur
        ces dates seulement, prix plancher respecté.
      </p>
      {/* Chiffres en ligne : un encadré gris dans un bloc déjà surfacé serait
          une surface imbriquée. La hiérarchie passe par la graisse.
          Le revenu attendu est l'espérance réelle (9 nuits × 70 € × 74 %), pas
          un chiffre d'ambiance : sur un écran de décision financière, un nombre
          qui ne se recalcule pas coûte la confiance dans tout le reste. */}
      <p className="m-0 mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          Nuitée{' '}
          <span className="tabular-nums"><Money value={80} decimals={0} /></span>
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
    </ProposalBlock>
  );
}

function MessageProposal({ onDecide }: { onDecide: (decision: string) => void }) {
  return (
    <ProposalBlock
      agent="Messaging"
      meta="panier abandonné il y a 26 h"
      title="Relance de Karim El Fassi"
      actions={[
        { label: 'Envoyer', icon: <CheckIcon />, done: 'envoyée' },
        { label: 'Modifier', icon: <PencilIcon />, done: 'ouverte en édition' },
        { label: 'Ignorer', icon: <XIcon />, done: 'ignorée' },
      ]}
      onDecide={onDecide}
    >
      <p className="m-0 mt-1 max-w-[60ch] text-xs text-muted-foreground">
        2 nuits au Duplex Guéliz, 940 €. Message proposé :
      </p>
      <blockquote className="m-0 mt-2 rounded-sm bg-muted px-2.5 py-2 text-xs text-foreground">
        Bonjour Karim, votre séjour du 14 au 16 août au Duplex Guéliz est toujours disponible.
        Réservez avant ce soir et profitez du petit-déjeuner offert.
      </blockquote>
    </ProposalBlock>
  );
}

/**
 * File de validation, partagée par les deux vues. `registerCard` n'est fourni
 * que par la vue constellation, qui a besoin d'ancrer les traits.
 */
function ProposalQueue({
  decisions,
  onDecide,
  registerCard,
}: {
  decisions: string[];
  onDecide: (decision: string) => void;
  registerCard?: (name: string, el: HTMLElement | null) => void;
}) {
  const pending = 2 - decisions.length;
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>À valider · {pending}</SectionLabel>
      {decisions.length < 1 && (
        <div
          ref={(el) => {
            registerCard?.('Revenue', el);
          }}
        >
          <YieldProposal onDecide={(d) => onDecide(`Proposition tarifaire ${d}`)} />
        </div>
      )}
      {decisions.length < 2 && (
        <div
          ref={(el) => {
            registerCard?.('Messaging', el);
          }}
        >
          <MessageProposal onDecide={(d) => onDecide(`Relance ${d}`)} />
        </div>
      )}
      {decisions.map((decision) => (
        <p
          key={decision}
          className="m-0 flex items-center gap-2 px-1 py-1.5 text-xs text-muted-foreground"
        >
          <CheckIcon className="size-3.5 shrink-0" /> {decision}
        </p>
      ))}
      {pending === 0 && (
        <p className="m-0 px-1 py-2 text-xs text-muted-foreground">
          Rien à valider. Les agents continuent en autonomie.
        </p>
      )}
    </section>
  );
}

// ─── Feed d'activité ─────────────────────────────────────────────────────────

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

export function BAgentsConstellationSectionDemo() {
  const [decisions, setDecisions] = useState<string[]>([]);
  const [view, setView] = useState<'list' | 'orbit'>('list');
  const [autoMap, setAutoMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AGENTS.map((agent) => [agent.name, agent.auto]))
  );
  const pending = 2 - decisions.length;
  const { wrapRef, registerNode, registerCard, tethers } = useTethers(
    view === 'orbit',
    decisions.length
  );

  const decide = (decision: string) => setDecisions((prev) => [...prev, decision]);

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
              onValueChange={(next) => next && setView(next as 'list' | 'orbit')}
              className="rounded-md bg-muted p-0.5"
            >
              <ToggleGroupItem
                value="list"
                aria-label="Vue liste"
                title="Vue liste"
                className="data-[state=on]:bg-card"
              >
                <ListIcon />
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

      {view === 'list' ? (
        <div key="list" className="bo-view flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <SectionLabel>Agents</SectionLabel>
            <ul className="m-0 list-none p-0">
              {AGENTS.map((agent) => (
                <AgentRow
                  key={agent.name}
                  agent={agent}
                  auto={autoMap[agent.name]}
                  onAutoChange={(auto) => setAutoMap((prev) => ({ ...prev, [agent.name]: auto }))}
                />
              ))}
            </ul>
          </section>
          <div className="grid grid-cols-1 items-start gap-x-8 gap-y-6 lg:grid-cols-[1.1fr_1fr]">
            <ProposalQueue decisions={decisions} onDecide={decide} />
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
              <AgentOrbit autoMap={autoMap} registerNode={registerNode} />
              <p className="m-0 max-w-[52ch] text-xs text-muted-foreground">
                L'aire d'un nœud est proportionnelle à ses tâches du jour. Survolez un agent pour
                voir ses échanges avec le noyau. L'interrupteur auto/validation est dans la vue
                liste.
              </p>
            </div>
            <ProposalQueue decisions={decisions} onDecide={decide} registerCard={registerCard} />
            <TetherOverlay tethers={tethers} />
          </div>
          <ActivityFeed />
        </div>
      )}
    </div>
  );
}
