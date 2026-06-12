// Constantes partagées par PropertiesList et ses vues (carte / grille / tableau).
// Styles alignés sur DESIGN_BASELINE (tokens var(--…), rayons 9/14, hairlines).

export const ICON_BUTTON_SX = {
  p: 0.5,
  borderRadius: '9px',
  border: '1px solid var(--line-2)',
  bgcolor: 'var(--card)',
  color: 'var(--muted)',
  transition: 'border-color .14s, color .14s, background-color .14s',
  '&:hover': { bgcolor: 'var(--hover)', borderColor: 'var(--faint)', color: 'var(--ink)' },
  '& .MuiSvgIcon-root': { fontSize: 18 },
} as const;

export const PAGINATION_SX = {
  position: 'sticky',
  bottom: 0,
  bgcolor: 'var(--card)',
  borderTop: '1px solid var(--line)',
  mt: 1.5,
  borderRadius: '9px',
} as const;

export const ITEMS_PER_PAGE = 6;
export const LIST_ROWS_PER_PAGE_OPTIONS = [10, 25, 50];
export const LIST_DEFAULT_ROWS = 10;

export const LIST_PAPER_SX = {
  border: '1px solid var(--line)',
  boxShadow: 'none',
  borderRadius: '14px',
  bgcolor: 'var(--card)',
} as const;

// ─── Chips statut propriété → tokens sémantiques (pattern « texte couleur + fond -soft ») ───

const PROPERTY_STATUS_TOKEN: Record<string, { fg: string; bg: string }> = {
  ACTIVE: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  INACTIVE: { fg: 'var(--muted)', bg: 'var(--hover)' },
  MAINTENANCE: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  UNDER_MAINTENANCE: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  RENTED: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  SOLD: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  ARCHIVED: { fg: 'var(--err)', bg: 'var(--err-soft)' },
};

/** Sx d'un chip de statut propriété (géométrie pilule héritée du thème global MuiChip). */
export function propertyStatusChipSx(status: string) {
  const tk = PROPERTY_STATUS_TOKEN[status?.toUpperCase()] ?? { fg: 'var(--muted)', bg: 'var(--hover)' };
  return { color: tk.fg, bgcolor: tk.bg, border: 'none', '& .MuiChip-icon': { color: tk.fg } } as const;
}

/**
 * Sx d'un chip « -soft » dérivé d'une couleur de donnée (type, équipement, fréquence…) —
 * texte couleur + fond translucide, géométrie pilule du thème global.
 */
export function softDataChipSx(hex: string) {
  return { color: hex, bgcolor: `${hex}1F`, border: 'none', '& .MuiChip-icon': { color: hex } } as const;
}

/** Chip neutre « champ » (.fr-chip) pour équipements / services. */
export const FIELD_CHIP_SX = {
  color: 'var(--body)',
  bgcolor: 'var(--field)',
  border: '1px solid var(--field-line)',
  '& .MuiChip-icon': { color: 'var(--accent)' },
} as const;
