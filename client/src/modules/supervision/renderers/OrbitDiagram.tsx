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

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useMediaQuery } from '../../../hooks/use-media-query';
import { useElementSize } from '../core/useElementSize';
import {
  fitOrbitSide,
  orbitRadiusFor,
  orbitVerticalLayout,
  ORBIT_NODE_SIZE as NODE_SIZE,
  ORBIT_LABEL_ROOM_PX as LABEL_ROOM_PX,
  ORBIT_EDGE_PX,
} from '../core/orbitGeometry';
import { DATA_FLOW_STYLES, FLOW_DASH, FLOW_STROKE, flowClockDelay, flowPacketStyle } from '../core/dataFlow';
import BaitlyMarkLogo from '../../../components/BaitlyMarkLogo';
import { AccessTime, ErrorOutline, Home } from '../../../icons';
import { cn } from '../../../utils/cn';
import { AGENT_META, STATUS, STATUS_PRIORITY } from '../constants';
import { AgentPortrait } from './AgentPortrait';
import { AgentSpeechContent } from './AgentSpeechContent';
import { AgentSpeechBubble } from './AgentSpeechBubble';
import type { ConstellationAgentView } from './ConstellationRenderer';
import type { AgentId, PendingAction } from '../types';
import '../supervision-surfaces.css';
import './orbit-diagram.css';

// ─── Géométrie (reprise de la projection) ────────────────────────────────────

/** Emplacement de tête : haut-droite, face à la file HITL. */
const SLOT_ANGLE = -45;
/**
 * Distance d'arc minimale entre deux nœuds voisins pour que TOUTES les légendes
 * tiennent. En dessous, la sélection et les alertes gardent leur nom complet ;
 * les autres spécialités restent nommées dans les boutons et infobulles.
 */
const LABEL_MIN_ARC_PX = 140;
/** Additional room for larger, two-line names and their optional status. */
const LABEL_EXTRA_ROOM_PX = 20;
/**
 * Écartement horizontal de la légende vers l'EXTÉRIEUR de l'anneau, quand il
 * est à l'étroit. Sur les flancs, une légende posée sous son nœud pointe vers
 * le voisin ; la pousser dehors la dégage. On ne va pas jusqu'au placement
 * radial complet — 98 px n'auraient pas la place de sortir du carré.
 */
const LABEL_SHIFT_PX = 30;
const CORE_SIZE = 15;
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
.baitly-orbit[data-rotating] .oc-ring,
.baitly-orbit[data-rotating] .oc-node { transition: transform ${ROTATION_MS}ms cubic-bezier(.25,1,.5,1); }

.oc-packet { display: none; }
.oc-flow[data-selected="true"] .oc-packet { display: inline; }

@media (prefers-reduced-motion: reduce) {
  .oc-flow[data-selected="true"] .oc-packet { display: none; }
  .baitly-orbit[data-rotating] .oc-ring,
  .baitly-orbit[data-rotating] .oc-node { transition: none; }
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

/** Mesure la traduction réelle pour garder la légende dans le cadre sans la
 * pousser inutilement sur le nœud voisin (notamment en arabe sur mobile). */
function OrbitAgentLabel({ name, status, attention, above, preferredShift, x, frameWidth, maxWidth }: {
  name: string;
  status: string | null;
  attention: boolean;
  above: boolean;
  preferredShift: number;
  x: number;
  frameWidth: number;
  maxWidth: number;
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
      className={cn('baitly-orbit-label absolute flex w-max flex-col items-center gap-1', above ? 'bottom-full mb-2' : 'top-full mt-1.5')}
      // Coordonnées physiques du diagramme : le texte garde sa direction RTL.
      style={{ left: '50%', maxWidth, transform: `translateX(calc(-50% + ${shift}px))` }}
    >
      <span className="baitly-orbit-name">{name}</span>
      {status && <span className={cn('baitly-orbit-status tabular-nums', attention ? 'text-destructive-ink' : 'text-muted-foreground')}>{status}</span>}
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
  // Bake the settled angle into coordinates. Leaving opposite rotations on
  // the ring and portrait forces video through two rasterised layers and can
  // damage its fine edges at the small sizes used in the real planning.
  const [settledRotation, setSettledRotation] = useState(rotation);
  const rotationRef = useRef(rotation);
  const [rotating, setRotating] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  // Sélection contrôlée : quand elle change, l'anneau pivote par le chemin le
  // plus court (angle cible « déroulé » autour de l'angle courant).
  useEffect(() => {
    if (selectedIndex < 0) {
      setSettledRotation(rotationRef.current);
      setRotating(false);
      return;
    }
    let target = rotationFor(selectedIndex, agentCount, isArabic);
    while (target - rotationRef.current > 180) target -= 360;
    while (target - rotationRef.current < -180) target += 360;
    if (Math.abs(target - rotationRef.current) < 0.5 || reducedMotion) {
      rotationRef.current = target;
      setRotation(target);
      setSettledRotation(target);
      setRotating(false);
      return;
    }
    rotationRef.current = target;
    setRotation(target);
    setRotating(true);
    const timer = window.setTimeout(() => {
      setSettledRotation(target);
      setRotating(false);
    }, ROTATION_MS + 40);
    return () => window.clearTimeout(timer);
    // Les mises à jour de tâches ne doivent pas annuler le timer de rotation.
  }, [selectedIndex, agentCount, reducedMotion, isArabic]);

  // Le relais ne joue que l'agent arrivé en tête ; même condition pour les
  // attaches, annoncée au parent (positions stables uniquement).
  // Check geometry as well as the timer: a new selection must not receive a
  // packet for one render while the previous agent still occupies the slot.
  const aligned = selectedIndex >= 0
    && Math.abs((rotation - rotationFor(selectedIndex, agentCount, isArabic)) % 360) < 0.5;
  const flowActive = flowEnabled && documentVisible && selectedIndex >= 0
    && (reducedMotion || (!rotating && aligned));
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
  // sur l'empreinte réelle (anneau, nœuds, badges et libellés visibles).
  // Sans plafond : sur un grand écran le diagramme
  // respire — les libellés, eux, ne grandissent pas, donc plus le cercle est
  // large, moins ils se chevauchent. Repli tant que rien n'est mesuré (premier
  // rendu, jsdom).
  const [boxRef, box] = useElementSize<HTMLDivElement>();
  const squareRef = useRef<HTMLDivElement>(null);
  const [verticalLayout, setVerticalLayout] = useState({
    room: LABEL_ROOM_PX + LABEL_EXTRA_ROOM_PX,
    offset: 0,
  });
  const side = fitOrbitSide(box.width, box.height, verticalLayout.room);
  const radius = orbitRadiusFor(side);

  // Anneau à l'étroit : distance d'arc entre deux nœuds voisins. En dessous de
  // LABEL_MIN_ARC_PX, les longues traductions (jusqu'à 130 px) peuvent toucher
  // le nœud voisin. Les noms restent accessibles dans les infobulles et les
  // libellés des boutons, sans rogner les traductions.
  // La densité se décide sur un gabarit stable. La mesure des libellés ne doit
  // pas les faire apparaître/disparaître en boucle près du seuil de densité.
  const labelSide = fitOrbitSide(box.width, box.height, LABEL_ROOM_PX + LABEL_EXTRA_ROOM_PX);
  const arcPx = agents.length > 0 ? (2 * Math.PI * ((orbitRadiusFor(labelSide) / 100) * labelSide)) / agents.length : 0;
  const crowded = arcPx > 0 && arcPx < LABEL_MIN_ARC_PX;
  const visualRotation = rotation - settledRotation;

  useLayoutEffect(() => {
    const square = squareRef.current;
    if (!square || side <= 0 || rotating) return;
    const elements = [...square.querySelectorAll<HTMLElement>(
      '.baitly-orbit-node, .baitly-orbit-count, .baitly-orbit-label, [data-core]',
    )];
    const measure = () => {
      const origin = square.getBoundingClientRect();
      // Les surfaces projetées peuvent être mises à l'échelle par leur parent.
      const scale = origin.height / side;
      if (scale <= 0) return;
      const bounds = elements.map((element) => element.getBoundingClientRect()).filter((rect) => rect.height > 0);
      if (!bounds.length) return;
      const next = orbitVerticalLayout(
        side,
        (Math.min(...bounds.map((rect) => rect.top)) - origin.top) / scale,
        (Math.max(...bounds.map((rect) => rect.bottom)) - origin.top) / scale,
      );
      setVerticalLayout((previous) => (
        Math.abs(previous.room - next.room) < 0.5 && Math.abs(previous.offset - next.offset) < 0.5
          ? previous
          : next
      ));
    };
    measure();
    // Police, traduction, statut ou badge : la réserve suit le contenu rendu.
    if (typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    elements.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [agents, selected, isArabic, side, crowded, rotating, settledRotation, box.width, box.height]);

  return (
    <div ref={boxRef} data-rotating={rotating || undefined} className={cn('baitly-supervision-surface baitly-orbit flex min-h-0 items-center justify-center', className)}>
      {/* Centrer l'empreinte visible, avec ses badges et ses seuls libellés
          affichés. Aucune bande vide fixe sous l'orbite sur les petits écrans. */}
      <div
        ref={squareRef}
        data-supervision-constellation
        className="relative aspect-square shrink-0"
        style={
          side > 0
            ? { width: side, height: side, transform: `translateY(${verticalLayout.offset}px)` }
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

        <div className="oc-ring absolute inset-0" style={{ transform: rotating ? `rotate(${visualRotation}deg)` : 'none' }}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
            {agents.map((agent, index) => {
              const angle = baseAngle(index, agents.length) + settledRotation;
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
            const point = polar(baseAngle(index, agents.length) + settledRotation, radius);
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
                data-animating={(working && flowEnabled && documentVisible && !rotating && !reducedMotion) || undefined}
                style={{
                  left: `${point.x - NODE_SIZE / 2}%`,
                  top: `${point.y - NODE_SIZE / 2}%`,
                  width: `${NODE_SIZE}%`,
                  height: `${NODE_SIZE}%`,
                  transform: rotating
                    ? `rotate(${-visualRotation}deg)`
                    : 'none',
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
                <AgentSpeechBubble
                  agentId={agent.id}
                  status={agent.status}
                  selected={isSelected}
                  rtl={isArabic}
                  // Le lecteur d'écran ne voit pas la pastille : on lui donne
                  // le compte que la légende ne répète plus.
                  label={[
                    t(meta.nameKey),
                    subLabel ?? statusLabel,
                    pending > 0 ? `${pending} ${t('supervision.board.toValidate', 'à valider')}` : null,
                    propertyCount != null ? `${propertyCount} ${t('supervision.portfolio.propertiesShort')}` : null,
                  ].filter(Boolean).join(' · ')}
                  onSelect={() => onSelect(agent.id)}
                  content={<AgentSpeechContent agent={agent} waiting={waiting} isSelected={isSelected} />}
                  badge={badgeCount != null ? (
                    <span className="baitly-orbit-count" data-kind={propertyCount != null ? 'properties' : 'pending'} aria-hidden>
                      {propertyCount != null && <Home size={11} strokeWidth={1.8} />}
                      <bdi dir="ltr">{badgeCount > 99 ? '99+' : badgeCount}</bdi>
                    </span>
                  ) : (isAttention || needsDecision) && (
                    <span className="baitly-orbit-count" data-kind="status" aria-hidden>
                      {isAttention ? <ErrorOutline size={14} /> : <AccessTime size={13} />}
                    </span>
                  )}
                >
                  <AgentPortrait
                    agentId={agent.id}
                    receiving={isSelected && flowActive && !reducedMotion}
                  />
                  {working && <span className="baitly-orbit-activity-dot" aria-hidden />}
                </AgentSpeechBubble>
                {/* Small orbits retain the full selected name and alerts:
                    larger typography must not overlap neighbouring agents. */}
                {(!crowded || isSelected || isAttention) && (
                  <OrbitAgentLabel
                    name={t(meta.nameKey)} status={subLabel} attention={isAttention}
                    above={labelAbove} preferredShift={crowded ? Math.sign(cos) * LABEL_SHIFT_PX : 0}
                    x={visualX} frameWidth={box.width}
                    maxWidth={180}
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
          <span className="baitly-orbit-mark" aria-hidden="true">
            <BaitlyMarkLogo
              variant="mark"
              colorMode="inherit"
              size={side > 0 ? side * CORE_SIZE / 100 * 0.58 : 44}
              disableAnimation={!flowActive || reducedMotion}
            />
          </span>
        </CoreTag>
      </div>
    </div>
  );
}
