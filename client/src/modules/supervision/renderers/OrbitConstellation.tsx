/* ============================================================
   OrbitConstellation — 2e renderer (grammaire de la projection)

   Portage réel de la projection « Constellation d'agents » de la
   galerie (BAgentsConstellationSectionDemo) sur le contrat
   ConstellationRenderer :

   - registre PRODUIT : canvas aux jetons du thème (clair/sombre),
     filets 1 px — plus de ciel décoratif ;
   - orbite UNIQUE, nœuds au diamètre uniforme — le volume se lit
     dans le libellé (« N en attente ») et l'infobulle, pas dans la
     taille des cercles ;
   - sélection : l'anneau pivote pour amener l'agent à l'emplacement
     de tête (haut à droite, face à la file HITL flottante) ;
   - relais de données : UN paquet fin (teinte primaire) part du
     noyau vers l'agent sélectionné — dash en unités utilisateur
     (pathLength + non-scaling-stroke est bugué dans Chromium) ;
   - seule l'exception est colorée : ambre = attend une décision,
     destructif = escaladé / erreur. Le reste vit en gris.

   Portage PROGRESSIF : le mode compact (rail de pastilles + tiroirs)
   reste servi par FramerConstellation — même contrat, bascule
   transparente — tant que sa variante n'est pas redessinée.
   ============================================================ */

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { MARK_PATH, MARK_VIEWBOX, STROKE_WIDTH } from '../../../components/BaitlyMarkLogo';
import { cn } from '../../../utils/cn';
import { AGENT_META, STATUS, STATUS_PRIORITY } from '../constants';
import { AgentIcon } from './agentIcon';
import { FramerConstellation } from './FramerConstellation';
import type { ConstellationAgentView, ConstellationRendererProps } from './ConstellationRenderer';
import type { AgentId } from '../types';

// ─── Géométrie (reprise de la projection) ────────────────────────────────────

/** Emplacement de tête : haut-droite, face à la file HITL flottante. */
const SLOT_ANGLE = -45;
const ORBIT_RADIUS = 33;
const CORE_SIZE = 15;
/** Diamètre uniforme des nœuds (% du canvas) — le volume ne se lit pas ici. */
const NODE_SIZE = 13;
/** Durée de la rotation de l'anneau — alignée sur `.oc-ring` ci-dessous. */
const ROTATION_MS = 720;
/** Durée d'un cycle du relais de données. */
const FLOW_CYCLE_MS = 3200;

/**
 * Jambe radiale du relais, en unités du viewBox — la MÊME pour tous les agents
 * (rayons constants) : le dash du paquet s'écrit en unités utilisateur exactes.
 * Indispensable : `pathLength` + `vector-effect: non-scaling-stroke` est bugué
 * dans Chromium (pathLength ignoré → tirets fantômes).
 */
const FLOW_LEG_START = CORE_SIZE / 2 + 1.3;
const FLOW_LEG_END = ORBIT_RADIUS - NODE_SIZE / 2 - 0.6;
const FLOW_LEG_LENGTH = FLOW_LEG_END - FLOW_LEG_START;
const FLOW_DASH = 4.5;

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

/** Agent pré-sélectionné : le plus chargé en attente, puis le statut le plus prioritaire. */
function busiestAgent(agents: ConstellationAgentView[]): AgentId | null {
  if (agents.length === 0) return null;
  return [...agents].sort(
    (a, b) =>
      (b.pendingCount ?? 0) - (a.pendingCount ?? 0)
      || STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status],
  )[0].id;
}

// ─── Feuille scopée `oc-` (règles du renderer, pas du kit) ───────────────────

const ORBIT_STYLES = `
/* Rotation de l'anneau à la sélection : l'anneau porte la rotation, chaque
   nœud la rotation inverse — les agents glissent le long de l'orbite. */
.oc-ring, .oc-node { transition: transform ${ROTATION_MS}ms cubic-bezier(.25,1,.5,1); }

/* Relais de données : UN paquet, du noyau vers l'agent sélectionné. */
.oc-packet {
  display: none;
  fill: none;
  stroke-linecap: round;
  opacity: .85;
  stroke-dasharray: ${FLOW_DASH} ${(FLOW_LEG_LENGTH * 3).toFixed(1)};
  animation: oc-relay-out ${FLOW_CYCLE_MS}ms linear infinite;
}
.oc-flow[data-selected="true"] .oc-packet { display: inline; }
@keyframes oc-relay-out {
  0% { stroke-dashoffset: ${FLOW_DASH}; }
  38%, 100% { stroke-dashoffset: ${(-(FLOW_LEG_LENGTH + FLOW_DASH)).toFixed(1)}; }
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

// ─── Fenêtres du bilan (mêmes options que le renderer historique) ────────────

const REPORT_WINDOWS: { days: number; key: string; fallback: string }[] = [
  { days: 1, key: 'supervision.report.win.day', fallback: 'Jour' },
  { days: 7, key: 'supervision.report.win.week', fallback: 'Sem.' },
  { days: 15, key: 'supervision.report.win.fortnight', fallback: 'Quinz.' },
  { days: 30, key: 'supervision.report.win.month', fallback: 'Mois' },
];

// ─── Renderer ────────────────────────────────────────────────────────────────

export function OrbitConstellation(props: ConstellationRendererProps) {
  // Portage progressif : la présentation compacte (rail de pastilles + tiroir
  // bas) reste celle du renderer historique — même contrat d'interface.
  if (props.compact) return <FramerConstellation {...props} />;
  return <OrbitConstellationWide {...props} />;
}

function OrbitConstellationWide({
  agents,
  hud,
  online,
  paused,
  focused,
  onToggleFocus,
  onSelectAgent,
  headerAction,
  report,
  reportWindow,
  onReportWindowChange,
  belowHud,
  flush,
}: ConstellationRendererProps) {
  const { t } = useTranslation();

  const [selected, setSelected] = useState<AgentId | null>(() => busiestAgent(agents));
  const initialIndex = Math.max(0, agents.findIndex((agent) => agent.id === selected));
  const [rotation, setRotation] = useState(() => rotationFor(initialIndex, agents.length || 1));
  const rotationRef = useRef(rotation);
  const [rotating, setRotating] = useState(false);

  /** Rotation par le chemin le plus court (angle « déroulé » autour du courant). */
  const selectAgent = (id: AgentId) => {
    onSelectAgent?.(id);
    if (id === selected) return;
    const index = agents.findIndex((agent) => agent.id === id);
    if (index < 0) return;
    let target = rotationFor(index, agents.length);
    while (target - rotationRef.current > 180) target -= 360;
    while (target - rotationRef.current < -180) target += 360;
    rotationRef.current = target;
    setRotation(target);
    setSelected(id);
    setRotating(true);
  };

  useLayoutEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setRotating(false), ROTATION_MS + 40);
    return () => window.clearTimeout(timer);
  }, [rotating]);

  // Le relais ne joue que lorsque l'agent est arrivé à l'emplacement de tête,
  // en ligne et hors kill-switch.
  const flowActive = online && !paused && !rotating;

  const attention = useMemo(
    () => agents.filter((agent) => agent.status === 'esc' || agent.status === 'err'),
    [agents],
  );

  return (
    <div
      role="group"
      aria-label={t('supervision.hud.orchestrator')}
      data-supervision-constellation
      className={cn(
        'relative flex-1 min-h-[380px] overflow-hidden bg-card',
        !flush && 'rounded-2xl border border-border',
        !online && 'saturate-50',
      )}
    >
      <style>{ORBIT_STYLES}</style>

      {/* ── HUD haut-gauche (masqué en mode focus) ─────────────────────── */}
      {!focused && (
        <div className="absolute start-3 top-3 z-10 flex w-[280px] max-w-[46%] flex-col gap-2">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn('size-1.5 shrink-0 rounded-full', online ? 'bg-success' : 'bg-muted-foreground/50')}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                {t('supervision.hud.orchestrator')} · {online ? t('supervision.hud.active') : t('supervision.states.offline')}
              </span>
              {headerAction && <span className="shrink-0">{headerAction}</span>}
            </div>
            <p className="m-0 mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span><b className="font-semibold text-foreground tabular-nums">{hud.agentsCount}</b> {t('supervision.hud.agents')}</span>
              <span><b className="font-semibold text-foreground tabular-nums">{hud.actingCount}</b> {t('supervision.hud.acting')}</span>
              <span className={cn(hud.awaitingCount > 0 && 'text-warning-ink')}>
                <b className="font-semibold tabular-nums">{hud.awaitingCount}</b> {t('supervision.hud.awaiting')}
              </span>
            </p>

            {/* Bilan de valeur — fenêtre alignée sur le zoom planning. */}
            {report && (
              <div className="mt-2 border-t border-border pt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('supervision.report.titleBase', 'Bilan')}
                  </span>
                  {onReportWindowChange ? (
                    <span className="flex gap-0.5" role="group" aria-label={t('supervision.report.titleBase', 'Bilan')}>
                      {REPORT_WINDOWS.map((option) => {
                        const active = (reportWindow ?? report.windowDays) === option.days;
                        return (
                          <button
                            key={option.days}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onReportWindowChange(option.days)}
                            className={cn(
                              'cursor-pointer rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors duration-100',
                              'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                              active ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted',
                            )}
                          >
                            {t(option.key, option.fallback)}
                          </button>
                        );
                      })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t('supervision.report.windowDays', { count: report.windowDays, defaultValue: '{{count}} jours' })}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-baseline gap-4 text-xs">
                  <span className="flex flex-col">
                    <b className="font-semibold text-foreground tabular-nums">{report.estimatedTimeSaved}</b>
                    <span className="text-muted-foreground">{t('supervision.report.timeSaved', 'Temps gagné')}</span>
                  </span>
                  <span className="flex flex-col">
                    <b className="font-semibold text-foreground tabular-nums">{report.autoActions}</b>
                    <span className="text-muted-foreground">{t('supervision.report.autoActions', 'Actions auto')}</span>
                  </span>
                  <span className="flex flex-col">
                    <b className="font-semibold text-foreground tabular-nums">{Math.round(report.acceptanceRate * 100)} %</b>
                    <span className="text-muted-foreground">{t('supervision.report.acceptance', 'Acceptation')}</span>
                  </span>
                </div>
              </div>
            )}

            {/* Escalades / erreurs : l'exception, nommée. */}
            {attention.length > 0 && (
              <p className="m-0 mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-destructive">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-destructive" />
                {attention.map((agent) => t(AGENT_META[agent.id].nameKey)).join(', ')} · {t(STATUS[attention[0].status].labelKey)}
              </p>
            )}
          </div>

          {belowHud}
        </div>
      )}

      {/* ── Canvas orbital ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 m-auto aspect-square max-h-[92%] w-full max-w-[520px]">
        {/* L'anneau d'orbite ne tourne pas : il est invariant par rotation. */}
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

        <div className="oc-ring absolute inset-0" style={{ transform: `rotate(${rotation}deg)` }}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
            {agents.map((agent, index) => {
              const angle = baseAngle(index, agents.length);
              const from = polar(angle, FLOW_LEG_START);
              const to = polar(angle, FLOW_LEG_END);
              const segment = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
              return (
                <g
                  key={agent.id}
                  className="oc-flow"
                  data-selected={(agent.id === selected && flowActive) || undefined}
                >
                  <line
                    {...segment}
                    vectorEffect="non-scaling-stroke"
                    strokeWidth="1"
                    className="stroke-border"
                  />
                  <line
                    {...segment}
                    vectorEffect="non-scaling-stroke"
                    strokeWidth="1.5"
                    className="oc-packet stroke-primary"
                  />
                </g>
              );
            })}
          </svg>

          {agents.map((agent, index) => {
            const meta = AGENT_META[agent.id];
            const point = polar(baseAngle(index, agents.length), ORBIT_RADIUS);
            const pending = agent.pendingCount ?? 0;
            const isSelected = agent.id === selected;
            const isAttention = agent.status === 'esc' || agent.status === 'err';
            // Le halo ne signale que ce qui n'est PAS déjà ouvert à droite.
            const needsDecision = (pending > 0 || agent.status === 'wait') && !isSelected;
            const statusLabel = t(STATUS[agent.status].labelKey);
            const subLabel = isAttention
              ? statusLabel
              : pending > 0
                ? `${pending} ${t('supervision.hud.awaiting')}`
                : agent.status === 'think' && agent.thinkingProgress != null
                  ? `${statusLabel} · ${Math.round(agent.thinkingProgress)} %`
                  : statusLabel;

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
                      aria-label={`${t(meta.nameKey)} · ${subLabel}`}
                      onClick={() => selectAgent(agent.id)}
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
                        <span className="absolute -end-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground tabular-nums">
                          {agent.badge}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[16rem]">
                    {agent.task ?? t(meta.roleKey)}
                  </TooltipContent>
                </Tooltip>
                <span className="absolute inset-x-0 top-full mt-2 flex flex-col items-center gap-0.5 leading-tight">
                  <span className="text-xs font-medium whitespace-nowrap text-foreground">
                    {t(meta.nameKey)}
                  </span>
                  <span
                    className={cn(
                      'text-xs whitespace-nowrap tabular-nums',
                      isAttention
                        ? 'font-medium text-destructive'
                        : pending > 0
                          ? 'font-medium text-warning-ink'
                          : 'text-muted-foreground',
                    )}
                  >
                    {subLabel}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Le noyau reste au centre, hors de l'anneau qui pivote. Le clic
            bascule le mode focus (les surcouches s'effacent). */}
        <button
          type="button"
          data-core
          aria-pressed={focused}
          aria-label={t('supervision.hud.orchestrator')}
          onClick={onToggleFocus}
          className="absolute inset-0 m-auto flex cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
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
        </button>
      </div>
    </div>
  );
}
