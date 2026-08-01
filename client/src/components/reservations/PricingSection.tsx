import React from 'react';
import { Spinner } from '../ui';
import { Field, FieldLabel, Input, InputGroup, InputGroupInput, InputGroupAddon } from '../ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui';
import { Edit as EditIcon, RemoveCircleOutline as MinusCircleIcon, Percent } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import type { UseReservationFormResult } from './useReservationForm';

interface Props {
  form: UseReservationFormResult;
}

// Equivalent classes de segBtnSx (reservationDialogStyles) avec les surcharges
// locales de cet ecran : flex 1, gap 5px, padding uniforme 7px.
const segTabCls = (on: boolean) =>
  cn(
    'inline-flex flex-1 cursor-pointer items-center justify-center gap-[5px] rounded-[7px] border-0 p-[7px]',
    '[font-family:inherit] text-[12px] font-semibold whitespace-nowrap',
    'transition-[background,color] duration-[140ms]',
    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]',
    on
      ? 'bg-[var(--card)] text-[var(--accent)] shadow-[0_1px_3px_rgba(21,36,45,.12)]'
      : 'bg-transparent text-[var(--muted)] shadow-none',
  );

// Transposition en classes de SEC_SX (.rm-sec) — la constante reste exportee
// dans reservationDialogStyles pour les consommateurs sx eventuels.
const SEC_CLS = 'cn-text-body1 text-[10.5px] font-bold tracking-[0.08em] uppercase text-[var(--faint)]';

// Ligne de detail du recap (override / menage / taxe de sejour).
const RECAP_LINE_CLS = 'cn-text-body1 text-[12.5px] text-[var(--muted)] mt-[2px] tabular-nums';

/**
 * Tarification : base /nuit DYNAMIQUE (PriceEngine, lecture seule) + override
 * (custom / réduction € / réduction % appliquée sur le TOTAL du séjour) + récap.
 */
const PricingSection: React.FC<Props> = ({ form }) => {
  const { t } = useTranslation();
  const locked = form.fieldsLocked;
  const overrideActive = form.pricingValue !== '' && !isNaN(parseFloat(form.pricingValue));

  // Détail par nuit (tooltip) : date → prix.
  const nightBreakdown = (
    <div className="flex flex-col gap-[2px] py-[2px]">
      {form.nightDates.map((d, i) => (
        <div className="flex justify-between gap-3.5 tabular-nums" key={d}>
          <span>{d}</span>
          <b>{(form.nightlyPrices[i] ?? 0).toFixed(2)} €</b>
        </div>
      ))}
    </div>
  );

  const baseValue = form.baseNightlyAvg > 0
    ? `${form.priceVaries ? '≈ ' : ''}${form.baseNightlyAvg.toFixed(2)}`
    : '';

  const baseField = (
    <Field>
      <FieldLabel htmlFor="pricing-base-per-night">{t('reservations.dialog.basePerNight')}</FieldLabel>
      <InputGroup>
        <InputGroupAddon>
          <span className="text-[var(--faint)] text-[14px] font-semibold">€</span>
        </InputGroupAddon>
        <InputGroupInput
          id="pricing-base-per-night"
          className="tabular-nums"
          value={baseValue}
          disabled
        />
        {(form.pricingLoading || form.priceVaries) && (
          <InputGroupAddon align="inline-end">
            {form.pricingLoading ? (
              <Spinner className="size-3.5 text-[var(--accent)]" />
            ) : (
              <span className="rounded-[6px] bg-[var(--accent-soft)] px-1.5 py-[2px] text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap text-[var(--accent)]">
                {t('reservations.dialog.priceVariable')}
              </span>
            )}
          </InputGroupAddon>
        )}
      </InputGroup>
    </Field>
  );

  return (
    <>
      <p className={SEC_CLS}>{t('reservations.dialog.pricingSection')}</p>

      {/* Base /nuit (dynamique, lecture seule) + override */}
      <div className="grid grid-cols-[1fr_1fr] gap-3">
        {form.priceVaries ? (
          <Tooltip>
            {/* Le trigger enveloppe le <div> (element hote) : Radix y pose sa ref
                d'ancrage, ce qu'un composant fonction React 18 ne peut recevoir. */}
            <TooltipTrigger asChild>
              <div>{baseField}</div>
            </TooltipTrigger>
            <TooltipContent side="top">{nightBreakdown}</TooltipContent>
          </Tooltip>
        ) : (
          baseField
        )}
        <Field>
          <FieldLabel htmlFor="pricing-override">{form.pricingLabel}</FieldLabel>
          <Input
            id="pricing-override"
            type="number"
            min={0}
            step={0.01}
            className="tabular-nums"
            value={form.pricingValue}
            onChange={(e) => form.setPricingValue(e.target.value)}
            disabled={locked}
            placeholder="—"
          />
        </Field>
      </div>

      {/* Onglets tarification (.rm-tariftabs) */}
      <div
        className={cn(
          'inline-flex w-full gap-[2px] rounded-[10px] border border-solid border-[var(--field-line)] bg-[var(--field)] p-[3px]',
          locked && 'opacity-50 pointer-events-none',
        )}
      >
        <button type="button" onClick={() => form.selectPricingMode('custom')} className={segTabCls(form.pricingMode === 'custom')}>
          <EditIcon size={13} strokeWidth={1.75} />
          {t('reservations.dialog.tabCustom')}
        </button>
        <button type="button" onClick={() => form.selectPricingMode('discount_euro')} className={segTabCls(form.pricingMode === 'discount_euro')}>
          <MinusCircleIcon size={13} strokeWidth={1.75} />
          {t('reservations.dialog.tabDiscountEuro')}
        </button>
        <button type="button" onClick={() => form.selectPricingMode('discount_percent')} className={segTabCls(form.pricingMode === 'discount_percent')}>
          <Percent size={13} strokeWidth={1.75} />
          {t('reservations.dialog.tabDiscountPercent')}
        </button>
      </div>

      {/* Récap (.rm-recap) */}
      {form.numberOfNights > 0 && (
        <div className="rounded-[12px] bg-[var(--accent-soft)] px-4 py-[14px]">
          <p className="cn-text-body1 text-[13px] text-[var(--body)] tabular-nums">
            {form.nightsText} · {t('reservations.dialog.accommodation')} :{' '}
            <b className="text-[var(--ink)]">{form.baseAccommodationTotal.toFixed(2)} €</b>
            {form.priceVaries && (
              <span className="text-[var(--accent)] font-semibold"> · {t('reservations.dialog.priceVariable')}</span>
            )}
          </p>
          {overrideActive && (
            <p className={RECAP_LINE_CLS}>
              {form.pricingLabel} → {t('reservations.dialog.accommodation')} : {form.accommodationTotal.toFixed(2)} €
            </p>
          )}
          {form.cleaningFeeAmount > 0 && (
            <p className={RECAP_LINE_CLS}>
              + {t('reservations.dialog.cleaningLine')} : {form.cleaningFeeAmount.toFixed(2)} €
            </p>
          )}
          {form.touristTaxAmount > 0 && (
            <p className={RECAP_LINE_CLS}>
              + {t('reservations.dialog.touristTaxLine')} : {form.touristTaxAmount.toFixed(2)} €
            </p>
          )}
          <p className="cn-text-body1 [font-family:var(--font-display)] text-[17px] font-semibold text-[var(--accent-deep)] mt-[6px] tabular-nums">
            {t('reservations.dialog.total')} : {form.totalPrice.toFixed(2)} €
          </p>
        </div>
      )}
    </>
  );
};

export default PricingSection;
