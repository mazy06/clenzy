import React from 'react';
import { Box, Typography, TextField } from '@mui/material';
import { AccessTime } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { UseReservationFormResult } from './useReservationForm';
import { SEC_SX, FIELD_SX, AdornIcon } from './reservationDialogStyles';
import ReservationRangeCalendar from './ReservationRangeCalendar';

interface Props {
  form: UseReservationFormResult;
}

/** Dates du séjour : calendrier range (ou dates read-only si source externe) + heures. */
const StaySection: React.FC<Props> = ({ form }) => {
  const { t } = useTranslation();

  return (
    <>
      <Typography sx={SEC_SX}>{t('reservations.dialog.stayDates')}</Typography>

      {form.fieldsLocked ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[
            { label: t('reservations.fields.checkIn'), value: form.startDate },
            { label: t('reservations.fields.checkOut'), value: form.endDate },
          ].map((f) => (
            <Box key={f.label} sx={{ padding: '8px 12px', borderRadius: '11px', border: '1px solid var(--field-line)', backgroundColor: 'var(--field)' }}>
              <Typography sx={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--muted)' }}>{f.label}</Typography>
              <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{f.value || '—'}</Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <ReservationRangeCalendar
          startDate={form.startDate}
          endDate={form.endDate}
          onChangeStart={form.setStartDate}
          onChangeEnd={form.setEndDate}
          nights={form.numberOfNights}
          nightsText={form.nightsText}
          arrivalLabel={t('reservations.fields.checkIn')}
          departureLabel={t('reservations.fields.checkOut')}
          clearLabel={t('reservations.dialog.clearDates')}
          prevMonthLabel={t('reservations.dialog.prevMonth')}
          nextMonthLabel={t('reservations.dialog.nextMonth')}
          locale={form.locale}
          weekdayLabels={form.weekdayLabels}
        />
      )}

      {/* Heures arrivée / départ */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <TextField
          label={t('reservations.fields.checkIn')}
          type="time"
          value={form.checkInTime}
          onChange={(e) => form.setCheckInTime(e.target.value)}
          fullWidth
          disabled={form.fieldsLocked}
          InputProps={{ startAdornment: <AdornIcon><AccessTime size={15} strokeWidth={1.75} /></AdornIcon> }}
          InputLabelProps={{ shrink: true }}
          sx={FIELD_SX}
        />
        <TextField
          label={t('reservations.fields.checkOut')}
          type="time"
          value={form.checkOutTime}
          onChange={(e) => form.setCheckOutTime(e.target.value)}
          fullWidth
          disabled={form.fieldsLocked}
          InputProps={{ startAdornment: <AdornIcon><AccessTime size={15} strokeWidth={1.75} /></AdornIcon> }}
          InputLabelProps={{ shrink: true }}
          sx={FIELD_SX}
        />
      </Box>
    </>
  );
};

export default StaySection;
