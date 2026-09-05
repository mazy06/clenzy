/**
 * Le langage « statistiques » de Baitly : un bandeau de chiffres, une grille de
 * tuiles, des graphiques qui remplissent la place qu'on leur donne.
 *
 * <p>Né dans l'onglet Statistiques de l'Annuaire, partagé depuis avec les
 * Rapports pour que les deux écrans se lisent de la même façon.</p>
 */
export { ChartTile, TileGrid, StatsLayout, tiles, type Tile, type TileOrNothing } from './ChartTile';
export { StatsBand, Figure, type StatFigure } from './StatsBand';
export { HighlightList, type Highlight } from './HighlightList';
export {
  DonutChart,
  HistogramChart,
  GroupedBarChart,
  TrendAreaChart,
  TrendLineChart,
  EmptyChart,
  SERIES_TOKENS,
  TONE_TOKENS,
  seriesColor,
  tooltipValue,
  type StatBucket,
  type SeriesDef,
  type SeriesTone,
  type ValueFormatter,
} from './charts';
