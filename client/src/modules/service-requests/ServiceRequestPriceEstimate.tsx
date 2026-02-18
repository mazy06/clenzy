import React, { useMemo } from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import {
  AutoAwesome,
  Timer,
  TrendingUp,
  Info,
  InfoOutlined,
  Star,
} from '@mui/icons-material';
import type { ForfaitConfig } from '../../services/api/pricingConfigApi';
import { DEFAULT_FORFAIT_CONFIGS } from '../../services/api/pricingConfigApi';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PropertyData {
  bedroomCount?: number;
  bathroomCount?: number;
  squareMeters?: number;
  maxGuests?: number;
  cleaningBasePrice?: number;
  cleaningDurationMinutes?: number;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  windowCount?: number;
  frenchDoorCount?: number;
  slidingDoorCount?: number;
  hasIroning?: boolean;
  hasDeepKitchen?: boolean;
  hasDisinfection?: boolean;
}

interface ServiceRequestPriceEstimateProps {
  property: PropertyData | null;
  forfaitConfigs?: ForfaitConfig[];
  selectedForfaitKey?: string;
}

// ─── Price calculation ──────────────────────────────────────────────────────

function getSurfaceBasePriceFromTiers(sqm: number, tiers: { maxSurface: number | null; base: number }[]): number {
  for (const tier of tiers) {
    if (tier.maxSurface === null || sqm <= tier.maxSurface) return tier.base;
  }
  return tiers.length > 0 ? tiers[tiers.length - 1].base : 35;
}

function computeRangeFromForfait(
  sqm: number, bedrooms: number, bathrooms: number, maxGuests: number,
  floors: number | undefined, hasExterior: boolean, hasLaundry: boolean,
  cleaningBasePrice: number | undefined, forfait: ForfaitConfig,
): { min: number; max: number } {
  const base = (cleaningBasePrice != null && cleaningBasePrice > 0)
    ? cleaningBasePrice
    : getSurfaceBasePriceFromTiers(sqm, forfait.surfaceBasePrices || []);

  const surcharges = forfait.surcharges || {};
  let surcharge = 0;
  surcharge += Math.max(0, bedrooms - 1) * (surcharges.perBedroom ?? 5);
  surcharge += Math.max(0, bathrooms - 1) * (surcharges.perBathroom ?? 4);
  if (floors != null && floors > 1) surcharge += (floors - 1) * (surcharges.perFloor ?? 8);
  if (hasExterior) surcharge += (surcharges.exterior ?? 12);
  if (hasLaundry) surcharge += (surcharges.laundry ?? 8);
  if (maxGuests > 4) surcharge += (maxGuests - 4) * (surcharges.perGuestAbove4 ?? 3);

  const raw = base + surcharge;
  const min = Math.max(30, Math.round((raw * (forfait.coeffMin ?? 1.0)) / 5) * 5);
  const max = Math.max(min, Math.round((raw * (forfait.coeffMax ?? 1.0)) / 5) * 5);
  return { min, max };
}

// ─── Duration estimation ────────────────────────────────────────────────────

function computeEstimatedDuration(p: PropertyData): number {
  const bedrooms = p.bedroomCount ?? 1;
  let baseMins: number;
  if (bedrooms <= 1)      baseMins = 90;
  else if (bedrooms === 2) baseMins = 120;
  else if (bedrooms === 3) baseMins = 150;
  else if (bedrooms === 4) baseMins = 180;
  else                      baseMins = 210;

  if ((p.bathroomCount ?? 1) > 1) baseMins += ((p.bathroomCount ?? 1) - 1) * 15;
  if ((p.squareMeters ?? 0) > 80) baseMins += Math.floor(((p.squareMeters ?? 0) - 80) / 5);
  if (p.numberOfFloors != null && p.numberOfFloors > 1) baseMins += (p.numberOfFloors - 1) * 15;

  baseMins += (p.windowCount ?? 0) * 5;
  baseMins += (p.frenchDoorCount ?? 0) * 8;
  baseMins += (p.slidingDoorCount ?? 0) * 12;

  if (p.hasLaundry)      baseMins += 10;
  if (p.hasIroning)      baseMins += 20;
  if (p.hasDeepKitchen)  baseMins += 30;
  if (p.hasExterior)     baseMins += 25;
  if (p.hasDisinfection) baseMins += 40;

  return baseMins;
}

function formatDuration(mins: number): string {
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours === 0) return `${mins} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h${String(remainder).padStart(2, '0')}`;
}

// ─── Stable sx ──────────────────────────────────────────────────────────────

const CONTAINER_SX = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  bgcolor: 'background.paper',
  px: 2,
  py: 1.5,
} as const;

const HEADER_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  mb: 1.5,
} as const;

const TITLE_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
} as const;

const CARDS_ROW_SX = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 1.5,
} as const;

const PRICE_CARD_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.75,
  py: 1.5,
  px: 1.5,
  borderRadius: 1.5,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'grey.50',
  position: 'relative',
} as const;

const PRICE_CARD_PRIMARY_SX = {
  ...PRICE_CARD_SX,
  borderColor: 'primary.main',
  borderWidth: 2,
  bgcolor: 'primary.50',
} as const;

const CHIP_SX = {
  height: 22,
  fontSize: '0.625rem',
  fontWeight: 600,
  borderRadius: 1,
  '& .MuiChip-label': { px: 1 },
} as const;

const DURATION_BANNER_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.75,
  py: 1,
  px: 1.5,
  mb: 1.5,
  borderRadius: 1.5,
  border: '1px solid',
  borderColor: 'primary.main',
  bgcolor: 'primary.50',
} as const;

const NO_DATA_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  py: 1.5,
  px: 2,
  borderRadius: 1.5,
  bgcolor: 'grey.50',
  border: '1px dashed',
  borderColor: 'grey.300',
} as const;

const RECOMMENDED_BADGE_SX = {
  position: 'absolute',
  top: -10,
  right: -4,
  display: 'flex',
  alignItems: 'center',
  gap: 0.25,
  px: 0.75,
  py: 0.25,
  borderRadius: 1,
  bgcolor: 'primary.main',
  color: 'white',
  fontSize: '0.5rem',
  fontWeight: 700,
  letterSpacing: '0.03em',
  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

const ServiceRequestPriceEstimate: React.FC<ServiceRequestPriceEstimateProps> = React.memo(
  ({ property, forfaitConfigs, selectedForfaitKey }) => {
    // Use provided configs or fall back to defaults
    const forfaits = useMemo(
      () => (forfaitConfigs?.length ? forfaitConfigs : DEFAULT_FORFAIT_CONFIGS),
      [forfaitConfigs]
    );

    // Déterminer si on a des données riches ou minimales
    const hasRichData = property != null && (
      (property.squareMeters ?? 0) > 0 ||
      (property.cleaningBasePrice != null && property.cleaningBasePrice > 0)
    );

    const hasMinimalData = property != null && (property.bedroomCount ?? 0) > 0;

    // On peut toujours calculer une estimation (au minimum basée sur 1 chambre)
    const canEstimate = property != null && (hasRichData || hasMinimalData);

    const estimatedDuration = useMemo(() => {
      if (!property) return 0;
      return computeEstimatedDuration(property);
    }, [property]);

    const estimates = useMemo(() => {
      if (!property) return [];
      return forfaits.map((forfait) => {
        const range = computeRangeFromForfait(
          property.squareMeters ?? 0,
          property.bedroomCount ?? 1,
          property.bathroomCount ?? 1,
          property.maxGuests ?? 2,
          property.numberOfFloors ?? undefined,
          property.hasExterior ?? false,
          property.hasLaundry ?? false,
          property.cleaningBasePrice ?? undefined,
          forfait,
        );
        return { key: forfait.key, label: forfait.label, ...range };
      });
    }, [property, forfaits]);

    return (
      <Box sx={CONTAINER_SX}>
        {/* Header */}
        <Box sx={HEADER_SX}>
          <Box sx={TITLE_ROW_SX}>
            <AutoAwesome sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
              Estimation du prix
            </Typography>
          </Box>
          <Tooltip title="Estimation indicative basée sur les caractéristiques du logement. Le tarif définitif est soumis à l'acceptation du prestataire." arrow>
            <Info sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        </Box>

        {/* Aucune propriété sélectionnée */}
        {!property && (
          <Box sx={NO_DATA_SX}>
            <InfoOutlined sx={{ fontSize: 16, color: 'text.disabled' }} />
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', lineHeight: 1.3 }}>
              Sélectionnez une propriété pour afficher l'estimation du prix et de la durée.
            </Typography>
          </Box>
        )}

        {/* Avertissement données minimales (propriété sélectionnée mais données incomplètes) */}
        {property && !hasRichData && (
          <Box sx={NO_DATA_SX}>
            <InfoOutlined sx={{ fontSize: 16, color: 'text.disabled' }} />
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', lineHeight: 1.3 }}>
              {canEstimate
                ? 'Estimation approximative — renseignez la surface et le tarif de base dans la fiche logement pour une estimation plus précise.'
                : 'Renseignez les caractéristiques du logement (chambres, surface, tarif de base) pour afficher une estimation.'}
            </Typography>
          </Box>
        )}

        {/* Duration banner */}
        {property && (
          <Box sx={{ ...DURATION_BANNER_SX, mt: !hasRichData ? 1.5 : 0 }}>
            <Timer sx={{ fontSize: 18, color: 'primary.main' }} />
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'primary.main', lineHeight: 1.2 }}>
                {formatDuration(estimatedDuration)}
              </Typography>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 500, color: 'text.secondary' }}>
                durée estimée
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.5625rem', color: 'text.disabled', fontStyle: 'italic', ml: 'auto' }}>
              Calculée automatiquement
            </Typography>
          </Box>
        )}

        {/* Price cards */}
        {estimates.length > 0 && (
          <Box sx={CARDS_ROW_SX}>
            {estimates.map(({ key, label, min, max }) => {
              const isSelected = selectedForfaitKey === key;
              const isDefault = !selectedForfaitKey && key === 'CLEANING';
              const isHighlighted = isSelected || isDefault;
              return (
                <Box key={key} sx={isHighlighted ? PRICE_CARD_PRIMARY_SX : PRICE_CARD_SX}>
                  {isSelected && (
                    <Box sx={RECOMMENDED_BADGE_SX}>
                      <Star sx={{ fontSize: 8 }} />
                      Recommandé
                    </Box>
                  )}
                  <Chip
                    label={label}
                    size="small"
                    variant={isHighlighted ? 'filled' : 'outlined'}
                    color={isHighlighted ? 'primary' : 'default'}
                    sx={CHIP_SX}
                  />
                  <Typography sx={{
                    fontSize: isHighlighted ? '1.125rem' : '1rem',
                    fontWeight: 700,
                    color: isHighlighted ? 'primary.main' : 'text.primary',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}>
                    {min === max ? `${min}€` : `${min}€ – ${max}€`}
                  </Typography>
                  <Typography sx={{ fontSize: '0.5625rem', color: 'text.disabled', lineHeight: 1 }}>
                    par intervention
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Placeholder price cards quand pas de propriété */}
        {!property && (
          <Box sx={{ ...CARDS_ROW_SX, mt: 1.5 }}>
            {forfaits.map((forfait, index) => {
              const isFirst = index === 0;
              return (
                <Box key={forfait.key} sx={{ ...PRICE_CARD_SX, opacity: 0.4 }}>
                  <Chip
                    label={forfait.label}
                    size="small"
                    variant="outlined"
                    sx={CHIP_SX}
                  />
                  <Typography sx={{
                    fontSize: isFirst ? '1.125rem' : '1rem',
                    fontWeight: 700,
                    color: 'text.disabled',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}>
                    --€
                  </Typography>
                  <Typography sx={{ fontSize: '0.5625rem', color: 'text.disabled', lineHeight: 1 }}>
                    par intervention
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Base note */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <TrendingUp sx={{ fontSize: 11, color: 'text.disabled' }} />
          <Typography sx={{ fontSize: '0.5625rem', color: 'text.disabled', fontStyle: 'italic' }}>
            Basé sur les caractéristiques du logement
          </Typography>
        </Box>
      </Box>
    );
  }
);

ServiceRequestPriceEstimate.displayName = 'ServiceRequestPriceEstimate';

export default ServiceRequestPriceEstimate;
