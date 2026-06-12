// Constantes partagées par ServiceRequestsList et ses vues (carte / grille / liste).
// Styles alignés sur DESIGN_BASELINE (tokens var(--…), rayons 9/14, hairlines).

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

export const LIST_ROWS_PER_PAGE_OPTIONS = [10, 25, 50];
export const LIST_DEFAULT_ROWS = 10;

export const LIST_PAPER_SX = {
  border: '1px solid var(--line)',
  boxShadow: 'none',
  borderRadius: '14px',
  bgcolor: 'var(--card)',
} as const;

export const ITEMS_PER_PAGE = 6;

// ─── Chips statut / priorité → tokens sémantiques (texte couleur + fond -soft) ───

const SR_STATUS_TOKEN: Record<string, { fg: string; bg: string }> = {
  pending: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  approved: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  assigned: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  devis_accepted: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  awaiting_payment: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  in_progress: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  completed: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  cancelled: { fg: 'var(--muted)', bg: 'var(--hover)' },
  rejected: { fg: 'var(--err)', bg: 'var(--err-soft)' },
};

const SR_PRIORITY_TOKEN: Record<string, { fg: string; bg: string }> = {
  low: { fg: 'var(--muted)', bg: 'var(--hover)' },
  normal: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  medium: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  high: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  urgent: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  critical: { fg: 'var(--err)', bg: 'var(--err-soft)' },
};

const FALLBACK_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' } as const;

/** Sx d'un chip de statut de demande (géométrie pilule héritée du thème global MuiChip). */
export function srStatusChipSx(status: string) {
  const tk = SR_STATUS_TOKEN[status?.toLowerCase()] ?? FALLBACK_TOKEN;
  return { color: tk.fg, bgcolor: tk.bg, border: 'none', '& .MuiChip-icon': { color: tk.fg } } as const;
}

/** Sx d'un chip de priorité de demande (texte couleur + fond -soft). */
export function srPriorityChipSx(priority: string) {
  const tk = SR_PRIORITY_TOKEN[priority?.toLowerCase()] ?? FALLBACK_TOKEN;
  return { color: tk.fg, bgcolor: tk.bg, border: 'none', '& .MuiChip-icon': { color: tk.fg } } as const;
}
