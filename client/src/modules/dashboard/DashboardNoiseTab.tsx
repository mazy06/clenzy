import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Button,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import {
  VolumeUp,
  Handshake,
  Memory,
  CheckCircleOutline,
  Save,
  Settings,
  History,
} from '../../icons';
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
import NoiseAlertConfigPanel, { type ActiveThresholds, type NoiseAlertConfigHandle } from './NoiseAlertConfigPanel';
import NoiseAlertHistory from './NoiseAlertHistory';

// ─── Feature list helper ────────────────────────────────────────────────────

function FeatureItem({ text }: { text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
      <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><CheckCircleOutline size={16} strokeWidth={1.75} /></Box>
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
        <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><VolumeUp size={20} strokeWidth={1.75} /></Box>
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
                borderColor: '#6B8A9A',
                boxShadow: '0 2px 12px rgba(107, 138, 154, 0.1)',
              },
            }}
          >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Handshake size={22} strokeWidth={1.75} color='#6B8A9A' />
              <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '1rem' }}>
                {t('tarification.monitoring.minut.title')}
              </Typography>
              <Chip
                label={t('tarification.monitoring.minut.badge')}
                size="small"
                sx={{
                  fontSize: '0.6875rem', height: 22, fontWeight: 600,
                  backgroundColor: '#6B8A9A18', color: '#6B8A9A',
                  border: '1px solid #6B8A9A40', borderRadius: '6px',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 2, lineHeight: 1.5 }}>
              {t('tarification.monitoring.minut.description')}
            </Typography>

            {/* Features */}
            <Box sx={{ mb: 2, flex: 1 }}>
              <FeatureItem text={t('tarification.monitoring.minut.feature1')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature2')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature3')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature4')} />
            </Box>

            {/* Pricing box */}
            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Capteur (matériel)</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#6B8A9A' }}>149 €</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Mensuel</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#6B8A9A' }}>9,90 €/capteur/mois</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Annuel</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#6B8A9A' }}>7,90 €/capteur/mois</Typography>
              </Box>
            </Box>

            {/* Subscribe CTA */}
            <Button
              variant="outlined"
              fullWidth
              startIcon={<Handshake size={16} strokeWidth={1.75} />}
              onClick={() => onSelectOffer('minut')}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderColor: '#6B8A9A',
                color: '#6B8A9A',
                '&:hover': { borderColor: '#5A7A8A', backgroundColor: '#6B8A9A08' },
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
                borderColor: '#4A9B8E',
                boxShadow: '0 2px 12px rgba(74, 155, 142, 0.1)',
              },
            }}
          >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Memory size={22} strokeWidth={1.75} color='#4A9B8E' />
              <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '1rem' }}>
                {t('tarification.monitoring.clenzy.title')}
              </Typography>
              <Chip
                label={t('tarification.monitoring.clenzy.badge')}
                size="small"
                sx={{
                  fontSize: '0.6875rem', height: 22, fontWeight: 600,
                  backgroundColor: '#4A9B8E18', color: '#4A9B8E',
                  border: '1px solid #4A9B8E40', borderRadius: '6px',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 2, lineHeight: 1.5 }}>
              {t('tarification.monitoring.clenzy.description')}
            </Typography>

            {/* Features */}
            <Box sx={{ mb: 2, flex: 1 }}>
              <FeatureItem text={t('tarification.monitoring.clenzy.feature1')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature2')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature3')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature4')} />
            </Box>

            {/* Pricing box */}
            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#4A9B8E' }}>
                {t('tarification.monitoring.clenzy.pricingModel')}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                Capteur + installation + configuration
              </Typography>
            </Box>

            {/* Subscribe CTA */}
            <Button
              variant="contained"
              fullWidth
              startIcon={<Memory size={16} strokeWidth={1.75} />}
              onClick={() => onSelectOffer('clenzy')}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: '#4A9B8E',
                '&:hover': { bgcolor: '#4A9B8E', filter: 'brightness(0.9)' },
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

  // Seuils dynamiques synchronisés avec les sliders de NoiseAlertConfigPanel.
  const [activeThresholds, setActiveThresholds] = useState<ActiveThresholds | null>(null);
  const handleThresholdsChange = useCallback((thresholds: ActiveThresholds) => {
    setActiveThresholds(thresholds);
  }, []);

  // Sous-onglet actif dans la vue devices (0 = Configuration, 1 = Historique).
  const [subTab, setSubTab] = useState(0);

  // Ref vers le panneau de config pour déclencher la sauvegarde depuis le header.
  const configPanelRef = useRef<NoiseAlertConfigHandle>(null);
  const [saveRefresh, setSaveRefresh] = useState(0);
  const forceRefresh = useCallback(() => setSaveRefresh(v => v + 1), []);

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
          {/* ── Header : capteurs + actions ── */}
          <NoiseDeviceList
            devices={devices}
            onRemoveDevice={(id) => {
              removeDevice(id);
              if (devices.length <= 1) setView('offers');
            }}
            onAddDevice={() => setView('offers')}
          />

          {/* ── Graphique monitoring ── */}
          {deviceNoiseData.length > 0 && (
            <Box sx={{ flex: 1, minHeight: 400 }}>
              <DashboardErrorBoundary widgetName="Monitoring sonore">
                <NoiseMonitorChart data={chartData} combinedChartData={deviceChartData} activeThresholds={activeThresholds} />
              </DashboardErrorBoundary>
            </Box>
          )}

          {/* ── Sous-onglets : Configuration | Historique ── */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={subTab}
                onChange={(_, v) => setSubTab(v)}
                sx={{
                  minHeight: 36,
                  '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontSize: '0.8125rem', fontWeight: 600, py: 0.5 },
                }}
              >
                <Tab icon={<Settings size={16} strokeWidth={1.75} />} iconPosition="start" label="Configuration" />
                <Tab icon={<History size={16} strokeWidth={1.75} />} iconPosition="start" label="Historique" />
              </Tabs>

              {/* Bouton Sauvegarder — visible uniquement sur l'onglet Configuration */}
              {subTab === 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 0.5 }}>
                  {configPanelRef.current?.hasError && (
                    <Alert severity="error" sx={{ py: 0, px: 1, fontSize: '0.6875rem' }}>
                      Erreur
                    </Alert>
                  )}
                  {configPanelRef.current?.isSaved && (
                    <Chip
                      label="Sauvegardé"
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ fontSize: '0.6875rem', height: 22 }}
                    />
                  )}
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Save size={14} strokeWidth={1.75} />}
                    onClick={() => { configPanelRef.current?.save(); forceRefresh(); }}
                    disabled={!configPanelRef.current?.canSave || configPanelRef.current?.isSaving}
                    sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    {configPanelRef.current?.isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </Button>
                </Box>
              )}
            </Box>

            {/* Contenu du sous-onglet */}
            <Box sx={{ pt: 2 }}>
              {subTab === 0 && (
                <NoiseAlertConfigPanel
                  ref={configPanelRef}
                  propertyIds={devices.map(d => d.propertyId)}
                  onThresholdsChange={handleThresholdsChange}
                />
              )}
              {subTab === 1 && (
                <NoiseAlertHistory />
              )}
            </Box>
          </Box>
        </Box>
      );

    default:
      return <NoiseOffersView onSelectOffer={handleSelectOffer} />;
  }
};

export default DashboardNoiseTab;
