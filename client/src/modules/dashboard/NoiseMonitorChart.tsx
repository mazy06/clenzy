import React, { useState } from 'react';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Spinner } from '../../components/ui';
import {
  Card,
  CardContent,
  NativeSelect,
  NativeSelectOption,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import {
  VolumeUp,
  Warning,
  Error as ErrorIcon,
  CheckCircle,
} from '../../icons';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  usePlotArea,
  useXAxisDomain,
  useYAxisDomain,
} from 'recharts';
import type { NoiseMonitoringData } from '../../hooks/noiseMonitoring';
import { NOISE_THRESHOLDS } from '../../hooks/noiseMonitoring';
import type { TimeWindowThreshold } from './NoiseAlertConfigPanel';

// ─── Styling constants ──────────────────────────────────────────────────────

const AXIS_TICK = { fontSize: 11, fill: '#94A3B8' } as const;
const GRID_STROKE = '#F1F5F9';

const PROPERTY_COLORS = [
  '#6B8A9A', // Baitly primary
  '#4A9B8E', // teal
  '#D4A574', // warm
  '#8B7EC8', // purple
  '#C97A7A', // coral
];

// Overlay non bloquant centré sur la zone de tracé (le graphique reste visible derrière).
const CHART_OVERLAY_CLASS =
  'absolute inset-0 flex items-center justify-center pointer-events-none p-3';

// Pastille translucide qui porte le message sans masquer les axes alentour.
// `background.paper` -> var(--card), `divider` -> var(--line) ; les alpha du sx
// d'origine deviennent un color-mix et une ombre ecrite en clair.
const CHART_OVERLAY_PILL_CLASS =
  'flex flex-col items-center gap-0.5 text-center px-[15px] py-[9px] max-w-[320px] ' +
  'rounded-[16px] border border-solid border-[var(--line)] backdrop-blur-[2px] ' +
  'bg-[color-mix(in_srgb,var(--card)_86%,transparent)] shadow-[0_6px_20px_rgba(0,0,0,0.06)]';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getNoiseStatus(level: number): { label: string; tone: StatusTone; icon: React.ReactElement } {
  if (level <= NOISE_THRESHOLDS.normal) {
    return { label: 'Normal', tone: 'ok', icon: <CheckCircle size={14} strokeWidth={1.75} /> };
  }
  if (level <= NOISE_THRESHOLDS.warning) {
    return { label: 'Élevé', tone: 'warn', icon: <Warning size={14} strokeWidth={1.75} /> };
  }
  return { label: 'Critique', tone: 'err', icon: <ErrorIcon size={14} strokeWidth={1.75} /> };
}

const hourLabel = (h: number) => `${h.toString().padStart(2, '0')}:00`;

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

const NoiseTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    // boxShadow: 1 = index dans theme.shadows (aucun override projet) => elevation 1 de MUI, ecrite en clair.
    <div className="bg-[var(--card)] border border-solid border-[var(--line)] rounded-[8px] p-[6px] min-w-[140px] shadow-[0px_2px_1px_-1px_rgba(0,0,0,0.2),0px_1px_1px_0px_rgba(0,0,0,0.14),0px_1px_3px_0px_rgba(0,0,0,0.12)]">
      <p className="cn-text-body1 text-[0.6875rem] font-semibold text-muted-foreground mb-0.5">
        {label}
      </p>
      {payload.map((entry) => {
        const status = getNoiseStatus(entry.value);
        return (
          <div className="flex items-center gap-0.5 mb-0.5" key={entry.name}>
            <div className="w-[8px] h-[8px] rounded-[50%] shrink-0" style={{ backgroundColor: entry.color }} />
            <p className="cn-text-body1 text-[0.6875rem] flex-1">{entry.name}</p>
            <StatusChip size="sm" tone={status.tone} label={`${entry.value} dB`} />
          </div>
        );
      })}
    </div>
  );
};

// ─── Threshold lines via Recharts v3 public hooks ───────────────────────────

interface ThresholdLinesRendererProps {
  thresholds: TimeWindowThreshold[];
  displayData: Record<string, string | number>[];
}

/**
 * Composant rendu directement dans le <AreaChart> (Recharts v3 permet les enfants arbitraires).
 * Utilise les hooks publics Recharts v3 (usePlotArea, useXAxisDomain, useYAxisDomain)
 * pour calculer les positions en pixels depuis le domaine.
 *
 * Pour chaque créneau horaire, dessine une ligne warning (orange) et une ligne critique
 * (rouge) qui s'étendent uniquement sur la largeur correspondant à la plage horaire.
 */
const ThresholdLinesRenderer: React.FC<ThresholdLinesRendererProps> = ({
  thresholds,
  displayData,
}) => {
  const plotArea = usePlotArea();
  const xDomain = useXAxisDomain();
  const yDomain = useYAxisDomain();

  if (!plotArea || !xDomain || !yDomain || displayData.length < 2) return null;

  // xDomain = tableau de catégories ['00:00', '01:00', ...] pour un axe catégoriel
  const categories = xDomain as string[];
  if (!Array.isArray(categories) || categories.length < 2) return null;

  // yDomain = [min, max] pour un axe numérique
  const yMin = Number(yDomain[0]);
  const yMax = Number(yDomain[yDomain.length - 1]);
  if (Number.isNaN(yMin) || Number.isNaN(yMax) || yMax <= yMin) return null;

  /** Convertit un label de catégorie X en pixel. (Point scale) */
  const xPixel = (label: string): number | null => {
    const idx = categories.indexOf(label);
    if (idx < 0) return null;
    // Point scale : chaque catégorie est répartie uniformément
    return plotArea.x + (idx / (categories.length - 1)) * plotArea.width;
  };

  /** Convertit une valeur Y (dB) en pixel. (Linear scale, Y inversé) */
  const yPixel = (value: number): number => {
    return plotArea.y + plotArea.height * (1 - (value - yMin) / (yMax - yMin));
  };

  const hasLabel = (label: string) => categories.includes(label);

  /**
   * Returns one or two ranges for a time window.
   * Handles midnight crossing by splitting into [startH..23:00] and [00:00..endH].
   */
  const findRanges = (startTime: string, endTime: string): Array<{ startLabel: string; endLabel: string }> => {
    const startH = parseInt(startTime.split(':')[0], 10);
    const [endHRaw, endM] = endTime.split(':').map(Number);
    // Round end hour UP when minutes > 0 (e.g. 21:59 → 22, 07:00 → 7)
    const endH = endM > 0 ? (endHRaw + 1) % 24 : endHRaw;

    if (startH < endH) {
      // No midnight crossing — single range
      const s = hourLabel(startH);
      const e = hourLabel(endH);
      return (hasLabel(s) && hasLabel(e)) ? [{ startLabel: s, endLabel: e }] : [];
    }

    // Crosses midnight — split into two segments
    const ranges: Array<{ startLabel: string; endLabel: string }> = [];
    const s1 = hourLabel(startH);
    const e1 = hourLabel(23);
    if (hasLabel(s1) && hasLabel(e1)) ranges.push({ startLabel: s1, endLabel: e1 });
    const s2 = hourLabel(0);
    const e2 = hourLabel(endH);
    if (hasLabel(s2) && hasLabel(e2)) ranges.push({ startLabel: s2, endLabel: e2 });
    return ranges;
  };

  const lines: React.ReactElement[] = [];

  for (const tw of thresholds) {
    const ranges = findRanges(tw.startTime, tw.endTime);

    for (let ri = 0; ri < ranges.length; ri++) {
      const range = ranges[ri];
      const x1 = xPixel(range.startLabel);
      const x2 = xPixel(range.endLabel);
      if (x1 == null || x2 == null) continue;
      // Show label only on the last segment to avoid clutter
      const showLabel = ri === ranges.length - 1;

      // Warning line
      const yWarn = yPixel(tw.warning);
      lines.push(
        <g key={`${tw.label}-warn-${ri}`}>
          <line
            x1={x1} y1={yWarn} x2={x2} y2={yWarn}
            stroke="#ED6C02"
            strokeDasharray="6 4"
            strokeWidth={1.5}
          />
          {showLabel && (
            <text
              x={x2 - 4} y={yWarn - 4}
              textAnchor="end"
              fontSize={9} fontWeight={600} fill="#ED6C02"
            >
              {tw.label} {tw.warning} dB
            </text>
          )}
        </g>,
      );

      // Critical line
      const yCrit = yPixel(tw.critical);
      lines.push(
        <g key={`${tw.label}-crit-${ri}`}>
          <line
            x1={x1} y1={yCrit} x2={x2} y2={yCrit}
            stroke="#D32F2F"
            strokeDasharray="6 4"
            strokeWidth={1.5}
          />
          {showLabel && (
            <text
              x={x2 - 4} y={yCrit - 4}
              textAnchor="end"
              fontSize={9} fontWeight={600} fill="#D32F2F"
            >
              {tw.label} {tw.critical} dB
            </text>
          )}
        </g>,
      );
    }
  }

  if (lines.length === 0) return null;
  return <g className="threshold-lines">{lines}</g>;
};

// ─── Main Component ─────────────────────────────────────────────────────────

interface NoiseMonitorChartProps {
  data: NoiseMonitoringData;
  combinedChartData: Record<string, string | number>[];
  activeThresholds?: TimeWindowThreshold[] | null;
  /** Chargement de l'historique réel (Tuya/Minut). */
  loading?: boolean;
  /**
   * `device` : détail d'UN capteur unique → masque le sélecteur de logement et la
   * rangée de puces multi-capteurs (l'identité du capteur est déjà portée par le
   * header de page + le bandeau de lecture live au-dessus).
   * `dashboard` (défaut) : vue agrégée multi-logements.
   */
  variant?: 'dashboard' | 'device';
}

const NoiseMonitorChart: React.FC<NoiseMonitorChartProps> = React.memo(({ data, combinedChartData, activeThresholds, loading = false, variant = 'dashboard' }) => {
  const isDevice = variant === 'device';
  const [selectedProperty, setSelectedProperty] = useState<string>('all');

  const maxCritical = activeThresholds && activeThresholds.length > 0
    ? Math.max(...activeThresholds.map(tw => tw.critical))
    : NOISE_THRESHOLDS.critical;

  const chartData = combinedChartData;

  // Build a fixed 24-hour timeline from 00:00 to 23:00.
  // Group raw data by hour (last point per hour wins), then sort from midnight.
  const displayData = (() => {
    const hourMap = new Map<string, Record<string, string | number>>();
    for (const point of chartData) {
      const t = String(point.time);
      if (!t.includes(':')) continue;
      const h = parseInt(t.split(':')[0], 10);
      if (h < 0 || h > 23) continue;
      const label = `${h.toString().padStart(2, '0')}:00`;
      hourMap.set(label, { ...point, time: label });
    }
    const result: Record<string, string | number>[] = [];
    for (let h = 0; h < 24; h++) {
      const label = `${h.toString().padStart(2, '0')}:00`;
      result.push(hourMap.get(label) ?? { time: label });
    }
    return result;
  })();

  const propertyNames = data.properties.map(p => p.propertyName);
  const displayProperties = selectedProperty === 'all'
    ? propertyNames
    : [selectedProperty];

  const recentAlerts = data.allAlerts.slice(0, 3);

  return (
    <Card className="h-full w-full">
      <CardContent className="p-[7.5px] h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-1 shrink-0">
          <div className="flex items-center gap-1">
            <span className="inline-flex text-primary"><VolumeUp size={16} strokeWidth={1.75} /></span>
            <p className="cn-text-body1 text-[0.75rem] font-bold uppercase tracking-[0.04em] text-muted-foreground">
              {isDevice ? 'Niveau sonore' : 'Monitoring sonore'}
            </p>
            <Badge variant="outline" className="h-[18px] text-[0.5625rem] font-semibold border-[var(--mui-primary)] text-[var(--mui-primary)] px-0.5">{isDevice ? 'Dernières 24 h' : `${data.properties.length} capteur${data.properties.length > 1 ? 's' : ''}`}</Badge>
          </div>

          {!isDevice && (
            /* Filtre sans libelle visible (il jouxte le titre de la carte) :
               l'aria-label reste la seule etiquette. */
            <NativeSelect
              size="sm"
              className="min-w-[130px]"
              aria-label="Filtrer par logement"
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
            >
              <NativeSelectOption value="all">Tous les logements</NativeSelectOption>
              {propertyNames.map(name => (
                <NativeSelectOption key={name} value={name}>{name}</NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </div>

        {/* Current levels indicators — masqués en mode device (lecture live portée par le bandeau au-dessus) */}
        {!isDevice && (
        <div className="flex gap-1 mb-1 shrink-0 flex-wrap">
          {data.properties.map((prop, idx) => {
            const status = getNoiseStatus(prop.currentLevel);
            return (
              <Tooltip key={prop.propertyId}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-[3px] px-[4.5px] py-[1.5px] rounded-[8px] border border-solid" style={{ backgroundColor: `${PROPERTY_COLORS[idx % PROPERTY_COLORS.length]}10`, borderColor: `${PROPERTY_COLORS[idx % PROPERTY_COLORS.length]}30` }}>
                    <div className="w-[6px] h-[6px] rounded-[50%]" style={{ backgroundColor: PROPERTY_COLORS[idx % PROPERTY_COLORS.length] }} />
                    <p className="cn-text-body1 text-[0.625rem] font-semibold text-muted-foreground">
                      {prop.propertyName}
                    </p>
                    <StatusChip
                      size="sm"
                      tone={status.tone}
                      icon={status.icon}
                      label={`${prop.currentLevel} dB`}
                      className="text-[0.5625rem] [&>svg]:size-3"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>{`Moy: ${prop.averageLevel} dB | Max: ${prop.maxLevel} dB`}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        )}

        {/*
          Graphique TOUJOURS monté : axes, grille et lignes de seuil restent visibles
          même sans données. Les états « chargement » / « en attente » sont des overlays
          translucides PAR-DESSUS la zone de tracé (jamais un remplacement du graphe),
          pour que la structure du graphique soit lisible d'emblée.
        */}
        <div className="flex-1 min-h-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData} margin={{ top: 8, right: 12, left: -10, bottom: 8 }}>
              <defs>
                {displayProperties.map((name, idx) => {
                  const colorIdx = propertyNames.indexOf(name);
                  const color = PROPERTY_COLORS[colorIdx % PROPERTY_COLORS.length];
                  return (
                    <linearGradient key={name} id={`noise-gradient-${colorIdx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="time" tick={AXIS_TICK} interval="preserveStartEnd" />
              <YAxis
                tick={AXIS_TICK}
                domain={[20, Math.max(100, maxCritical + 10)]}
                ticks={[20, 40, 60, 80, Math.max(100, maxCritical + 10)]}
              />
              <RechartsTooltip content={<NoiseTooltip />} />

              {/* Seuils par créneau — rendu direct via hooks publics Recharts v3 */}
              {activeThresholds && activeThresholds.length > 0 ? (
                <ThresholdLinesRenderer
                  thresholds={activeThresholds}
                  displayData={displayData}
                />
              ) : (
                <>
                  <ReferenceLine
                    y={NOISE_THRESHOLDS.warning}
                    stroke="#ED6C02"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{ value: `${NOISE_THRESHOLDS.warning} dB`, position: 'insideRight', style: { fontSize: 10, fill: '#ED6C02', fontWeight: 600 } }}
                  />
                  <ReferenceLine
                    y={NOISE_THRESHOLDS.critical}
                    stroke="#D32F2F"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{ value: `${NOISE_THRESHOLDS.critical} dB`, position: 'insideRight', style: { fontSize: 10, fill: '#D32F2F', fontWeight: 600 } }}
                  />
                </>
              )}

              {displayProperties.map((name) => {
                const colorIdx = propertyNames.indexOf(name);
                const color = PROPERTY_COLORS[colorIdx % PROPERTY_COLORS.length];
                return (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#noise-gradient-${colorIdx})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2 }}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>

          {/* Overlay : chargement de l'historique réel (axes visibles derrière) */}
          {loading && (
            <div className={CHART_OVERLAY_CLASS}>
              <div className={CHART_OVERLAY_PILL_CLASS}>
                <Spinner className="size-[22px]" />
                <span className="cn-text-caption text-muted-foreground font-semibold">
                  Chargement de l'historique…
                </span>
              </div>
            </div>
          )}

          {/* Overlay : aucune mesure encore remontée (le graphique reste « amorcé ») */}
          {!loading && combinedChartData.length === 0 && (
            <div className={CHART_OVERLAY_CLASS}>
              <div className={CHART_OVERLAY_PILL_CLASS}>
                <span className="inline-flex text-primary">
                  <VolumeUp size={24} strokeWidth={1.5} />
                </span>
                <p className="cn-text-body2 font-bold">
                  En attente des premières mesures
                </p>
                <span className="cn-text-caption text-muted-foreground leading-[1.4]">
                  Les courbes s'afficheront ici dès que le capteur remontera ses relevés.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recent alerts strip */}
        {recentAlerts.length > 0 && (
          <div className="flex gap-[3px] mt-[3px] shrink-0 overflow-x-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-[var(--line)] [&::-webkit-scrollbar-thumb]:rounded-[16px]">
            {recentAlerts.map(alert => (
              <StatusChip
                key={alert.id}
                size="sm"
                tone={alert.severity === 'critical' ? 'err' : 'warn'}
                icon={alert.severity === 'critical' ? <ErrorIcon /> : <Warning />}
                label={`${alert.propertyName}: ${alert.level} dB`}
                className="shrink-0 text-[0.5625rem] [&>svg]:size-3"
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

NoiseMonitorChart.displayName = 'NoiseMonitorChart';

export default NoiseMonitorChart;
