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
import { useMediaQuery } from '../../../hooks/use-media-query';
import { useElementSize } from '../core/useElementSize';
import { DATA_FLOW_STYLES, FLOW_DASH, FLOW_STROKE, flowClockDelay, flowPacketStyle } from '../core/dataFlow';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { MARK_PATH, MARK_VIEWBOX, STROKE_WIDTH } from '../../../components/BaitlyMarkLogo';
import { AccessTime, ErrorOutline, Home, MousePointerClick } from '../../../icons';
import { cn } from '../../../utils/cn';
import { AGENT_META, STATUS, STATUS_PRIORITY } from '../constants';
import { AgentIcon } from './agentIcon';
import type { ConstellationAgentView } from './ConstellationRenderer';
import type { AgentId, PendingAction } from '../types';
import '../supervision-surfaces.css';
import './orbit-diagram.css';

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
/** Espace pour le contour extérieur et le focus clavier aux bords du dessin. */
const ORBIT_EDGE_PX = 10;
/**
 * Distance d'arc minimale entre deux nœuds voisins pour que TOUTES les légendes
 * tiennent. En dessous, seuls les agents qui demandent quelque chose gardent la
 * leur — un agent en veille n'a rien à dire, sa légende ne fait qu'entrer dans
 * celle du voisin.
 */
const LABEL_MIN_ARC_PX = 140;
/**
 * Écartement horizontal de la légende vers l'EXTÉRIEUR de l'anneau, quand il
 * est à l'étroit. Sur les flancs, une légende posée sous son nœud pointe vers
 * le voisin ; la pousser dehors la dégage. On ne va pas jusqu'au placement
 * radial complet — 98 px n'auraient pas la place de sortir du carré.
 */
const LABEL_SHIFT_PX = 30;
const CORE_SIZE = 15;
/** Diamètre uniforme des nœuds (% du canvas) — le volume ne se lit pas ici. */
const NODE_SIZE = 13;
/**
 * Empreinte RÉELLE du dessin (anneau + nœuds) pour un carré de `side` px.
 *
 * <p>Le carré est toujours plus grand que son dessin : le dimensionner sur la
 * boîte laisserait une couronne de vide. On le dimensionne donc sur cette
 * empreinte — le carré peut alors déborder la boîte, seul son vide déborde.</p>
 */
function contentSpan(side: number): number {
  return ((2 * orbitRadiusFor(side) + NODE_SIZE) / 100) * side;
}

/**
 * Plus grand carré dont le DESSIN tient dans la boîte, en largeur comme en
 * hauteur (la bande de libellés qui pend sous le dernier rang comprise).
 *
 * <p>Le carré était dimensionné sur l'empreinte au rayon MAXIMAL. Or
 * `orbitRadiusFor` resserre le rayon dès que le canvas est petit : la place des
 * libellés se compte en pixels, donc en pourcentage elle grandit quand le
 * canvas rétrécit. Sur téléphone le rayon tombait à ~30 % au lieu de 38 — le
 * dessin n'occupait plus que les trois quarts d'un carré lui-même bridé par la
 * hauteur, d'où une constellation riquiqui au milieu du vide.</p>
 *
 * <p>L'empreinte est croissante avec le côté, mais par morceaux (trois régimes
 * selon les bornes du rayon) : on cherche le côté par DICHOTOMIE plutôt que
 * d'inverser la formule à la main, ce qu'un changement de borne casserait en
 * silence.</p>
 */
function fitSide(width: number, height: number): number {
  const room = height - LABEL_ROOM_PX;
  if (width <= 0 || room <= 0) return 0;
  let low = 0;
  let high = Math.max(width, height) * 3;
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    const drawn = contentSpan(mid);
    if (drawn <= width && drawn <= room) low = mid;
    else high = mid;
  }
  return low;
}
/** Durée de la rotation de l'anneau — alignée sur `.oc-ring` ci-dessous. */
const ROTATION_MS = 560;
/**
 * Jambe radiale du relais, en unités du viewBox — la MÊME pour tous les agents
 * (rayons constants) : le dash du paquet s'écrit en unités utilisateur exactes.
 * Indispensable : `pathLength` + `vector-effect: non-scaling-stroke` est bugué
 * dans Chromium (pathLength ignoré → tirets fantômes).
 */
const FLOW_LEG_START = CORE_SIZE / 2 + 1.3;
const flowLegEnd = (radius: number) => radius - NODE_SIZE / 2 - 0.6;
const flowLegLength = (radius: number) => flowLegEnd(radius) - FLOW_LEG_START;

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
function rotationFor(index: number, total: number, rtl: boolean) {
  return (rtl ? -180 - SLOT_ANGLE : SLOT_ANGLE) - baseAngle(index, total);
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

const ORBIT_STYLES = `
${DATA_FLOW_STYLES}
/* Rotation de l'anneau à la sélection : l'anneau porte la rotation, chaque
   nœud la rotation inverse — les agents glissent le long de l'orbite. */
.oc-ring, .oc-node { transition: transform ${ROTATION_MS}ms cubic-bezier(.25,1,.5,1); }

.oc-packet { display: none; }
.oc-flow[data-selected="true"] .oc-packet { display: inline; }

@media (prefers-reduced-motion: reduce) {
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
        {agent.badge != null && agent.badge > 0 && (
          <p className="m-0 text-xs tabular-nums">
            {agent.badge} {t('supervision.portfolio.propertiesShort')}
          </p>
        )}
        {(agent.pendingCount ?? 0) > 0 && (
          <p className="m-0 text-xs tabular-nums">
            {agent.pendingCount} {t('supervision.board.toValidate', 'à valider')}
          </p>
        )}
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

/** Mesure la traduction réelle pour garder la légende dans le cadre sans la
 * pousser inutilement sur le nœud voisin (notamment en arabe sur mobile). */
function OrbitAgentLabel({ name, status, attention, above, preferredShift, x, frameWidth }: {
  name: string;
  status: string | null;
  attention: boolean;
  above: boolean;
  preferredShift: number;
  x: number;
  frameWidth: number;
}) {
  const [labelRef, label] = useElementSize<HTMLSpanElement>();
  const halfWidth = label.width / 2;
  const shift = frameWidth > 0
    ? Math.max(ORBIT_EDGE_PX + halfWidth - x,
        Math.min(preferredShift, frameWidth - ORBIT_EDGE_PX - halfWidth - x))
    : 0;

  return (
    <span
      ref={labelRef}
      className={cn('absolute flex w-max flex-col items-center gap-0.5 leading-tight', above ? 'bottom-full mb-3' : 'top-full mt-2')}
      // Coordonnées physiques du diagramme : le texte garde sa direction RTL.
      style={{ left: '50%', transform: `translateX(calc(-50% + ${shift}px))` }}
    >
      <span className="baitly-orbit-name text-xs font-medium whitespace-nowrap">{name}</span>
      {status && <span className={cn('text-xs whitespace-nowrap tabular-nums', attention ? 'font-medium text-destructive-ink' : 'text-muted-foreground')}>{status}</span>}
    </span>
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
  const { t, isArabic } = useTranslation();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const selectedIndex = agents.findIndex((agent) => agent.id === selected);
  const agentCount = agents.length;
  const [rotation, setRotation] = useState(() => rotationFor(Math.max(0, selectedIndex), agentCount || 1, isArabic));
  const rotationRef = useRef(rotation);
  const [rotating, setRotating] = useState(false);

  // Sélection contrôlée : quand elle change, l'anneau pivote par le chemin le
  // plus court (angle cible « déroulé » autour de l'angle courant).
  useEffect(() => {
    if (selectedIndex < 0) {
      setRotating(false);
      return;
    }
    let target = rotationFor(selectedIndex, agentCount, isArabic);
    while (target - rotationRef.current > 180) target -= 360;
    while (target - rotationRef.current < -180) target += 360;
    if (Math.abs(target - rotationRef.current) < 0.5 || reducedMotion) {
      rotationRef.current = target;
      setRotation(target);
      setRotating(false);
      return;
    }
    rotationRef.current = target;
    setRotation(target);
    setRotating(true);
    const timer = window.setTimeout(() => setRotating(false), ROTATION_MS + 40);
    return () => window.clearTimeout(timer);
    // Les mises à jour de tâches ne doivent pas annuler le timer de rotation.
  }, [selectedIndex, agentCount, reducedMotion, isArabic]);

  // Le relais ne joue que l'agent arrivé en tête ; même condition pour les
  // attaches, annoncée au parent (positions stables uniquement).
  const flowActive = flowEnabled && !rotating && selectedIndex >= 0;
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
  const side = fitSide(Math.max(0, box.width - ORBIT_EDGE_PX * 2), Math.max(0, box.height - ORBIT_EDGE_PX * 2));
  const radius = orbitRadiusFor(side);

  // Anneau à l'étroit : distance d'arc entre deux nœuds voisins. En dessous de
  // LABEL_MIN_ARC_PX, les longues traductions (jusqu'à 130 px) peuvent toucher
  // le nœud voisin. Les noms restent accessibles dans les infobulles et les
  // libellés des boutons, sans rogner les traductions.
  const arcPx = agents.length > 0 ? (2 * Math.PI * ((radius / 100) * side)) / agents.length : 0;
  const crowded = arcPx > 0 && arcPx < LABEL_MIN_ARC_PX;

  return (
    <div ref={boxRef} className={cn('baitly-supervision-surface baitly-orbit flex min-h-0 items-center justify-center', className)}>
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
        <style>{ORBIT_STYLES}</style>

        {/* L'anneau d'orbite ne tourne pas : il est invariant par rotation. */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            className="baitly-orbit-track"
            vectorEffect="non-scaling-stroke"
            strokeWidth="1"
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
                  data-focused={agent.id === selected || undefined}
                  data-selected={(agent.id === selected && flowActive) || undefined}
                >
                  {/* Même dessin que les attaches (rail 1 px, paquet 1,5 px) :
                      non-scaling-stroke fige l'épaisseur en pixels d'écran. */}
                  <line
                    {...segment}
                    vectorEffect="non-scaling-stroke"
                    strokeWidth="1"
                    className="baitly-orbit-spoke"
                  />
                  {/* Même paquet et même animation que les attaches HITL,
                      exprimés ici dans les unités du viewBox orbital. */}
                  <line
                    {...segment}
                    strokeWidth={FLOW_STROKE}
                    className="oc-packet baitly-data-packet"
                    style={flowPacketStyle(flowLegLength(radius), FLOW_DASH, flowDelay)}
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
            const needsDecision = pending > 0 || agent.status === 'wait';
            const working = agent.status === 'think' || agent.status === 'act';
            const progress = agent.status === 'think' && Number.isFinite(agent.thinkingProgress)
              ? Math.max(0, Math.min(100, agent.thinkingProgress!))
              : null;
            const propertyCount = agent.badge != null && agent.badge > 0 ? agent.badge : null;
            const badgeCount = propertyCount ?? (pending > 0 ? pending : null);
            const statusLabel = t(STATUS[agent.status].labelKey);
            // Ce que la PASTILLE dit deja ne se redit pas en texte. « 6 a
            // valider », puis « Attend ta validation » : deux facons d'ecrire le
            // meme nombre, sous un noeud qui l'affiche une troisieme fois. Un
            // agent qui attend n'a donc plus de seconde ligne — son compte se lit
            // sur le noeud. Les autres etats, eux, restent nommes : la pastille
            // ne sait pas dire « Agit » ni « Reflechit a 40 % ».
            const countedByBadge = pending > 0 && agent.status === 'wait';
            const subLabel = isAttention
              ? statusLabel
              : countedByBadge
                ? null
                : progress != null
                  ? `${statusLabel} · ${Math.round(progress)} %`
                  : statusLabel;

            // Position de la légende quand l'anneau est à l'étroit. Le nœud
            // porte déjà la rotation inverse de l'anneau : ses axes locaux sont
            // ceux de l'écran, on raisonne donc en angle VISUEL.
            const visualRad = ((baseAngle(index, agents.length) + rotation) * Math.PI) / 180;
            // Moitié haute (sin < 0 en repère écran) : la légende passe AU-DESSUS.
            // Posée dessous, elle descendait sur le nœud suivant de l'anneau —
            // les deux recouvrements mesurés étaient exactement ceux-là.
            const labelAbove = crowded && Math.sin(visualRad) < -0.25;
            const cos = Math.cos(visualRad);
            const visualX = box.width / 2 + cos * ((radius / 100) * side);

            return (
              <div
                key={agent.id}
                className="oc-node absolute"
                data-selected={isSelected || undefined}
                data-attention={isAttention || undefined}
                data-waiting={needsDecision || undefined}
                data-working={working || undefined}
                data-animating={(working && flowEnabled && !rotating) || undefined}
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  width: `${NODE_SIZE}%`,
                  height: `${NODE_SIZE}%`,
                  transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                }}
              >
                <svg className="baitly-orbit-rim" viewBox="0 0 100 100" aria-hidden>
                  <circle className="baitly-orbit-rim-track" cx="50" cy="50" r="47" />
                  {working && (
                    <circle
                      className="baitly-orbit-progress"
                      data-indeterminate={progress == null || undefined}
                      cx="50" cy="50" r="47" pathLength="100"
                      strokeDasharray={`${progress ?? 24} 100`}
                    />
                  )}
                </svg>
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
                        propertyCount != null ? `${propertyCount} ${t('supervision.portfolio.propertiesShort')}` : null,
                      ].filter(Boolean).join(' · ')}
                      onClick={() => onSelect(agent.id)}
                      className="baitly-orbit-node"
                    >
                      <span className="baitly-orbit-icon" aria-hidden>
                        <AgentIcon token={meta.icon} size={28} strokeWidth={1.6} />
                      </span>
                      {badgeCount != null ? (
                        <span className="baitly-orbit-count" data-kind={propertyCount != null ? 'properties' : 'pending'} aria-hidden>
                          {propertyCount != null && <Home size={11} strokeWidth={1.8} />}
                          <bdi dir="ltr">{badgeCount > 99 ? '99+' : badgeCount}</bdi>
                        </span>
                      ) : (isAttention || needsDecision) && (
                        <span className="baitly-orbit-count" data-kind="status" aria-hidden>
                          {isAttention ? <ErrorOutline size={14} /> : <AccessTime size={13} />}
                        </span>
                      )}
                      {working && <span className="baitly-orbit-activity-dot" aria-hidden />}
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
                  <OrbitAgentLabel
                    name={t(meta.nameKey)} status={subLabel} attention={isAttention}
                    above={labelAbove} preferredShift={crowded ? Math.sign(cos) * LABEL_SHIFT_PX : 0}
                    x={visualX} frameWidth={box.width}
                  />
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
            'baitly-orbit-core absolute inset-0 m-auto flex items-center justify-center rounded-full',
            onCoreClick
              ? 'cursor-pointer'
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
