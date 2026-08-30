/* ============================================================
   <OrbitDiagram> — le diagramme orbital PUR (grammaire projection)

   Reproduction exacte du canvas de la projection « Constellation
   d'agents » (BAgentsConstellationSectionDemo) : orbite unique à
   filet, nœuds au diamètre uniforme posés SUR LE FOND DE PAGE
   (aucune carte-canvas), rotation de l'anneau vers l'emplacement
   de tête à la sélection, relais à paquet unique noyau → agent.

   Sélection CONTRÔLÉE par le parent (le tableau et le renderer en
   ont besoin pour la file / le drawer) ; le diagramme possède la
   rotation et annonce l'agent stabilisé (onHeadAgentSettled) pour
   les attaches vers les cartes.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useElementSize } from '../core/useElementSize';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { MARK_PATH, MARK_VIEWBOX, STROKE_WIDTH } from '../../../components/BaitlyMarkLogo';
import { MousePointerClick } from '../../../icons';
import { cn } from '../../../utils/cn';
import { AGENT_META, STATUS, STATUS_PRIORITY } from '../constants';
import { AgentIcon } from './agentIcon';
import type { ConstellationAgentView } from './ConstellationRenderer';
import type { AgentId, PendingAction } from '../types';

// ─── Géométrie (reprise de la projection) ────────────────────────────────────

/** Emplacement de tête : haut-droite, face à la file HITL. */
const SLOT_ANGLE = -45;
/**
 * Rayon d'orbite (% du canvas) — CALCULÉ, pas figé : l'anneau s'écarte jusqu'à
 * ce que les libellés du bas touchent le bord, puis se resserre quand le canvas
 * rétrécit. Les libellés font une hauteur en PIXELS (deux lignes + marge), donc
 * la place qu'ils réclament est d'autant plus grande que le canvas est petit —
 * d'où un rayon qui dépend de la taille mesurée. Bornes : au-delà de 38 % on ne
 * gagne plus en lisibilité, en dessous de 28 % l'anneau colle au noyau.
 */
const ORBIT_RADIUS_MAX = 38;
const ORBIT_RADIUS_MIN = 28;
/** Place réservée SOUS le dernier nœud pour son libellé (2 lignes + marge). */
const LABEL_ROOM_PX = 38;
/**
 * Distance d'arc minimale entre deux nœuds voisins pour que TOUTES les légendes
 * tiennent. En dessous, seuls les agents qui demandent quelque chose gardent la
 * leur — un agent en veille n'a rien à dire, sa légende ne fait qu'entrer dans
 * celle du voisin.
 */
const LABEL_MIN_ARC_PX = 110;
/**
 * Écartement horizontal de la légende vers l'EXTÉRIEUR de l'anneau, quand il
 * est à l'étroit. Sur les flancs, une légende posée sous son nœud pointe vers
 * le voisin ; la pousser dehors la dégage. On ne va pas jusqu'au placement
 * radial complet — 98 px n'auraient pas la place de sortir du carré.
 */
const LABEL_SHIFT_PX = 30;
/** Demi-largeur typique d'une légende — sert à ne pas la pousser hors du cadre. */
const LABEL_HALF_WIDTH_PX = 50;
const CORE_SIZE = 15;
/** Diamètre uniforme des nœuds (% du canvas) — le volume ne se lit pas ici. */
const NODE_SIZE = 13;
/**
 * Part du canvas réellement OCCUPÉE par le dessin (anneau + nœuds) au rayon
 * maximal. Le canvas carré est plus grand que son dessin : le dimensionner sur
 * la boîte laisserait une couronne de vide. On le dimensionne donc sur cette
 * empreinte — le carré peut alors déborder la boîte, seul son vide déborde.
 */
const CONTENT_SPAN = (2 * ORBIT_RADIUS_MAX + NODE_SIZE) / 100;
/** Durée de la rotation de l'anneau — alignée sur `.oc-ring` ci-dessous. */
const ROTATION_MS = 720;
/**
 * Durée d'un cycle du relais de données — EXPORTÉE : les paquets des attaches
 * (SupervisionTethers) battent sur la même horloge. Les deux jambes se calent
 * sur une horloge GLOBALE (retard négatif = performance.now() % cycle posé au
 * démarrage) : quel que soit leur instant de montage, la sortie du noyau
 * occupe [0 ; 38 %] du cycle et le dispatch vers les cartes [38 ; 92 %].
 */
export const FLOW_CYCLE_MS = 3200;

/** Phase courante de l'horloge globale du relais, en retard négatif CSS. */
export function flowClockDelay(): string {
  return `-${Math.round(performance.now() % FLOW_CYCLE_MS)}ms`;
}

/**
 * Jambe radiale du relais, en unités du viewBox — la MÊME pour tous les agents
 * (rayons constants) : le dash du paquet s'écrit en unités utilisateur exactes.
 * Indispensable : `pathLength` + `vector-effect: non-scaling-stroke` est bugué
 * dans Chromium (pathLength ignoré → tirets fantômes).
 */
const FLOW_LEG_START = CORE_SIZE / 2 + 1.3;
const flowLegEnd = (radius: number) => radius - NODE_SIZE / 2 - 0.6;
const flowLegLength = (radius: number) => flowLegEnd(radius) - FLOW_LEG_START;
const FLOW_DASH = 4.5;

/**
 * Rayon d'orbite pour un canvas de `side` pixels : le plus large possible dont
 * les libellés du bas tiennent encore dans le carré. `side` non mesuré → rayon
 * maximal (le premier rendu ne doit pas partir riquiqui).
 */
function orbitRadiusFor(side: number): number {
  if (side <= 0) return ORBIT_RADIUS_MAX;
  const labelRoom = (LABEL_ROOM_PX / side) * 100;
  const fits = 50 - NODE_SIZE / 2 - labelRoom;
  return Math.max(ORBIT_RADIUS_MIN, Math.min(ORBIT_RADIUS_MAX, fits));
}

/** Angle canonique d'un agent, avant rotation de l'anneau. */
function baseAngle(index: number, total: number) {
  return (index * 360) / total;
}

/** Rotation à appliquer pour amener l'agent `index` sur l'emplacement de tête. */
function rotationFor(index: number, total: number) {
  return SLOT_ANGLE - baseAngle(index, total);
}

/** Point de l'orbite pour un angle donné, en % du canvas. */
function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

/** Agent pré-sélectionné : le plus chargé en attente, puis le plus prioritaire. */
export function busiestAgent(agents: ConstellationAgentView[]): AgentId | null {
  if (agents.length === 0) return null;
  return [...agents].sort(
    (a, b) =>
      (b.pendingCount ?? 0) - (a.pendingCount ?? 0)
      || STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status],
  )[0].id;
}

// ─── Feuille scopée `oc-` (règles du diagramme, pas du kit) ──────────────────

const orbitStyles = (radius: number) => `
/* Rotation de l'anneau à la sélection : l'anneau porte la rotation, chaque
   nœud la rotation inverse — les agents glissent le long de l'orbite. */
.oc-ring, .oc-node { transition: transform ${ROTATION_MS}ms cubic-bezier(.25,1,.5,1); }

/* Relais de données : UN paquet, du noyau vers l'agent sélectionné. Le motif
   suit le rayon courant (l'anneau s'écarte avec le canvas) — sans quoi le
   paquet s'arrêterait avant le nœud ou le dépasserait. */
.oc-packet {
  display: none;
  fill: none;
  stroke-linecap: round;
  opacity: .85;
  stroke-dasharray: ${FLOW_DASH} ${(flowLegLength(radius) * 3).toFixed(1)};
  animation: oc-relay-out ${FLOW_CYCLE_MS}ms linear infinite;
}
.oc-flow[data-selected="true"] .oc-packet { display: inline; }
@keyframes oc-relay-out {
  0% { stroke-dashoffset: ${FLOW_DASH}; }
  38%, 100% { stroke-dashoffset: ${(-(flowLegLength(radius) + FLOW_DASH)).toFixed(1)}; }
}

/* Halo de l'agent qui attend une décision : la seule boucle au repos. */
.oc-ripple { opacity: 0; transform-origin: center; animation: oc-ripple 3.6s cubic-bezier(.25,1,.5,1) infinite; }
@keyframes oc-ripple { 0% { transform: scale(1); opacity: .45; } 100% { transform: scale(1.4); opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .oc-ripple { display: none; }
  .oc-flow[data-selected="true"] .oc-packet { display: none; }
  .oc-ring, .oc-node { transition: none; }
}
`;

export interface OrbitDiagramProps {
  agents: ConstellationAgentView[];
  selected: AgentId | null;
  onSelect: (id: AgentId) => void;
  /** Relais autorisé (en ligne, hors kill-switch). */
  flowEnabled: boolean;
  /** Agent stabilisé en tête, rotation finie (null pendant la rotation). */
  onHeadAgentSettled?: (id: AgentId | null) => void;
  /** Cœur cliquable (mode focus du renderer) ; absent = cœur statique. */
  onCoreClick?: () => void;
  corePressed?: boolean;
  /** File HITL brute — aperçu borné dans l'infobulle des nœuds. */
  pendingItems?: readonly PendingAction[];
  className?: string;
}

/** Nombre de lignes montrées dans l'infobulle avant de renvoyer vers la file —
 *  une infobulle qui déborde n'est plus une infobulle (règle projection). */
const TOOLTIP_MAX_ITEMS = 3;

/** « 5 h 20 » / « 40 min » / « < 1 min » — même vocabulaire que les cartes. */
function tooltipRemaining(expiresAt: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return t('supervision.hitl.expired');
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 1) return `${hours} ${t('supervision.hitl.unitHour')} ${String(minutes).padStart(2, '0')}`;
  if (minutes >= 1) return `${minutes} ${t('supervision.hitl.unitMin')}`;
  return t('supervision.hitl.lessThanMin');
}

/**
 * Infobulle enrichie (dessin projection) : identité de l'agent, puis un aperçu
 * BORNÉ de ce qu'il a en attente (titres + échéances) et de ce qu'il exécute.
 * Au-delà de trois lignes on ne déroule pas, on invite à ouvrir la file.
 */
function AgentNodeTooltip({
  agent,
  waiting,
  isSelected,
}: {
  agent: ConstellationAgentView;
  waiting: readonly PendingAction[];
  isSelected: boolean;
}) {
  const { t } = useTranslation();
  const meta = AGENT_META[agent.id];
  const rows = [
    ...waiting.map((item) => ({
      key: item.id,
      label: item.title?.trim() || t('supervision.payment.fallbackTitle', 'Demande de service'),
      hint: tooltipRemaining(item.expiresAt, t),
      pending: true,
    })),
    ...(agent.task
      ? [{ key: 'task', label: agent.task, hint: t('supervision.board.inProgress', 'en cours'), pending: false }]
      : []),
  ];
  const shown = rows.slice(0, TOOLTIP_MAX_ITEMS);
  const rest = rows.length - shown.length;

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5">
      <div>
        <p className="m-0 text-xs font-medium">
          {t('supervision.feed.agentLine', { name: t(meta.nameKey), defaultValue: 'Agent {{name}}' })}
        </p>
        <p className="m-0 text-xs opacity-70">{t(meta.roleKey)}</p>
      </div>

      {rows.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {shown.map((row) => (
            <li key={row.key} className="flex items-start gap-1.5 text-xs">
              <span
                aria-hidden
                className={cn(
                  'mt-1 size-1.5 shrink-0 rounded-[2px]',
                  row.pending ? 'bg-warning' : 'bg-current opacity-50',
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
          t('supervision.board.tooltipQueueOpen', 'File ouverte à droite')
        ) : (
          <>
            <MousePointerClick size={12} strokeWidth={1.75} className="shrink-0" />
            {rest > 0
              ? t('supervision.board.tooltipSeeMore', {
                  count: rest,
                  defaultValue: 'Cliquer pour voir {{count}} autre(s)',
                })
              : t('supervision.board.tooltipOpenQueue', 'Cliquer pour ouvrir la file')}
          </>
        )}
      </p>
    </div>
  );
}

export function OrbitDiagram({
  agents,
  selected,
  onSelect,
  flowEnabled,
  onHeadAgentSettled,
  onCoreClick,
  corePressed,
  pendingItems,
  className,
}: OrbitDiagramProps) {
  const { t } = useTranslation();

  const selectedIndex = Math.max(0, agents.findIndex((agent) => agent.id === selected));
  const [rotation, setRotation] = useState(() => rotationFor(selectedIndex, agents.length || 1));
  const rotationRef = useRef(rotation);
  const [rotating, setRotating] = useState(false);

  // Sélection contrôlée : quand elle change, l'anneau pivote par le chemin le
  // plus court (angle cible « déroulé » autour de l'angle courant).
  useEffect(() => {
    if (!selected || agents.length === 0) return;
    const index = agents.findIndex((agent) => agent.id === selected);
    if (index < 0) return;
    let target = rotationFor(index, agents.length);
    if (Math.abs(target - rotationRef.current) < 0.5) return;
    while (target - rotationRef.current > 180) target -= 360;
    while (target - rotationRef.current < -180) target += 360;
    rotationRef.current = target;
    setRotation(target);
    setRotating(true);
    const timer = window.setTimeout(() => setRotating(false), ROTATION_MS + 40);
    return () => window.clearTimeout(timer);
  }, [selected, agents]);

  // Le relais ne joue que l'agent arrivé en tête ; même condition pour les
  // attaches, annoncée au parent (positions stables uniquement).
  const flowActive = flowEnabled && !rotating;
  useEffect(() => {
    onHeadAgentSettled?.(flowActive && selected ? selected : null);
  }, [flowActive, selected, onHeadAgentSettled]);

  // Calage du paquet radial sur l'horloge GLOBALE du relais : posé quand le
  // flux (re)démarre — l'animation CSS repart alors avec ce retard, en phase
  // avec les paquets d'attaches qui se calent sur la même horloge au montage.
  const [flowDelay, setFlowDelay] = useState('0ms');
  useEffect(() => {
    if (flowActive && selected) setFlowDelay(flowClockDelay());
  }, [flowActive, selected]);

  const CoreTag = onCoreClick ? 'button' : 'div';

  // Le DESSIN épouse la boîte offerte, pas le carré théorique : on dimensionne
  // sur l'empreinte réelle (anneau + nœuds + la bande de libellés qui pend
  // sous le dernier rang). Sans plafond : sur un grand écran le diagramme
  // respire — les libellés, eux, ne grandissent pas, donc plus le cercle est
  // large, moins ils se chevauchent. Repli tant que rien n'est mesuré (premier
  // rendu, jsdom).
  const [boxRef, box] = useElementSize<HTMLDivElement>();
  const side = Math.max(
    0,
    Math.min(box.width / CONTENT_SPAN, (box.height - LABEL_ROOM_PX) / CONTENT_SPAN),
  );
  const radius = orbitRadiusFor(side);

  // Anneau à l'étroit : distance d'arc entre deux nœuds voisins. En dessous de
  // LABEL_MIN_ARC_PX, les légendes (44 à 98 px de large) débordent sur le nœud
  // d'à côté — mesuré, 5 recouvrements sur 10 agents à 79 px d'arc, aucun à
  // 142. Les placer radialement ne sauverait rien : sur les flancs, une légende
  // de 98 px n'a pas la place de sortir du carré.
  const arcPx = agents.length > 0 ? (2 * Math.PI * ((radius / 100) * side)) / agents.length : 0;
  const crowded = arcPx > 0 && arcPx < LABEL_MIN_ARC_PX;

  return (
    <div ref={boxRef} className={cn('flex min-h-0 items-center justify-center', className)}>
      {/* marginBottom : le dessin n'est PAS centré dans son carré — les
          libellés pendent sous le dernier rang de nœuds. Réserver cette bande
          sous le carré remonte l'ensemble d'une demi-bande, et c'est le DESSIN
          qui se retrouve centré dans la boîte (sans ça : un trou en haut, des
          libellés collés en bas). */}
      <div
        data-supervision-constellation
        className="relative aspect-square"
        style={
          side > 0
            ? { width: side, height: side, marginBottom: LABEL_ROOM_PX }
            : { width: '100%' }
        }
      >
        <style>{orbitStyles(radius)}</style>

        {/* L'anneau d'orbite ne tourne pas : il est invariant par rotation. */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            className="stroke-border"
            strokeWidth="0.25"
            opacity="0.65"
          />
        </svg>

        <div className="oc-ring absolute inset-0" style={{ transform: `rotate(${rotation}deg)` }}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
            {agents.map((agent, index) => {
              const angle = baseAngle(index, agents.length);
              const from = polar(angle, FLOW_LEG_START);
              const to = polar(angle, flowLegEnd(radius));
              const segment = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
              return (
                <g
                  key={agent.id}
                  className="oc-flow"
                  data-selected={(agent.id === selected && flowActive) || undefined}
                >
                  {/* Même dessin que les attaches (rail 1 px, paquet 1,5 px) :
                      non-scaling-stroke fige l'épaisseur en pixels d'écran. */}
                  <line
                    {...segment}
                    vectorEffect="non-scaling-stroke"
                    strokeWidth="1"
                    className="stroke-border"
                  />
                  {/* Le flux de données est TOUJOURS encre (noir en thème clair) :
                      l'ambre est réservé aux RAILS urgents des attaches. PAS de
                      non-scaling-stroke ici : il ferait interpréter le dash en
                      PIXELS ÉCRAN (spec SVG) — la période du motif devenait plus
                      courte que le rail et DEUX tirets apparaissaient. En unités
                      viewBox, un seul paquet est mathématiquement possible
                      (0.32 unité ≈ 1,5 px au canvas maximal). */}
                  <line
                    {...segment}
                    strokeWidth="0.32"
                    className="oc-packet stroke-foreground"
                    style={{ animationDelay: flowDelay }}
                  />
                </g>
              );
            })}
          </svg>

          {agents.map((agent, index) => {
            const meta = AGENT_META[agent.id];
            const point = polar(baseAngle(index, agents.length), radius);
            const pending = agent.pendingCount ?? 0;
            // Actions en attente de CET agent, échéance la plus proche d'abord —
            // l'aperçu borné de l'infobulle.
            const waiting = (pendingItems ?? [])
              .filter((item) => item.agentId === agent.id)
              .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
            const isSelected = agent.id === selected;
            const isAttention = agent.status === 'esc' || agent.status === 'err';
            // Le halo ne signale que ce qui n'est PAS déjà ouvert à droite.
            const needsDecision = (pending > 0 || agent.status === 'wait') && !isSelected;
            const statusLabel = t(STATUS[agent.status].labelKey);
            // Ce que la PASTILLE dit deja ne se redit pas en texte. « 6 a
            // valider », puis « Attend ta validation » : deux facons d'ecrire le
            // meme nombre, sous un noeud qui l'affiche une troisieme fois. Un
            // agent qui attend n'a donc plus de seconde ligne — son compte se lit
            // sur le noeud. Les autres etats, eux, restent nommes : la pastille
            // ne sait pas dire « Agit » ni « Reflechit a 40 % ».
            const countedByBadge = pending > 0 || agent.status === 'wait';
            const subLabel = isAttention
              ? statusLabel
              : countedByBadge
                ? null
                : agent.status === 'think' && agent.thinkingProgress != null
                  ? `${statusLabel} · ${Math.round(agent.thinkingProgress)} %`
                  : statusLabel;

            // Position de la légende quand l'anneau est à l'étroit. Le nœud
            // porte déjà la rotation inverse de l'anneau : ses axes locaux sont
            // ceux de l'écran, on raisonne donc en angle VISUEL.
            const visualRad = ((baseAngle(index, agents.length) + rotation) * Math.PI) / 180;
            // Moitié haute (sin < 0 en repère écran) : la légende passe AU-DESSUS.
            // Posée dessous, elle descendait sur le nœud suivant de l'anneau —
            // les deux recouvrements mesurés étaient exactement ceux-là.
            const labelAbove = crowded && Math.sin(visualRad) < -0.25;
            // Poussée vers l'extérieur, BORNÉE par la place réelle : le carré du
            // dessin est plus large que sa boîte, pousser sans regarder coupait
            // la légende au bord. On ne pousse que ce qui rentre encore.
            const cos = Math.cos(visualRad);
            const room = box.width / 2 - Math.abs(cos) * ((radius / 100) * side) - LABEL_HALF_WIDTH_PX;
            const labelShift = crowded
              ? Math.sign(cos) * Math.min(LABEL_SHIFT_PX, Math.max(0, room))
              : 0;

            return (
              <div
                key={agent.id}
                className="oc-node absolute"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  width: `${NODE_SIZE}%`,
                  height: `${NODE_SIZE}%`,
                  transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                }}
              >
                {needsDecision && (
                  <>
                    <span aria-hidden className="pointer-events-none absolute -inset-[10%] rounded-full ring-1 ring-warning/30" />
                    <span aria-hidden className="oc-ripple pointer-events-none absolute -inset-[10%] rounded-full ring-1 ring-warning/45" />
                  </>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-agent={agent.id}
                      data-status={agent.status}
                      aria-pressed={isSelected}
                      // Le lecteur d'écran, lui, ne voit pas la pastille : on
                      // lui donne le compte que le texte ne porte plus.
                      aria-label={[
                        t(meta.nameKey),
                        subLabel ?? statusLabel,
                        pending > 0 ? `${pending} ${t('supervision.board.toValidate', 'à valider')}` : null,
                      ].filter(Boolean).join(' · ')}
                      onClick={() => onSelect(agent.id)}
                      className={cn(
                        'relative flex size-full cursor-pointer items-center justify-center rounded-full border bg-card transition-colors duration-100 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                        isSelected && 'border-primary/45 text-foreground ring-1 ring-primary/25',
                        !isSelected && isAttention && 'border-destructive/60 text-destructive',
                        !isSelected && !isAttention && needsDecision && 'border-warning/60 text-warning-ink',
                        !isSelected && !isAttention && !needsDecision && 'border-border text-muted-foreground',
                        agent.status === 'veille' && !isSelected && 'opacity-70',
                      )}
                    >
                      <span className="flex aspect-square items-center justify-center" style={{ width: 'clamp(14px, 32%, 22px)' }}>
                        <AgentIcon token={meta.icon} size={18} strokeWidth={1.75} />
                      </span>
                      {/* Portefeuille : nb de logements concernés. */}
                      {agent.badge != null && agent.badge > 0 && (
                        <span className="absolute -end-1 -top-1 z-10 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground tabular-nums">
                          {agent.badge}
                        </span>
                      )}
                      {/* Le compte, a toutes les largeurs. Il n'apparaissait
                          qu'a l'etroit, la legende s'en chargeant au-dela :
                          deux rendus pour une meme information, dont un qui
                          evincait l'etat de l'agent. */}
                      {agent.badge == null && pending > 0 && (
                        // Fond de CARTE, opaque. `warning-soft` vaut
                        // `rgba(…, 0.16)` : l'anneau et les liens du diagramme
                        // se voyaient au travers, et le nombre devenait illisible
                        // selon ce qui passait dessous. L'aplat vif n'est pas une
                        // option non plus — `warning-ink` dessus ne donne que
                        // 3,06:1, sous le seuil. Le contour et l'encre portent
                        // donc seuls l'identité d'alerte.
                        <span className="absolute -end-1 -top-1 z-10 inline-flex min-w-4 items-center justify-center rounded-full border border-warning bg-card px-1 text-[9px] font-bold text-warning-ink tabular-nums">
                          {pending}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[16rem] p-0">
                    <AgentNodeTooltip agent={agent} waiting={waiting} isSelected={isSelected} />
                  </TooltipContent>
                </Tooltip>
                {/* Anneau à l'étroit : une SEULE légende, celle de l'agent
                    ouvert (plus une escalade, qui doit être nommée) — sinon les
                    légendes se recouvrent. Les noms restent dans l'infobulle et
                    dans `aria-label`. Le compte, lui, est toujours sur le nœud :
                    attaché à l'icône, il ne peut recouvrir personne. */}
                {(!crowded || isSelected || isAttention) && (
                  <span
                    className={cn(
                      'absolute inset-x-0 flex flex-col items-center gap-0.5 leading-tight',
                      labelAbove ? 'bottom-full mb-2' : 'top-full mt-2',
                    )}
                    style={labelShift ? { transform: `translateX(${labelShift.toFixed(1)}px)` } : undefined}
                  >
                    <span className="text-xs font-medium whitespace-nowrap text-foreground">
                      {t(meta.nameKey)}
                    </span>
                    {subLabel && (
                      <span
                        className={cn(
                          'text-xs whitespace-nowrap tabular-nums',
                          isAttention ? 'font-medium text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {subLabel}
                      </span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Le noyau reste au centre, hors de l'anneau qui pivote. */}
        <CoreTag
          {...(onCoreClick
            ? { type: 'button' as const, onClick: onCoreClick, 'aria-pressed': corePressed }
            : {})}
          data-core
          aria-label={t('supervision.hud.orchestrator')}
          className={cn(
            'absolute inset-0 m-auto flex items-center justify-center rounded-full bg-primary text-primary-foreground',
            onCoreClick
              ? 'cursor-pointer focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'
              : 'cursor-default',
          )}
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
        </CoreTag>
      </div>
    </div>
  );
}
