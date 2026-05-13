import { useTheme, useMediaQuery } from '@mui/material';

/**
 * Roles d'icones standardises dans le PMS.
 *   - hero    : grosse icone dans une carte de presentation (~40px)
 *   - badge   : icone dans un avatar/badge carre (~20-24px)
 *   - section : titre de section (~18-22px)
 *   - action  : bouton d'action, IconButton (~16-20px)
 *   - row     : ligne de tableau, liste, ligne d'info (~14-17px)
 *   - inline  : icone inline dans un Chip, label, tooltip (~12-14px)
 *   - micro   : tres petite icone decorative (~10-12px)
 */
export type IconRole = 'hero' | 'badge' | 'section' | 'action' | 'row' | 'inline' | 'micro';

/**
 * Echelle des icones par role x breakpoint.
 * Aligne avec les paliers typography du theme :
 *   - base : <1200px (laptop standard 13-15')
 *   - md+  : 1200-1535px
 *   - xl+  : >=1536px
 *
 * Garde une difference d'environ 1 cran entre paliers pour matcher la
 * difference typo (~12 -> 13 -> 14 px sur body).
 */
const ICON_SIZE_TABLE: Record<IconRole, { base: number; md: number; xl: number }> = {
  hero:    { base: 26, md: 30, xl: 34 },
  badge:   { base: 14, md: 16, xl: 18 },
  section: { base: 13, md: 14, xl: 16 },
  action:  { base: 12, md: 13, xl: 14 },
  row:     { base: 11, md: 12, xl: 13 },
  inline:  { base: 10, md: 11, xl: 12 },
  micro:   { base: 9,  md: 10, xl: 10 },
};

/**
 * Retourne la taille d'icone adaptee au viewport courant pour un role donne.
 *
 * Utilisation :
 *   const size = useIconSize('action');
 *   <Edit size={size} strokeWidth={1.75} />
 *
 * Bonne pratique : passe par les roles plutot que d'ecrire des chiffres bruts
 * dans tes composants. Si la charte change, on bouge ICON_SIZE_TABLE et tout
 * suit automatiquement.
 */
export function useIconSize(role: IconRole): number {
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('lg'));   // 1200px+
  const isXl = useMediaQuery(theme.breakpoints.up('xl'));   // 1536px+
  const tier = ICON_SIZE_TABLE[role];
  if (isXl) return tier.xl;
  if (isMd) return tier.md;
  return tier.base;
}

/**
 * Renvoie un objet { isSm, isMd, isLg, isXl } pour les composants qui veulent
 * adapter leur layout (gap, padding, columns) sans lire useMediaQuery 4 fois.
 *
 * Note : isMd/isLg/isXl utilisent la convention 'mobile-first' (`up(...)`),
 * donc isXl implique isLg implique isMd.
 */
export function useResponsiveBreakpoints() {
  const theme = useTheme();
  return {
    isSm: useMediaQuery(theme.breakpoints.up('sm')),
    isMd: useMediaQuery(theme.breakpoints.up('md')),
    isLg: useMediaQuery(theme.breakpoints.up('lg')),
    isXl: useMediaQuery(theme.breakpoints.up('xl')),
  };
}
