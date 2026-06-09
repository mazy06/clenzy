// Constantes partagées par PropertiesList et ses vues (carte / grille / tableau).

export const ICON_BUTTON_SX = {
  p: 0.5,
  borderRadius: 1,
  border: '1px solid',
  borderColor: 'divider',
  color: 'text.secondary',
  '&:hover': { bgcolor: 'rgba(107,138,154,0.08)', borderColor: 'primary.main', color: 'primary.main' },
  '& .MuiSvgIcon-root': { fontSize: 18 },
} as const;

export const PAGINATION_SX = {
  position: 'sticky',
  bottom: 0,
  bgcolor: 'background.paper',
  borderTop: '1px solid',
  borderColor: 'divider',
  mt: 1.5,
  borderRadius: 1,
  '& .MuiTablePagination-toolbar': {
    minHeight: 36,
    px: 1,
  },
  '& .MuiTablePagination-displayedRows': {
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  '& .MuiTablePagination-actions .MuiIconButton-root': {
    p: 0.5,
    '& .MuiSvgIcon-root': { fontSize: 18 },
  },
} as const;

export const ITEMS_PER_PAGE = 6;
export const LIST_ROWS_PER_PAGE_OPTIONS = [10, 25, 50];
export const LIST_DEFAULT_ROWS = 10;

export const LIST_PAPER_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;
