import { useMediaQuery, useTheme } from '@mui/material';
import {
  PROPERTY_COL_WIDTH,
  PROPERTY_COL_WIDTH_MD,
  PROPERTY_COL_WIDTH_SM,
} from '../constants';

/**
 * Returns a responsive property-column width based on viewport breakpoints.
 *
 * Spec maquette .pl-corner / .pl-name : 188px à tous les breakpoints
 * (nom 1 ligne ellipsis + ville). Reste redimensionnable par drag handle.
 */
export function usePropertyColWidth(): number {
  const theme = useTheme();
  const isLg = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true });
  const isMd = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });

  if (isLg) return PROPERTY_COL_WIDTH;
  if (isMd) return PROPERTY_COL_WIDTH_MD;
  return PROPERTY_COL_WIDTH_SM;
}
