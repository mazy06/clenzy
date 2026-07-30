import React, { useState } from 'react';
import { Box, Popover } from '@mui/material';
import { MoreHorizontal } from 'lucide-react';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from './ui';
import { useTranslation } from '../hooks/useTranslation';

/**
 * Conteneur des actions du PageHeader (slot droit).
 *
 * Comportement unifié (demande produit) :
 *   - À toute taille : les boutons d'action sont rendus ICON-ONLY (le libellé
 *     est masqué visuellement mais conservé comme nom accessible).
 *   - En responsive (< md) : tous les icônes sont repliés dans UN SEUL bouton
 *     overflow (⋯) ouvrant un dropdown où les actions réapparaissent AVEC leur
 *     libellé (pleine largeur, empilées).
 *
 * Générique : fonctionne pour les actions passées en JSX inline ET pour celles
 * portalées via PageHeaderActionsContext (le portail se re-render au montage du
 * slot, donc le contenu apparaît à l'ouverture du dropdown).
 */

/**
 * Normalisation Baitly UI des boutons d'action, quelle que soit leur origine
 * (MUI `Button`, `IconButton`, bouton du kit) :
 *
 *   - CARRÉ strict de 36 px, icône centrée par flex (pas de padding résiduel
 *     MUI qui décalait l'icône vers la droite) ;
 *   - rayon 10 px, hairline `--bui-border`, encre `--bui-foreground` — plus de
 *     bleu MUI `color="primary"` étranger à la palette Baitly ;
 *   - hiérarchie conservée : `contained` = pastille pleine bleu nuit,
 *     `outlined`/`text`/IconButton = neutre, `error` = destructive.
 */
const ICON_ONLY_SX = {
  // Le sélecteur est doublé (`&&`) pour battre les styles Emotion du thème MUI,
  // qui ne passent pas par les couches CSS du kit.
  '&& .MuiButton-root, && .MuiIconButton-root': {
    boxSizing: 'border-box',
    // Gabarit `cn-button-size-icon` du kit : carré de 32 px, rayon rounded-lg.
    width: 32,
    height: 32,
    minWidth: 32,
    minHeight: 32,
    padding: 0,
    borderRadius: 'var(--radius-lg, 10px)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 0,
    lineHeight: 0,
    boxShadow: 'none',
    transition:
      'background-color .15s var(--ease-out), color .15s var(--ease-out), border-color .15s var(--ease-out)',
    '& .MuiButton-startIcon, & .MuiButton-endIcon': { margin: 0 },
    // `[&_svg:not([class*='size-'])]:size-4` du kit.
    '& svg': { width: 16, height: 16, flexShrink: 0 },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  },

  // Variante `outline` du kit : hairline --border, fond --background,
  // survol --muted. C'est le rendu des boutons d'icône de la galerie.
  '&& .MuiButton-outlined, && .MuiButton-text, && .MuiIconButton-root': {
    border: '1px solid var(--bui-border)',
    color: 'var(--bui-foreground)',
    backgroundColor: 'var(--bui-background)',
    '&:hover': {
      backgroundColor: 'var(--bui-muted)',
      borderColor: 'var(--bui-border)',
      color: 'var(--bui-foreground)',
    },
  },

  // Action principale : variante `default` du kit (pastille pleine bleu nuit).
  '&& .MuiButton-contained': {
    backgroundColor: 'var(--bui-primary)',
    color: 'var(--bui-primary-foreground)',
    border: '1px solid transparent',
    '&:hover': { backgroundColor: 'var(--bui-primary-deep)', boxShadow: 'none' },
  },

  // Actions destructives : on garde le signal, à la teinte Baitly.
  '&& .MuiButton-outlinedError, && .MuiButton-textError, && .MuiIconButton-colorError': {
    color: 'var(--bui-destructive-ink)',
    borderColor: 'var(--bui-destructive)',
    '&:hover': {
      backgroundColor: 'var(--bui-destructive-soft)',
      color: 'var(--bui-destructive-ink)',
    },
  },
  '&& .MuiButton-containedError': {
    backgroundColor: 'var(--bui-destructive)',
    color: 'var(--bui-primary-foreground)',
  },

  '&& .Mui-disabled': { opacity: 0.5 },
} as const;

/** Dans le dropdown : boutons pleine largeur, libellé visible, alignés au début. */
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
  /** Forcer le repli overflow (sinon : auto < md). */
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
      <Tooltip>
        {/* Le trigger enveloppe un <span> (élément hôte) : Radix y pose sa ref
            d'ancrage, ce qu'un composant fonction React 18 ne peut pas recevoir. */}
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="outline"
              size="icon"
              aria-label={t('common.actions', 'Actions')}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={(event) => setAnchorEl(event.currentTarget)}
            >
              <MoreHorizontal />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t('common.actions', 'Actions')}</TooltipContent>
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
