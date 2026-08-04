import React, { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '../../components/ui';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { CleaningServices, TrendingUp, Timer, CheckCircle } from '../../icons';
import { useWatch } from 'react-hook-form';
import type { Control, UseFormSetValue } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { Money } from '../../components/Money';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { CleaningPreviewInputs, CleaningPreviewResponse } from '../../services/api/propertiesApi';
import type { PropertyFormValues } from '../../schemas';

// ─── Estimateur ménage v2 — branché sur le Moteur Ménage backend ─────────────
// Plus AUCUNE formule locale : POST /pricing-config/cleaning-estimate/preview
// (minutes normées × taux horaire org × multiplicateur type) avec debounce 400 ms.
// Prix conseillé = MÉDIANE mise en avant (ancrage), fourchette min–max discrète,
// durée normée, et décomposition transparente des minutes (pattern price book).

// ─── Stable sx constants ────────────────────────────────────────────────────

const TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--faint)',
  whiteSpace: 'nowrap',
} as const;

/** Report en classes de `TITLE_SX`. */
const TITLE_CLASS = 'text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--faint)] whitespace-nowrap';

const CARDS_ROW_CLASS = 'grid grid-cols-[1fr_1fr_1fr] gap-3 max-[700px]:grid-cols-[1fr]';

// Carte option sélectionnable : tuile hairline, sélection accent-soft + bordure accent.
const PRICE_CARD_CLASS =
  'relative flex flex-col items-center justify-center gap-[4.5px] py-[15px] px-3 rounded-[13px] '
  + 'border border-solid cursor-pointer '
  + 'focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]';

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

/**
 * Report en classes de `RECOMMENDED_SX` / `RECOMMENDED_SECONDARY_SX`.
 * `[font-family:…]` (propriete arbitraire) et non `font-[…]` : ce dernier se
 * lit comme une graisse et non comme une famille.
 */
const RECOMMENDED_CLASS =
  '[font-family:var(--font-display)] text-[22px] font-semibold text-[var(--accent)] '
  + 'whitespace-nowrap leading-[1.2] tabular-nums tracking-[-.01em]';

const RECOMMENDED_SECONDARY_CLASS =
  '[font-family:var(--font-display)] text-[19px] font-semibold text-[var(--ink)] '
  + 'whitespace-nowrap leading-[1.2] tabular-nums tracking-[-.01em]';

/** Fourchette min–max : discrète, sous la médiane. */
const RANGE_SX = {
  fontSize: '11.5px',
  color: 'var(--muted)',
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
} as const;

/** Report en classes de `RANGE_SX`. */
const RANGE_CLASS = 'text-[11.5px] text-[var(--muted)] leading-[1] tabular-nums';

const PER_LABEL_SX = {
  fontSize: '11px',
  color: 'var(--muted)',
  lineHeight: 1,
} as const;

/** Report en classes de `PER_LABEL_SX`. */
const PER_LABEL_CLASS = 'text-[11px] text-[var(--muted)] leading-[1]';

const HINT_SX = {
  fontSize: '12.5px',
  color: 'var(--muted)',
  fontStyle: 'italic',
  textAlign: 'center',
  py: 3,
} as const;

/** Report en classes de `HINT_SX`. */
const HINT_CLASS = 'text-[12.5px] text-[var(--muted)] italic text-center py-[18px]';

// Bandeau durée : pattern alerte -soft pleine largeur (accent).
const DURATION_BANNER_CLASS =
  'flex items-center justify-center gap-1.5 py-[7.5px] px-3 mb-3 rounded-[11px] '
  + 'border border-solid border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[var(--accent-soft)]';

const DURATION_VALUE_SX = {
  fontFamily: 'var(--font-display)',
  fontSize: '17px',
  fontWeight: 600,
  color: 'var(--accent)',
  lineHeight: 1.2,
  fontVariantNumeric: 'tabular-nums',
} as const;

/** Report en classes de `DURATION_VALUE_SX`. */
const DURATION_VALUE_CLASS =
  '[font-family:var(--font-display)] text-[17px] font-semibold text-[var(--accent)] leading-[1.2] tabular-nums';

const DURATION_LABEL_SX = {
  fontSize: '11.5px',
  fontWeight: 500,
  color: 'var(--body)',
} as const;

/** Report en classes de `DURATION_LABEL_SX`. */
const DURATION_LABEL_CLASS = 'text-[11.5px] font-medium text-[var(--body)]';

// Décomposition minutes (pattern price book) : lignes hairline lisibles.
const BREAKDOWN_CLASS = 'mt-3 border border-solid border-[var(--line)] rounded-[11px] overflow-hidden';

// Le selecteur d'origine ('& + &') posait un filet entre deux lignes consecutives :
// toutes les lignes sauf la premiere, la liste ne contenant que des lignes.
const BREAKDOWN_ROW_CLASS =
  'flex items-center justify-between px-[10.5px] py-[4.5px] '
  + '[&:not(:first-child)]:[border-top:1px_solid_var(--line)]';

const ADOPT_BTN_CLASS =
  'inline-flex items-center gap-[7px] h-8 px-[14px] py-0 rounded-[10px] '
  + 'border border-solid border-[var(--accent)] bg-transparent text-[var(--accent)] '
  + '[font-family:inherit] text-[12px] font-semibold cursor-pointer hover:bg-[var(--accent-soft)] '
  + 'focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]';

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
    <div className="border border-solid border-[var(--line)] rounded-[14px] bg-[var(--card)] mb-3 px-[15px] py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-[4.5px]">
          <span className="inline-flex text-[var(--accent)]"><CleaningServices size={20} strokeWidth={1.75} /></span>
          <p className={cn(TITLE_CLASS, 'cn-text-body1')}>
            {t('properties.priceEstimation.title')}
          </p>
        </div>

        {preview && (
          <div className="flex items-center gap-[3px]">
            <span className="inline-flex text-[var(--muted)]"><TrendingUp size={13} strokeWidth={1.75} /></span>
            <p className={cn(PER_LABEL_CLASS, 'cn-text-body1')}>
              {t('properties.cleaningEstimator.engineBadge')}
            </p>
          </div>
        )}
      </div>

      {/* Duration banner — durée normée du moteur pour le type sélectionné */}
      {selectedQuote != null && (
        <div className={DURATION_BANNER_CLASS}>
          <span className="inline-flex text-[var(--accent)]"><Timer size={20} strokeWidth={1.75} /></span>
          <div className="flex items-baseline gap-1">
            <p className={cn(DURATION_VALUE_CLASS, 'cn-text-body1')}>
              {formatDuration(selectedQuote.durationMinutes)}
            </p>
            <p className={cn(DURATION_LABEL_CLASS, 'cn-text-body1')}>
              {t('properties.durationEstimation.title')}
            </p>
          </div>
          <p className="cn-text-body1 text-[10.5px] text-[var(--muted)] italic ms-auto">
            {t('properties.durationEstimation.computed')}
          </p>
        </div>
      )}

      {/* Skeleton bref pendant le premier chargement */}
      {loading && (
        <div className={CARDS_ROW_CLASS}>
          {CLEANING_TYPES.map((ct) => (
            <Skeleton key={ct} className="h-[118px] rounded-[13px]" />
          ))}
        </div>
      )}

      {/* Price cards — cliquables pour choisir le type de ménage par défaut */}
      {!loading && preview ? (
        <>
          <div className={CARDS_ROW_CLASS}>
            {CLEANING_TYPES.map((type) => {
              const quote = preview.quotes?.[type];
              if (!quote) return null;
              const isSelected = type === selectedType;
              return (
                <div
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
                  className={cn(
                    PRICE_CARD_CLASS,
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] hover:border-[var(--accent)]'
                      : 'border-[var(--line)] bg-[var(--card)] hover:border-[var(--line-2)]',
                  )}
                  style={{ transition: 'border-color .14s, background-color .14s' }}
                >
                  {isSelected && <span className="absolute top-[6px] end-[6px] inline-flex text-[var(--accent)]"><CheckCircle size={18} strokeWidth={1.75} /></span>}
                  <StatusChip
                    label={t(`properties.priceEstimation.cleaningTypes.${type}`)}
                    tokens={isSelected
                      ? { color: 'var(--accent)', bg: 'var(--card)' }
                      : { color: 'var(--muted)', bg: 'var(--field)' }}
                    className="border border-solid"
                    sx={{ borderColor: isSelected ? 'var(--accent)' : 'var(--field-line)' }}
                  />
                  {/* Médiane = ancre visuelle */}
                  <p className={cn(isSelected ? RECOMMENDED_CLASS : RECOMMENDED_SECONDARY_CLASS, 'cn-text-body1')}>
                    <Money value={quote.recommended} from="EUR" decimals={0} />
                  </p>
                  {/* Fourchette discrète */}
                  <p className={cn(RANGE_CLASS, 'cn-text-body1')}>
                    <Money value={quote.min} from="EUR" decimals={0} /> – <Money value={quote.max} from="EUR" decimals={0} />
                    {' · '}{formatDuration(quote.durationMinutes)}
                  </p>
                  <p className={cn(PER_LABEL_CLASS, 'cn-text-body1')}>
                    {t('properties.priceEstimation.perIntervention')}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Adopter la médiane CLEANING comme prix du logement */}
          {recommendedStandard != null && (
            <div className="flex items-center gap-2 mt-3">
              {adopted ? (
                <div className="inline-flex items-center gap-1">
                  <span className="inline-flex text-[var(--ok,_var(--accent))]">
                    <CheckCircle size={15} strokeWidth={1.75} />
                  </span>
                  <p className="cn-text-body1 text-[12px] font-semibold text-[var(--body)]">
                    {t('properties.cleaningEstimator.adopted')}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setValue('cleaningBasePrice', Number(recommendedStandard), { shouldDirty: true })}
                  className={ADOPT_BTN_CLASS}
                  style={{ transition: 'background .14s, color .14s' }}
                >
                  <CheckCircle size={14} strokeWidth={1.75} />
                  {t('properties.cleaningEstimator.adoptAsBasePrice')}
                </button>
              )}
              {cleaningBasePrice != null && Number(cleaningBasePrice) > 0 && !adopted && (
                <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] tabular-nums">
                  {t('properties.cleaningEstimator.currentBasePrice')} : <Money value={Number(cleaningBasePrice)} from="EUR" decimals={0} />
                </p>
              )}
            </div>
          )}

          {/* Décomposition minutes — transparence du conseil (pattern price book) */}
          {breakdownEntries.length > 0 && (
            <div className={BREAKDOWN_CLASS}>
              <div className={cn(BREAKDOWN_ROW_CLASS, 'bg-[var(--surface-2)]')}>
                <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--faint)]">
                  {t('properties.cleaningEstimator.breakdownTitle')}
                </p>
                <p className="cn-text-body1 text-[10.5px] font-bold text-[var(--faint)] tabular-nums">
                  {formatDuration(breakdownEntries.reduce((sum, e) => sum + e.minutes, 0))}
                </p>
              </div>
              {breakdownEntries.map(({ key, minutes }) => (
                <div key={key} className={BREAKDOWN_ROW_CLASS}>
                  <p className="cn-text-body1 text-[12.5px] text-[var(--body)]">
                    {t(`properties.cleaningEstimator.breakdown.${key}`)}
                  </p>
                  <p className="cn-text-body1 text-[12.5px] font-semibold text-[var(--ink)] tabular-nums">
                    {minutes} min
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : !loading ? (
        <p className={cn(HINT_CLASS, 'cn-text-body1')}>
          {t('properties.priceEstimation.noEstimation')}
        </p>
      ) : null}
    </div>
  );
});

CleaningPriceEstimator.displayName = 'CleaningPriceEstimator';

export default CleaningPriceEstimator;
