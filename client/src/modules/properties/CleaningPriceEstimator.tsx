import React, { useMemo } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { CleaningServices, TrendingUp, Timer, CheckCircle } from '../../icons';
import { useWatch } from 'react-hook-form';
import type { Control, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyFormValues } from '../../schemas';

// ─── Stable sx constants ────────────────────────────────────────────────────

const CONTAINER_SX = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  bgcolor: 'background.paper',
  mb: 2,
  px: 2.5,
  py: 2,
} as const;

const HEADER_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  mb: 2,
} as const;

const TITLE_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
} as const;

const ICON_SX = {
  fontSize: 20,
  color: 'primary.main',
} as const;

const TITLE_SX = {
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'text.secondary',
  whiteSpace: 'nowrap',
} as const;

const CARDS_ROW_SX = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 2,
} as const;

const PRICE_CARD_SX = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  py: 2.5,
  px: 2,
  borderRadius: 1.5,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'grey.50',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background-color 0.15s, transform 0.15s',
  '&:hover': {
    borderColor: 'primary.light',
    transform: 'translateY(-1px)',
  },
} as const;

const PRICE_CARD_SELECTED_SX = {
  ...PRICE_CARD_SX,
  borderColor: 'primary.main',
  borderWidth: 2,
  bgcolor: 'primary.50',
  '&:hover': {
    borderColor: 'primary.main',
    transform: 'translateY(-1px)',
  },
} as const;

const SELECTED_BADGE_SX = {
  position: 'absolute',
  top: 6,
  right: 6,
  fontSize: 18,
  color: 'primary.main',
} as const;

const CHIP_SX = {
  height: 24,
  fontSize: '0.6875rem',
  fontWeight: 600,
  borderRadius: 1,
  '& .MuiChip-label': { px: 1.25 },
} as const;

const PRICE_RANGE_SX = {
  fontSize: '1.375rem',
  fontWeight: 700,
  color: 'primary.main',
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
} as const;

const PRICE_RANGE_SECONDARY_SX = {
  ...PRICE_RANGE_SX,
  fontSize: '1.25rem',
  color: 'text.primary',
  fontWeight: 600,
} as const;

const PER_LABEL_SX = {
  fontSize: '0.6875rem',
  color: 'text.disabled',
  lineHeight: 1,
} as const;

const HINT_SX = {
  fontSize: '0.75rem',
  color: 'text.disabled',
  fontStyle: 'italic',
  textAlign: 'center',
  py: 3,
} as const;

const BADGE_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
} as const;

const DURATION_BANNER_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  py: 1.25,
  px: 2,
  mb: 2,
  borderRadius: 1.5,
  border: '1px solid',
  borderColor: 'primary.main',
  bgcolor: 'primary.50',
} as const;

const DURATION_VALUE_SX = {
  fontSize: '1.125rem',
  fontWeight: 700,
  color: 'primary.main',
  lineHeight: 1.2,
} as const;

const DURATION_LABEL_SX = {
  fontSize: '0.6875rem',
  fontWeight: 500,
  color: 'text.secondary',
} as const;

// ─── Price calculation coefficients ─────────────────────────────────────────

// Property type coefficients (mirrors backend PricingConfigService DEFAULT_PROPERTY_TYPE_COEFFS)
const PROPERTY_TYPE_COEFFS: Record<string, number> = {
  STUDIO:     0.85,
  APARTMENT:  1.0,
  HOUSE:      1.15,
  LOFT:       1.10,
  VILLA:      1.35,
  GUEST_ROOM: 0.80,
  COTTAGE:    1.15,
  CHALET:     1.20,
  BOAT:       1.10,
  OTHER:      1.0,
};

// Type multipliers (how much cleaning type affects price)
const CLEANING_TYPE_COEFFS: Record<string, { min: number; max: number }> = {
  CLEANING:         { min: 1.0,  max: 1.0 },   // Standard
  EXPRESS_CLEANING: { min: 0.7,  max: 0.85 },   // Express (less thorough, cheaper)
  DEEP_CLEANING:    { min: 1.4,  max: 1.7 },    // Deep (more thorough, more expensive)
};

// Surface-based pricing tiers (base price in euros)
const SURFACE_BASE_PRICE: { maxSurface: number | null; base: number }[] = [
  { maxSurface: 30,   base: 35 },
  { maxSurface: 50,   base: 45 },
  { maxSurface: 70,   base: 55 },
  { maxSurface: 100,  base: 70 },
  { maxSurface: 150,  base: 90 },
  { maxSurface: null,  base: 110 },
];

// Additive surcharges
const SURCHARGES = {
  perBedroom:      5,   // per bedroom above 1
  perBathroom:     4,   // per bathroom above 1
  perFloor:        8,   // per additional floor
  exterior:        12,  // has terrace/garden
  laundry:         8,   // linen management
  perGuestAbove4:  3,   // per guest above 4
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface CleaningPriceEstimatorProps {
  control: Control<PropertyFormValues>;
  setValue: UseFormSetValue<PropertyFormValues>;
}

type CleaningType = 'CLEANING' | 'EXPRESS_CLEANING' | 'DEEP_CLEANING';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSurfaceBasePrice(sqm: number): number {
  for (const tier of SURFACE_BASE_PRICE) {
    if (tier.maxSurface === null || sqm <= tier.maxSurface) {
      return tier.base;
    }
  }
  return SURFACE_BASE_PRICE[SURFACE_BASE_PRICE.length - 1].base;
}

function computeRange(
  sqm: number,
  bedrooms: number,
  bathrooms: number,
  maxGuests: number,
  floors: number | undefined,
  hasExterior: boolean,
  hasLaundry: boolean,
  cleaningBasePrice: number | undefined,
  cleaningType: CleaningType,
  propertyType: string,
): { min: number; max: number } {
  // If user set a manual base price, use it as anchor
  const base = (cleaningBasePrice != null && cleaningBasePrice > 0)
    ? cleaningBasePrice
    : getSurfaceBasePrice(sqm);

  // Additive surcharges
  let surcharge = 0;
  surcharge += Math.max(0, bedrooms - 1) * SURCHARGES.perBedroom;
  surcharge += Math.max(0, bathrooms - 1) * SURCHARGES.perBathroom;
  if (floors != null && floors > 1) {
    surcharge += (floors - 1) * SURCHARGES.perFloor;
  }
  if (hasExterior) surcharge += SURCHARGES.exterior;
  if (hasLaundry) surcharge += SURCHARGES.laundry;
  if (maxGuests > 4) {
    surcharge += (maxGuests - 4) * SURCHARGES.perGuestAbove4;
  }

  const raw = base + surcharge;

  // Apply property type coefficient
  const propTypeCoeff = PROPERTY_TYPE_COEFFS[propertyType] ?? 1.0;
  const adjusted = raw * propTypeCoeff;

  const typeCoeff = CLEANING_TYPE_COEFFS[cleaningType] ?? CLEANING_TYPE_COEFFS.CLEANING;

  // Round to nearest 5
  const min = Math.max(30, Math.round((adjusted * typeCoeff.min) / 5) * 5);
  const max = Math.max(min, Math.round((adjusted * typeCoeff.max) / 5) * 5);

  return { min, max };
}

// ─── Duration estimation (mirrors backend algorithm) ────────────────────────

function computeEstimatedDuration(
  bedrooms: number,
  bathrooms: number,
  squareMeters: number,
  numberOfFloors: number | undefined,
  hasExterior: boolean,
  hasLaundry: boolean,
  windowCount: number,
  frenchDoorCount: number,
  slidingDoorCount: number,
  hasIroning: boolean,
  hasDeepKitchen: boolean,
  hasDisinfection: boolean,
  propertyType: string,
): number {
  // Base from bedroom count (type T)
  let baseMins: number;
  if (bedrooms <= 1)      baseMins = 90;
  else if (bedrooms === 2) baseMins = 120;
  else if (bedrooms === 3) baseMins = 150;
  else if (bedrooms === 4) baseMins = 180;
  else                      baseMins = 210;

  // Extra bathrooms (+15 min each above 1)
  if (bathrooms > 1) baseMins += (bathrooms - 1) * 15;

  // Surface surcharge (>80m² → +1 min per 5m²)
  if (squareMeters > 80) baseMins += Math.floor((squareMeters - 80) / 5);

  // Extra floors (+15 min each above 1)
  if (numberOfFloors != null && numberOfFloors > 1) {
    baseMins += (numberOfFloors - 1) * 15;
  }

  // Window services
  baseMins += (windowCount ?? 0) * 5;
  baseMins += (frenchDoorCount ?? 0) * 8;
  baseMins += (slidingDoorCount ?? 0) * 12;

  // Boolean add-ons
  if (hasLaundry)      baseMins += 10;
  if (hasIroning)      baseMins += 20;
  if (hasDeepKitchen)  baseMins += 30;
  if (hasExterior)     baseMins += 25;
  if (hasDisinfection) baseMins += 40;

  // Apply property type coefficient
  const propTypeCoeff = PROPERTY_TYPE_COEFFS[propertyType] ?? 1.0;
  baseMins = Math.round(baseMins * propTypeCoeff);

  return baseMins;
}

function formatDuration(mins: number): string {
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours === 0) return `${mins} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h${String(remainder).padStart(2, '0')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

const CLEANING_TYPES: CleaningType[] = ['CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING'];

const CleaningPriceEstimator: React.FC<CleaningPriceEstimatorProps> = React.memo(({ control, setValue }) => {
  const { t } = useTranslation();

  // Watch form values in real time
  const watchedValues = useWatch({
    control,
    name: [
      'squareMeters',
      'bedroomCount',
      'bathroomCount',
      'maxGuests',
      'numberOfFloors',
      'hasExterior',
      'hasLaundry',
      'cleaningBasePrice',
      'windowCount',
      'frenchDoorCount',
      'slidingDoorCount',
      'hasIroning',
      'hasDeepKitchen',
      'hasDisinfection',
      'type',
      'defaultCleaningType',
    ],
  });

  const [
    squareMeters,
    bedroomCount,
    bathroomCount,
    maxGuests,
    numberOfFloors,
    hasExterior,
    hasLaundry,
    cleaningBasePrice,
    windowCount,
    frenchDoorCount,
    slidingDoorCount,
    hasIroning,
    hasDeepKitchen,
    hasDisinfection,
    propertyType,
    defaultCleaningType,
  ] = watchedValues;

  const selectedType: CleaningType = defaultCleaningType ?? 'CLEANING';

  // Check if we have enough data to show an estimate
  const hasEnoughData = (squareMeters ?? 0) > 0 || (cleaningBasePrice != null && cleaningBasePrice > 0);

  // Compute estimated duration
  const estimatedDuration = useMemo(() => {
    const bedrooms = bedroomCount ?? 1;
    if (bedrooms <= 0 && (squareMeters ?? 0) <= 0) return null;

    return computeEstimatedDuration(
      bedrooms,
      bathroomCount ?? 1,
      squareMeters ?? 0,
      numberOfFloors ?? undefined,
      hasExterior ?? false,
      hasLaundry ?? false,
      windowCount ?? 0,
      frenchDoorCount ?? 0,
      slidingDoorCount ?? 0,
      hasIroning ?? false,
      hasDeepKitchen ?? false,
      hasDisinfection ?? false,
      propertyType ?? 'OTHER',
    );
  }, [bedroomCount, bathroomCount, squareMeters, numberOfFloors, hasExterior, hasLaundry, windowCount, frenchDoorCount, slidingDoorCount, hasIroning, hasDeepKitchen, hasDisinfection, propertyType]);

  // Compute price ranges for each cleaning type
  const estimates = useMemo(() => {
    if (!hasEnoughData) return null;

    return CLEANING_TYPES.map((ct) => {
      const range = computeRange(
        squareMeters ?? 0,
        bedroomCount ?? 1,
        bathroomCount ?? 1,
        maxGuests ?? 2,
        numberOfFloors ?? undefined,
        hasExterior ?? false,
        hasLaundry ?? true,
        cleaningBasePrice ?? undefined,
        ct,
        propertyType ?? 'OTHER',
      );
      return { type: ct, ...range };
    });
  }, [squareMeters, bedroomCount, bathroomCount, maxGuests, numberOfFloors, hasExterior, hasLaundry, cleaningBasePrice, hasEnoughData, propertyType]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Box sx={CONTAINER_SX}>
      {/* Header */}
      <Box sx={HEADER_SX}>
        <Box sx={TITLE_ROW_SX}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><CleaningServices size={20} strokeWidth={1.75} /></Box>
          <Typography sx={TITLE_SX}>
            {t('properties.priceEstimation.title')}
          </Typography>
        </Box>

        {estimates && (
          <Box sx={BADGE_SX}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><TrendingUp size={13} strokeWidth={1.75} /></Box>
            <Typography sx={PER_LABEL_SX}>
              {t('properties.priceEstimation.basedOn')}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Duration banner */}
      {estimatedDuration != null && (
        <Box sx={DURATION_BANNER_SX}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><Timer size={20} strokeWidth={1.75} /></Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
            <Typography sx={DURATION_VALUE_SX}>
              {formatDuration(estimatedDuration)}
            </Typography>
            <Typography sx={DURATION_LABEL_SX}>
              {t('properties.durationEstimation.title')}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.625rem', color: 'text.disabled', fontStyle: 'italic', ml: 'auto' }}>
            {t('properties.durationEstimation.computed')}
          </Typography>
        </Box>
      )}

      {/* Price cards — clickable to select default cleaning type */}
      {estimates ? (
        <Box sx={CARDS_ROW_SX}>
          {estimates.map(({ type, min, max }) => {
            const isSelected = type === selectedType;
            return (
              <Box
                key={type}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => setValue('defaultCleaningType', type, { shouldDirty: true })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setValue('defaultCleaningType', type, { shouldDirty: true });
                  }
                }}
                sx={isSelected ? PRICE_CARD_SELECTED_SX : PRICE_CARD_SX}
              >
                {isSelected && <Box component="span" sx={{ position: 'absolute', top: 6, right: 6, display: 'inline-flex', color: 'primary.main' }}><CheckCircle size={18} strokeWidth={1.75} /></Box>}
                <Chip
                  label={t(`properties.priceEstimation.cleaningTypes.${type}`)}
                  size="small"
                  variant={isSelected ? 'filled' : 'outlined'}
                  color={isSelected ? 'primary' : 'default'}
                  sx={CHIP_SX}
                />
                <Typography sx={isSelected ? PRICE_RANGE_SX : PRICE_RANGE_SECONDARY_SX}>
                  {min === max ? `${min}€` : `${min}€ – ${max}€`}
                </Typography>
                <Typography sx={PER_LABEL_SX}>
                  {t('properties.priceEstimation.perIntervention')}
                </Typography>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Typography sx={HINT_SX}>
          {t('properties.priceEstimation.noEstimation')}
        </Typography>
      )}
    </Box>
  );
});

CleaningPriceEstimator.displayName = 'CleaningPriceEstimator';

export default CleaningPriceEstimator;
