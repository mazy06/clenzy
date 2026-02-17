import React from 'react';
import {
  Box,
  Grid,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormControlLabel,
  Checkbox,
  Divider,
} from '@mui/material';
import {
  Person,
  Schedule,
  CleaningServices,
  Window,
} from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyFormValues } from '../../schemas';

// ─── Stable sx constants ────────────────────────────────────────────────────

const SECTION_TITLE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'text.secondary',
  mb: 1.5,
} as const;

const SECTION_TITLE_ICON_SX = {
  ...SECTION_TITLE_SX,
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface PropertyFormSettingsProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
  users: User[];
  propertyStatuses: { value: string; label: string }[];
  cleaningFrequencies: { value: string; label: string }[];
  isAdmin: () => boolean;
  isManager: () => boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyFormSettings: React.FC<PropertyFormSettingsProps> = React.memo(
  ({ control, errors, users, propertyStatuses, cleaningFrequencies, isAdmin, isManager }) => {
    const { t } = useTranslation();

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* ── Configuration ────────────────────────────────────────────── */}
        <Box>
          <Typography sx={SECTION_TITLE_SX}>
            {t('properties.configuration')}
          </Typography>

          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <Controller
                name="ownerId"
                control={control}
                render={({ field, fieldState }) => (
                  <FormControl fullWidth required error={!!fieldState.error}>
                    <InputLabel>{t('properties.owner')} *</InputLabel>
                    <Select
                      {...field}
                      label={`${t('properties.owner')} *`}
                      disabled={!isAdmin() && !isManager()}
                      size="small"
                    >
                      {users.map((user) => (
                        <MenuItem key={user.id} value={user.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Person sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography sx={{ fontSize: '0.8125rem' }}>
                              {user.firstName} {user.lastName} ({user.role})
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="status"
                control={control}
                render={({ field, fieldState }) => (
                  <FormControl fullWidth required error={!!fieldState.error}>
                    <InputLabel>{t('properties.status')}</InputLabel>
                    <Select {...field} label={t('properties.status')} size="small">
                      {propertyStatuses.map(status => (
                        <MenuItem key={status.value} value={status.value}>
                          {status.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="defaultCheckInTime"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="time"
                    label={t('properties.checkInTime')}
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      startAdornment: <Schedule sx={{ mr: 0.75, color: 'text.secondary', fontSize: 16 }} />,
                    }}
                    inputProps={{ step: 900 }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="defaultCheckOutTime"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="time"
                    label={t('properties.checkOutTime')}
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      startAdornment: <Schedule sx={{ mr: 0.75, color: 'text.secondary', fontSize: 16 }} />,
                    }}
                    inputProps={{ step: 900 }}
                  />
                )}
              />
            </Grid>
          </Grid>
        </Box>

        <Divider />

        {/* ── Tarification ménage ──────────────────────────────────────── */}
        <Box>
          <Typography sx={SECTION_TITLE_ICON_SX}>
            <CleaningServices sx={{ fontSize: 14 }} />
            {t('properties.cleaningPricing')}
          </Typography>

          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <Controller
                name="cleaningFrequency"
                control={control}
                render={({ field, fieldState }) => (
                  <FormControl fullWidth required error={!!fieldState.error}>
                    <InputLabel>{t('properties.cleaningFrequency')}</InputLabel>
                    <Select {...field} label={t('properties.cleaningFrequency')} size="small">
                      {cleaningFrequencies.map(freq => (
                        <MenuItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="cleaningBasePrice"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    fullWidth
                    type="number"
                    label={t('properties.cleaningBasePrice')}
                    onChange={(e) => {
                      const val = e.target.value;
                      field.onChange(val === '' ? undefined : Number(val));
                    }}
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message || t('properties.cleaningBasePriceHelper')}
                    inputProps={{ step: '0.01', min: '0' }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={4}>
              <Controller
                name="numberOfFloors"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    fullWidth
                    type="number"
                    label={t('properties.numberOfFloors')}
                    onChange={(e) => {
                      const val = e.target.value;
                      field.onChange(val === '' ? undefined : Number(val));
                    }}
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    inputProps={{ min: '0' }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={4}>
              <Controller
                name="hasExterior"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: '0.8125rem' }}>
                        {t('properties.hasExterior')}
                      </Typography>
                    }
                  />
                )}
              />
            </Grid>

            <Grid item xs={4}>
              <Controller
                name="hasLaundry"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value ?? true}
                        onChange={(e) => field.onChange(e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: '0.8125rem' }}>
                        {t('properties.hasLaundry')}
                      </Typography>
                    }
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="cleaningNotes"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    fullWidth
                    label={t('properties.cleaningNotes')}
                    multiline
                    rows={2}
                    placeholder={t('properties.cleaningNotesPlaceholder')}
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
          </Grid>
        </Box>

        <Divider />

        {/* ── Prestations à la carte ─────────────────────────────────────── */}
        <Box>
          <Typography sx={SECTION_TITLE_ICON_SX}>
            <Window sx={{ fontSize: 14 }} />
            {t('properties.addOnServices.title')}
          </Typography>

          <Grid container spacing={1.5}>
            {/* Vitres */}
            <Grid item xs={4}>
              <Controller
                name="windowCount"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    value={field.value ?? 0}
                    fullWidth
                    type="number"
                    label={t('properties.addOnServices.windowCount')}
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                    size="small"
                    error={!!fieldState.error}
                    helperText={t('properties.addOnServices.windowCountHelper')}
                    inputProps={{ min: '0' }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={4}>
              <Controller
                name="frenchDoorCount"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    value={field.value ?? 0}
                    fullWidth
                    type="number"
                    label={t('properties.addOnServices.frenchDoorCount')}
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                    size="small"
                    error={!!fieldState.error}
                    helperText={t('properties.addOnServices.frenchDoorCountHelper')}
                    inputProps={{ min: '0' }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={4}>
              <Controller
                name="slidingDoorCount"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    value={field.value ?? 0}
                    fullWidth
                    type="number"
                    label={t('properties.addOnServices.slidingDoorCount')}
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                    size="small"
                    error={!!fieldState.error}
                    helperText={t('properties.addOnServices.slidingDoorCountHelper')}
                    inputProps={{ min: '0' }}
                  />
                )}
              />
            </Grid>

            {/* Checkboxes prestations */}
            <Grid item xs={4}>
              <Controller
                name="hasIroning"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: '0.8125rem' }}>
                        {t('properties.addOnServices.hasIroning')}
                      </Typography>
                    }
                  />
                )}
              />
            </Grid>

            <Grid item xs={4}>
              <Controller
                name="hasDeepKitchen"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: '0.8125rem' }}>
                        {t('properties.addOnServices.hasDeepKitchen')}
                      </Typography>
                    }
                  />
                )}
              />
            </Grid>

            <Grid item xs={4}>
              <Controller
                name="hasDisinfection"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: '0.8125rem' }}>
                        {t('properties.addOnServices.hasDisinfection')}
                      </Typography>
                    }
                  />
                )}
              />
            </Grid>
          </Grid>
        </Box>
      </Box>
    );
  }
);

PropertyFormSettings.displayName = 'PropertyFormSettings';

export default PropertyFormSettings;
