// Constantes de style partagées par ChannelsPage et ses vues (liste / grille) + sous-sections.

export const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
  p: 2,
} as const;

export const OTA_CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'default',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
    borderColor: 'grey.300',
  },
} as const;

export const OTA_CARD_CONTENT_SX = {
  p: 2.5,
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,
  flex: 1,
} as const;
