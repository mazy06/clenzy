import React, { useState } from 'react';
import { Box, IconButton, Popover, Tooltip } from '@mui/material';
import { MoreHoriz } from '../icons';
import { useTranslation } from '../hooks/useTranslation';

/**
 * Conteneur des actions du PageHeader (slot droit).
 *
 * Comportement unifié (demande produit) :
 *   - À toute taille : les boutons d'action sont rendus ICON-ONLY (le libellé
 *     est masqué visuellement mais conservé comme nom accessible).
 *   - En responsive (< sm) : tous les icônes sont repliés dans UN SEUL bouton
 *     overflow (⋯) ouvrant un dropdown où les actions réapparaissent AVEC leur
 *     libellé (pleine largeur, empilées).
 *
 * Générique : fonctionne pour les actions passées en JSX inline ET pour celles
 * portalées via PageHeaderActionsContext (le portail se re-render au montage du
 * slot, donc le contenu apparaît à l'ouverture du dropdown).
 */

/** Masque le libellé des boutons à icône → icon-only carré. */
const ICON_ONLY_SX = {
  '& .MuiButton-root:has(.MuiButton-startIcon), & .MuiButton-root:has(.MuiButton-endIcon)': {
    fontSize: 0,
    minWidth: 38,
    paddingInline: 0,
    '& .MuiButton-startIcon': { margin: 0 },
    '& .MuiButton-endIcon': { margin: 0 },
  },
} as const;

/** Dans le dropdown : boutons pleine largeur, libellé visible, alignés à gauche. */
const LABELED_SX = {
  '& .MuiButton-root': {
    fontSize: '13px',
    minWidth: 0,
    width: '100%',
    justifyContent: 'flex-start',
  },
} as const;

interface PageHeaderActionsProps {
  /** Recherche / filtres (slot gauche du groupe d'actions). */
  filters?: React.ReactNode;
  /** Boutons d'action. */
  actions?: React.ReactNode;
  /** Forcer le repli overflow (sinon : auto < sm). */
  narrow: boolean;
}

export default function PageHeaderActions({ filters, actions, narrow }: PageHeaderActionsProps) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  // Pas d'actions → rien (évite un bouton overflow vide sur les pages sans action).
  if (!filters && !actions) return null;

  if (!narrow) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ...ICON_ONLY_SX }}>
        {filters}
        {actions}
      </Box>
    );
  }

  return (
    <>
      <Tooltip title={t('common.actions', 'Actions')} arrow>
        <IconButton
          aria-label={t('common.actions', 'Actions')}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ flexShrink: 0 }}
        >
          <MoreHoriz size={18} strokeWidth={2} />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        onClick={() => setAnchorEl(null)}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 0.5,
            p: 1,
            minWidth: 200,
            ...LABELED_SX,
          }}
        >
          {filters}
          {actions}
        </Box>
      </Popover>
    </>
  );
}
