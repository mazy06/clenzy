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
import { Box, Typography } from '@mui/material';
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
      <Box sx={{ mt: 1, mb: 1.5, px: 2, py: 2, borderRadius: '12px', border: '1px solid var(--line)', bgcolor: 'var(--card)', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)' }}>
          {data.title ?? 'Graphique'} — aucune donnée.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {data.title && <Overline sx={{ mb: 1 }}>{data.title}</Overline>}

      <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'var(--field)', height: 230 }}>
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
      </Box>
    </Box>
  );
};
