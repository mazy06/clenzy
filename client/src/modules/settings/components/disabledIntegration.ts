import type React from 'react';

/**
 * Styles + helper partages pour griser les sections d'integration tant que
 * le backend n'est pas branche. Channex est la seule integration fonctionnelle
 * pour l'instant ; toutes les autres affichent la chip "Bientot disponible"
 * et bloquent clic + clavier sans casser le hover (les tooltips restent
 * disponibles pour decrire chaque provider).
 */

const NEUTRAL = '#8A8378';

export const COMING_SOON_CHIP_SX = {
  height: 18,
  fontSize: '0.62rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  borderRadius: '5px',
  backgroundColor: `${NEUTRAL}14`,
  color: NEUTRAL,
  border: `1px solid ${NEUTRAL}33`,
  '& .MuiChip-label': { px: 0.75 },
} as const;

// On evite `pointer-events: none` parce qu'il tuerait aussi le hover (et donc
// les tooltips d'info sur chaque provider). On bloque clic + clavier au niveau
// du wrapper via onClickCapture / onKeyDownCapture, et on neutralise les
// effets visuels de hover sur les cards enfant.
export const DISABLED_CARDS_SX = {
  opacity: 0.55,
  filter: 'grayscale(0.7)',
  userSelect: 'none' as const,
  '& [role="radio"], & [role="button"]': {
    cursor: 'not-allowed !important',
  },
  '& [role="radio"]:hover, & [role="button"]:hover': {
    borderColor: (theme: { palette: { divider: string } }) => `${theme.palette.divider} !important`,
    backgroundColor: 'transparent !important',
    boxShadow: 'none !important',
  },
  '& [role="radio"]:focus-visible, & [role="button"]:focus-visible': {
    boxShadow: 'none !important',
  },
};

/**
 * A passer en onClickCapture / onKeyDownCapture sur le wrapper d'une grille
 * desactivee. Laisse passer hover/focus (tooltips) mais empeche tout
 * selectionneur de s'ouvrir.
 */
export const blockInteraction = (e: React.SyntheticEvent) => {
  if ('key' in e) {
    const k = (e as React.KeyboardEvent).key;
    if (k !== 'Enter' && k !== ' ') return;
  }
  e.preventDefault();
  e.stopPropagation();
};
