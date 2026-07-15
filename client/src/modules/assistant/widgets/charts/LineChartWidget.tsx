import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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

interface LineChartData {
  items?: Array<{ name: string;[key: string]: string | number }>;
  series?: Array<{ key: string; label?: string; color?: string }>;
  title?: string;
}

interface LineChartWidgetProps {
  data: LineChartData;
}

/**
 * Line chart pour les series temporelles : revenu mensuel, evolution
 * interventions, score readiness dans le temps, etc.
 *
 * <p>Detection automatique des series si non specifiees (toutes les keys
 * numeriques de la premiere ligne, sauf {@code name}).</p>
 */
export const LineChartWidget: React.FC<LineChartWidgetProps> = ({ data }) => {
  const items = data.items ?? [];
  const series = data.series ?? deriveSeries(items);

  if (items.length === 0 || series.length === 0) {
    return <EmptyChart label={data.title} />;
  }

  const seriesWithColors = series.map((s, idx) => ({
    ...s,
    color: s.color || CHART_SERIES_COLORS[idx % CHART_SERIES_COLORS.length],
  }));

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {data.title && (
        <Typography sx={{
          display: 'block', mb: 1, fontSize: '10.5px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.05em',
          color: 'var(--faint)',
        }}>
          {data.title}
        </Typography>
      )}

      <Box sx={{
        p: 1.5,
        borderRadius: '12px',
        bgcolor: 'var(--field)',
        height: CHART_HEIGHT + 30,
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={items} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
            {series.length > 1 && (
              <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} iconType="circle" />
            )}
            {seriesWithColors.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label || s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: s.color }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

// ─── Helpers (dedupes — voir BarChartWidget pour les memes) ──────────────────

function deriveSeries(items: Array<{ name: string;[key: string]: string | number }>): Array<{ key: string; label?: string; color?: string }> {
  if (items.length === 0) return [];
  const sample = items[0];
  return Object.keys(sample)
    .flatMap((k) => (k !== 'name' && typeof sample[k] === 'number' ? [{ key: k, label: humanize(k) }] : []));
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

