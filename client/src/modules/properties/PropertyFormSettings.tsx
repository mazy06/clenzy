import React from 'react';
import { cn } from '../../utils/cn';
import { TextField, FormControl, InputLabel, Select, MenuItem, FormHelperText, FormControlLabel, Checkbox, Divider, Switch } from '@mui/material';
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

/** Report en classes de `SECTION_TITLE_SX`. */
const SECTION_TITLE_CLASS = 'text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-[var(--muted)] mb-[9px]';

const SECTION_TITLE_ICON_SX = {
  ...SECTION_TITLE_SX,
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
} as const;

/** Report en classes de `SECTION_TITLE_ICON_SX` (gap 0.5 = 3 px, spacing 6). */
const SECTION_TITLE_ICON_CLASS = `${SECTION_TITLE_CLASS} flex items-center gap-[3px]`;

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
          <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1')}>
            {t('properties.configuration')}
          </p>

          <div className="grid grid-cols-12 gap-[9px]">
            <div className="col-span-12">
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
            </div>

            <div className="col-span-12">
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
            </div>

            {/* Booking Engine Visibility */}
            <div className="col-span-12">
              <Controller
                name="bookingEngineVisible"
                control={control}
                render={({ field }) => (
                  <div className={cn('flex items-center gap-[9px] py-1.5 px-[9px] rounded-[11px] border border-solid', field.value ? 'bg-[var(--ok-soft)]' : 'bg-[var(--field)]', field.value ? 'border-[color-mix(in_srgb,_var(--ok)_30%,_transparent)]' : 'border-[var(--field-line)]')} style={{ transition: 'background-color .14s, border-color .14s' }}>
                    <span className={cn('inline-flex', field.value ? 'text-[var(--ok)]' : 'text-[var(--muted)]')}><Language size={18} strokeWidth={1.75} /></span>
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
                  </div>
                )}
              />
            </div>

            {/* Org Voucher Consent — autorise la conciergerie a creer des
                vouchers sur ce logement (combine avec organization.has_voucher_contract
                cote backend). Default false : le host garde le controle. */}
            <div className="col-span-12">
              <Controller
                name="orgCanCreateVouchers"
                control={control}
                render={({ field }) => (
                  <div className={cn('flex items-center gap-[9px] py-1.5 px-[9px] rounded-[11px] border border-solid', field.value ? 'bg-[var(--ok-soft)]' : 'bg-[var(--field)]', field.value ? 'border-[color-mix(in_srgb,_var(--ok)_30%,_transparent)]' : 'border-[var(--field-line)]')} style={{ transition: 'background-color .14s, border-color .14s' }}>
                    <span className={cn('inline-flex', field.value ? 'text-[var(--ok)]' : 'text-[var(--muted)]')}>
                      <Language size={18} strokeWidth={1.75} />
                    </span>
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
                  </div>
                )}
              />
            </div>

            <div className="col-span-6">
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
            </div>

            <div className="col-span-6">
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
            </div>
          </div>
        </div>

        <Divider />

        {/* ── Tarification ménage ──────────────────────────────────────── */}
        <div>
          <p className={cn(SECTION_TITLE_ICON_CLASS, 'cn-text-body1')}>
            <CleaningServices size={14} strokeWidth={1.75} />
            {t('properties.cleaningPricing')}
          </p>

          <div className="grid grid-cols-12 gap-[9px]">
            <div className="col-span-12">
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
            </div>

            <div className="col-span-12">
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
            </div>

            <div className="col-span-4">
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
            </div>

            <div className="col-span-4">
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
            </div>

            <div className="col-span-4">
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
            </div>

            <div className="col-span-12">
              <Controller
                name="cleaningNotes"
                control={control}
                render={({ field, fieldState }) => (
                  <div className={cn('flex gap-1.5 py-[7.5px] px-[9px] rounded-[11px] bg-[var(--accent-soft)] border border-solid min-h-[80px]', fieldState.error ? 'border-[var(--err)]' : 'border-[color-mix(in_srgb,_var(--accent)_30%,_transparent)]')} style={{ transition: 'border-color 0.15s ease' }}>
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
                  </div>
                )}
              />
            </div>
          </div>
        </div>

        <Divider />

        {/* ── Prestations à la carte ─────────────────────────────────────── */}
        <div>
          <p className={cn(SECTION_TITLE_ICON_CLASS, 'cn-text-body1')}>
            <Window width={14} />
            {t('properties.addOnServices.title')}
          </p>

          <div className="grid grid-cols-12 gap-[9px]">
            {/* Vitres */}
            <div className="col-span-4">
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
            </div>

            <div className="col-span-4">
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
            </div>

            <div className="col-span-4">
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
            </div>

            {/* Checkboxes prestations */}
            <div className="col-span-4">
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
            </div>

            <div className="col-span-4">
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
            </div>

            <div className="col-span-4">
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
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PropertyFormSettings.displayName = 'PropertyFormSettings';

export default PropertyFormSettings;
