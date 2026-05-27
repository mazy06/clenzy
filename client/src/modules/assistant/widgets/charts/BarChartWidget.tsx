import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
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
import {
  CHART_HEIGHT,
  CHART_SERIES_COLORS,
  AXIS_TICK,
  GRID_STROKE,
  TOOLTIP_CONTENT_STYLE,
  LEGEND_WRAPPER_STYLE,
} from './chartConstants';
import { EmptyChart } from './EmptyChart';

interface BarChartData {
  /** Liste des items (axe X = name, valeurs = series). */
  items?: Array<{ name: string;[key: string]: string | number }>;
  /** Cles des series a afficher (default: toutes les cles numeriques sauf "name"). */
  series?: Array<{ key: string; label?: string; color?: string }>;
  /** Titre optionnel. */
  title?: string;
  /** Mode empile (stacked bars) si true. */
  stacked?: boolean;
}

interface BarChartWidgetProps {
  data: BarChartData;
}

/**
 * Bar chart pour les comparaisons categorielles : performance proprietes,
 * revenue/expenses par mois, comparaison par equipe, etc.
 *
 * <p>Detection automatique des series si non specifiees. Mode stacked optionnel.</p>
 */
export const BarChartWidget: React.FC<BarChartWidgetProps> = ({ data }) => {
  const theme = useTheme();
  const items = data.items ?? [];
  const series = data.series ?? deriveSeries(items);

  if (items.length === 0 || series.length === 0) {
    return <EmptyChart label={data.title} />;
  }

  // Inject colors from palette if not provided
  const seriesWithColors = series.map((s, idx) => ({
    ...s,
    color: s.color || CHART_SERIES_COLORS[idx % CHART_SERIES_COLORS.length],
  }));

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {data.title && (
        <Typography variant="caption" sx={{
          display: 'block', mb: 1, fontSize: '0.7rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: theme.palette.text.secondary,
        }}>
          {data.title}
        </Typography>
      )}

      <Box sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: alpha(theme.palette.text.primary, 0.025),
        height: CHART_HEIGHT + 30,
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
            {series.length > 1 && (
              <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} iconType="circle" />
            )}
            {seriesWithColors.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label || s.key}
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function deriveSeries(items: Array<{ name: string;[key: string]: string | number }>): Array<{ key: string; label?: string; color?: string }> {
  if (items.length === 0) return [];
  const sample = items[0];
  return Object.keys(sample)
    .filter((k) => k !== 'name' && typeof sample[k] === 'number')
    .map((k) => ({ key: k, label: humanize(k) }));
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

