import React from 'react';
import { Box, Typography, TextField, Tooltip, CircularProgress } from '@mui/material';
import { Edit as EditIcon, RemoveCircleOutline as MinusCircleIcon, Percent } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { UseReservationFormResult } from './useReservationForm';
import { SEC_SX, FIELD_SX, SEG_WRAP_SX, segBtnSx } from './reservationDialogStyles';

interface Props {
  form: UseReservationFormResult;
}

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px 0' }}>
      {form.nightDates.map((d, i) => (
        <Box key={d} sx={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontVariantNumeric: 'tabular-nums' }}>
          <span>{d}</span>
          <b>{(form.nightlyPrices[i] ?? 0).toFixed(2)} €</b>
        </Box>
      ))}
    </Box>
  );

  const baseValue = form.baseNightlyAvg > 0
    ? `${form.priceVaries ? '≈ ' : ''}${form.baseNightlyAvg.toFixed(2)}`
    : '';

  const baseField = (
    <TextField
      label={t('reservations.dialog.basePerNight')}
      value={baseValue}
      fullWidth
      disabled
      InputProps={{
        startAdornment: <Box component="span" sx={{ color: 'var(--faint)', fontSize: '14px', fontWeight: 600 }}>€</Box>,
        endAdornment: form.pricingLoading ? (
          <CircularProgress size={14} sx={{ color: 'var(--accent)' }} />
        ) : form.priceVaries ? (
          <Box
            component="span"
            sx={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--accent)',
              backgroundColor: 'var(--accent-soft)',
              borderRadius: '6px',
              padding: '2px 6px',
              whiteSpace: 'nowrap',
            }}
          >
            {t('reservations.dialog.priceVariable')}
          </Box>
        ) : undefined,
      }}
      InputLabelProps={{ shrink: true }}
      sx={{ ...FIELD_SX, '& .MuiOutlinedInput-input': { fontVariantNumeric: 'tabular-nums' } }}
    />
  );

  return (
    <>
      <Typography sx={SEC_SX}>{t('reservations.dialog.pricingSection')}</Typography>

      {/* Base /nuit (dynamique, lecture seule) + override */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {form.priceVaries ? (
          <Tooltip title={nightBreakdown} arrow placement="top">
            <Box>{baseField}</Box>
          </Tooltip>
        ) : (
          baseField
        )}
        <TextField
          label={form.pricingLabel}
          type="number"
          value={form.pricingValue}
          onChange={(e) => form.setPricingValue(e.target.value)}
          fullWidth
          disabled={locked}
          placeholder="—"
          inputProps={{ min: 0, step: 0.01 }}
          InputLabelProps={{ shrink: true }}
          sx={FIELD_SX}
        />
      </Box>

      {/* Onglets tarification (.rm-tariftabs) */}
      <Box sx={{ ...SEG_WRAP_SX, width: '100%', opacity: locked ? 0.5 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
        <Box
          component="button"
          type="button"
          onClick={() => form.selectPricingMode('custom')}
          sx={{ ...segBtnSx(form.pricingMode === 'custom'), flex: 1, gap: '5px', padding: '7px' }}
        >
          <EditIcon size={13} strokeWidth={1.75} />
          {t('reservations.dialog.tabCustom')}
        </Box>
        <Box
          component="button"
          type="button"
          onClick={() => form.selectPricingMode('discount_euro')}
          sx={{ ...segBtnSx(form.pricingMode === 'discount_euro'), flex: 1, gap: '5px', padding: '7px' }}
        >
          <MinusCircleIcon size={13} strokeWidth={1.75} />
          {t('reservations.dialog.tabDiscountEuro')}
        </Box>
        <Box
          component="button"
          type="button"
          onClick={() => form.selectPricingMode('discount_percent')}
          sx={{ ...segBtnSx(form.pricingMode === 'discount_percent'), flex: 1, gap: '5px', padding: '7px' }}
        >
          <Percent size={13} strokeWidth={1.75} />
          {t('reservations.dialog.tabDiscountPercent')}
        </Box>
      </Box>

      {/* Récap (.rm-recap) */}
      {form.numberOfNights > 0 && (
        <Box sx={{ backgroundColor: 'var(--accent-soft)', borderRadius: '12px', padding: '14px 16px' }}>
          <Typography sx={{ fontSize: '13px', color: 'var(--body)', fontVariantNumeric: 'tabular-nums' }}>
            {form.nightsText} · {t('reservations.dialog.accommodation')} :{' '}
            <Box component="b" sx={{ color: 'var(--ink)' }}>{form.baseAccommodationTotal.toFixed(2)} €</Box>
            {form.priceVaries && (
              <Box component="span" sx={{ color: 'var(--accent)', fontWeight: 600 }}> · {t('reservations.dialog.priceVariable')}</Box>
            )}
          </Typography>
          {overrideActive && (
            <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              {form.pricingLabel} → {t('reservations.dialog.accommodation')} : {form.accommodationTotal.toFixed(2)} €
            </Typography>
          )}
          {form.cleaningFeeAmount > 0 && (
            <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              + {t('reservations.dialog.cleaningLine')} : {form.cleaningFeeAmount.toFixed(2)} €
            </Typography>
          )}
          {form.touristTaxAmount > 0 && (
            <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              + {t('reservations.dialog.touristTaxLine')} : {form.touristTaxAmount.toFixed(2)} €
            </Typography>
          )}
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: '17px',
              fontWeight: 600,
              color: 'var(--accent-deep)',
              marginTop: '6px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {t('reservations.dialog.total')} : {form.totalPrice.toFixed(2)} €
          </Typography>
        </Box>
      )}
    </>
  );
};

export default PricingSection;
