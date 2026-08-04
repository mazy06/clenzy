import { useMediaQuery } from '../../../hooks/use-media-query';
import {
  PROPERTY_COL_WIDTH,
  PROPERTY_COL_WIDTH_MD,
  PROPERTY_COL_WIDTH_SM,
} from '../constants';

// Bornes reprises telles quelles du theme MUI (lg = 1200 px, md = 900 px) :
// Tailwind lit 1024 et 768, recopier ses paliers deplacerait les seuils.
const REQUETE_LG = '(min-width: 1200px)';
const REQUETE_MD = '(min-width: 900px)';

/**
 * Returns a responsive property-column width based on viewport breakpoints.
 *
 * Spec maquette .pl-corner / .pl-name : 188px à tous les breakpoints
 * (nom 1 ligne ellipsis + ville). Reste redimensionnable par drag handle.
 */
export function usePropertyColWidth(): number {
  const isLg = useMediaQuery(REQUETE_LG);
  const isMd = useMediaQuery(REQUETE_MD);

  if (isLg) return PROPERTY_COL_WIDTH;
  if (isMd) return PROPERTY_COL_WIDTH_MD;
  return PROPERTY_COL_WIDTH_SM;
}
