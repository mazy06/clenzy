/* ============================================================
   BarChartResult — displayHint="chart_bar"

   Payload backend (get_financial_summary, get_properties_performance) :
     { items: [{ name, <seriesKey>: number, … }],
       series: [{ key, label?, color? }],
       title?, totalRevenue?, totalExpenses?, totalProfit? }

   Réutilise recharts (déjà dépendance du projet) avec la palette Clenzy.
   Les séries sans couleur prennent une couleur d'accent par défaut.
   ============================================================ */
import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Overline, CLENZY_SERIES_COLORS } from './shared';

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

const AXIS_TICK = { fontSize: 11, fill: 'var(--muted)' };

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
      <div className="mt-1.5 mb-2 px-3 py-3 rounded-[12px] border border-[var(--line)] bg-[var(--card)] text-center">
        <p className="cn-text-body1 text-[12.5px] text-[var(--muted)]">
          {data.title ?? 'Graphique'} — aucune donnée.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-1.5 mb-2">
      {data.title && <Overline sx={{ mb: 1 }}>{data.title}</Overline>}

      <div className="p-2 rounded-[12px] bg-[var(--field)] h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--hover)' }}
              contentStyle={{
                background: 'var(--card)',
                border: '1px solid var(--line-2)',
                borderRadius: 10,
                fontSize: 12,
                color: 'var(--ink)',
              }}
              labelStyle={{ color: 'var(--muted)', fontWeight: 600 }}
            />
            {series.length > 1 && (
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }} iconType="circle" />
            )}
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
        </ResponsiveContainer>
      </div>
    </div>
  );
};
