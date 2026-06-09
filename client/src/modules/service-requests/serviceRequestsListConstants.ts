// Constantes partagées par ServiceRequestsList et ses vues (carte / grille / liste).

export const PAGINATION_SX = {
  position: 'sticky',
  bottom: 0,
  bgcolor: 'background.paper',
  borderTop: '1px solid',
  borderColor: 'divider',
  mt: 2,
  borderRadius: 1,
} as const;

export const LIST_ROWS_PER_PAGE_OPTIONS = [10, 25, 50];
export const LIST_DEFAULT_ROWS = 10;

export const LIST_PAPER_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;

export const ITEMS_PER_PAGE = 6;
