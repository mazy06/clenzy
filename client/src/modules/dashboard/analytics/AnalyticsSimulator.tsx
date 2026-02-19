import React, { useState, useMemo } from 'react';
import { Box, Typography, Card, CardContent, Slider, Grid } from '@mui/material';
import { Calculate, Euro, Percent, ShowChart } from '@mui/icons-material';
import GridSection from './GridSection';
import AnalyticsWidgetCard from './AnalyticsWidgetCard';
import { useTranslation } from '../../../hooks/useTranslation';
import type { AnalyticsData } from '../../../hooks/useAnalyticsEngine';

const SECTION_LABEL_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'text.secondary',
  mb: 0.5,
  flexShrink: 0,
} as const;

interface Props {
  data: AnalyticsData | null;
}

const AnalyticsSimulator: React.FC<Props> = React.memo(({ data }) => {
  const { t } = useTranslation();

  // Simulation state
  const basePrice = data?.pricing.optimalPrice || 100;
  const baseOccupancy = data?.global.occupancyRate.value || 50;
  const baseRevenue = data?.global.totalRevenue.value || 0;

  const [priceAdjust, setPriceAdjust] = useState(0); // -50% to +50%
  const [targetOccupancy, setTargetOccupancy] = useState(baseOccupancy);

  // Simulate impact: price elasticity = -0.8
  const simulation = useMemo(() => {
    const elasticity = data?.pricing.elasticity || -0.8;
    const priceChange = priceAdjust / 100;
    const occupancyChange = priceChange * elasticity;
    const simulatedOccupancy = Math.max(0, Math.min(100, baseOccupancy * (1 + occupancyChange)));
    const simulatedPrice = basePrice * (1 + priceChange);
    const simulatedRevPAN = (simulatedPrice * simulatedOccupancy) / 100;
    const simulatedRevenue = baseRevenue * (1 + priceChange) * (1 + occupancyChange);

    // Reverse: target occupancy → required price
    const occupancyDelta = (targetOccupancy - baseOccupancy) / baseOccupancy;
    const requiredPriceChange = elasticity !== 0 ? occupancyDelta / elasticity : 0;
    const requiredPrice = basePrice * (1 + requiredPriceChange);

    return {
      price: Math.round(simulatedPrice),
      occupancy: Math.round(simulatedOccupancy * 10) / 10,
      revPAN: Math.round(simulatedRevPAN * 100) / 100,
      revenue: Math.round(simulatedRevenue),
      requiredPrice: Math.round(requiredPrice),
    };
  }, [priceAdjust, targetOccupancy, basePrice, baseOccupancy, baseRevenue, data]);

  if (!data) return null;

  return (
    <GridSection
      title={t('dashboard.analytics.simulator')}
      subtitle={t('dashboard.analytics.simulatorDesc')}
    >
      <Grid container spacing={1.5}>
        {/* Price slider card */}
        <Grid item xs={12} sm={6}>
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.priceAdjustment')}
              </Typography>
              <Box sx={{ px: 0.5, mt: 1 }}>
                <Slider
                  value={priceAdjust}
                  onChange={(_, v) => setPriceAdjust(v as number)}
                  min={-50}
                  max={50}
                  step={5}
                  marks={[
                    { value: -50, label: '-50%' },
                    { value: 0, label: '0' },
                    { value: 50, label: '+50%' },
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v > 0 ? '+' : ''}${v}%`}
                  sx={{
                    color: '#6B8A9A',
                    '& .MuiSlider-markLabel': { fontSize: '0.5625rem' },
                    '& .MuiSlider-thumb': { width: 14, height: 14 },
                    '& .MuiSlider-valueLabel': { fontSize: '0.5625rem' },
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.primary' }}>
                  {simulation.price} € / {t('dashboard.analytics.night')}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Occupancy target slider */}
        <Grid item xs={12} sm={6}>
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
              <Typography sx={SECTION_LABEL_SX}>
                {t('dashboard.analytics.targetOccupancy')}
              </Typography>
              <Box sx={{ px: 0.5, mt: 1 }}>
                <Slider
                  value={targetOccupancy}
                  onChange={(_, v) => setTargetOccupancy(v as number)}
                  min={20}
                  max={100}
                  step={5}
                  marks={[
                    { value: 20, label: '20%' },
                    { value: 60, label: '60%' },
                    { value: 100, label: '100%' },
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                  sx={{
                    color: '#4A9B8E',
                    '& .MuiSlider-markLabel': { fontSize: '0.5625rem' },
                    '& .MuiSlider-thumb': { width: 14, height: 14 },
                    '& .MuiSlider-valueLabel': { fontSize: '0.5625rem' },
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.primary' }}>
                  {t('dashboard.analytics.requiredPrice')}: {simulation.requiredPrice} €
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Simulation results */}
        <Grid item xs={6} sm={4}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.projectedRevenue')}
            value={`${simulation.revenue.toLocaleString('fr-FR')} €`}
            icon={<Euro color="success" />}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.projectedOccupancy')}
            value={`${simulation.occupancy}%`}
            icon={<Percent color="primary" />}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.projectedRevPAN')}
            value={`${simulation.revPAN} €`}
            icon={<ShowChart color="info" />}
          />
        </Grid>
      </Grid>
    </GridSection>
  );
});

AnalyticsSimulator.displayName = 'AnalyticsSimulator';

export default AnalyticsSimulator;
