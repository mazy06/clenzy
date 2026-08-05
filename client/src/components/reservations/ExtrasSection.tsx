import React from 'react';
import { cn } from '../../utils/cn';
import {
  Field,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Switch,
  Textarea,
} from '../ui';
import { CleaningServices, Receipt as ReceiptIcon, Numbers as HashIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { UseReservationFormResult } from './useReservationForm';

interface Props {
  form: UseReservationFormResult;
}

/** Ménage + taxe de séjour + code de confirmation + notes. */
const ExtrasSection: React.FC<Props> = ({ form }) => {
  const { t } = useTranslation();
  const locked = form.fieldsLocked;

  return (
    <>
      {/* Toggle ménage (.rm-toggle) */}
      <Field
        orientation="horizontal"
        className={cn('w-[fit-content] gap-[11px]', locked ? 'opacity-50' : 'opacity-100')}
      >
        <Switch
          id="reservation-create-cleaning"
          checked={form.createCleaning}
          onCheckedChange={(checked) => form.setCreateCleaning(checked)}
          disabled={locked}
        />
        <FieldLabel
          htmlFor="reservation-create-cleaning"
          className={cn('flex items-center gap-[11px] text-[13.5px] font-semibold text-foreground', locked ? 'cursor-default' : 'cursor-pointer')}
        >
          <span className="inline-flex text-primary">
            <CleaningServices size={16} strokeWidth={1.75} />
          </span>
          {t('reservations.dialog.cleaningAtCheckout')}
        </FieldLabel>
      </Field>

      {/* Frais ménage (si toggle actif) + taxe de séjour */}
      <div className={cn('grid gap-3', form.createCleaning ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[1fr]')}>
        {form.createCleaning && (
          <Field>
            <FieldLabel htmlFor="reservation-cleaning-fee">
              {t('reservations.dialog.cleaningFee')}
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <span className="inline-flex text-faint">
                  <CleaningServices size={15} strokeWidth={1.75} />
                </span>
              </InputGroupAddon>
              <InputGroupInput
                id="reservation-cleaning-fee"
                type="number"
                min={0}
                step={0.01}
                disabled={locked}
                value={form.cleaningFee}
                onChange={(e) => form.setCleaningFee(e.target.value)}
                placeholder={form.estimatedCleaningPrice ? String(form.estimatedCleaningPrice) : '0'}
              />
            </InputGroup>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="reservation-tourist-tax">
            {t('reservations.dialog.touristTaxPerPerson')}
          </FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <span className="inline-flex text-faint">
                <ReceiptIcon size={15} strokeWidth={1.75} />
              </span>
            </InputGroupAddon>
            <InputGroupInput
              id="reservation-tourist-tax"
              type="number"
              min={0}
              step={0.01}
              disabled={locked}
              value={form.touristTaxPerPerson}
              onChange={(e) => form.setTouristTaxPerPerson(e.target.value)}
              placeholder="0"
            />
            {form.touristTaxAmount > 0 && (
              <InputGroupAddon align="inline-end">
                <span className="text-[11.5px] font-semibold whitespace-nowrap text-muted-foreground tabular-nums">
                  = {form.touristTaxAmount.toFixed(2)} €
                </span>
              </InputGroupAddon>
            )}
          </InputGroup>
        </Field>
      </div>
      {form.createCleaning && form.estimatedCleaningPrice != null && form.estimatedCleaningPrice > 0 && (
        <p className="text-[11.5px] text-muted-foreground italic -mt-3">
          {t('reservations.dialog.estimatedCleaning', { amount: form.estimatedCleaningPrice.toFixed(2) })}
        </p>
      )}

      {/* Code de confirmation */}
      <Field>
        <FieldLabel htmlFor="reservation-confirmation-code">
          {t('reservations.fields.confirmationCode')}
        </FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <span className="inline-flex text-faint">
              <HashIcon size={15} strokeWidth={1.75} />
            </span>
          </InputGroupAddon>
          <InputGroupInput
            id="reservation-confirmation-code"
            disabled={locked}
            value={form.confirmationCode}
            onChange={(e) => form.setConfirmationCode(e.target.value)}
          />
        </InputGroup>
      </Field>

      {/* Notes (toujours éditable) */}
      <Field>
        <FieldLabel htmlFor="reservation-notes">{t('reservations.fields.notes')}</FieldLabel>
        <Textarea
          id="reservation-notes"
          rows={3}
          className="w-full"
          value={form.notes}
          onChange={(e) => form.setNotes(e.target.value)}
          placeholder={t('reservations.dialog.notesPlaceholder')}
        />
      </Field>
    </>
  );
};

export default ExtrasSection;
