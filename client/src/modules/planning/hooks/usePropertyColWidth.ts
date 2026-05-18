import { useMediaQuery, useTheme } from '@mui/material';
import {
  PROPERTY_COL_WIDTH,
  PROPERTY_COL_WIDTH_MD,
  PROPERTY_COL_WIDTH_SM,
} from '../constants';

/**
 * Returns a responsive property-column width based on viewport breakpoints.
 *
 * ≥ 1200px → 280px  (carousel + nom complet + sous-titre + tag count, large)
 * ≥  900px → 240px  (carousel + nom complet + sous-titre + tag count)
 * <  900px → 200px  (carousel + nom 2 lignes + sous-titre + tag count)
 */
export function usePropertyColWidth(): number {
  const theme = useTheme();
  const isLg = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true });
  const isMd = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });

  if (isLg) return PROPERTY_COL_WIDTH;
  if (isMd) return PROPERTY_COL_WIDTH_MD;
  return PROPERTY_COL_WIDTH_SM;
}
