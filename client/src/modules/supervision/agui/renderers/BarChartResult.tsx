/* ============================================================
   BarChartResult — displayHint="chart_bar"

   Payload backend (get_financial_summary, get_properties_performance) :
     { items: [{ name, <seriesKey>: number, … }],
       series: [{ key, label?, color? }],
       title?, totalRevenue?, totalExpenses?, totalProfit? }

   Rendu par le primitive `ChartContainer` de Baitly UI (recharts habillé :
   ticks, grille, curseur et tooltip prennent les jetons du thème). Les séries
   sans couleur prennent un jeton graphique Baitly par défaut.
   ============================================================ */
import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../../../components/ui';
import { Overline, SurfaceCard, CLENZY_SERIES_COLORS } from './shared';

interface Series {
  key: string;
  label?: string;
  color?: string;
}
interface BarChartData {
  items?: Array<Record<string, string | number>>;
  series?: Series[];
  title?: string;
  stacked?: boolean;
}

/** Déduit les séries numériques si le backend ne les fournit pas. */
function deriveSeries(items: Array<Record<string, string | number>>): Series[] {
  if (items.length === 0) return [];
  return Object.keys(items[0])
    .flatMap((k) => k !== 'name' && typeof items[0][k] === 'number' ? [{ key: k }] : []);
}

export const BarChartResult: React.FC<{ data: BarChartData }> = ({ data }) => {
  const items = Array.isArray(data.items) ? data.items : [];
  const series = (data.series && data.series.length > 0 ? data.series : deriveSeries(items)).map(
    (s, idx) => ({
      ...s,
      label: s.label ?? s.key,
      color: s.color ?? CLENZY_SERIES_COLORS[idx % CLENZY_SERIES_COLORS.length],
    }),
  );

  if (items.length === 0 || series.length === 0) {
    return (
      <SurfaceCard className="text-center">
        <p className="text-xs text-muted-foreground">{data.title ?? 'Graphique'} — aucune donnée.</p>
      </SurfaceCard>
    );
  }

  // Le registre de séries alimente les libellés de la légende et du tooltip.
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label }]),
  );

  return (
    <div className="mt-1.5 mb-2">
      {data.title && <Overline className="mb-1.5">{data.title}</Overline>}

      <ChartContainer config={config} className="aspect-auto h-[230px] w-full rounded-xl bg-field p-2">
        <BarChart accessibilityLayer data={items} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={6} />
          <YAxis axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              stackId={data.stacked ? 'stack' : undefined}
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  );
};
