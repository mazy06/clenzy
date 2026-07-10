import React from 'react';
import { Box, Typography, TextField, Tooltip } from '@mui/material';
import { CheckCircle, CreditCard, Mail } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { UseReservationFormResult } from './useReservationForm';
import { SEC_SX, SEG_WRAP_SX, segBtnSx, FIELD_SX, AdornIcon } from './reservationDialogStyles';

interface Props {
  form: UseReservationFormResult;
}

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
      <Box sx={{ ...SEG_WRAP_SX, width: '100%' }}>
        <Tooltip title={t('reservations.dialog.confirmNowHint')} arrow>
          <Box
            component="button"
            type="button"
            onClick={() => form.setPaymentIntent('confirm_now')}
            sx={{ ...segBtnSx(form.paymentIntent === 'confirm_now'), flex: 1, padding: '9px' }}
          >
            <CheckCircle size={14} strokeWidth={1.75} />
            {t('reservations.dialog.confirmNow')}
          </Box>
        </Tooltip>
        <Tooltip title={t('reservations.dialog.requestPaymentHint')} arrow>
          <Box
            component="button"
            type="button"
            onClick={() => form.setPaymentIntent('request_payment')}
            sx={{ ...segBtnSx(form.paymentIntent === 'request_payment'), flex: 1, padding: '9px' }}
          >
            <CreditCard size={14} strokeWidth={1.75} />
            {t('reservations.dialog.requestPayment')}
          </Box>
        </Tooltip>
      </Box>

      {/* Email destinataire du lien de paiement (déplacé de GuestSection) */}
      {form.requestPayment && (
        <TextField
          label={t('reservations.dialog.paymentEmail')}
          type="email"
          value={form.paymentEmail}
          onChange={(e) => form.setPaymentEmail(e.target.value)}
          placeholder={form.selectedGuest?.email || ''}
          required
          fullWidth
          InputLabelProps={{ shrink: true }}
          helperText={t('reservations.dialog.paymentEmailHelp')}
          InputProps={{ startAdornment: <AdornIcon><Mail size={15} strokeWidth={1.75} /></AdornIcon> }}
          sx={{ ...FIELD_SX, '& .MuiFormHelperText-root': { fontSize: '11px', color: 'var(--accent)', marginLeft: '2px' } }}
        />
      )}

      {/* Récapitulatif lecture seule */}
      <Box sx={{ borderRadius: '12px', border: '1px solid var(--line)', backgroundColor: 'var(--surface-2)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Typography sx={SEC_SX}>{t('reservations.dialog.recapTitle')}</Typography>
        {recapRows.map((row) => (
          <Box key={row.label} sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', flexShrink: 0 }}>{row.label}</Typography>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>{row.value}</Typography>
          </Box>
        ))}
        <Box sx={{ height: '1px', backgroundColor: 'var(--line)', margin: '2px 0' }} />
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>{t('reservations.dialog.recapTotal')}</Typography>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--accent-deep)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {form.totalPrice.toFixed(2)} €
          </Typography>
        </Box>
      </Box>
    </>
  );
};

export default FinalizeStep;
