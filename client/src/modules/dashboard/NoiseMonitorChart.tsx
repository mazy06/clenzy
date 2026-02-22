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
} from 'recharts';
import type { NoiseMonitoringData } from '../../hooks/useNoiseMonitoring';
import { NOISE_THRESHOLDS } from '../../hooks/useNoiseMonitoring';

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
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
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

// ─── Component ──────────────────────────────────────────────────────────────

interface NoiseMonitorChartProps {
  data: NoiseMonitoringData;
  combinedChartData: Record<string, string | number>[];
}

const NoiseMonitorChart: React.FC<NoiseMonitorChartProps> = React.memo(({ data, combinedChartData }) => {
  const [selectedProperty, setSelectedProperty] = useState<string>('all');

  // Filter chart data based on selection
  const chartData = combinedChartData;

  // Show only every nth point for readability (last 12 hours = ~24 points)
  const displayData = chartData.length > 48
    ? chartData.filter((_, i) => i % 2 === 0).slice(-24)
    : chartData.slice(-24);

  const propertyNames = data.properties.map(p => p.propertyName);
  const displayProperties = selectedProperty === 'all'
    ? propertyNames
    : [selectedProperty];

  // Latest alerts (max 3)
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
                domain={[20, 100]}
                ticks={[20, 40, 50, 60, 70, 85, 100]}
              />
              <RechartsTooltip content={<NoiseTooltip />} />

              {/* Threshold reference lines */}
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
