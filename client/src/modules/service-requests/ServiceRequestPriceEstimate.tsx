import React, { useMemo } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription, Card, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import {
  AutoAwesome,
  Timer,
  TrendingUp,
  Info,
  InfoOutlined,
  Star,
} from '../../icons';
import type { ForfaitConfig } from '../../services/api/pricingConfigApi';
import { useCurrency } from '../../hooks/useCurrency';
import { Money } from '../../components/Money';

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

// ─── Price calculation (exported for reuse) ────────────────────────────────

export function getSurfaceBasePriceFromTiers(sqm: number, tiers: { maxSurface: number | null; base: number }[]): number {
  for (const tier of tiers) {
    if (tier.maxSurface === null || sqm <= tier.maxSurface) return tier.base;
  }
  return tiers.length > 0 ? tiers[tiers.length - 1].base : 35;
}

export function computeRangeFromForfait(
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

export function computeEstimatedDuration(p: PropertyData): number {
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

export function formatDuration(mins: number): string {
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours === 0) return `${mins} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h${String(remainder).padStart(2, '0')}`;
}

// ─── Classes stables (jetons Baitly UI) ─────────────────────────────────────

/** Surface du panneau : le hairline vient de l'anneau du gabarit `Card`. */
const CONTAINER_CLASS = 'gap-0 px-3 py-[9px]';

const HEADER_CLASS = 'flex items-center justify-between mb-[9px]';

const TITLE_ROW_CLASS = 'flex items-center gap-[4.5px]';

const CARDS_ROW_CLASS = 'grid grid-cols-[1fr_1fr_1fr] gap-[9px]';

const PRICE_CARD_CLASS =
  'relative flex flex-col items-center justify-center gap-[4.5px] py-[9px] px-[9px] rounded-[11px] border border-solid border-field-line bg-field';

const PRICE_CARD_PRIMARY_CLASS = 'border-primary bg-primary-soft';

/** Puce de palier tarifaire : le gabarit statut, avec une graisse plus marquee
 *  parce qu'elle sert d'etiquette a un montant. */
const TIER_CHIP_CLASS = 'text-[10.5px] font-bold';

const DURATION_BANNER_CLASS =
  'flex items-center justify-center gap-[4.5px] py-1.5 px-[9px] mb-[9px] rounded-[11px] border border-solid border-[color-mix(in_srgb,var(--bui-primary)_30%,transparent)] bg-primary-soft';

/** Notice « données insuffisantes » : l'Alert du kit, à la densité du panneau. */
const NOTICE_CLASS = 'py-1.5 text-[11.5px]';

// Marqueur compact au ton de marque (`-end-*` et non `-right-*` : le PMS est RTL).
const RECOMMENDED_BADGE_CLASS =
  'absolute -top-[10px] -end-[4px] flex items-center gap-[1.5px] px-[4.5px] py-[1.5px] rounded-[6px] bg-primary text-primary-foreground text-[9px] font-bold tracking-[0.03em]';

// ─── Component ──────────────────────────────────────────────────────────────

const ServiceRequestPriceEstimate: React.FC<ServiceRequestPriceEstimateProps> = React.memo(
  ({ property, forfaitConfigs, selectedForfaitKey }) => {
    const { convertAndFormat } = useCurrency();
    // Use provided configs or fall back to defaults
    const forfaits = useMemo(
      () => forfaitConfigs ?? [],
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
      <Card className={CONTAINER_CLASS}>
        {/* Header */}
        <div className={HEADER_CLASS}>
          <div className={TITLE_ROW_CLASS}>
            <span className="inline-flex text-primary"><AutoAwesome size={18} strokeWidth={1.75} /></span>
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Estimation du prix
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex text-faint cursor-help"><Info size={14} strokeWidth={1.75} /></span>
            </TooltipTrigger>
            <TooltipContent>
              Estimation indicative basée sur les caractéristiques du logement. Le tarif définitif est soumis à l'acceptation du prestataire.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Aucune propriété sélectionnée */}
        {!property && (
          <Alert variant="info" className={NOTICE_CLASS}>
            <InfoOutlined size={16} strokeWidth={1.75} />
            <AlertDescription>
              Sélectionnez une propriété pour afficher l'estimation du prix et de la durée.
            </AlertDescription>
          </Alert>
        )}

        {/* Avertissement données minimales (propriété sélectionnée mais données incomplètes) */}
        {property && !hasRichData && (
          <Alert variant="info" className={NOTICE_CLASS}>
            <InfoOutlined size={16} strokeWidth={1.75} />
            <AlertDescription>
              {canEstimate
                ? 'Estimation approximative — renseignez la surface et le tarif de base dans la fiche logement pour une estimation plus précise.'
                : 'Renseignez les caractéristiques du logement (chambres, surface, tarif de base) pour afficher une estimation.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Duration banner */}
        {property && (
          <div className={cn(DURATION_BANNER_CLASS, !hasRichData && 'mt-[9px]')}>
            <span className="inline-flex text-primary"><Timer size={18} strokeWidth={1.75} /></span>
            <div className="flex items-baseline gap-0.5">
              <p className="text-[16px] font-semibold text-primary leading-[1.2] font-[family-name:var(--font-display)] tabular-nums">
                {formatDuration(estimatedDuration)}
              </p>
              <p className="text-[10.5px] font-medium text-muted-foreground">
                durée estimée
              </p>
            </div>
            <p className="text-2xs text-faint italic ms-auto">
              Calculée automatiquement
            </p>
          </div>
        )}

        {/* Price cards */}
        {estimates.length > 0 && (
          <div className={CARDS_ROW_CLASS}>
            {estimates.map(({ key, label, min, max }) => {
              const isSelected = selectedForfaitKey === key;
              const isDefault = !selectedForfaitKey && key === 'CLEANING';
              const isHighlighted = isSelected || isDefault;
              return (
                <div key={key} className={cn(PRICE_CARD_CLASS, isHighlighted && PRICE_CARD_PRIMARY_CLASS)}>
                  {isSelected && (
                    <div className={RECOMMENDED_BADGE_CLASS}>
                      <Star size={8} strokeWidth={1.75} fill="currentColor" />
                      Recommandé
                    </div>
                  )}
                  <StatusChip
                    tokens={isHighlighted
                      ? { color: 'var(--bui-primary)', bg: 'var(--bui-card)' }
                      : { color: 'var(--bui-muted-foreground)', bg: 'var(--bui-muted)' }}
                    label={label}
                    className={cn(TIER_CHIP_CLASS, isHighlighted && 'border border-solid border-primary')}
                  />
                  <p className={cn('font-semibold tabular-nums whitespace-nowrap leading-[1.2] font-[family-name:var(--font-display)]', isHighlighted ? 'text-[18px]' : 'text-[16px]', isHighlighted ? 'text-primary' : 'text-foreground')}>
                    {min === max ? <Money value={min} from="EUR" /> : `${convertAndFormat(min, 'EUR')} – ${convertAndFormat(max, 'EUR')}`}
                  </p>
                  <p className="text-2xs text-faint leading-[1]">
                    par intervention
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Placeholder price cards quand pas de propriété */}
        {!property && (
          <div className={cn(CARDS_ROW_CLASS, 'mt-[9px]')}>
            {forfaits.map((forfait, index) => {
              const isFirst = index === 0;
              return (
                <div key={forfait.key} className={cn(PRICE_CARD_CLASS, 'opacity-40')}>
                  <StatusChip
                    tone="neutral"
                    label={forfait.label}
                    className={TIER_CHIP_CLASS}
                  />
                  <p className={cn('font-semibold text-faint whitespace-nowrap leading-[1.2] font-[family-name:var(--font-display)]', isFirst ? 'text-[18px]' : 'text-[16px]')}>
                    —
                  </p>
                  <p className="text-2xs text-faint leading-[1]">
                    par intervention
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Base note */}
        <div className="flex items-center gap-0.5 mt-1.5">
          <span className="inline-flex text-faint"><TrendingUp size={11} strokeWidth={1.75} /></span>
          <p className="text-2xs text-faint italic">
            Basé sur les caractéristiques du logement
          </p>
        </div>
      </Card>
    );
  }
);

ServiceRequestPriceEstimate.displayName = 'ServiceRequestPriceEstimate';

export default ServiceRequestPriceEstimate;
