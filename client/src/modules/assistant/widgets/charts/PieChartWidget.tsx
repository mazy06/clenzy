import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Label,
} from 'recharts';
import {
  CHART_HEIGHT,
  CHART_SERIES_COLORS,
  humanizeStatus,
  CHART_PRIMARY,
} from './chartConstants';
import { EmptyChart } from './EmptyChart';

interface PieChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface PieChartData {
  /** Items du donut. Si {@code color} est fourni, override la palette par defaut. */
  items?: PieChartDataPoint[];
  /** Titre optionnel rendu au-dessus du chart (caption uppercase). */
  title?: string;
  /** Label central du donut (default "items"). */
  centerLabel?: string;
}

interface PieChartWidgetProps {
  data: PieChartData;
}

/**
 * Donut chart pour les distributions categorielles : statuts d'interventions,
 * types de proprietes, sources de reservations, etc.
 *
 * <p>Aligne avec le style {@code DashboardCharts.tsx} : center label avec total,
 * tooltip custom, legend pourcentage + barre de progression.</p>
 */
export const PieChartWidget: React.FC<PieChartWidgetProps> = ({ data }) => {
  const items = (data.items ?? []).map((it, idx) => ({
    ...it,
    color: it.color || CHART_SERIES_COLORS[idx % CHART_SERIES_COLORS.length],
  }));
  const total = items.reduce((sum, it) => sum + (it.value || 0), 0);

  if (items.length === 0) {
    return <EmptyChart label={data.title} />;
  }

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {data.title && (
        <Typography
          sx={{
            display: 'block',
            mb: 1,
            fontSize: '10.5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            color: 'var(--faint)',
          }}
        >
          {data.title}
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '180px 1fr' },
          gap: 2,
          alignItems: 'center',
          p: 1.5,
          borderRadius: '12px',
          bgcolor: 'var(--field)',
        }}
      >
        {/* Donut */}
        <Box sx={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {items.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.color} />
                ))}
                <Label
                  content={(props) => (
                    <CenterLabel
                      cx={(props.viewBox as { cx?: number; cy?: number })?.cx ?? 0}
                      cy={(props.viewBox as { cx?: number; cy?: number })?.cy ?? 0}
                      total={total}
                      label={data.centerLabel ?? 'items'}
                    />
                  )}
                />
              </Pie>
              <Tooltip content={<PieCustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </Box>

        {/* Legend custom avec pourcentages + progress bars */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {items.map((entry) => {
            const pct = total > 0 ? (entry.value / total) * 100 : 0;
            return (
              <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 8, height: 8, borderRadius: '2px',
                    bgcolor: entry.color, flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', flex: 1, lineHeight: 1.2 }}>
                  {humanizeStatus(entry.name)}
                </Typography>
                <Typography sx={{
                  fontSize: '11.5px', fontWeight: 700, color: 'var(--ink)',
                  minWidth: 20, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                }}>
                  {entry.value}
                </Typography>
                <Box sx={{
                  width: 40, height: 4, bgcolor: 'var(--hover)',
                  borderRadius: 2, overflow: 'hidden', flexShrink: 0,
                }}>
                  <Box sx={{
                    height: '100%', width: `${pct}%`,
                    bgcolor: entry.color, borderRadius: 2,
                    transition: 'width 0.4s ease',
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  }} />
                </Box>
                <Typography sx={{
                  fontSize: '10.5px', color: 'var(--faint)',
                  minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                }}>
                  {pct.toFixed(0)}%
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const CenterLabel: React.FC<{ cx: number; cy: number; total: number; label: string }> = ({
  cx, cy, total, label,
}) => (
  <g>
    <text x={cx} y={cy - 4} textAnchor="middle" fill="#1E293B" fontSize={18} fontWeight={800}>
      {total}
    </text>
    <text x={cx} y={cy + 12} textAnchor="middle" fill="#94A3B8" fontSize={9} fontWeight={500}>
      {label}
    </text>
  </g>
);

interface PieTooltipPayload {
  name: string;
  value: number;
  payload: { color?: string };
}

const PieCustomTooltip: React.FC<{ active?: boolean; payload?: PieTooltipPayload[] }> = ({
  active, payload,
}) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <Box
      sx={{
        bgcolor: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: '12px',
        px: 1.25,
        py: 0.75,
        boxShadow: 'var(--shadow-pop)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{
          width: 10, height: 10, borderRadius: '3px',
          bgcolor: entry.payload.color || CHART_PRIMARY, flexShrink: 0,
        }} />
        <Box>
          <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
            {humanizeStatus(entry.name)}
          </Typography>
          <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {entry.value}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

