import React, { useCallback } from 'react';
import { cn } from '../../utils/cn';
import { Grid, TextField, Checkbox, FormControlLabel } from '@mui/material';
import {
  Euro,
  Bed,
  Bathroom,
  SquareFoot,
  Group,
  NightsStay,
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

const CATEGORY_TITLE_SX = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'text.primary',
  mb: 0.75,
} as const;

/** Report en classes de `CATEGORY_TITLE_SX`. */
const CATEGORY_TITLE_CLASS = 'text-[0.75rem] font-semibold text-[var(--ink)] mb-[4.5px]';

const CHECKBOX_LABEL_SX = {
  fontSize: '0.8125rem',
} as const;

/** Report en classes de `CHECKBOX_LABEL_SX`. */
const CHECKBOX_LABEL_CLASS = 'text-[0.8125rem]';

// ─── Amenities configuration ────────────────────────────────────────────────

const AMENITIES_CATEGORIES = [
  { key: 'comfort', items: ['WIFI', 'TV', 'AIR_CONDITIONING', 'HEATING'] },
  { key: 'kitchen', items: ['EQUIPPED_KITCHEN', 'DISHWASHER', 'MICROWAVE', 'OVEN'] },
  { key: 'appliances', items: ['WASHING_MACHINE', 'DRYER', 'IRON', 'HAIR_DRYER'] },
  { key: 'outdoor', items: ['PARKING', 'POOL', 'JACUZZI', 'GARDEN_TERRACE', 'BARBECUE'] },
  { key: 'safetyFamily', items: ['SAFE', 'BABY_BED', 'HIGH_CHAIR'] },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PropertyFormDetailsProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyFormDetails: React.FC<PropertyFormDetailsProps> = React.memo(
  ({ control, errors }) => {
    const { t } = useTranslation();

    return (
      <div>
        <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1')}>
          {t('properties.characteristics')}
        </p>

        <Grid container spacing={1.5}>
          <Grid item xs={6} md={4}>
            <Controller
              name="bedroomCount"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  type="number"
                  label={t('properties.bedroomCount')}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  required
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    startAdornment: <Bed size={16} strokeWidth={1.75} style={{ marginRight: 6, color: "var(--muted)" }} />,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={6} md={4}>
            <Controller
              name="bathroomCount"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  type="number"
                  label={t('properties.bathroomCount')}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  required
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    startAdornment: <Bathroom size={16} strokeWidth={1.75} style={{ marginRight: 6, color: "var(--muted)" }} />,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={6} md={4}>
            <Controller
              name="squareMeters"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  type="number"
                  label={t('properties.surface')}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  required
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    startAdornment: <SquareFoot size={16} strokeWidth={1.75} style={{ marginRight: 6, color: "var(--muted)" }} />,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={6} md={6}>
            <Controller
              name="maxGuests"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  type="number"
                  label={t('properties.maxGuests')}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  required
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    startAdornment: <Group size={16} strokeWidth={1.75} style={{ marginRight: 6, color: "var(--muted)" }} />,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name="nightlyPrice"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  type="number"
                  label={t('properties.nightlyPriceField')}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    startAdornment: <Euro size={16} strokeWidth={1.75} style={{ marginRight: 6, color: "var(--muted)" }} />,
                  }}
                  placeholder={t('properties.nightlyPricePlaceholder')}
                  inputProps={{ step: '0.01', min: '0' }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name="minimumNights"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  type="number"
                  label="Nuitées minimum"
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    startAdornment: <NightsStay size={16} strokeWidth={1.75} style={{ marginRight: 6, color: "var(--muted)" }} />,
                  }}
                  placeholder="1"
                  inputProps={{ step: '1', min: '1' }}
                />
              )}
            />
          </Grid>
        </Grid>

        {/* ─── Amenities Section ─────────────────────────────────────────── */}
        <div className="mt-4">
          <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1')}>
            {t('properties.amenities.title')}
          </p>

          <Controller
            name="amenities"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-3">
                {AMENITIES_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <p className={cn(CATEGORY_TITLE_CLASS, 'cn-text-body1')}>
                      {t(`properties.amenities.categories.${category.key}`)}
                    </p>
                    <Grid container spacing={0.5}>
                      {category.items.map((amenity) => {
                        const checked = field.value?.includes(amenity) || false;
                        return (
                          <Grid item xs={6} md={4} key={amenity}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={checked}
                                  onChange={(e) => {
                                    const newValue = e.target.checked
                                      ? [...(field.value || []), amenity]
                                      : (field.value || []).filter((v: string) => v !== amenity);
                                    field.onChange(newValue);
                                  }}
                                  size="small"
                                />
                              }
                              label={
                                <p className={cn(CHECKBOX_LABEL_CLASS, 'cn-text-body1')}>
                                  {t(`properties.amenities.items.${amenity}`)}
                                </p>
                              }
                            />
                          </Grid>
                        );
                      })}
                    </Grid>
                  </div>
                ))}
              </div>
            )}
          />
        </div>
      </div>
    );
  }
);

PropertyFormDetails.displayName = 'PropertyFormDetails';

export default PropertyFormDetails;
