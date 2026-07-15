import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Chip, Skeleton } from '@mui/material';
import { CleaningServices, TrendingUp, Timer, CheckCircle } from '../../icons';
import { useWatch } from 'react-hook-form';
import type { Control, UseFormSetValue } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { Money } from '../../components/Money';
import { propertiesApi } from '../../services/api';
import type { CleaningPreviewInputs, CleaningPreviewResponse } from '../../services/api/propertiesApi';
import type { PropertyFormValues } from '../../schemas';

// ─── Estimateur ménage v2 — branché sur le Moteur Ménage backend ─────────────
// Plus AUCUNE formule locale : POST /pricing-config/cleaning-estimate/preview
// (minutes normées × taux horaire org × multiplicateur type) avec debounce 400 ms.
// Prix conseillé = MÉDIANE mise en avant (ancrage), fourchette min–max discrète,
// durée normée, et décomposition transparente des minutes (pattern price book).

// ─── Stable sx constants ────────────────────────────────────────────────────

const CONTAINER_SX = {
  border: '1px solid var(--line)',
  borderRadius: '14px',
  bgcolor: 'var(--card)',
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

const TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--faint)',
  whiteSpace: 'nowrap',
} as const;

const CARDS_ROW_SX = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 2,
  '@media (max-width: 700px)': { gridTemplateColumns: '1fr' },
} as const;

// Carte option sélectionnable : tuile hairline, sélection accent-soft + bordure accent.
const PRICE_CARD_SX = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.75,
  py: 2.5,
  px: 2,
  borderRadius: '13px',
  border: '1px solid var(--line)',
  bgcolor: 'var(--card)',
  cursor: 'pointer',
  transition: 'border-color .14s, background-color .14s',
  '&:hover': {
    borderColor: 'var(--line-2)',
  },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
} as const;

const PRICE_CARD_SELECTED_SX = {
  ...PRICE_CARD_SX,
  borderColor: 'var(--accent)',
  bgcolor: 'var(--accent-soft)',
  '&:hover': {
    borderColor: 'var(--accent)',
  },
} as const;

const CHIP_SX = {
  '& .MuiChip-label': { px: 1.25 },
} as const;

/** Prix conseillé (médiane) : l'ancre visuelle, en avant. */
const RECOMMENDED_SX = {
  fontFamily: 'var(--font-display)',
  fontSize: '22px',
  fontWeight: 600,
  color: 'var(--accent)',
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-.01em',
} as const;

const RECOMMENDED_SECONDARY_SX = {
  ...RECOMMENDED_SX,
  fontSize: '19px',
  color: 'var(--ink)',
} as const;

/** Fourchette min–max : discrète, sous la médiane. */
const RANGE_SX = {
  fontSize: '11.5px',
  color: 'var(--muted)',
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
} as const;

const PER_LABEL_SX = {
  fontSize: '11px',
  color: 'var(--muted)',
  lineHeight: 1,
} as const;

const HINT_SX = {
  fontSize: '12.5px',
  color: 'var(--muted)',
  fontStyle: 'italic',
  textAlign: 'center',
  py: 3,
} as const;

const BADGE_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
} as const;

// Bandeau durée : pattern alerte -soft pleine largeur (accent).
const DURATION_BANNER_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  py: 1.25,
  px: 2,
  mb: 2,
  borderRadius: '11px',
  border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
  bgcolor: 'var(--accent-soft)',
} as const;

const DURATION_VALUE_SX = {
  fontFamily: 'var(--font-display)',
  fontSize: '17px',
  fontWeight: 600,
  color: 'var(--accent)',
  lineHeight: 1.2,
  fontVariantNumeric: 'tabular-nums',
} as const;

const DURATION_LABEL_SX = {
  fontSize: '11.5px',
  fontWeight: 500,
  color: 'var(--body)',
} as const;

// Décomposition minutes (pattern price book) : lignes hairline lisibles.
const BREAKDOWN_SX = {
  mt: 2,
  border: '1px solid var(--line)',
  borderRadius: '11px',
  overflow: 'hidden',
} as const;

const BREAKDOWN_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  px: 1.75,
  py: 0.75,
  '& + &': { borderTop: '1px solid var(--line)' },
} as const;

const ADOPT_BTN_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  height: 32,
  padding: '0 14px',
  borderRadius: '10px',
  border: '1px solid var(--accent)',
  background: 'transparent',
  color: 'var(--accent)',
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background .14s, color .14s',
  '&:hover': { backgroundColor: 'var(--accent-soft)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
} as const;

// ─── Types & helpers ─────────────────────────────────────────────────────────

interface CleaningPriceEstimatorProps {
  control: Control<PropertyFormValues>;
  setValue: UseFormSetValue<PropertyFormValues>;
}

type CleaningType = 'CLEANING' | 'EXPRESS_CLEANING' | 'DEEP_CLEANING';

const CLEANING_TYPES: CleaningType[] = ['CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING'];

/** Ordre d'affichage stable des composants de la décomposition minutes. */
const BREAKDOWN_KEYS = ['base', 'bathrooms', 'surface', 'floors', 'exterior', 'laundry', 'guests'] as const;

function formatDuration(mins: number): string {
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours === 0) return `${mins} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h${String(remainder).padStart(2, '0')}`;
}

/** Debounce générique d'une valeur (le preview part ~400 ms après la dernière frappe). */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ─── Component ──────────────────────────────────────────────────────────────

const CleaningPriceEstimator: React.FC<CleaningPriceEstimatorProps> = React.memo(({ control, setValue }) => {
  const { t } = useTranslation();

  // Watch des champs du formulaire consommés par le moteur.
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
    defaultCleaningType,
  ] = watchedValues;

  const selectedType: CleaningType = (defaultCleaningType as CleaningType) ?? 'CLEANING';

  const hasEnoughData = (squareMeters ?? 0) > 0 || (bedroomCount ?? 0) > 0;

  const inputs: CleaningPreviewInputs = useMemo(() => ({
    bedrooms: bedroomCount ?? null,
    bathrooms: bathroomCount ?? null,
    squareMeters: squareMeters ?? null,
    floors: numberOfFloors ?? null,
    hasExterior: hasExterior ?? null,
    hasLaundry: hasLaundry ?? null,
    maxGuests: maxGuests ?? null,
  }), [bedroomCount, bathroomCount, squareMeters, numberOfFloors, hasExterior, hasLaundry, maxGuests]);
  const debouncedInputs = useDebouncedValue(inputs, 400);

  // Preview moteur (config org enregistrée). Repli silencieux : en erreur, on
  // affiche le hint « pas d'estimation » plutôt que de casser le formulaire.
  const previewQuery = useQuery<CleaningPreviewResponse>({
    queryKey: ['cleaning-estimate-preview', debouncedInputs],
    queryFn: () => propertiesApi.previewCleaningEstimate(debouncedInputs),
    enabled: hasEnoughData,
    staleTime: 30_000,
    retry: false,
  });

  const preview = previewQuery.data;
  const loading = previewQuery.isPending && hasEnoughData;
  const recommendedStandard = preview?.quotes?.CLEANING?.recommended;
  const selectedQuote = preview?.quotes?.[selectedType];

  const adopted = recommendedStandard != null
    && cleaningBasePrice != null
    && Number(cleaningBasePrice) === Number(recommendedStandard);

  const breakdownEntries = preview
    ? BREAKDOWN_KEYS.flatMap((key) => {
        const minutes = preview.minutesBreakdown?.[key] ?? 0;
        return key === 'base' || minutes > 0 ? [{ key, minutes }] : [];
      })
    : [];

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Box sx={CONTAINER_SX}>
      {/* Header */}
      <Box sx={HEADER_SX}>
        <Box sx={TITLE_ROW_SX}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><CleaningServices size={20} strokeWidth={1.75} /></Box>
          <Typography sx={TITLE_SX}>
            {t('properties.priceEstimation.title')}
          </Typography>
        </Box>

        {preview && (
          <Box sx={BADGE_SX}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><TrendingUp size={13} strokeWidth={1.75} /></Box>
            <Typography sx={PER_LABEL_SX}>
              {t('properties.cleaningEstimator.engineBadge')}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Duration banner — durée normée du moteur pour le type sélectionné */}
      {selectedQuote != null && (
        <Box sx={DURATION_BANNER_SX}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Timer size={20} strokeWidth={1.75} /></Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
            <Typography sx={DURATION_VALUE_SX}>
              {formatDuration(selectedQuote.durationMinutes)}
            </Typography>
            <Typography sx={DURATION_LABEL_SX}>
              {t('properties.durationEstimation.title')}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '10.5px', color: 'var(--muted)', fontStyle: 'italic', ml: 'auto' }}>
            {t('properties.durationEstimation.computed')}
          </Typography>
        </Box>
      )}

      {/* Skeleton bref pendant le premier chargement */}
      {loading && (
        <Box sx={CARDS_ROW_SX}>
          {CLEANING_TYPES.map((ct) => (
            <Skeleton key={ct} variant="rounded" height={118} sx={{ borderRadius: '13px' }} />
          ))}
        </Box>
      )}

      {/* Price cards — cliquables pour choisir le type de ménage par défaut */}
      {!loading && preview ? (
        <>
          <Box sx={CARDS_ROW_SX}>
            {CLEANING_TYPES.map((type) => {
              const quote = preview.quotes?.[type];
              if (!quote) return null;
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
                  {isSelected && <Box component="span" sx={{ position: 'absolute', top: 6, right: 6, display: 'inline-flex', color: 'var(--accent)' }}><CheckCircle size={18} strokeWidth={1.75} /></Box>}
                  <Chip
                    label={t(`properties.priceEstimation.cleaningTypes.${type}`)}
                    size="small"
                    sx={{
                      ...CHIP_SX,
                      ...(isSelected
                        ? { color: 'var(--accent)', bgcolor: 'var(--card)', border: '1px solid var(--accent)' }
                        : { color: 'var(--muted)', bgcolor: 'var(--field)', border: '1px solid var(--field-line)' }),
                    }}
                  />
                  {/* Médiane = ancre visuelle */}
                  <Typography sx={isSelected ? RECOMMENDED_SX : RECOMMENDED_SECONDARY_SX}>
                    <Money value={quote.recommended} from="EUR" decimals={0} />
                  </Typography>
                  {/* Fourchette discrète */}
                  <Typography sx={RANGE_SX}>
                    <Money value={quote.min} from="EUR" decimals={0} /> – <Money value={quote.max} from="EUR" decimals={0} />
                    {' · '}{formatDuration(quote.durationMinutes)}
                  </Typography>
                  <Typography sx={PER_LABEL_SX}>
                    {t('properties.priceEstimation.perIntervention')}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Adopter la médiane CLEANING comme prix du logement */}
          {recommendedStandard != null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 2 }}>
              {adopted ? (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--ok, var(--accent))' }}>
                    <CheckCircle size={15} strokeWidth={1.75} />
                  </Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: 'var(--body)' }}>
                    {t('properties.cleaningEstimator.adopted')}
                  </Typography>
                </Box>
              ) : (
                <Box
                  component="button"
                  type="button"
                  onClick={() => setValue('cleaningBasePrice', Number(recommendedStandard), { shouldDirty: true })}
                  sx={ADOPT_BTN_SX}
                >
                  <CheckCircle size={14} strokeWidth={1.75} />
                  {t('properties.cleaningEstimator.adoptAsBasePrice')}
                </Box>
              )}
              {cleaningBasePrice != null && Number(cleaningBasePrice) > 0 && !adopted && (
                <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {t('properties.cleaningEstimator.currentBasePrice')} : <Money value={Number(cleaningBasePrice)} from="EUR" decimals={0} />
                </Typography>
              )}
            </Box>
          )}

          {/* Décomposition minutes — transparence du conseil (pattern price book) */}
          {breakdownEntries.length > 0 && (
            <Box sx={BREAKDOWN_SX}>
              <Box sx={{ ...BREAKDOWN_ROW_SX, bgcolor: 'var(--surface-2)' }}>
                <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--faint)' }}>
                  {t('properties.cleaningEstimator.breakdownTitle')}
                </Typography>
                <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatDuration(breakdownEntries.reduce((sum, e) => sum + e.minutes, 0))}
                </Typography>
              </Box>
              {breakdownEntries.map(({ key, minutes }) => (
                <Box key={key} sx={BREAKDOWN_ROW_SX}>
                  <Typography sx={{ fontSize: '12.5px', color: 'var(--body)' }}>
                    {t(`properties.cleaningEstimator.breakdown.${key}`)}
                  </Typography>
                  <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {minutes} min
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </>
      ) : !loading ? (
        <Typography sx={HINT_SX}>
          {t('properties.priceEstimation.noEstimation')}
        </Typography>
      ) : null}
    </Box>
  );
});

CleaningPriceEstimator.displayName = 'CleaningPriceEstimator';

export default CleaningPriceEstimator;
