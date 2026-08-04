/* ============================================================
   <SupervisionTethers> — attaches agent → cartes HITL (panneau)

   Deuxième jambe du relais de données (portage de la projection) :
   le paquet arrivé de l'orchestrateur sur l'agent de tête repart le
   long d'attaches courbes vers SES cartes de la file flottante —
   même grammaire que la jambe radiale du renderer (rail 1 px, paquet
   1,5 px teinte primaire, fenêtre [38 ; 92 %] du cycle commun).

   Tout est mesuré en DOM au niveau du PANNEAU (le renderer et la
   file vivent dans des sous-arbres distincts) : l'agent de tête est
   annoncé par le renderer (onHeadAgentSettled, positions stables),
   les cartes s'ancrent par leurs attributs data-* (agent porteur,
   urgence, carte « derrière » d'un deck replié = pas d'attache).
   ============================================================ */

import { useEffect, useRef, useState, type RefObject } from 'react';
import { FLOW_CYCLE_MS, flowClockDelay } from '../renderers/OrbitDiagram';
import type { AgentId } from '../types';

/** Re-mesure différée après une mutation du deck (dépliage animé ~250 ms). */
const SETTLE_MS = 350;

interface TetherLine {
  key: string;
  urgent: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/* Le flux de données est TOUJOURS encre (noir en thème clair, encre claire en
   sombre) : l'ambre ne colore que les RAILS urgents (carte qui expire sous
   l'heure), jamais la donnée. Le paquet arrivé du noyau se dispatche en
   SIMULTANÉ vers toutes les cartes (fenêtre [38 ; 92 %] du cycle commun). */
const TETHER_STYLES = `
.sv-tether-packet {
  fill: none;
  stroke-linecap: round;
  opacity: .9;
  stroke-dasharray: 12 200;
  animation: sv-relay-hop ${FLOW_CYCLE_MS}ms linear infinite;
}
@keyframes sv-relay-hop { 0%, 38% { stroke-dashoffset: 12; } 92%, 100% { stroke-dashoffset: -112; } }
@media (prefers-reduced-motion: reduce) {
  .sv-tether-packet { display: none; }
}
`;

/**
 * Paquet d'une attache, calé sur l'horloge GLOBALE du relais à son montage
 * (retard négatif = phase courante) : quel que soit l'instant où l'attache
 * apparaît, son paquet part dans la fenêtre [38 ; 92 %] du MÊME cycle que la
 * jambe radiale. Le retard est figé (ref) : le recalculer à chaque rendu
 * ferait sauter la phase à chaque mesure.
 */
function HopPacket({ d }: { d: string }) {
  const delayRef = useRef<string | null>(null);
  if (delayRef.current === null) delayRef.current = flowClockDelay();
  return (
    <path
      fill="none"
      pathLength={100}
      strokeWidth="1.5"
      className="sv-tether-packet stroke-foreground"
      style={{ animationDelay: delayRef.current }}
      d={d}
    />
  );
}

export interface SupervisionTethersProps {
  /** Racine RELATIVE du panneau — englobe le renderer ET la file flottante. */
  rootRef: RefObject<HTMLDivElement | null>;
  /** Agent stabilisé à l'emplacement de tête (null = aucune attache). */
  headAgent: AgentId | null;
  /** Identité de la file : tout changement de `pending` re-mesure. */
  revision: unknown;
}

export function SupervisionTethers({ rootRef, headAgent, revision }: SupervisionTethersProps) {
  const [tethers, setTethers] = useState<TetherLine[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !headAgent) {
      setTethers((prev) => (prev.length ? [] : prev));
      return;
    }

    const measure = () => {
      const base = root.getBoundingClientRect();
      const node = root.querySelector(
        `[data-supervision-constellation] [data-agent="${headAgent}"]`,
      );
      if (!node) {
        setTethers((prev) => (prev.length ? [] : prev));
        return;
      }
      const n = node.getBoundingClientRect();
      const cards = root.querySelectorAll(
        `[data-pending-action][data-agent-id="${headAgent}"]:not([data-behind])`,
      );
      const next: TetherLine[] = [];
      for (const card of cards) {
        const c = card.getBoundingClientRect();
        // Carte franchement à droite (LTR) ou à gauche (RTL) du nœud ; sinon
        // les surfaces se recouvrent et un trait n'aurait aucun sens.
        const toRight = c.left >= n.right;
        const toLeft = c.right <= n.left;
        if (!toRight && !toLeft) continue;
        // Point d'ancrage hors du panneau (deck défilé) → pas d'attache.
        const anchorY = c.top + 22;
        if (anchorY < base.top || anchorY > base.bottom) continue;
        // Carte dans un conteneur défilant marqué [data-tethers-viewport]
        // (file portefeuille) : son rect survit au défilement alors qu'elle
        // est rognée — pas d'attache vers une carte invisible.
        const clip = card.closest('[data-tethers-viewport]')?.getBoundingClientRect();
        if (clip && (anchorY < clip.top || anchorY > clip.bottom)) continue;
        const y2 = anchorY - base.top;
        next.push({
          key: card.getAttribute('data-pending-action') ?? String(next.length),
          urgent: card.hasAttribute('data-urgent'),
          x1: Math.round((toRight ? n.right : n.left) - base.left),
          y1: Math.round(n.top + n.height / 2 - base.top),
          x2: Math.round((toRight ? c.left : c.right) - base.left),
          y2: Math.round(y2),
        });
      }
      setTethers((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };

    measure();

    // Observer la racine ne suffit pas : le diagramme peut se redimensionner
    // (borne en vh), une carte s'étendre (« Pourquoi ? ») ou le cadre de la
    // file changer — autant de déplacements SANS changement de taille racine,
    // qui laissaient des attaches mesurées sur des positions périmées.
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    const constellation = root.querySelector('[data-supervision-constellation]');
    if (constellation) observer.observe(constellation);
    for (const viewport of root.querySelectorAll('[data-tethers-viewport]')) observer.observe(viewport);
    for (const card of root.querySelectorAll(`[data-pending-action][data-agent-id="${headAgent}"]`)) {
      observer.observe(card);
    }

    // Le deck se déplie/replie (data-behind, montages) sans changer la taille du
    // panneau : on observe les mutations, avec une re-mesure différée pour
    // capter la position POST-animation du dépliage.
    let raf = 0;
    let settleTimer = 0;
    const queueMeasure = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          measure();
        });
      }
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(measure, SETTLE_MS);
    };
    const mutations = new MutationObserver(queueMeasure);
    mutations.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-behind', 'aria-pressed'],
    });

    // La file peut défiler en interne → re-mesure au scroll (capture).
    root.addEventListener('scroll', queueMeasure, { capture: true, passive: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
      root.removeEventListener('scroll', queueMeasure, { capture: true });
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
    };
  }, [rootRef, headAgent, revision]);

  if (tethers.length === 0) return null;

  return (
    // z-[6] : sous la file flottante (z-7) — les traits passent DERRIÈRE les
    // cartes — et au-dessus du canvas du renderer.
    <svg className="pointer-events-none absolute inset-0 z-[6] size-full overflow-visible" aria-hidden>
      <style>{TETHER_STYLES}</style>
      {tethers.map((tether) => {
        const bend = (tether.x2 - tether.x1) * 0.45;
        const path = `M${tether.x1} ${tether.y1} C${tether.x1 + bend} ${tether.y1}, ${tether.x2 - bend} ${tether.y2}, ${tether.x2} ${tether.y2}`;
        return (
          <g key={tether.key} className={tether.urgent ? 'stroke-warning/70' : 'stroke-border'}>
            <path fill="none" strokeWidth="1" d={path} />
            {/* Le paquet ne revient pas au noyau : la donnée finit là où la
                décision se prend. `pathLength=100` cale son dash sur le même
                cycle que la jambe radiale du renderer. */}
            <HopPacket d={path} />
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
