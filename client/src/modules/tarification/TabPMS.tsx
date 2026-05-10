import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Grid,
  InputAdornment,
  Divider,
} from '@mui/material';
import { Devices, Computer, People } from '../../icons';
import type { PricingConfig } from '../../services/api/pricingConfigApi';
import { useTranslation } from '../../hooks/useTranslation';

interface TabPMSProps {
  config: PricingConfig;
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
  currencySymbol: string;
}

export default function TabPMS({ config, canEdit, onUpdate, currencySymbol }: TabPMSProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ pt: 2 }}>
      {/* ─── Abonnement PMS ─────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'info.main' }}><Devices size={20} strokeWidth={1.75} /></Box>
        <Typography variant="subtitle1" fontWeight={600}>
          {t('tarification.pms.title')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('tarification.pms.subtitle')}
      </Typography>

      <Grid container spacing={1.5}>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.pms.monthly')}
            type="number"
            size="small"
            fullWidth
            value={(config.pmsMonthlyPriceCents / 100).toFixed(0)}
            onChange={(e) => {
              const euros = parseInt(e.target.value, 10);
              if (!isNaN(euros)) onUpdate({ pmsMonthlyPriceCents: euros * 100 });
            }}
            disabled={!canEdit}
            helperText={t('tarification.pms.monthlyHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}/mois</InputAdornment> }}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.pms.sync')}
            type="number"
            size="small"
            fullWidth
            value={(config.pmsSyncPriceCents / 100).toFixed(0)}
            onChange={(e) => {
              const euros = parseInt(e.target.value, 10);
              if (!isNaN(euros)) onUpdate({ pmsSyncPriceCents: euros * 100 });
            }}
            disabled={!canEdit}
            helperText={t('tarification.pms.syncHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}/mois</InputAdornment> }}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2.5 }} />

      {/* ─── Tarification par utilisateur ────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><People size={20} strokeWidth={1.75} /></Box>
        <Typography variant="subtitle1" fontWeight={600}>
          {t('tarification.pms.perSeatTitle')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('tarification.pms.perSeatSubtitle')}
      </Typography>

      <Grid container spacing={1.5}>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.pms.perSeat')}
            type="number"
            size="small"
            fullWidth
            value={(config.pmsPerSeatPriceCents / 100).toFixed(0)}
            onChange={(e) => {
              const euros = parseInt(e.target.value, 10);
              if (!isNaN(euros)) onUpdate({ pmsPerSeatPriceCents: euros * 100 });
            }}
            disabled={!canEdit}
            helperText={t('tarification.pms.perSeatHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}/mois/utilisateur</InputAdornment> }}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.pms.freeSeats')}
            type="number"
            size="small"
            fullWidth
            value={config.pmsFreeSeats}
            onChange={(e) => {
              const num = parseInt(e.target.value, 10);
              if (!isNaN(num) && num >= 0) onUpdate({ pmsFreeSeats: num });
            }}
            disabled={!canEdit}
            helperText={t('tarification.pms.freeSeatsHelp')}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2.5 }} />

      {/* ─── Surcharges automatisation ──────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'warning.main' }}><Computer size={20} strokeWidth={1.75} /></Box>
        <Typography variant="subtitle1" fontWeight={600}>
          {t('tarification.automation.title')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('tarification.automation.subtitle')}
      </Typography>

      <Grid container spacing={1.5}>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.automation.basic')}
            type="number"
            size="small"
            fullWidth
            value={config.automationBasicSurcharge}
            onChange={(e) => {
              const num = parseInt(e.target.value, 10);
              if (!isNaN(num)) onUpdate({ automationBasicSurcharge: num });
            }}
            disabled={!canEdit}
            helperText={t('tarification.automation.basicHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.automation.full')}
            type="number"
            size="small"
            fullWidth
            value={config.automationFullSurcharge}
            onChange={(e) => {
              const num = parseInt(e.target.value, 10);
              if (!isNaN(num)) onUpdate({ automationFullSurcharge: num });
            }}
            disabled={!canEdit}
            helperText={t('tarification.automation.fullHelp')}
            InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
