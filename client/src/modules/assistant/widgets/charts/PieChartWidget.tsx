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
  WIDGET_CARD,
  WIDGET_OVERLINE,
} from './chartConstants';
import { EmptyChart } from './EmptyChart';
import { cn } from '../../../../utils/cn';

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
    <div className="flex flex-col gap-1.5">
      {data.title && <p className={WIDGET_OVERLINE}>{data.title}</p>}

      <div className={cn(WIDGET_CARD, 'grid grid-cols-[1fr] items-center gap-3 min-[900px]:grid-cols-[180px_1fr]')}>
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
                <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
                <p className="flex-1 text-xs leading-tight text-muted-foreground">
                  {humanizeStatus(entry.name)}
                </p>
                <p className="min-w-5 text-end text-xs font-semibold tabular-nums text-foreground">
                  {entry.value}
                </p>
                <div className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                  {/* Largeur et teinte sont calculees par entree : elles passent par `style`. */}
                  <div
                    className="h-full rounded-full transition-[width] duration-[400ms] motion-reduce:transition-none"
                    style={{ width: `${pct}%`, backgroundColor: entry.color }}
                  />
                </div>
                <p className="min-w-7 text-end text-2xs tabular-nums text-faint">
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
  // Couleurs en tokens : les hex figes d'origine (#1E293B) restaient sombres
  // sur fond sombre — le libelle central doit suivre le theme.
  <g>
    <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--color-foreground)" fontSize={18} fontWeight={700}>
      {total}
    </text>
    <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--color-muted-foreground)" fontSize={9} fontWeight={500}>
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
    <div className="rounded-lg border border-border bg-popover px-2 py-1 text-popover-foreground">
      <div className="flex items-center gap-1.5">
        <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: entry.payload.color || CHART_PRIMARY }} />
        <div>
          <p className="text-xs font-semibold leading-tight">{humanizeStatus(entry.name)}</p>
          <p className="text-xs tabular-nums text-muted-foreground">{entry.value}</p>
        </div>
      </div>
    </div>
  );
};

