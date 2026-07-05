/* ============================================================
   Géométrie de la constellation (cœur headless, pur)

   Port fidèle de layoutConstellation + drawBeams (demo variants.js) :
     angle = -π/2 + i·(2π/n) + 0.18
     r     = R · RAD[autonomie]   (l'orbite reflète toujours l'autonomie)
     R     = min(w, h) / 2
   Faisceaux : du bord du cœur (34 px) au bord de l'avatar (28 px).

   Aucune dépendance React/DOM → testable unitairement (Phase 8).
   ============================================================ */

import { AGENT_IDS, RAD, isConnectedStatus } from '../constants';
import type { AgentId, AgentStatus, AutonomyLevel } from '../types';

export interface LayoutAgentInput {
  id: AgentId;
  status: AgentStatus;
  autonomy: AutonomyLevel;
}

export interface SatelliteLayout {
  id: AgentId;
  x: number;
  y: number;
  status: AgentStatus;
  autonomy: AutonomyLevel;
  active: boolean; // relié au cœur par un faisceau ?
}

export interface BeamLayout {
  id: AgentId;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  status: AgentStatus;
  active: boolean;
}

export interface RingLayout {
  autonomy: AutonomyLevel;
  radius: number;
}

export interface ConstellationLayout {
  width: number;
  height: number;
  cx: number;
  cy: number;
  radius: number; // R
  rings: RingLayout[];
  satellites: SatelliteLayout[];
  beams: BeamLayout[];
}

/** Offsets aérés : départ au bord du cœur, arrivée au bord de l'avatar. */
const CORE_EDGE = 34;
const AVATAR_EDGE = 28;

/* Empreinte d'un satellite autour de son centre (px), pour dimensionner R sans
   rogner les agents extérieurs. BAS = demi-avatar (25) + gap + pastille de nom ;
   c'est le bord le plus contraint. HAUT = demi-avatar + petite bande (anneau/label).
   CÔTÉ = demi-avatar + marge. On garde un rayon minimal pour rester fini si la boîte
   n'est pas encore mesurée (taille 0 en SSR/jsdom). */
const SAT_FOOTPRINT_BELOW = 75;
const SAT_FOOTPRINT_ABOVE = 34;
const SAT_FOOTPRINT_SIDE = 60;
const MIN_OUTER_REACH = 40;

/** Du plus proche du centre (Auto) au plus loin (Suggère). */
const RING_ORDER: AutonomyLevel[] = ['full', 'notify', 'suggest'];

/** Décalage angulaire de la démo, pour une belle répartition. */
const ANGLE_OFFSET = 0.18;

export function computeConstellationLayout(
  agents: LayoutAgentInput[],
  size: { width: number; height: number },
): ConstellationLayout {
  const width = Math.max(0, size.width);
  const height = Math.max(0, size.height);
  const cx = width / 2;
  // Centre VISUEL (≠ centre géométrique) : les empreintes verticales sont
  // asymétriques — la pastille de NOM est SOUS l'avatar → il faut réserver ~75px
  // en bas contre seulement ~34px en haut. Centrer sur height/2 bride donc le
  // rayon par le bas ET laisse une bande vide EN HAUT. On remonte le centre de
  // (BELOW-ABOVE)/2 : les portées haut/bas s'égalisent → rayon maximal et
  // l'espace du haut est exploité (la bande vide passe de ~75px à ~34px).
  const cy = height / 2 - (SAT_FOOTPRINT_BELOW - SAT_FOOTPRINT_ABOVE) / 2;

  // R est dimensionné pour que l'anneau EXTÉRIEUR (suggest) tienne dans la boîte
  // AVEC l'empreinte d'un satellite — sinon l'agent du bas (avatar + pastille de
  // nom dessous) était rogné par l'overflow:hidden. Le bord bas est le plus
  // contraint (label sous l'avatar). On réserve aussi une bande haute (HUD/Scan +
  // cartes HITL CopilotKit qui flottent dans les coins). La barre de chat CopilotKit
  // est en flux SOUS la boîte → pas d'overlap à gérer ici.
  const downReach = height - cy - SAT_FOOTPRINT_BELOW;
  const upReach = cy - SAT_FOOTPRINT_ABOVE;
  const sideReach = Math.min(cx, width - cx) - SAT_FOOTPRINT_SIDE;
  const outerReach = Math.max(MIN_OUTER_REACH, Math.min(downReach, upReach, sideReach));
  const R = RAD.suggest > 0 ? outerReach / RAD.suggest : outerReach;

  const rings: RingLayout[] = RING_ORDER.map((autonomy) => ({ autonomy, radius: R * RAD[autonomy] }));

  // Ordre canonique stable (indépendant de l'ordre d'arrivée des données).
  const ordered = AGENT_IDS.map((id) => agents.find((a) => a.id === id)).filter(
    (a): a is LayoutAgentInput => Boolean(a),
  );
  const n = ordered.length || 1;

  const satellites: SatelliteLayout[] = ordered.map((agent, i) => {
    const angle = -Math.PI / 2 + i * ((2 * Math.PI) / n) + ANGLE_OFFSET;
    // L'orbite reflète TOUJOURS le niveau d'autonomie de l'agent (cohérence avec
    // les labels d'anneaux SUGGÈRE/NOTIFIE/AUTO). Le statut `wait` (« Attend ta
    // validation ») est signalé par ailleurs (couleur ambre, HUD « en attente »,
    // carte HITL) — il ne déplace plus l'agent sur l'anneau AUTO (label trompeur).
    const r = R * RAD[agent.autonomy];
    return {
      id: agent.id,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      status: agent.status,
      autonomy: agent.autonomy,
      active: isConnectedStatus(agent.status),
    };
  });

  const beams: BeamLayout[] = satellites.map((s) => {
    const angle = Math.atan2(s.y - cy, s.x - cx);
    return {
      id: s.id,
      x1: cx + CORE_EDGE * Math.cos(angle),
      y1: cy + CORE_EDGE * Math.sin(angle),
      x2: s.x - AVATAR_EDGE * Math.cos(angle),
      y2: s.y - AVATAR_EDGE * Math.sin(angle),
      status: s.status,
      active: s.active,
    };
  });

  return { width, height, cx, cy, radius: R, rings, satellites, beams };
}
