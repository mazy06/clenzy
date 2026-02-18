import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  InputAdornment,
  Grid,
  Divider,
} from '@mui/material';
import { Percent } from '@mui/icons-material';
import type { CommissionConfig } from '../../services/api/pricingConfigApi';
import { useTranslation } from '../../hooks/useTranslation';

interface CommissionSectionProps {
  commission: CommissionConfig;
  canEdit: boolean;
  onChange: (updated: CommissionConfig) => void;
}

export default function CommissionSection({ commission, canEdit, onChange }: CommissionSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      <Divider sx={{ my: 2.5 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Percent sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600}>
          {t('tarification.commission.title')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('tarification.commission.subtitle')}
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={6}>
          <FormControlLabel
            control={
              <Switch
                checked={commission.enabled}
                onChange={(e) => onChange({ ...commission, enabled: e.target.checked })}
                disabled={!canEdit}
                color="primary"
              />
            }
            label={t('tarification.commission.enable')}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label={t('tarification.commission.rate')}
            type="number"
            size="small"
            fullWidth
            value={commission.rate}
            onChange={(e) => {
              const num = parseFloat(e.target.value);
              if (!isNaN(num)) onChange({ ...commission, rate: num });
            }}
            disabled={!canEdit || !commission.enabled}
            inputProps={{ step: 0.5, min: 0, max: 100 }}
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
          />
        </Grid>
      </Grid>
    </>
  );
}
