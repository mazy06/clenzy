import React, { useState } from 'react';
import { Spinner } from '../ui';
import { Typography, TextField, MenuItem } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, Build } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { calendarPricingApi } from '../../services/api/calendarPricingApi';
import { planningKeys } from '../../modules/planning/hooks/usePlanningData';
import { reservationsKeys } from '../../hooks/useReservations';
import { INTERVENTION_TYPE_TOKEN_COLORS } from '../../modules/planning/constants';
import { cn } from '../../utils/cn';
import type { UseReservationFormResult } from './useReservationForm';
import { SEC_SX, FIELD_SX, TEXTAREA_SX } from './reservationDialogStyles';
import PropertySelectField from './PropertySelectField';
import ReservationRangeCalendar from './ReservationRangeCalendar';
import ConflictAlert from './ConflictAlert';

// Equivalent classes du BTN_BASE_SX de reservationDialogStyles (.s-btn) —
// le .ts partage reste la source pour les autres ecrans du dialogue.
const BTN_BASE_CLS =
  'inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-[11px] border border-solid border-transparent px-[17px] py-0 '
  + '[font-family:inherit] text-[12.5px] font-semibold '
  + '[transition:transform_.12s,background_.14s,border-color_.14s,color_.14s] enabled:active:scale-[.97] '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

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
          <Typography sx={SEC_SX}>{t('reservations.dialog.stayDates')}</Typography>
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

        <TextField
          select
          label={t('reservations.dialog.blockTypeLabel')}
          value={blockType}
          onChange={(e) => setBlockType(e.target.value as BlockType)}
          fullWidth
          InputLabelProps={{ shrink: true }}
          sx={FIELD_SX}
        >
          <MenuItem value="BLOCKED">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex" style={{ color: INTERVENTION_TYPE_TOKEN_COLORS.blocked }}>
                <Lock size={15} strokeWidth={1.75} />
              </span>
              {t('reservations.dialog.blockTypeBlocked')}
            </div>
          </MenuItem>
          <MenuItem value="MAINTENANCE">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex" style={{ color: INTERVENTION_TYPE_TOKEN_COLORS.maintenance }}>
                <Build size={15} strokeWidth={1.75} />
              </span>
              {t('reservations.dialog.blockTypeMaintenance')}
            </div>
          </MenuItem>
        </TextField>

        {nights > 0 && (
          <p className="cn-text-body1 text-[12.5px] text-[var(--muted)] tabular-nums">
            {nights} {t(nights > 1 ? 'reservations.dialog.blockNights' : 'reservations.dialog.blockNight')}
          </p>
        )}

        <TextField
          label={t('reservations.dialog.blockReason')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('reservations.dialog.blockReasonPlaceholder')}
          multiline
          minRows={2}
          fullWidth
          InputLabelProps={{ shrink: true }}
          sx={TEXTAREA_SX}
        />

        <ConflictAlert form={form} />

        {error && (
          <p className="cn-text-body1 text-[12.5px] font-semibold text-[var(--err)]">{error}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-solid border-[var(--line)] bg-[var(--surface-2)] px-[22px] py-[14px]">
        <button
          type="button"
          onClick={onClose}
          className={cn(BTN_BASE_CLS, 'bg-transparent text-[var(--muted)] hover:text-[var(--ink)]')}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleBlock}
          disabled={saving || !canSubmit}
          className={cn(
            BTN_BASE_CLS,
            'border-[var(--accent)] bg-transparent text-[var(--accent)]',
            'enabled:hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-45',
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
