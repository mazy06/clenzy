import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Grid,
  InputAdornment,
  Divider,
} from '@mui/material';
import { Devices, Computer } from '@mui/icons-material';
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
        <Devices sx={{ color: 'info.main', fontSize: 20 }} />
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

      {/* ─── Surcharges automatisation ──────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Computer sx={{ color: 'warning.main', fontSize: 20 }} />
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
