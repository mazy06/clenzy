import React from 'react';
import {
  Box, Grid, TextField, MenuItem, Switch, FormControlLabel, Typography,
} from '@mui/material';
import {
  Settings as SettingsIcon, Gavel, Security, ToggleOn, Widgets,
} from '@mui/icons-material';
import { useTranslation } from '../../../hooks/useTranslation';
import type { BookingEngineConfigUpdate } from '../../../services/api/bookingEngineApi';
import type { ComponentVisibility } from '../ComponentVisibilityConfig';
import ComponentVisibilityConfig from '../ComponentVisibilityConfig';
import SectionPaper from './SectionPaper';
import { LANGUAGE_OPTIONS, CURRENCY_OPTIONS } from '../constants';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StepSettingsProps {
  form: BookingEngineConfigUpdate;
  componentVis: ComponentVisibility;
  onFormChange: (field: keyof BookingEngineConfigUpdate, value: unknown) => void;
  onComponentVisChange: (vis: ComponentVisibility) => void;
}

// ─── Toggle Fields Config ───────────────────────────────────────────────────

const TOGGLE_FIELDS = [
  { field: 'collectPaymentOnBooking' as const, labelKey: 'bookingEngine.fields.collectPaymentOnBooking' },
  { field: 'autoConfirm' as const, labelKey: 'bookingEngine.fields.autoConfirm' },
  { field: 'showCleaningFee' as const, labelKey: 'bookingEngine.fields.showCleaningFee' },
  { field: 'showTouristTax' as const, labelKey: 'bookingEngine.fields.showTouristTax' },
] as const;

// ─── Component ──────────────────────────────────────────────────────────────

const StepSettings: React.FC<StepSettingsProps> = ({
  form,
  componentVis,
  onFormChange,
  onComponentVisChange,
}) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Grid container spacing={2.5}>
        {/* Behavior */}
        <Grid item xs={12} sm={6}>
          <SectionPaper icon={<SettingsIcon sx={{ fontSize: 20, color: '#4A9B8E' }} />} titleKey="bookingEngine.sections.behavior">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                select
                label={t('bookingEngine.fields.defaultLanguage')}
                value={form.defaultLanguage}
                onChange={(e) => onFormChange('defaultLanguage', e.target.value)}
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                size="small"
                select
                label={t('bookingEngine.fields.defaultCurrency')}
                value={form.defaultCurrency}
                onChange={(e) => onFormChange('defaultCurrency', e.target.value)}
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </TextField>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label={t('bookingEngine.fields.minAdvanceDays')}
                  value={form.minAdvanceDays}
                  onChange={(e) => onFormChange('minAdvanceDays', Math.max(0, parseInt(e.target.value) || 0))}
                  inputProps={{ min: 0 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label={t('bookingEngine.fields.maxAdvanceDays')}
                  value={form.maxAdvanceDays}
                  onChange={(e) => onFormChange('maxAdvanceDays', Math.max(1, parseInt(e.target.value) || 365))}
                  inputProps={{ min: 1 }}
                />
              </Box>
            </Box>
          </SectionPaper>
        </Grid>

        {/* Policies */}
        <Grid item xs={12} sm={6}>
          <SectionPaper icon={<Gavel sx={{ fontSize: 20, color: '#D4A574' }} />} titleKey="bookingEngine.sections.policies">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={2}
                maxRows={4}
                label={t('bookingEngine.fields.cancellationPolicy')}
                value={form.cancellationPolicy || ''}
                onChange={(e) => onFormChange('cancellationPolicy', e.target.value || null)}
              />
              <TextField
                fullWidth
                size="small"
                label={t('bookingEngine.fields.termsUrl')}
                value={form.termsUrl || ''}
                onChange={(e) => onFormChange('termsUrl', e.target.value || null)}
                placeholder="https://..."
              />
              <TextField
                fullWidth
                size="small"
                label={t('bookingEngine.fields.privacyUrl')}
                value={form.privacyUrl || ''}
                onChange={(e) => onFormChange('privacyUrl', e.target.value || null)}
                placeholder="https://..."
              />
            </Box>
          </SectionPaper>
        </Grid>

        {/* Security */}
        <Grid item xs={12} sm={6}>
          <SectionPaper icon={<Security sx={{ fontSize: 20, color: '#FF5A5F' }} />} titleKey="bookingEngine.sections.security">
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={3}
              maxRows={6}
              label={t('bookingEngine.fields.allowedOrigins')}
              value={form.allowedOrigins || ''}
              onChange={(e) => onFormChange('allowedOrigins', e.target.value || null)}
              helperText={t('bookingEngine.fields.allowedOriginsHelper')}
              placeholder="https://monsite.com"
            />
          </SectionPaper>
        </Grid>

        {/* Display Options */}
        <Grid item xs={12} sm={6}>
          <SectionPaper icon={<ToggleOn sx={{ fontSize: 20, color: '#4FC3F7' }} />} titleKey="bookingEngine.sections.displayOptions">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {TOGGLE_FIELDS.map(({ field, labelKey }) => (
                <FormControlLabel
                  key={field}
                  control={
                    <Switch
                      checked={form[field]}
                      onChange={(e) => onFormChange(field, e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{t(labelKey)}</Typography>}
                />
              ))}
            </Box>
          </SectionPaper>
        </Grid>
      </Grid>

      {/* Component Visibility */}
      <SectionPaper icon={<Widgets sx={{ fontSize: 20, color: '#7E57C2' }} />} titleKey="bookingEngine.sections.componentVisibility">
        <ComponentVisibilityConfig value={componentVis} onChange={onComponentVisChange} />
      </SectionPaper>
    </Box>
  );
};

StepSettings.displayName = 'StepSettings';

export default StepSettings;
