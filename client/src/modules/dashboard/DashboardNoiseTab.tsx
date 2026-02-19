import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Divider,
  Button,
} from '@mui/material';
import {
  VolumeUp,
  Handshake,
  Memory,
  CheckCircleOutline,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNoiseDevices, type NoiseView } from '../../hooks/useNoiseDevices';
import { useTranslation } from '../../hooks/useTranslation';
import { propertiesApi } from '../../services/api';
import { extractApiList } from '../../types';
import type { Property } from '../../services/api/propertiesApi';
import NoiseMonitorChart from './NoiseMonitorChart';
import DashboardErrorBoundary from './DashboardErrorBoundary';
import NoiseProductDetail from './NoiseProductDetail';
import NoiseDeviceConfigForm from './NoiseDeviceConfigForm';
import NoiseDeviceList from './NoiseDeviceList';

// ─── Feature list helper ────────────────────────────────────────────────────

function FeatureItem({ text }: { text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
      <CheckCircleOutline sx={{ fontSize: 16, color: 'success.main' }} />
      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
        {text}
      </Typography>
    </Box>
  );
}

// ─── Offers display ─────────────────────────────────────────────────────────

interface NoiseOffersViewProps {
  onSelectOffer: (type: 'minut' | 'clenzy') => void;
}

function NoiseOffersView({ onSelectOffer }: NoiseOffersViewProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <VolumeUp sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
          {t('dashboard.noise.offersTitle')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: '0.82rem' }}>
        {t('dashboard.noise.offersSubtitle')}
      </Typography>

      {/* Two offers side by side */}
      <Grid container spacing={2}>

        {/* ── MINUT ── */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              height: '100%',
              border: '1.5px solid',
              borderColor: 'divider',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                boxShadow: '0 2px 12px rgba(107, 138, 154, 0.1)',
              },
            }}
          >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Handshake sx={{ color: '#6B8A9A', fontSize: 22 }} />
              <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '1rem' }}>
                {t('tarification.monitoring.minut.title')}
              </Typography>
              <Chip
                label={t('tarification.monitoring.minut.badge')}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontSize: '0.6875rem', height: 22 }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 2, lineHeight: 1.5 }}>
              {t('tarification.monitoring.minut.description')}
            </Typography>

            <Divider sx={{ my: 1.5 }} />

            {/* Pricing model */}
            <Typography variant="overline" sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '0.08em' }}>
              {t('tarification.monitoring.minut.pricingModel')}
            </Typography>

            <Box
              sx={{
                mt: 1,
                mb: 2,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'grey.50',
                border: '1px dashed',
                borderColor: 'divider',
                textAlign: 'center',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '1.1rem' }}>
                {t('tarification.monitoring.minut.onQuote')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                {t('tarification.monitoring.minut.onQuoteHint')}
              </Typography>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Features */}
            <Box sx={{ mb: 2, flex: 1 }}>
              <FeatureItem text={t('tarification.monitoring.minut.feature1')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature2')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature3')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature4')} />
            </Box>

            {/* Subscribe CTA */}
            <Button
              variant="contained"
              size="small"
              onClick={() => onSelectOffer('minut')}
              sx={{
                textTransform: 'none',
                fontSize: '0.8125rem',
                fontWeight: 700,
                py: 0.75,
                bgcolor: '#6B8A9A',
                '&:hover': { bgcolor: '#6B8A9A', filter: 'brightness(0.9)' },
              }}
            >
              {t('dashboard.noise.subscribe') || 'Souscrire'}
            </Button>
          </Paper>
        </Grid>

        {/* ── CLENZY HARDWARE ── */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              height: '100%',
              border: '1.5px solid',
              borderColor: 'divider',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              '&:hover': {
                borderColor: 'success.main',
                boxShadow: '0 2px 12px rgba(74, 155, 142, 0.1)',
              },
            }}
          >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Memory sx={{ color: '#4A9B8E', fontSize: 22 }} />
              <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '1rem' }}>
                {t('tarification.monitoring.clenzy.title')}
              </Typography>
              <Chip
                label={t('tarification.monitoring.clenzy.badge')}
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontSize: '0.6875rem', height: 22 }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 2, lineHeight: 1.5 }}>
              {t('tarification.monitoring.clenzy.description')}
            </Typography>

            <Divider sx={{ my: 1.5 }} />

            {/* Pricing model */}
            <Typography variant="overline" sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '0.08em' }}>
              {t('tarification.monitoring.clenzy.pricingModel')}
            </Typography>

            <Box
              sx={{
                mt: 1,
                mb: 2,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'grey.50',
                border: '1px dashed',
                borderColor: 'divider',
                textAlign: 'center',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '1.1rem' }}>
                {t('tarification.monitoring.clenzy.onQuote')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                {t('tarification.monitoring.clenzy.onQuoteHint')}
              </Typography>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Features */}
            <Box sx={{ mb: 2, flex: 1 }}>
              <FeatureItem text={t('tarification.monitoring.clenzy.feature1')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature2')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature3')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature4')} />
            </Box>

            {/* Subscribe CTA */}
            <Button
              variant="contained"
              size="small"
              color="success"
              onClick={() => onSelectOffer('clenzy')}
              sx={{
                textTransform: 'none',
                fontSize: '0.8125rem',
                fontWeight: 700,
                py: 0.75,
              }}
            >
              {t('dashboard.noise.subscribe') || 'Souscrire'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

// ─── Main component (view router) ───────────────────────────────────────────

const DashboardNoiseTab: React.FC = () => {
  const {
    currentView,
    setView,
    devices,
    hasDevices,
    form,
    setFormField,
    resetForm,
    startConfigFlow,
    configSteps,
    canGoNextConfig,
    handleConfigNext,
    handleConfigBack,
    handleConfigSubmit,
    removeDevice,
    deviceNoiseData,
    deviceChartData,
  } = useNoiseDevices();

  // Properties query (only active during config-form)
  const propertiesQuery = useQuery({
    queryKey: ['properties-for-noise-config'],
    queryFn: () => propertiesApi.getAll({ size: 1000 }),
    enabled: currentView === 'config-form',
    staleTime: 60_000,
  });

  const properties = useMemo(
    () => extractApiList<Property>(propertiesQuery.data),
    [propertiesQuery.data],
  );

  // Build chart data structure for NoiseMonitorChart
  const chartData = useMemo(
    () => ({
      enabled: true,
      properties: deviceNoiseData,
      allAlerts: deviceNoiseData.flatMap((p) => p.alerts),
      globalAverage:
        deviceNoiseData.length > 0
          ? Math.round(deviceNoiseData.reduce((sum, p) => sum + p.averageLevel, 0) / deviceNoiseData.length)
          : 0,
    }),
    [deviceNoiseData],
  );

  const handleSelectOffer = (type: 'minut' | 'clenzy') => {
    setView(`${type}-detail` as NoiseView);
  };

  switch (currentView) {
    case 'offers':
      return <NoiseOffersView onSelectOffer={handleSelectOffer} />;

    case 'minut-detail':
      return (
        <NoiseProductDetail
          type="minut"
          onSubscribe={() => startConfigFlow('minut')}
          onBack={() => setView('offers')}
        />
      );

    case 'clenzy-detail':
      return (
        <NoiseProductDetail
          type="clenzy"
          onSubscribe={() => startConfigFlow('clenzy')}
          onBack={() => setView('offers')}
        />
      );

    case 'config-form':
      return (
        <NoiseDeviceConfigForm
          form={form}
          setFormField={setFormField}
          configSteps={configSteps}
          canGoNext={canGoNextConfig}
          onNext={handleConfigNext}
          onBack={handleConfigBack}
          onSubmit={handleConfigSubmit}
          onCancel={() => {
            resetForm();
            setView(hasDevices ? 'devices' : 'offers');
          }}
          properties={properties}
          loadingProperties={propertiesQuery.isFetching}
        />
      );

    case 'devices':
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1 }}>
          <NoiseDeviceList
            devices={devices}
            onRemoveDevice={(id) => {
              removeDevice(id);
              // If last device removed, go back to offers
              if (devices.length <= 1) {
                setView('offers');
              }
            }}
            onAddDevice={() => setView('offers')}
          />
          {deviceNoiseData.length > 0 && (
            <Box sx={{ flex: 1, minHeight: 180 }}>
              <DashboardErrorBoundary widgetName="Monitoring sonore">
                <NoiseMonitorChart data={chartData} combinedChartData={deviceChartData} />
              </DashboardErrorBoundary>
            </Box>
          )}
        </Box>
      );

    default:
      return <NoiseOffersView onSelectOffer={handleSelectOffer} />;
  }
};

export default DashboardNoiseTab;
