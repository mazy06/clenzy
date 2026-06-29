import type { ReactNode } from 'react';

/**
 * Icônes MONOLINE colorées par catégorie de service payant (option C retenue) : trait fin, sans fond,
 * une couleur intrinsèque par type. Aucune dépendance externe (SVG inline, recolorable, on-brand).
 * viewBox 0 0 24 24 ; trait via `currentColor` (posé par `style={{ color }}` selon le type).
 */

/** Couleur intrinsèque par type de service (registre brand, lisible en clair ET sombre). */
export const SERVICE_COLOR: Record<string, string> = {
  EARLY_CHECKIN: '#C8924B', // ambre — matin
  LATE_CHECKOUT: '#6E97BE', // bleu — soir
  CLEANING: '#3E9B89',      // teal — fraîcheur
  BREAKFAST: '#C56F6F',     // rosé — chaleur
  TRANSFER: '#6B8A9A',      // ardoise (primaire)
  PARKING: '#6E6DD4',       // indigo
  EQUIPMENT: '#5E9B86',     // vert
  EXPERIENCE: '#D08A55',    // orange
};
const DEFAULT_COLOR = '#6B8A9A';

/** Tracés monoline par type (héritent stroke/fill du <svg> parent — aucun attribut de couleur ici). */
const PATHS: Record<string, ReactNode> = {
  // Arrivée anticipée : lever de soleil.
  EARLY_CHECKIN: (
    <>
      <path d="M3.5 18h17" />
      <path d="M7 18a5 5 0 0 1 10 0" />
      <path d="M12 4.5v2.6" />
      <path d="M5.4 9.2l1.6 1.6" />
      <path d="M18.6 9.2l-1.6 1.6" />
    </>
  ),
  // Départ tardif : croissant de lune.
  LATE_CHECKOUT: <path d="M18.6 14.4A7.6 7.6 0 1 1 9.6 5.4 5.9 5.9 0 0 0 18.6 14.4Z" />,
  // Ménage : deux étincelles.
  CLEANING: (
    <>
      <path d="M10.5 3.8l1.5 4.1 4.1 1.5-4.1 1.5-1.5 4.1-1.5-4.1L5 9.4l4-1.5z" />
      <path d="M17.6 13.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  // Petit-déjeuner : tasse + vapeur.
  BREAKFAST: (
    <>
      <path d="M5 9.2h11v4.3a5.5 5.5 0 0 1-11 0z" />
      <path d="M16 10.6h2.3a2.3 2.3 0 0 1 0 4.6H16" />
      <path d="M8.6 3.6c.8 1-.8 1.6 0 2.6" />
      <path d="M12 3.6c.8 1-.8 1.6 0 2.6" />
    </>
  ),
  // Transfert : voiture.
  TRANSFER: (
    <>
      <path d="M4 17l1.6-5.4C5.9 10.6 6.6 10 7.7 10h8.6c1.1 0 1.8.6 2.1 1.6L20 17" />
      <path d="M3.6 17h16.8" />
      <circle cx="8" cy="18.6" r="1.6" />
      <circle cx="16" cy="18.6" r="1.6" />
    </>
  ),
  // Parking : panneau « P ».
  PARKING: (
    <>
      <rect x="5" y="4.6" width="14" height="14.8" rx="4.2" />
      <path d="M10 8.2v7.6" />
      <path d="M10 8.2h3a2.4 2.4 0 0 1 0 4.8h-3" />
    </>
  ),
  // Équipement : valise.
  EQUIPMENT: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="2.5" />
      <path d="M9 9V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V9" />
      <path d="M12 12.5v4.2" />
    </>
  ),
  // Expérience : montgolfière.
  EXPERIENCE: (
    <>
      <path d="M12 3a6 6 0 0 1 6 6c0 3.3-2.8 5.4-6 6.6C8.8 14.4 6 12.3 6 9a6 6 0 0 1 6-6z" />
      <path d="M10 15.1l1 2.4M14 15.1l-1 2.4" />
      <rect x="10.3" y="17" width="3.4" height="2.6" rx="0.7" />
    </>
  ),
  // Repli : étiquette.
  DEFAULT: (
    <>
      <path d="M12 4h6a2 2 0 0 1 2 2v6l-7.4 7.4a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8z" />
      <circle cx="15.4" cy="8.6" r="1.3" />
    </>
  ),
};

/** Icône monoline colorée du service par type (repli sur « étiquette »). */
export function ServiceArt({ type }: { type: string }) {
  const color = SERVICE_COLOR[type] ?? DEFAULT_COLOR;
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color }}
    >
      {PATHS[type] ?? PATHS.DEFAULT}
    </svg>
  );
}
