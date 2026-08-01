import React from 'react';
import { Typography, Tooltip } from '@mui/material';
import { Field, FieldLabel, FieldDescription, InputGroup, InputGroupInput, InputGroupAddon } from '../ui';
import { CheckCircle, CreditCard, Mail } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import type { UseReservationFormResult } from './useReservationForm';
import { SEC_SX } from './reservationDialogStyles';

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
    '[font-family:inherit] text-[12px] font-semibold whitespace-nowrap cursor-pointer',
    'transition-[background-color,color] duration-[140ms]',
    'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1',
    on
      ? 'bg-[var(--card)] text-[var(--accent)] shadow-[0_1px_3px_rgba(21,36,45,.12)]'
      : 'bg-transparent text-[var(--muted)] shadow-none',
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
      <div className="inline-flex w-full gap-[2px] p-[3px] rounded-[10px] border border-solid border-[var(--field-line)] bg-[var(--field)]">
        <Tooltip title={t('reservations.dialog.confirmNowHint')} arrow>
          <button
            type="button"
            onClick={() => form.setPaymentIntent('confirm_now')}
            className={segBtnClass(form.paymentIntent === 'confirm_now')}
          >
            <CheckCircle size={14} strokeWidth={1.75} />
            {t('reservations.dialog.confirmNow')}
          </button>
        </Tooltip>
        <Tooltip title={t('reservations.dialog.requestPaymentHint')} arrow>
          <button
            type="button"
            onClick={() => form.setPaymentIntent('request_payment')}
            className={segBtnClass(form.paymentIntent === 'request_payment')}
          >
            <CreditCard size={14} strokeWidth={1.75} />
            {t('reservations.dialog.requestPayment')}
          </button>
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
          <FieldDescription className="text-[11px] text-[var(--accent)]">
            {t('reservations.dialog.paymentEmailHelp')}
          </FieldDescription>
        </Field>
      )}

      {/* Récapitulatif lecture seule */}
      <div className="flex flex-col gap-[10px] rounded-[12px] border border-solid border-[var(--line)] bg-[var(--surface-2)] px-[18px] py-4">
        <Typography sx={SEC_SX}>{t('reservations.dialog.recapTitle')}</Typography>
        {recapRows.map((row) => (
          <div className="flex items-baseline justify-between gap-3" key={row.label}>
            <p className="cn-text-body1 text-[12px] font-semibold text-[var(--muted)] shrink-0">{row.label}</p>
            <p className="cn-text-body1 text-[13px] font-semibold text-[var(--ink)] text-end tabular-nums">{row.value}</p>
          </div>
        ))}
        <div className="h-px my-[2px] bg-[var(--line)]" />
        <div className="flex items-baseline justify-between gap-3">
          <p className="cn-text-body1 text-[12px] font-bold text-[var(--ink)]">{t('reservations.dialog.recapTotal')}</p>
          <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--accent-deep)] tabular-nums">
            {form.totalPrice.toFixed(2)} €
          </p>
        </div>
      </div>
    </>
  );
};

export default FinalizeStep;
