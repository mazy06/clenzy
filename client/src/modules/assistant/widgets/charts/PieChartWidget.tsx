import React from 'react';
import { Box } from '@mui/material';
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
    <div className="mt-1.5 mb-2">
      {data.title && (
        <p className="cn-text-body1 block mb-1.5 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
          {data.title}
        </p>
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
                {items.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
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
        <div className="flex flex-col gap-0.5">
          {items.map((entry) => {
            const pct = total > 0 ? (entry.value / total) * 100 : 0;
            return (
              <div className="flex items-center gap-1" key={entry.name}>
                <Box
                  sx={{
                    width: 8, height: 8, borderRadius: '2px',
                    bgcolor: entry.color, flexShrink: 0,
                  }}
                />
                <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] flex-1 leading-[1.2]">
                  {humanizeStatus(entry.name)}
                </p>
                <p className="cn-text-body1 text-[11.5px] font-bold text-[var(--ink)] min-w-[20px] text-end tabular-nums">
                  {entry.value}
                </p>
                <div className="w-[40px] h-[4px] bg-[var(--hover)] rounded-[2px] overflow-hidden shrink-0">
                  <Box sx={{
                    height: '100%', width: `${pct}%`,
                    bgcolor: entry.color, borderRadius: 2,
                    transition: 'width 0.4s ease',
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  }} />
                </div>
                <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] min-w-[28px] text-end tabular-nums">
                  {pct.toFixed(0)}%
                </p>
              </div>
            );
          })}
        </div>
      </Box>
    </div>
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
      <div className="flex items-center gap-1">
        <Box sx={{
          width: 10, height: 10, borderRadius: '3px',
          bgcolor: entry.payload.color || CHART_PRIMARY, flexShrink: 0,
        }} />
        <div>
          <p className="cn-text-body1 text-[12.5px] font-bold text-[var(--ink)] leading-[1.2]">
            {humanizeStatus(entry.name)}
          </p>
          <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] tabular-nums">
            {entry.value}
          </p>
        </div>
      </div>
    </Box>
  );
};

