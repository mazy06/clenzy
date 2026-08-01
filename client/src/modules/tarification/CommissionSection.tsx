import React from 'react';
import { TextField, Switch, FormControlLabel, InputAdornment, Divider } from '@mui/material';
import { Percent } from '../../icons';
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
      <div className="flex items-center gap-1.5 mb-2">
        <span className="inline-flex text-primary"><Percent size={20} strokeWidth={1.75} /></span>
        <h6 className="cn-text-subtitle1 font-semibold">
          {t('tarification.commission.title')}
        </h6>
      </div>
      <p className="cn-text-body2 text-muted-foreground mb-3">
        {t('tarification.commission.subtitle')}
      </p>
      <div className="grid grid-cols-12 gap-3 items-center">
        <div className="col-span-6">
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
        </div>
        <div className="col-span-6">
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
        </div>
      </div>
    </>
  );
}
