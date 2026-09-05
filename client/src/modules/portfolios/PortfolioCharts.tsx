import React from 'react';
import {
  DonutChart,
  GroupedBarChart,
  HistogramChart,
  SERIES_TOKENS,
  TrendAreaChart,
} from '../../components/stats';
import type { PortfolioBucket, PortfolioStats } from '../../services/api/portfoliosApi';

/**
 * Les graphiques de l'écran statistiques des portefeuilles.
 *
 * <p>Les formes génériques — anneau, histogramme, barres groupées, aires —
 * vivent dans `components/stats` : les Rapports parlent le même langage et
 * doivent le tenir du même endroit. Ne restent ici que les deux lectures
 * PROPRES aux portefeuilles, celles qui savent ce qu'est une ville couverte ou
 * un mois de rattachement.</p>
 */
export { DonutChart, HistogramChart, SERIES_TOKENS };

/**
 * Deux répartitions comparées ville par ville.
 *
 * <p>C'est le graphique qui répond à la seule question opérationnelle de
 * l'écran : où le parc est-il couvert, et où ne l'est-il pas. Les villes sont
 * l'union des deux séries — une ville avec des logements et aucun intervenant
 * doit apparaître, c'est précisément le cas qu'on cherche.</p>
 */
export const CoverageChart: React.FC<{
  properties: PortfolioBucket[];
  staff: PortfolioBucket[];
  propertiesLabel: string;
  staffLabel: string;
}> = ({ properties, staff, propertiesLabel, staffLabel }) => {
  const villes = Array.from(
    new Set([...properties.map((b) => b.label), ...staff.map((b) => b.label)]),
  );
  const byLabel = (list: PortfolioBucket[], label: string) =>
    list.find((b) => b.label === label)?.count ?? 0;

  const data = villes
    .map((ville) => ({
      label: ville,
      properties: byLabel(properties, ville),
      staff: byLabel(staff, ville),
    }))
    .sort((a, b) => b.properties + b.staff - (a.properties + a.staff));

  return (
    <GroupedBarChart
      data={data}
      series={[
        { key: 'properties', label: propertiesLabel, tokenIndex: 0 },
        { key: 'staff', label: staffLabel, tokenIndex: 1 },
      ]}
    />
  );
};

/**
 * Rattachements dans le temps.
 *
 * <p>Les mois SANS rattachement sont comblés à zéro : sauter d'un mois peuplé
 * au suivant écraserait le trou et donnerait à lire une continuité qui n'existe
 * pas. Une aire empilée, parce que la question est le volume total autant que
 * sa composition.</p>
 */
export const TimelineChart: React.FC<{
  points: PortfolioStats['assignmentsByMonth'];
  clientsLabel: string;
  staffLabel: string;
}> = ({ points, clientsLabel, staffLabel }) => (
  <TrendAreaChart
    stacked
    data={fillMonthGaps(points)}
    series={[
      { key: 'clients', label: clientsLabel, tokenIndex: 0 },
      { key: 'staff', label: staffLabel, tokenIndex: 1 },
    ]}
  />
);

/**
 * Complète les mois manquants entre le premier et le dernier point.
 *
 * <p>Sans cela, janvier et juin voisineraient sur l'axe comme s'ils se
 * suivaient : le graphique mentirait sur le rythme.</p>
 */
function fillMonthGaps(points: PortfolioStats['assignmentsByMonth']) {
  if (points.length === 0) return [];

  const trie = [...points].sort((a, b) => a.month.localeCompare(b.month));
  const parse = (m: string) => {
    const [year, month] = m.split('-').map(Number);
    return year * 12 + (month - 1);
  };
  const format = (index: number) => {
    const year = Math.floor(index / 12);
    const month = index % 12;
    return {
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: new Date(year, month, 1).toLocaleDateString('fr-FR', {
        month: 'short',
        year: '2-digit',
      }),
    };
  };

  const debut = parse(trie[0].month);
  const fin = parse(trie[trie.length - 1].month);
  const connus = new Map(trie.map((p) => [p.month, p]));

  const out = [];
  for (let i = debut; i <= fin; i += 1) {
    const { key, label } = format(i);
    const point = connus.get(key);
    out.push({ label, clients: point?.clients ?? 0, staff: point?.staff ?? 0 });
  }
  return out;
}
