import React, { useState } from 'react';
import { Spinner } from '../ui';
import {
  Field,
  FieldLabel,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from '../ui';
import { useQueryClient } from '@tanstack/react-query';
import { Lock } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { calendarPricingApi } from '../../services/api/calendarPricingApi';
import { planningKeys } from '../../modules/planning/hooks/usePlanningData';
import { reservationsKeys } from '../../hooks/useReservations';
import { cn } from '../../utils/cn';
import type { UseReservationFormResult } from './useReservationForm';
import PropertySelectField from './PropertySelectField';
import ReservationRangeCalendar from './ReservationRangeCalendar';
import ConflictAlert from './ConflictAlert';

// Equivalent classes du BTN_BASE_SX de reservationDialogStyles (.s-btn) —
// le .ts partage reste la source pour les autres ecrans du dialogue.
const BTN_BASE_CLS =
  'inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-[11px] border border-solid border-transparent px-[17px] py-0 '
  + '[font-family:inherit] text-[12.5px] font-semibold '
  + '[transition:transform_.12s,background_.14s,border-color_.14s,color_.14s] enabled:active:scale-[.97] '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

// Transposition en classes de SEC_SX (.rm-sec) — la constante reste exportee
// dans reservationDialogStyles pour les consommateurs sx eventuels.
const SEC_CLS = 'text-2xs font-bold tracking-[0.08em] uppercase text-faint';

type BlockType = 'BLOCKED' | 'MAINTENANCE';

interface Props {
  form: UseReservationFormResult;
  onClose: () => void;
}

// ─── Corps « Blocage » (écran unique) ──────────────────────────────────────────
//
// Unifié dans le dialogue de réservation : logement + calendrier 2 mois partagés
// avec la création de réservation, plus un type de blocage et une raison. Soumission
// vers calendarPricingApi.blockDates (label : préfixe « Maintenance » si type maintenance).
const BlockBody: React.FC<Props> = ({ form, onClose }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [blockType, setBlockType] = useState<BlockType>('BLOCKED');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!form.effectivePropertyId && !!form.startDate && !!form.endDate && !form.hasConflict;

  const handleBlock = async () => {
    if (!form.effectivePropertyId || !form.startDate || !form.endDate) {
      setError(t('reservations.dialog.blockErrorRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Label stocké : préfixe « Maintenance » (parité avec les blocages existants).
      const label = blockType === 'MAINTENANCE'
        ? `Maintenance${notes ? ' : ' + notes : ''}`
        : notes || undefined;

      await calendarPricingApi.blockDates(form.effectivePropertyId, form.startDate, form.endDate, label);

      queryClient.invalidateQueries({ queryKey: planningKeys.all });
      queryClient.invalidateQueries({ queryKey: reservationsKeys.all });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reservations.dialog.blockErrorFailed'));
    } finally {
      setSaving(false);
    }
  };

  const nights = form.numberOfNights;

  return (
    <>
      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-[22px]">
        {form.showPropertySelector && <PropertySelectField form={form} />}

        <div className="flex flex-col gap-2.5">
          <p className={SEC_CLS}>{t('reservations.dialog.stayDates')}</p>
          <ReservationRangeCalendar
            startDate={form.startDate}
            endDate={form.endDate}
            onChangeStart={form.setStartDate}
            onChangeEnd={form.setEndDate}
            nights={nights}
            nightsText={form.nightsText}
            arrivalLabel={t('reservations.fields.checkIn')}
            departureLabel={t('reservations.fields.checkOut')}
            clearLabel={t('reservations.dialog.clearDates')}
            prevMonthLabel={t('reservations.dialog.prevMonth')}
            nextMonthLabel={t('reservations.dialog.nextMonth')}
            locale={form.locale}
            weekdayLabels={form.weekdayLabels}
          />
        </div>

        {/* Un select natif ne peut pas peindre d icone dans ses options :
            les pastilles Lock / Build de l ancien menu MUI disparaissent. */}
        <Field>
          <FieldLabel htmlFor="block-type">{t('reservations.dialog.blockTypeLabel')}</FieldLabel>
          <NativeSelect
            id="block-type"
            className="w-full"
            value={blockType}
            onChange={(e) => setBlockType(e.target.value as BlockType)}
          >
            <NativeSelectOption value="BLOCKED">{t('reservations.dialog.blockTypeBlocked')}</NativeSelectOption>
            <NativeSelectOption value="MAINTENANCE">{t('reservations.dialog.blockTypeMaintenance')}</NativeSelectOption>
          </NativeSelect>
        </Field>

        {nights > 0 && (
          <p className="text-[12.5px] text-muted-foreground tabular-nums">
            {nights} {t(nights > 1 ? 'reservations.dialog.blockNights' : 'reservations.dialog.blockNight')}
          </p>
        )}

        <Field>
          <FieldLabel htmlFor="block-reason">{t('reservations.dialog.blockReason')}</FieldLabel>
          <Textarea
            id="block-reason"
            className="w-full"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('reservations.dialog.blockReasonPlaceholder')}
          />
        </Field>

        <ConflictAlert form={form} />

        {error && (
          <p className="text-[12.5px] font-semibold text-destructive-ink">{error}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-solid border-border bg-card px-[22px] py-[14px]">
        <button
          type="button"
          onClick={onClose}
          className={cn(BTN_BASE_CLS, 'bg-transparent text-muted-foreground hover:text-foreground')}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleBlock}
          disabled={saving || !canSubmit}
          className={cn(
            BTN_BASE_CLS,
            'border-primary bg-transparent text-primary',
            'enabled:hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-45',
          )}
        >
          {saving ? <Spinner className="size-[15px]" /> : <Lock size={15} strokeWidth={2} />}
          {saving ? t('reservations.dialog.blockSubmitting') : t('reservations.dialog.blockSubmit')}
        </button>
      </div>
    </>
  );
};

export default BlockBody;
