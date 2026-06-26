/* ============================================================
   Géométrie de la constellation (cœur headless, pur)

   Port fidèle de layoutConstellation + drawBeams (demo variants.js) :
     angle = -π/2 + i·(2π/n) + 0.18
     r     = R · RAD[autonomie]   (wait → R · RAD.full, tiré au centre)
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
  const cy = height / 2;
  const R = Math.min(width, height) / 2;

  const rings: RingLayout[] = RING_ORDER.map((autonomy) => ({ autonomy, radius: R * RAD[autonomy] }));

  // Ordre canonique stable (indépendant de l'ordre d'arrivée des données).
  const ordered = AGENT_IDS.map((id) => agents.find((a) => a.id === id)).filter(
    (a): a is LayoutAgentInput => Boolean(a),
  );
  const n = ordered.length || 1;

  const satellites: SatelliteLayout[] = ordered.map((agent, i) => {
    const angle = -Math.PI / 2 + i * ((2 * Math.PI) / n) + ANGLE_OFFSET;
    // wait → tiré au centre (urgence), quel que soit son niveau d'autonomie.
    const r = agent.status === 'wait' ? R * RAD.full : R * RAD[agent.autonomy];
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
