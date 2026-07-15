// Constantes partagées par ServiceRequestsList et ses vues (carte / grille / liste).
// Styles alignés sur DESIGN_BASELINE (tokens var(--…), rayons 9/14, hairlines).

import { STATUS_TONES, type StatusTone } from '../../components/StatusChip';

export const PAGINATION_SX = {
  position: 'sticky',
  bottom: 0,
  bgcolor: 'var(--card)',
  borderTop: '1px solid var(--line)',
  mt: 2,
  borderRadius: '9px',
  '& .MuiTablePagination-displayedRows, & .MuiTablePagination-selectLabel': {
    fontSize: '11.5px',
    fontWeight: 600,
    color: 'var(--muted)',
    fontVariantNumeric: 'tabular-nums',
  },
} as const;

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

/** Sx d'un chip de priorité de demande (texte couleur + fond -soft). */
export function srPriorityChipSx(priority: string) {
  return toneChipSx(SR_PRIORITY_TONE[priority?.toLowerCase()] ?? 'neutral');
}
