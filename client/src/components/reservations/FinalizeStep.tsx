import React from 'react';
import {
  Field,
  FieldLabel,
  FieldDescription,
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui';
import { CheckCircle, CreditCard, Mail } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import type { UseReservationFormResult } from './useReservationForm';

/** Transcription de `SEC_SX` (reservationDialogStyles) — overline de section .rm-sec. */
const SEC_CLASS = 'text-2xs font-bold tracking-[0.08em] uppercase text-faint';

interface Props {
  form: UseReservationFormResult;
}

/**
 * Transcription de `segBtnSx` (reservationDialogStyles) en classes : seuls le fond,
 * la couleur et l'ombre dependent de l'etat actif. `background: none` du sx d'origine
 * devient `bg-transparent` — sans lui le bouton reprendrait le fond gris de l'UA.
 */
const segBtnClass = (on: boolean) =>
  cn(
    'inline-flex flex-1 items-center justify-center gap-[6px] border-0 rounded-[7px] p-[9px]',
    '[font-family:inherit] text-xs font-semibold whitespace-nowrap cursor-pointer',
    'transition-[background-color,color] duration-[140ms]',
    'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1',
    on
      ? 'bg-card text-primary shadow-sm'
      : 'bg-transparent text-muted-foreground shadow-none',
  );

/** Étape 4 : intention de paiement + email du lien (si demande de paiement) + récapitulatif. */
const FinalizeStep: React.FC<Props> = ({ form }) => {
  const { t } = useTranslation();

  const recapRows: Array<{ label: string; value: string }> = [
    { label: t('reservations.dialog.recapProperty'), value: form.propertyName || '—' },
    {
      label: t('reservations.dialog.recapDates'),
      value: form.startDate && form.endDate ? `${form.startDate} → ${form.endDate} · ${form.nightsText}` : '—',
    },
    { label: t('reservations.dialog.recapGuest'), value: form.selectedGuest?.fullName || '—' },
  ];

  return (
    <>
      {/* Intention : confirmer maintenant / demander le paiement (déplacé de l'entête) */}
      <div className="inline-flex w-full gap-[2px] p-[3px] rounded-lg border border-solid border-field-line bg-field">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => form.setPaymentIntent('confirm_now')}
              className={segBtnClass(form.paymentIntent === 'confirm_now')}
            >
              <CheckCircle size={14} strokeWidth={1.75} />
              {t('reservations.dialog.confirmNow')}
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('reservations.dialog.confirmNowHint')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => form.setPaymentIntent('request_payment')}
              className={segBtnClass(form.paymentIntent === 'request_payment')}
            >
              <CreditCard size={14} strokeWidth={1.75} />
              {t('reservations.dialog.requestPayment')}
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('reservations.dialog.requestPaymentHint')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Email destinataire du lien de paiement (déplacé de GuestSection) */}
      {form.requestPayment && (
        <Field>
          <FieldLabel htmlFor="finalize-payment-email">{t('reservations.dialog.paymentEmail')}</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Mail size={15} strokeWidth={1.75} />
            </InputGroupAddon>
            <InputGroupInput
              id="finalize-payment-email"
              type="email"
              required
              value={form.paymentEmail}
              onChange={(e) => form.setPaymentEmail(e.target.value)}
              placeholder={form.selectedGuest?.email || ''}
            />
          </InputGroup>
          <FieldDescription className="text-[11px] text-primary">
            {t('reservations.dialog.paymentEmailHelp')}
          </FieldDescription>
        </Field>
      )}

      {/* Récapitulatif lecture seule */}
      <div className="flex flex-col gap-[10px] rounded-[12px] border border-solid border-border bg-card px-[18px] py-4">
        <p className={SEC_CLASS}>{t('reservations.dialog.recapTitle')}</p>
        {recapRows.map((row) => (
          <div className="flex items-baseline justify-between gap-3" key={row.label}>
            <p className="text-xs font-semibold text-muted-foreground shrink-0">{row.label}</p>
            <p className="text-[13px] font-semibold text-foreground text-end tabular-nums">{row.value}</p>
          </div>
        ))}
        <div className="h-px my-[2px] bg-border" />
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-bold text-foreground">{t('reservations.dialog.recapTotal')}</p>
          <p className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-primary-deep tabular-nums">
            {form.totalPrice.toFixed(2)} €
          </p>
        </div>
      </div>
    </>
  );
};

export default FinalizeStep;
