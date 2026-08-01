import React from 'react';
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

      <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[180px_1fr] gap-3 items-center p-[9px] rounded-[12px] bg-[var(--field)]">
        {/* Donut */}
        <div style={{ height: CHART_HEIGHT }}>
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
        </div>

        {/* Legend custom avec pourcentages + progress bars */}
        <div className="flex flex-col gap-0.5">
          {items.map((entry) => {
            const pct = total > 0 ? (entry.value / total) * 100 : 0;
            return (
              <div className="flex items-center gap-1" key={entry.name}>
                <div className="w-[8px] h-[8px] rounded-[2px] shrink-0" style={{ backgroundColor: entry.color }} />
                <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] flex-1 leading-[1.2]">
                  {humanizeStatus(entry.name)}
                </p>
                <p className="cn-text-body1 text-[11.5px] font-bold text-[var(--ink)] min-w-[20px] text-end tabular-nums">
                  {entry.value}
                </p>
                <div className="w-[40px] h-[4px] bg-[var(--hover)] rounded-[2px] overflow-hidden shrink-0">
                  {/* Largeur et teinte sont calculees par entree : elles passent par `style`. */}
                  <div
                    className="h-full rounded-[16px] transition-[width] duration-[400ms] ease-[ease] motion-reduce:transition-none"
                    style={{ width: `${pct}%`, backgroundColor: entry.color }}
                  />
                </div>
                <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] min-w-[28px] text-end tabular-nums">
                  {pct.toFixed(0)}%
                </p>
              </div>
            );
          })}
        </div>
      </div>
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
    <div className="bg-[var(--card)] border border-solid border-[var(--line)] rounded-[12px] px-[7.5px] py-[4.5px]" style={{ boxShadow: 'var(--shadow-pop)' }}>
      <div className="flex items-center gap-1">
        <div className="w-[10px] h-[10px] rounded-[3px] shrink-0" style={{ backgroundColor: entry.payload.color || CHART_PRIMARY }} />
        <div>
          <p className="cn-text-body1 text-[12.5px] font-bold text-[var(--ink)] leading-[1.2]">
            {humanizeStatus(entry.name)}
          </p>
          <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] tabular-nums">
            {entry.value}
          </p>
        </div>
      </div>
    </div>
  );
};

