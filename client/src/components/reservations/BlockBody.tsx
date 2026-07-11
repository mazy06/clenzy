import React, { useState } from 'react';
import { Box, Typography, TextField, MenuItem, CircularProgress } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, Build } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { calendarPricingApi } from '../../services/api';
import { planningKeys } from '../../modules/planning/hooks/usePlanningData';
import { reservationsKeys } from '../../hooks/useReservations';
import { INTERVENTION_TYPE_TOKEN_COLORS } from '../../modules/planning/constants';
import type { UseReservationFormResult } from './useReservationForm';
import { SEC_SX, FIELD_SX, TEXTAREA_SX, FOOT_SX, BTN_GHOST_SX, BTN_PRIMARY_SX } from './reservationDialogStyles';
import PropertySelectField from './PropertySelectField';
import ReservationRangeCalendar from './ReservationRangeCalendar';
import ConflictAlert from './ConflictAlert';

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
      <Box sx={{ flex: 1, overflowY: 'auto', padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {form.showPropertySelector && <PropertySelectField form={form} />}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
        </Box>

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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ display: 'inline-flex', color: INTERVENTION_TYPE_TOKEN_COLORS.blocked }}>
                <Lock size={15} strokeWidth={1.75} />
              </Box>
              {t('reservations.dialog.blockTypeBlocked')}
            </Box>
          </MenuItem>
          <MenuItem value="MAINTENANCE">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ display: 'inline-flex', color: INTERVENTION_TYPE_TOKEN_COLORS.maintenance }}>
                <Build size={15} strokeWidth={1.75} />
              </Box>
              {t('reservations.dialog.blockTypeMaintenance')}
            </Box>
          </MenuItem>
        </TextField>

        {nights > 0 && (
          <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {nights} {t(nights > 1 ? 'reservations.dialog.blockNights' : 'reservations.dialog.blockNight')}
          </Typography>
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
          <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--err)' }}>{error}</Typography>
        )}
      </Box>

      <Box sx={{ ...FOOT_SX, justifyContent: 'flex-end' }}>
        <Box component="button" type="button" onClick={onClose} sx={BTN_GHOST_SX}>
          {t('common.cancel')}
        </Box>
        <Box
          component="button"
          type="button"
          onClick={handleBlock}
          disabled={saving || !canSubmit}
          sx={BTN_PRIMARY_SX}
        >
          {saving ? <CircularProgress size={15} /> : <Lock size={15} strokeWidth={2} />}
          {saving ? t('reservations.dialog.blockSubmitting') : t('reservations.dialog.blockSubmit')}
        </Box>
      </Box>
    </>
  );
};

export default BlockBody;
