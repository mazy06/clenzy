import * as React from 'react';

/**
 * Rendu VIGNETTE d'un graphique.
 *
 * <p>A une centaine de pixels de large, les graduations et la legende ne sont
 * plus que des taches grises. Les masquer en CSS ne suffisait pas : Recharts
 * RESERVE la place de ses axes, et un `display: none` laisse la gouttiere —
 * le dessin restait tasse dans un coin de la vignette.</p>
 *
 * <p>Le contexte permet aux graphiques de ne PAS dessiner leurs axes du tout
 * (`hide` de Recharts, qui rend la place) ni leur legende. Le trace occupe
 * alors toute la vignette, sans rognage a l'estime.</p>
 *
 * <p>Meme motif que {@code statTileCompact} : un module a part, pour que le
 * producteur et le consommateur du contexte ne s'importent pas l'un l'autre.</p>
 */
export const ChartThumbnailContext = React.createContext(false);

export function useChartThumbnail(): boolean {
  return React.useContext(ChartThumbnailContext);
}
