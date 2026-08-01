import React from 'react';
import { Switch, FormControlLabel, Divider } from '@mui/material';
import {
  Field,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '../../components/ui';
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
          <Field>
            <FieldLabel htmlFor="commission-rate">{t('tarification.commission.rate')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="commission-rate"
                type="number"
                min={0}
                max={100}
                step={0.5}
                disabled={!canEdit || !commission.enabled}
                value={commission.rate}
                onChange={(e) => {
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num)) onChange({ ...commission, rate: num });
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </div>
      </div>
    </>
  );
}
