import React from 'react';
import { AccessTime } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { UseReservationFormResult } from './useReservationForm';
import { Field, FieldLabel, InputGroup, InputGroupAddon, InputGroupInput } from '../ui';
import ReservationRangeCalendar from './ReservationRangeCalendar';

interface Props {
  form: UseReservationFormResult;
}

// Transposition en classes de SEC_SX (.rm-sec) — la constante reste exportee
// dans reservationDialogStyles pour les consommateurs sx eventuels.
const SEC_CLS = 'cn-text-body1 text-[10.5px] font-bold tracking-[0.08em] uppercase text-[var(--faint)]';

/** Dates du séjour : calendrier range (ou dates read-only si source externe) + heures. */
const StaySection: React.FC<Props> = ({ form }) => {
  const { t } = useTranslation();

  return (
    <>
      <p className={SEC_CLS}>{t('reservations.dialog.stayDates')}</p>

      {form.fieldsLocked ? (
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          {[
            { label: t('reservations.fields.checkIn'), value: form.startDate },
            { label: t('reservations.fields.checkOut'), value: form.endDate },
          ].map((f) => (
            <div key={f.label} className="rounded-[11px] border border-solid border-[var(--field-line)] bg-[var(--field)] px-3 py-2">
              <p className="cn-text-body1 text-[10.5px] font-semibold text-[var(--muted)]">{f.label}</p>
              <p className="cn-text-body1 text-[13.5px] font-semibold text-[var(--ink)] tabular-nums">{f.value || '—'}</p>
            </div>
          ))}
        </div>
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
      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <Field>
          <FieldLabel htmlFor="stay-check-in-time">{t('reservations.fields.checkIn')}</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <AccessTime size={15} strokeWidth={1.75} />
            </InputGroupAddon>
            <InputGroupInput
              id="stay-check-in-time"
              type="time"
              value={form.checkInTime}
              onChange={(e) => form.setCheckInTime(e.target.value)}
              disabled={form.fieldsLocked}
            />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="stay-check-out-time">{t('reservations.fields.checkOut')}</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <AccessTime size={15} strokeWidth={1.75} />
            </InputGroupAddon>
            <InputGroupInput
              id="stay-check-out-time"
              type="time"
              value={form.checkOutTime}
              onChange={(e) => form.setCheckOutTime(e.target.value)}
              disabled={form.fieldsLocked}
            />
          </InputGroup>
        </Field>
      </div>
    </>
  );
};

export default StaySection;
