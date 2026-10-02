/** Géométrie pure Baitly, commune au PMS et à ses démonstrations publiques. */
export const ORBIT_NODE_SIZE = 13;
export const ORBIT_LABEL_ROOM_PX = 38;
/** Marge réservée au contour extérieur et au focus clavier, aux bords du dessin. */
export const ORBIT_EDGE_PX = 10;
const ORBIT_RADIUS_MIN = 28;
const ORBIT_RADIUS_MAX = 38;

/** Rayon en pourcentage du carré, avec une réserve fixe pour les légendes. */
export function orbitRadiusFor(side: number): number {
  if (side <= 0) return ORBIT_RADIUS_MAX;
  const fits = 50 - ORBIT_NODE_SIZE / 2 - (ORBIT_LABEL_ROOM_PX / side) * 100;
  return Math.max(ORBIT_RADIUS_MIN, Math.min(ORBIT_RADIUS_MAX, fits));
}

/**
 * Dimensionne l'empreinte visible (anneau + nœuds), pas le carré transparent.
 * La dichotomie suit les trois régimes du rayon sans plafonner les grands
 * cadres. Seuls les coins vides du carré peuvent dépasser de la colonne.
 * Les dimensions reçues sont celles du layout, avant tout transform: scale.
 */
export function fitOrbitSide(width: number, height: number): number {
  const availableWidth = Math.max(0, width - ORBIT_EDGE_PX * 2);
  const availableHeight = Math.max(0, height - ORBIT_EDGE_PX * 2);
  const room = availableHeight - ORBIT_LABEL_ROOM_PX;
  if (availableWidth <= 0 || room <= 0) return 0;
  let low = 0;
  let high = Math.max(availableWidth, availableHeight) * 3;
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    const drawn = ((2 * orbitRadiusFor(mid) + ORBIT_NODE_SIZE) / 100) * mid;
    if (drawn <= availableWidth && drawn <= room) low = mid;
    else high = mid;
  }
  return low;
}
