import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Grid,
  InputAdornment,
  Divider,
  Paper,
  Chip,
  Switch,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  VolumeUp,
  Handshake,
  Memory,
  CheckCircleOutline,
} from '@mui/icons-material';
import type { PricingConfig } from '../../services/api/pricingConfigApi';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Props ──────────────────────────────────────────────────────────────────

interface TabMonitoringProps {
  config: PricingConfig;
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
  currencySymbol: string;
}

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

// ─── Component ──────────────────────────────────────────────────────────────

export default function TabMonitoring({ config, canEdit, onUpdate, currencySymbol }: TabMonitoringProps) {
  const { t } = useTranslation();

  // ─── Clenzy total calculation ─────────────────────────────────────────────
  const clenzyTotalCents =
    (config.monitoringClenzyDevicePriceCents || 0) +
    (config.monitoringClenzyInstallationPriceCents || 0) +
    (config.monitoringClenzyConfigPriceCents || 0) +
    (config.monitoringClenzySupportPriceCents || 0);

  const centsToEuros = (cents: number) => (cents / 100).toFixed(0);
  const eurosToCents = (val: string) => {
    const euros = parseInt(val, 10);
    return isNaN(euros) ? 0 : euros * 100;
  };

  return (
    <Box sx={{ pt: 2 }}>
      {/* ─── Section title ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <VolumeUp sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600}>
          {t('tarification.monitoring.title')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {t('tarification.monitoring.subtitle')}
      </Typography>

      {/* ─── Two offers side by side ───────────────────────────────────── */}
      <Grid container spacing={2}>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* MINUT — Abonnement mensuel                                     */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              height: '100%',
              border: '1.5px solid',
              borderColor: config.monitoringMinutEnabled ? 'primary.main' : 'divider',
              borderRadius: 2,
              transition: 'border-color 0.2s',
              opacity: config.monitoringMinutEnabled ? 1 : 0.75,
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

            <Box sx={{ mt: 1, mb: 2 }}>
              {config.monitoringMinutMonthlyPriceCents > 0 ? (
                <TextField
                  label={t('tarification.monitoring.minut.monthlyPrice')}
                  type="number"
                  size="small"
                  fullWidth
                  value={centsToEuros(config.monitoringMinutMonthlyPriceCents)}
                  onChange={(e) => onUpdate({ monitoringMinutMonthlyPriceCents: eurosToCents(e.target.value) })}
                  disabled={!canEdit}
                  InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}/mois</InputAdornment> }}
                />
              ) : (
                <Box
                  sx={{
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
              )}
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Features */}
            <Box sx={{ mb: 2 }}>
              <FeatureItem text={t('tarification.monitoring.minut.feature1')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature2')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature3')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature4')} />
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Enable switch */}
            <List disablePadding>
              <ListItem disableGutters sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <VolumeUp sx={{ fontSize: 20, color: config.monitoringMinutEnabled ? 'primary.main' : 'text.disabled' }} />
                </ListItemIcon>
                <ListItemText
                  primary={t('tarification.monitoring.enable')}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={config.monitoringMinutEnabled}
                    onChange={(e) => onUpdate({ monitoringMinutEnabled: e.target.checked })}
                    disabled={!canEdit}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* CLENZY HARDWARE — Coût unique (Tuya OEM)                       */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              height: '100%',
              border: '1.5px solid',
              borderColor: config.monitoringClenzyEnabled ? 'success.main' : 'divider',
              borderRadius: 2,
              transition: 'border-color 0.2s',
              opacity: config.monitoringClenzyEnabled ? 1 : 0.75,
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

            <Grid container spacing={1.5} sx={{ mt: 0.5, mb: 1 }}>
              <Grid item xs={6}>
                <TextField
                  label={t('tarification.monitoring.clenzy.devicePrice')}
                  type="number"
                  size="small"
                  fullWidth
                  value={centsToEuros(config.monitoringClenzyDevicePriceCents)}
                  onChange={(e) => onUpdate({ monitoringClenzyDevicePriceCents: eurosToCents(e.target.value) })}
                  disabled={!canEdit}
                  helperText={t('tarification.monitoring.clenzy.devicePriceHelp')}
                  InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label={t('tarification.monitoring.clenzy.installationPrice')}
                  type="number"
                  size="small"
                  fullWidth
                  value={centsToEuros(config.monitoringClenzyInstallationPriceCents)}
                  onChange={(e) => onUpdate({ monitoringClenzyInstallationPriceCents: eurosToCents(e.target.value) })}
                  disabled={!canEdit}
                  helperText={t('tarification.monitoring.clenzy.installationPriceHelp')}
                  InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label={t('tarification.monitoring.clenzy.configPrice')}
                  type="number"
                  size="small"
                  fullWidth
                  value={centsToEuros(config.monitoringClenzyConfigPriceCents)}
                  onChange={(e) => onUpdate({ monitoringClenzyConfigPriceCents: eurosToCents(e.target.value) })}
                  disabled={!canEdit}
                  helperText={t('tarification.monitoring.clenzy.configPriceHelp')}
                  InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label={t('tarification.monitoring.clenzy.supportPrice')}
                  type="number"
                  size="small"
                  fullWidth
                  value={centsToEuros(config.monitoringClenzySupportPriceCents)}
                  onChange={(e) => onUpdate({ monitoringClenzySupportPriceCents: eurosToCents(e.target.value) })}
                  disabled={!canEdit}
                  helperText={t('tarification.monitoring.clenzy.supportPriceHelp')}
                  InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }}
                />
              </Grid>
            </Grid>

            {/* Total */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.25,
                borderRadius: 1.5,
                bgcolor: 'success.50',
                border: '1px solid',
                borderColor: 'success.200',
                mb: 1.5,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                {t('tarification.monitoring.clenzy.total')}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'success.main', fontSize: '1.25rem' }}>
                {clenzyTotalCents > 0 ? `${(clenzyTotalCents / 100).toLocaleString('fr-FR')} ${currencySymbol}` : `— ${currencySymbol}`}
              </Typography>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Features */}
            <Box sx={{ mb: 2 }}>
              <FeatureItem text={t('tarification.monitoring.clenzy.feature1')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature2')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature3')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature4')} />
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Enable switch */}
            <List disablePadding>
              <ListItem disableGutters sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Memory sx={{ fontSize: 20, color: config.monitoringClenzyEnabled ? 'success.main' : 'text.disabled' }} />
                </ListItemIcon>
                <ListItemText
                  primary={t('tarification.monitoring.enable')}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={config.monitoringClenzyEnabled}
                    onChange={(e) => onUpdate({ monitoringClenzyEnabled: e.target.checked })}
                    disabled={!canEdit}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
