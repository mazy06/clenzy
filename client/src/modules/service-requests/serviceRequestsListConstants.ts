// Constantes partagées par ServiceRequestsList et ses vues (carte / grille / liste).
// Styles alignés sur DESIGN_BASELINE (tokens var(--…), rayons 9/14, hairlines).

import { STATUS_TONES, type StatusTone } from '../../components/StatusChip';

export const LIST_PAPER_SX = {
  border: '1px solid var(--line)',
  boxShadow: 'none',
  borderRadius: '14px',
  bgcolor: 'var(--card)',
} as const;

export const ITEMS_PER_PAGE = 6;

// ─── Chips statut / priorité → tons sémantiques partagés (STATUS_TONES) ───
// Mapping statut/priorité métier → ton ; les couleurs proviennent de la
// primitive partagée. Géométrie pilule héritée du thème global MuiChip
// (donc PAS toneTokensSx ici : on ne réémet que color/bgcolor/border).

const SR_STATUS_TONE: Record<string, StatusTone> = {
  pending: 'warn',
  approved: 'info',
  assigned: 'info',
  devis_accepted: 'ok',
  awaiting_payment: 'warn',
  in_progress: 'info',
  completed: 'ok',
  cancelled: 'neutral',
  rejected: 'err',
};

const SR_PRIORITY_TONE: Record<string, StatusTone> = {
  low: 'neutral',
  normal: 'info',
  medium: 'info',
  high: 'warn',
  urgent: 'err',
  critical: 'err',
};

function toneChipSx(tone: StatusTone) {
  const tk = STATUS_TONES[tone];
  return { color: tk.color, bgcolor: tk.bg, border: 'none', '& .MuiChip-icon': { color: tk.color } } as const;
}

/** Sx d'un chip de statut de demande (géométrie pilule héritée du thème global MuiChip). */
export function srStatusChipSx(status: string) {
  return toneChipSx(SR_STATUS_TONE[status?.toLowerCase()] ?? 'neutral');
}

/** Tokens de statut d'une demande, pour la primitive StatusChip. */
export function srStatusTokens(status: string) {
  return STATUS_TONES[SR_STATUS_TONE[status?.toLowerCase()] ?? 'neutral'];
}

/** Tokens de priorité d'une demande, pour la primitive StatusChip. */
export function srPriorityTokens(priority: string) {
  return STATUS_TONES[SR_PRIORITY_TONE[priority?.toLowerCase()] ?? 'neutral'];
}

/** Sx d'un chip de priorité de demande (texte couleur + fond -soft). */
export function srPriorityChipSx(priority: string) {
  return toneChipSx(SR_PRIORITY_TONE[priority?.toLowerCase()] ?? 'neutral');
}

/**
 * Gabarit des puces de SÉLECTION du formulaire de demande : plus haut et plus
 * lisible qu'une puce de statut, parce qu'on clique dessus.
 *
 * Partagé entre le choix du type de service (`ServiceRequestFormInfo`) et celui
 * du mode d'affectation (`ServiceRequestFormAssignment`) : les deux rangées se
 * suivent dans le même formulaire et doivent faire la même hauteur au pixel.
 */
export const SELECT_CHIP_CLASS = 'h-[30px] text-[11.5px]';

/**
 * Puce « champ » : caractéristiques figées d'un logement (surface, chambres,
 * équipements). Elles ne se cliquent pas — d'où le fond de champ et le liseré,
 * qui les distinguent des puces de sélection voisines, de même hauteur.
 *
 * `border-solid` est indispensable : le gabarit du kit pose `border-none`
 * (border-STYLE), que tailwind-merge ne considère pas en conflit avec `border`
 * (border-WIDTH) — sans lui, le liseré reste invisible.
 */
export const FORM_TAG_TOKENS = { color: 'var(--body)', bg: 'var(--field)' } as const;
export const FORM_TAG_CLASS =
  'h-[30px] text-[11.5px] font-medium border border-solid border-[var(--field-line)] [&>svg]:text-[var(--accent)]';
