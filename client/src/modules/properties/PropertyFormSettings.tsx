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
  Switch,
} from '@mui/material';
import {
  Person,
  Schedule,
  CleaningServices,
  Window,
  Checklist,
  Language,
} from '../../icons';
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
      <div className="flex flex-col gap-4">
        {/* ── Configuration ────────────────────────────────────────────── */}
        <div>
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
                          <div className="flex items-center gap-1">
                            <span className="inline-flex text-muted-foreground"><Person size={14} strokeWidth={1.75} /></span>
                            <p className="cn-text-body1 text-[0.8125rem]">
                              {user.firstName} {user.lastName} ({user.role})
                            </p>
                          </div>
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

            {/* Booking Engine Visibility */}
            <Grid item xs={12}>
              <Controller
                name="bookingEngineVisible"
                control={control}
                render={({ field }) => (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1,
                      px: 1.5,
                      borderRadius: '11px',
                      bgcolor: field.value ? 'var(--ok-soft)' : 'var(--field)',
                      border: '1px solid',
                      borderColor: field.value ? 'color-mix(in srgb, var(--ok) 30%, transparent)' : 'var(--field-line)',
                      transition: 'background-color .14s, border-color .14s',
                    }}
                  >
                    <Box component="span" sx={{ display: 'inline-flex', color: field.value ? 'var(--ok)' : 'var(--muted)' }}><Language size={18} strokeWidth={1.75} /></Box>
                    <div className="flex-1">
                      <p className="cn-text-body1 text-[0.8125rem] font-semibold">
                        {t('properties.bookingEngineVisible')}
                      </p>
                      <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">
                        {t('properties.bookingEngineVisibleHelper')}
                      </p>
                    </div>
                    <Switch
                      checked={field.value ?? false}
                      onChange={(e) => field.onChange(e.target.checked)}
                      size="small"
                      color="success"
                    />
                  </Box>
                )}
              />
            </Grid>

            {/* Org Voucher Consent — autorise la conciergerie a creer des
                vouchers sur ce logement (combine avec organization.has_voucher_contract
                cote backend). Default false : le host garde le controle. */}
            <Grid item xs={12}>
              <Controller
                name="orgCanCreateVouchers"
                control={control}
                render={({ field }) => (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1,
                      px: 1.5,
                      borderRadius: '11px',
                      bgcolor: field.value ? 'var(--ok-soft)' : 'var(--field)',
                      border: '1px solid',
                      borderColor: field.value ? 'color-mix(in srgb, var(--ok) 30%, transparent)' : 'var(--field-line)',
                      transition: 'background-color .14s, border-color .14s',
                    }}
                  >
                    <Box component="span" sx={{ display: 'inline-flex', color: field.value ? 'var(--ok)' : 'var(--muted)' }}>
                      <Language size={18} strokeWidth={1.75} />
                    </Box>
                    <div className="flex-1">
                      <p className="cn-text-body1 text-[0.8125rem] font-semibold">
                        {t('properties.orgCanCreateVouchers')}
                      </p>
                      <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">
                        {t('properties.orgCanCreateVouchersHelper')}
                      </p>
                    </div>
                    <Switch
                      checked={field.value ?? false}
                      onChange={(e) => field.onChange(e.target.checked)}
                      size="small"
                      color="success"
                    />
                  </Box>
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
                      startAdornment: <Schedule size={16} strokeWidth={1.75} style={{ marginRight: 6, color: 'var(--muted)' }} />,
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
                      startAdornment: <Schedule size={16} strokeWidth={1.75} style={{ marginRight: 6, color: 'var(--muted)' }} />,
                    }}
                    inputProps={{ step: 900 }}
                  />
                )}
              />
            </Grid>
          </Grid>
        </div>

        <Divider />

        {/* ── Tarification ménage ──────────────────────────────────────── */}
        <div>
          <Typography sx={SECTION_TITLE_ICON_SX}>
            <CleaningServices size={14} strokeWidth={1.75} />
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
                      <p className="cn-text-body1 text-[0.8125rem]">
                        {t('properties.hasExterior')}
                      </p>
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
                      <p className="cn-text-body1 text-[0.8125rem]">
                        {t('properties.hasLaundry')}
                      </p>
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
                  <Box sx={{
                    display: 'flex',
                    gap: 1,
                    py: 1.25,
                    px: 1.5,
                    borderRadius: '11px',
                    bgcolor: 'var(--accent-soft)',
                    border: '1px solid',
                    borderColor: fieldState.error ? 'var(--err)' : 'color-mix(in srgb, var(--accent) 30%, transparent)',
                    minHeight: 80,
                    transition: 'border-color 0.15s ease',
                  }}>
                    <span className="inline-flex text-[var(--accent)] mt-0 shrink-0"><Checklist size={16} strokeWidth={1.75} /></span>
                    <div className="flex-1">
                      <p className="cn-text-body1 text-[0.625rem] font-bold uppercase tracking-[0.05em] text-[var(--accent)] mb-0.5">
                        {t('properties.cleaningNotes')}
                      </p>
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={6}
                        placeholder={t('properties.cleaningNotesPlaceholder')}
                        size="small"
                        variant="standard"
                        InputProps={{ disableUnderline: true }}
                        sx={{
                          '& .MuiInputBase-root': { fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4, p: 0 },
                          '& .MuiInputBase-input::placeholder': { fontSize: '0.75rem', color: 'text.disabled' },
                        }}
                      />
                      {fieldState.error && (
                        <FormHelperText error sx={{ mx: 0, mt: 0.5 }}>{fieldState.error.message}</FormHelperText>
                      )}
                    </div>
                  </Box>
                )}
              />
            </Grid>
          </Grid>
        </div>

        <Divider />

        {/* ── Prestations à la carte ─────────────────────────────────────── */}
        <div>
          <Typography sx={SECTION_TITLE_ICON_SX}>
            <Window width={14} />
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
                      <p className="cn-text-body1 text-[0.8125rem]">
                        {t('properties.addOnServices.hasIroning')}
                      </p>
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
                      <p className="cn-text-body1 text-[0.8125rem]">
                        {t('properties.addOnServices.hasDeepKitchen')}
                      </p>
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
                      <p className="cn-text-body1 text-[0.8125rem]">
                        {t('properties.addOnServices.hasDisinfection')}
                      </p>
                    }
                  />
                )}
              />
            </Grid>
          </Grid>
        </div>
      </div>
    );
  }
);

PropertyFormSettings.displayName = 'PropertyFormSettings';

export default PropertyFormSettings;
