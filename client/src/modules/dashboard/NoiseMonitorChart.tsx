import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  FormControl,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  VolumeUp,
  Warning,
  Error as ErrorIcon,
  CheckCircle,
} from '@mui/icons-material';
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
import type { NoiseMonitoringData } from '../../hooks/useNoiseMonitoring';
import { NOISE_THRESHOLDS } from '../../hooks/useNoiseMonitoring';
import type { TimeWindowThreshold } from './NoiseAlertConfigPanel';

// ─── Styling constants ──────────────────────────────────────────────────────

const AXIS_TICK = { fontSize: 11, fill: '#94A3B8' } as const;
const GRID_STROKE = '#F1F5F9';

const PROPERTY_COLORS = [
  '#6B8A9A', // Clenzy primary
  '#4A9B8E', // teal
  '#D4A574', // warm
  '#8B7EC8', // purple
  '#C97A7A', // coral
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getNoiseStatus(level: number): { label: string; color: 'success' | 'warning' | 'error'; icon: React.ReactElement } {
  if (level <= NOISE_THRESHOLDS.normal) {
    return { label: 'Normal', color: 'success', icon: <CheckCircle sx={{ fontSize: 14 }} /> };
  }
  if (level <= NOISE_THRESHOLDS.warning) {
    return { label: 'Élevé', color: 'warning', icon: <Warning sx={{ fontSize: 14 }} /> };
  }
  return { label: 'Critique', color: 'error', icon: <ErrorIcon sx={{ fontSize: 14 }} /> };
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

const NoiseTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 1,
        boxShadow: 1,
        minWidth: 140,
      }}
    >
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
        {label}
      </Typography>
      {payload.map((entry, idx) => {
        const status = getNoiseStatus(entry.value);
        return (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.6875rem', flex: 1 }}>{entry.name}</Typography>
            <Chip
              label={`${entry.value} dB`}
              size="small"
              color={status.color}
              variant="outlined"
              sx={{ height: 18, fontSize: '0.625rem', '& .MuiChip-label': { px: 0.5 } }}
            />
          </Box>
        );
      })}
    </Box>
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

  const hourLabel = (h: number) => `${h.toString().padStart(2, '0')}:00`;
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
}

const NoiseMonitorChart: React.FC<NoiseMonitorChartProps> = React.memo(({ data, combinedChartData, activeThresholds }) => {
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
    <Card sx={{ height: '100%' }}>
      <CardContent
        sx={{
          p: 1.25,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          '&:last-child': { pb: 1.25 },
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <VolumeUp sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'text.secondary',
              }}
            >
              Monitoring sonore
            </Typography>
            <Chip
              label={`${data.properties.length} capteur${data.properties.length > 1 ? 's' : ''}`}
              size="small"
              variant="outlined"
              sx={{
                height: 18,
                fontSize: '0.5625rem',
                fontWeight: 600,
                borderColor: 'primary.main',
                color: 'primary.main',
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          </Box>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <Select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              sx={{
                fontSize: '0.6875rem',
                height: 26,
                '& .MuiSelect-select': { py: 0.25, px: 1 },
              }}
            >
              <MenuItem value="all" sx={{ fontSize: '0.75rem' }}>Tous les logements</MenuItem>
              {propertyNames.map(name => (
                <MenuItem key={name} value={name} sx={{ fontSize: '0.75rem' }}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Current levels indicators */}
        <Box sx={{ display: 'flex', gap: 0.75, mb: 0.75, flexShrink: 0, flexWrap: 'wrap' }}>
          {data.properties.map((prop, idx) => {
            const status = getNoiseStatus(prop.currentLevel);
            return (
              <Tooltip
                key={prop.propertyId}
                title={`Moy: ${prop.averageLevel} dB | Max: ${prop.maxLevel} dB`}
                arrow
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    bgcolor: `${PROPERTY_COLORS[idx % PROPERTY_COLORS.length]}10`,
                    border: '1px solid',
                    borderColor: `${PROPERTY_COLORS[idx % PROPERTY_COLORS.length]}30`,
                  }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: PROPERTY_COLORS[idx % PROPERTY_COLORS.length],
                    }}
                  />
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary' }}>
                    {prop.propertyName}
                  </Typography>
                  <Chip
                    icon={status.icon}
                    label={`${prop.currentLevel} dB`}
                    size="small"
                    color={status.color}
                    variant="outlined"
                    sx={{
                      height: 18,
                      fontSize: '0.5625rem',
                      '& .MuiChip-icon': { fontSize: 12, ml: 0.25 },
                      '& .MuiChip-label': { px: 0.5 },
                    }}
                  />
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        {/* Chart */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
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
        </Box>

        {/* Recent alerts strip */}
        {recentAlerts.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              mt: 0.5,
              flexShrink: 0,
              overflowX: 'auto',
              '&::-webkit-scrollbar': { height: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
            }}
          >
            {recentAlerts.map(alert => (
              <Chip
                key={alert.id}
                icon={alert.severity === 'critical' ? <ErrorIcon /> : <Warning />}
                label={`${alert.propertyName}: ${alert.level} dB`}
                size="small"
                color={alert.severity === 'critical' ? 'error' : 'warning'}
                variant="outlined"
                sx={{
                  height: 20,
                  fontSize: '0.5625rem',
                  flexShrink: 0,
                  '& .MuiChip-icon': { fontSize: 12 },
                  '& .MuiChip-label': { px: 0.5 },
                }}
              />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
});

NoiseMonitorChart.displayName = 'NoiseMonitorChart';

export default NoiseMonitorChart;
