import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Skeleton } from '../../components/ui';
import { cn } from '../../utils/cn';
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

// ─── Gabarits (Baitly UI) ───────────────────────────────────────────────────

const TITLE_CLASS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap';

const CARDS_ROW_CLASS = 'grid grid-cols-[1fr_1fr_1fr] gap-3 max-[700px]:grid-cols-[1fr]';

// Carte option sélectionnable : tuile hairline ; la sélection se dit par le
// fond `primary-soft` et un filet d'1 px, jamais par une bande latérale.
const PRICE_CARD_CLASS =
  'relative flex flex-col items-center justify-center gap-[4.5px] py-[15px] px-3 rounded-xl '
  + 'border border-solid cursor-pointer transition-colors duration-150 motion-reduce:transition-none '
  + 'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2';

/**
 * Prix conseillé (médiane) : l'ancre visuelle. Les tailles des valeurs
 * chiffrées restent explicites — c'est une hiérarchie d'affichage propre à la
 * tuile, pas du corps de texte. `[font-family:…]` (propriété arbitraire) et non
 * `font-[…]` : ce dernier se lit comme une graisse et non comme une famille.
 */
const RECOMMENDED_CLASS =
  '[font-family:var(--font-display)] text-[22px] font-semibold text-primary '
  + 'whitespace-nowrap leading-[1.2] tabular-nums tracking-[-.01em]';

const RECOMMENDED_SECONDARY_CLASS =
  '[font-family:var(--font-display)] text-[19px] font-semibold text-foreground '
  + 'whitespace-nowrap leading-[1.2] tabular-nums tracking-[-.01em]';

/** Fourchette min–max : discrète, sous la médiane. */
const RANGE_CLASS = 'text-xs text-muted-foreground leading-[1] tabular-nums';

const PER_LABEL_CLASS = 'text-xs text-muted-foreground leading-[1]';

const HINT_CLASS = 'text-xs text-muted-foreground italic text-center py-[18px]';

// Bandeau durée : encart pastel pleine largeur.
const DURATION_BANNER_CLASS =
  'flex items-center justify-center gap-1.5 py-[7.5px] px-3 mb-3 rounded-lg '
  + 'border border-solid border-primary/30 bg-primary-soft';

const DURATION_VALUE_CLASS =
  '[font-family:var(--font-display)] text-[17px] font-semibold text-primary leading-[1.2] tabular-nums';

const DURATION_LABEL_CLASS = 'text-xs font-medium text-foreground';

// Décomposition minutes (pattern price book) : lignes hairline lisibles.
const BREAKDOWN_CLASS = 'mt-3 border border-solid border-border rounded-lg overflow-hidden';

// Le selecteur d'origine ('& + &') posait un filet entre deux lignes consecutives :
// toutes les lignes sauf la premiere, la liste ne contenant que des lignes.
// `border-solid` est obligatoire : sans preflight, une largeur seule reste invisible.
const BREAKDOWN_ROW_CLASS =
  'flex items-center justify-between px-[10.5px] py-[4.5px] '
  + '[&:not(:first-child)]:border-t [&:not(:first-child)]:border-solid [&:not(:first-child)]:border-border';

/** Puce du type de ménage : puce de SÉLECTION, donc filet visible et fond plein une fois choisie. */
const TYPE_BADGE_CLASS = 'h-[22px] rounded-md px-1.5 text-[0.6875rem] font-semibold border border-solid';

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
    <div className="border border-solid border-border rounded-xl bg-card mb-3 px-[15px] py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-[4.5px]">
          <span className="inline-flex text-primary"><CleaningServices size={20} strokeWidth={1.75} /></span>
          <p className={TITLE_CLASS}>
            {t('properties.priceEstimation.title')}
          </p>
        </div>

        {preview && (
          <div className="flex items-center gap-[3px]">
            <span className="inline-flex text-muted-foreground"><TrendingUp size={13} strokeWidth={1.75} /></span>
            <p className={PER_LABEL_CLASS}>
              {t('properties.cleaningEstimator.engineBadge')}
            </p>
          </div>
        )}
      </div>

      {/* Duration banner — durée normée du moteur pour le type sélectionné */}
      {selectedQuote != null && (
        <div className={DURATION_BANNER_CLASS}>
          <span className="inline-flex text-primary"><Timer size={20} strokeWidth={1.75} /></span>
          <div className="flex items-baseline gap-1">
            <p className={DURATION_VALUE_CLASS}>
              {formatDuration(selectedQuote.durationMinutes)}
            </p>
            <p className={DURATION_LABEL_CLASS}>
              {t('properties.durationEstimation.title')}
            </p>
          </div>
          <p className="text-2xs text-muted-foreground italic ms-auto">
            {t('properties.durationEstimation.computed')}
          </p>
        </div>
      )}

      {/* Skeleton bref pendant le premier chargement */}
      {loading && (
        <div className={CARDS_ROW_CLASS}>
          {CLEANING_TYPES.map((ct) => (
            <Skeleton key={ct} className="h-[118px] rounded-xl" />
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
                      ? 'border-primary bg-primary-soft'
                      : 'border-border bg-card hover:bg-muted/40',
                  )}
                >
                  {isSelected && <span className="absolute top-[6px] end-[6px] inline-flex text-primary"><CheckCircle size={18} strokeWidth={1.75} /></span>}
                  <Badge
                    variant="outline"
                    className={cn(
                      TYPE_BADGE_CLASS,
                      isSelected
                        ? 'border-primary bg-card text-primary'
                        : 'border-field-line bg-field text-muted-foreground',
                    )}
                  >
                    {t(`properties.priceEstimation.cleaningTypes.${type}`)}
                  </Badge>
                  {/* Médiane = ancre visuelle */}
                  <p className={isSelected ? RECOMMENDED_CLASS : RECOMMENDED_SECONDARY_CLASS}>
                    <Money value={quote.recommended} from="EUR" decimals={0} />
                  </p>
                  {/* Fourchette discrète */}
                  <p className={RANGE_CLASS}>
                    <Money value={quote.min} from="EUR" decimals={0} /> – <Money value={quote.max} from="EUR" decimals={0} />
                    {' · '}{formatDuration(quote.durationMinutes)}
                  </p>
                  <p className={PER_LABEL_CLASS}>
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
                  <span className="inline-flex text-success">
                    <CheckCircle size={15} strokeWidth={1.75} />
                  </span>
                  <p className="text-xs font-semibold text-success-ink">
                    {t('properties.cleaningEstimator.adopted')}
                  </p>
                </div>
              ) : (
                // `type="button"` explicite : l'estimateur vit dans le formulaire
                // de logement, un bouton sans type le soumettrait.
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setValue('cleaningBasePrice', Number(recommendedStandard), { shouldDirty: true })}
                >
                  <CheckCircle size={14} strokeWidth={1.75} />
                  {t('properties.cleaningEstimator.adoptAsBasePrice')}
                </Button>
              )}
              {cleaningBasePrice != null && Number(cleaningBasePrice) > 0 && !adopted && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t('properties.cleaningEstimator.currentBasePrice')} : <Money value={Number(cleaningBasePrice)} from="EUR" decimals={0} />
                </p>
              )}
            </div>
          )}

          {/* Décomposition minutes — transparence du conseil (pattern price book) */}
          {breakdownEntries.length > 0 && (
            <div className={BREAKDOWN_CLASS}>
              <div className={cn(BREAKDOWN_ROW_CLASS, 'bg-muted')}>
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('properties.cleaningEstimator.breakdownTitle')}
                </p>
                <p className="text-2xs font-semibold text-muted-foreground tabular-nums">
                  {formatDuration(breakdownEntries.reduce((sum, e) => sum + e.minutes, 0))}
                </p>
              </div>
              {breakdownEntries.map(({ key, minutes }) => (
                <div key={key} className={BREAKDOWN_ROW_CLASS}>
                  <p className="text-xs text-muted-foreground">
                    {t(`properties.cleaningEstimator.breakdown.${key}`)}
                  </p>
                  <p className="text-xs font-semibold text-foreground tabular-nums">
                    {minutes} min
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : !loading ? (
        <p className={HINT_CLASS}>
          {t('properties.priceEstimation.noEstimation')}
        </p>
      ) : null}
    </div>
  );
});

CleaningPriceEstimator.displayName = 'CleaningPriceEstimator';

export default CleaningPriceEstimator;
