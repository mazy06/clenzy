import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../components/ui';
import type { PortfolioBucket, PortfolioStats } from '../../services/api/portfoliosApi';

/**
 * Les graphiques de l'écran statistiques.
 *
 * <p>Ils vivent à part parce que chacun est rendu dans sa propre tuile, sans
 * rien savoir de ses voisins ni de la place qu'on lui donne.</p>
 *
 * <p>Toutes les couleurs sont des JETONS de série (`--bui-chart-*`), jamais des
 * hexadécimaux : c'est ainsi que le thème clair et le thème sombre suivent
 * sans qu'on ait à les traiter séparément.</p>
 */
export const SERIES_TOKENS = [
  'var(--bui-chart-1)',
  'var(--bui-chart-2)',
  'var(--bui-chart-3)',
  'var(--bui-chart-4)',
  'var(--bui-chart-5)',
];

/**
 * Hauteur plancher d'une tuile.
 *
 * <p>Les graphiques ne fixent plus leur hauteur : ils remplissent la tuile que
 * la grille leur donne, elle-même dérivée de la hauteur de fenêtre. Ce plancher
 * ne sert qu'à empêcher une fenêtre très basse de les réduire à une bande où
 * plus aucun axe ne se lit — mieux vaut alors déborder.</p>
 */
export const CHART_MIN_HEIGHT = 150;

/** Une part sans effectif ne se voit pas ; inutile de la porter au graphique. */
const nonEmpty = (buckets: PortfolioBucket[]) => buckets.filter((b) => b.count > 0);

/**
 * Répartition en anneau, avec sa légende chiffrée.
 *
 * <p>Un anneau plutôt qu'un camembert plein : le centre libre porte le total,
 * et l'œil compare mieux des arcs que des secteurs. Au-delà de six parts la
 * queue est regroupée sous « Autres » — un anneau à quinze parts n'est plus
 * lisible et ses libellés se chevauchent.</p>
 *
 * <p>La légende par défaut alignait des pastilles sans valeur : il fallait
 * survoler chaque arc pour savoir ce qu'il pesait. Elle est remplacée par une
 * liste qui donne l'effectif ET la part, alignés en chiffres tabulaires pour
 * que les colonnes se comparent verticalement. Elle passe à côté de l'anneau
 * quand la tuile est large, dessous quand elle est étroite.</p>
 *
 * <p>Le total est centré par un `Label` qui reçoit le centre RÉEL du camembert,
 * au lieu d'un pourcentage deviné : la présence d'une légende décale ce centre,
 * et le texte flottait alors hors de l'anneau.</p>
 */
export const DonutChart: React.FC<{
  buckets: PortfolioBucket[];
  totalLabel: string;
}> = ({ buckets, totalLabel }) => {
  const parts = nonEmpty(buckets);
  const MAX_SLICES = 6;
  const shown =
    parts.length > MAX_SLICES
      ? [
          ...parts.slice(0, MAX_SLICES - 1),
          {
            label: 'Autres',
            count: parts.slice(MAX_SLICES - 1).reduce((sum, b) => sum + b.count, 0),
          },
        ]
      : parts;

  const total = shown.reduce((sum, b) => sum + b.count, 0);

  const config: ChartConfig = Object.fromEntries(
    shown.map((b, i) => [
      b.label,
      { label: b.label, color: SERIES_TOKENS[i % SERIES_TOKENS.length] },
    ]),
  );

  if (shown.length === 0) return <EmptyChart />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 @[380px]:flex-row @[380px]:items-center">
      <div className="min-h-0 min-w-0 flex-1">
        <ChartContainer config={config} className="aspect-auto h-full w-full">
          <PieChart margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
            <Pie
              data={shown}
              dataKey="count"
              nameKey="label"
              innerRadius="58%"
              outerRadius="86%"
              paddingAngle={2}
              cornerRadius={3}
              strokeWidth={0}
            >
              {shown.map((b, i) => (
                <Cell key={b.label} fill={SERIES_TOKENS[i % SERIES_TOKENS.length]} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
                  const { cx, cy } = viewBox as { cx: number; cy: number };
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan
                        x={cx}
                        dy="-0.15em"
                        className="fill-foreground text-xl font-bold"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {total}
                      </tspan>
                      <tspan x={cx} dy="1.5em" className="fill-muted-foreground text-2xs">
                        {totalLabel}
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </div>

      {/* La légende porte les chiffres : sans eux, un anneau ne se lit qu'au
          survol, ce qui exclut le clavier et l'impression. */}
      <ul className="no-scrollbar m-0 flex max-h-full shrink-0 list-none flex-col gap-1 overflow-y-auto p-0 @[380px]:w-[46%]">
        {shown.map((b, i) => (
          <li key={b.label} className="flex items-baseline gap-1.5 text-2xs">
            <span
              aria-hidden="true"
              className="mt-1 size-2 shrink-0 rounded-[2.5px]"
              style={{ backgroundColor: SERIES_TOKENS[i % SERIES_TOKENS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground" title={b.label}>
              {b.label}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">{b.count}</span>
            <span className="w-8 shrink-0 text-end tabular-nums text-muted-foreground">
              {total > 0 ? Math.round((b.count / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Histogramme horizontal d'une répartition.
 *
 * <p>Horizontal : les libellés sont des noms de ville, qui tiennent sur une
 * ligne mais seraient tronqués ou pivotés sous une colonne verticale.</p>
 */
export const HistogramChart: React.FC<{
  buckets: PortfolioBucket[];
  label: string;
  tokenIndex?: number;
}> = ({ buckets, label, tokenIndex = 0 }) => {
  const parts = nonEmpty(buckets);
  const config: ChartConfig = {
    count: { label, color: SERIES_TOKENS[tokenIndex % SERIES_TOKENS.length] },
  };

  if (parts.length === 0) return <EmptyChart />;

  return (
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      <BarChart
        accessibilityLayer
        layout="vertical"
        data={parts}
        margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          axisLine={false}
          tickLine={false}
          width={96}
          tickMargin={6}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 3, 3, 0]} maxBarSize={18} />
      </BarChart>
    </ChartContainer>
  );
};

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

  const config: ChartConfig = {
    properties: { label: propertiesLabel, color: SERIES_TOKENS[0] },
    staff: { label: staffLabel, color: SERIES_TOKENS[1] },
  };

  if (data.length === 0) return <EmptyChart />;

  return (
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={6} />
        <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="properties" fill="var(--color-properties)" radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Bar dataKey="staff" fill="var(--color-staff)" radius={[3, 3, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ChartContainer>
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
}> = ({ points, clientsLabel, staffLabel }) => {
  const data = fillMonthGaps(points);

  const config: ChartConfig = {
    clients: { label: clientsLabel, color: SERIES_TOKENS[0] },
    staff: { label: staffLabel, color: SERIES_TOKENS[1] },
  };

  if (data.length === 0) return <EmptyChart />;

  return (
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      <AreaChart accessibilityLayer data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={6} />
        <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="clients"
          stackId="a"
          stroke="var(--color-clients)"
          fill="var(--color-clients)"
          fillOpacity={0.25}
        />
        <Area
          type="monotone"
          dataKey="staff"
          stackId="a"
          stroke="var(--color-staff)"
          fill="var(--color-staff)"
          fillOpacity={0.25}
        />
      </AreaChart>
    </ChartContainer>
  );
};

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

const EmptyChart: React.FC = () => (
  <div
    className="flex h-full items-center justify-center text-xs text-muted-foreground"
  >
    Aucune donnée à représenter.
  </div>
);
