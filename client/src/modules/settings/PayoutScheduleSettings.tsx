import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Spinner } from '../../components/ui';
import { Box, Switch, TextField, Alert, Snackbar } from '@mui/material';
import { CalendarMonth } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { usePayoutSchedule, useUpdatePayoutSchedule } from '../../hooks/usePayoutSchedule';
import SettingsSection from './components/SettingsSection';

const VALID_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

const ACCENT = 'var(--accent)';

const sameDays = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((v, i) => v === sortedB[i]);
};

export interface PayoutScheduleHandle {
  save: () => Promise<void>;
  hasChanges: () => boolean;
  isSaving: boolean;
  isValid: () => boolean;
}

interface PayoutScheduleSettingsProps {
  onChangeState?: () => void;
}

const PayoutScheduleSettings = forwardRef<PayoutScheduleHandle, PayoutScheduleSettingsProps>(
  function PayoutScheduleSettings({ onChangeState }, ref) {
    const { t } = useTranslation();
    const { data: config, isLoading } = usePayoutSchedule();
    const updateMutation = useUpdatePayoutSchedule();

    const [selectedDays, setSelectedDays] = useState<number[]>([1, 15]);
    const [gracePeriod, setGracePeriod] = useState(2);
    const [autoGenerate, setAutoGenerate] = useState(true);
    const [snackbar, setSnackbar] = useState({
      open: false,
      message: '',
      severity: 'success' as 'success' | 'error',
    });

    useEffect(() => {
      if (!config) return;
      setSelectedDays(config.payoutDaysOfMonth);
      setGracePeriod(config.gracePeriodDays);
      setAutoGenerate(config.autoGenerateEnabled);
    }, [config]);

    const baseline = useMemo(
      () => ({
        days: config?.payoutDaysOfMonth ?? [],
        gracePeriod: config?.gracePeriodDays ?? 0,
        autoGenerate: config?.autoGenerateEnabled ?? true,
      }),
      [config],
    );

    const toggleDay = (day: number) => {
      setSelectedDays((prev) =>
        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
      );
    };

    const hasChanges = () => {
      return (
        !sameDays(selectedDays, baseline.days) ||
        gracePeriod !== baseline.gracePeriod ||
        autoGenerate !== baseline.autoGenerate
      );
    };

    const isValid = () => selectedDays.length > 0;

    const handleSave = async () => {
      if (!isValid()) {
        setSnackbar({
          open: true,
          message: t('settings.payoutSchedule.validationDays'),
          severity: 'error',
        });
        throw new Error('Validation: au moins un jour requis');
      }

      try {
        await updateMutation.mutateAsync({
          payoutDaysOfMonth: selectedDays,
          gracePeriodDays: gracePeriod,
          autoGenerateEnabled: autoGenerate,
        });
        setSnackbar({
          open: true,
          message: t('settings.payoutSchedule.saved'),
          severity: 'success',
        });
      } catch (err) {
        setSnackbar({
          open: true,
          message: t('settings.payoutSchedule.error'),
          severity: 'error',
        });
        throw err;
      }
    };

    useEffect(() => {
      onChangeState?.();
    }, [selectedDays, gracePeriod, autoGenerate, updateMutation.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

    useImperativeHandle(ref, () => ({
      save: handleSave,
      hasChanges,
      isSaving: updateMutation.isPending,
      isValid,
    }));

    if (isLoading) {
      return (
        <SettingsSection
          title={t('settings.payoutSchedule.title')}
          icon={CalendarMonth}
          accent="info"
        >
          <div className="flex justify-center py-3">
            <Spinner className="size-6" />
          </div>
        </SettingsSection>
      );
    }

    return (
      <SettingsSection
        title={t('settings.payoutSchedule.title')}
        icon={CalendarMonth}
        accent="info"
        description={t('settings.payoutSchedule.subtitle')}
      >
        {/* Auto-generate toggle */}
        <div className="p-2 mb-2 rounded-[8px] border border-[var(--line)] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="cn-text-body1 text-[0.8125rem] font-semibold text-foreground leading-[1.3]">
              {t('settings.payoutSchedule.autoGenerate')}
            </p>
            <p className="cn-text-body1 text-[0.72rem] text-muted-foreground leading-[1.4] mt-0">
              {t('settings.payoutSchedule.autoGenerateHelper')}
            </p>
          </div>
          <Switch
            size="small"
            checked={autoGenerate}
            onChange={(e) => setAutoGenerate(e.target.checked)}
          />
        </div>

        {/* Days of month selector */}
        <Box
          sx={{
            p: 1.5,
            mb: 1.5,
            borderRadius: '8px',
            border: '1px solid',
            borderColor: 'divider',
            opacity: autoGenerate ? 1 : 0.5,
            pointerEvents: autoGenerate ? 'auto' : 'none',
            transition: 'opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <p className="cn-text-body1 text-[0.8125rem] font-semibold text-foreground leading-[1.3]">
            {t('settings.payoutSchedule.daysOfMonth')}
          </p>
          <p className="cn-text-body1 text-[0.72rem] text-muted-foreground leading-[1.4] mt-0 mb-2">
            {t('settings.payoutSchedule.daysOfMonthHelper')}
          </p>
          <div className="flex flex-wrap gap-0.5">
            {VALID_DAYS.map((day) => {
              const active = selectedDays.includes(day);
              return (
                <Box
                  key={day}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  onClick={() => toggleDay(day)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleDay(day);
                    }
                  }}
                  sx={{
                    minWidth: 30,
                    height: 26,
                    px: 1,
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontSize: '0.72rem',
                    fontWeight: active ? 700 : 500,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.01em',
                    border: '1px solid',
                    borderColor: active ? ACCENT : 'divider',
                    backgroundColor: active ? ACCENT : 'background.paper',
                    color: active ? 'var(--on-accent)' : 'text.primary',
                    transition:
                      'border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                    '&:hover': {
                      borderColor: active ? ACCENT : 'color-mix(in srgb, var(--accent) 40%, transparent)',
                      backgroundColor: active ? ACCENT : 'var(--accent-soft)',
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${ACCENT}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  {day}
                </Box>
              );
            })}
          </div>
        </Box>

        {/* Grace period */}
        <div className="p-2 rounded-[8px] border border-[var(--line)]">
          <p className="cn-text-body1 text-[0.8125rem] font-semibold text-foreground leading-[1.3]">
            {t('settings.payoutSchedule.gracePeriod')}
          </p>
          <p className="cn-text-body1 text-[0.72rem] text-muted-foreground leading-[1.4] mt-0 mb-1.5">
            {t('settings.payoutSchedule.gracePeriodHelper')}
          </p>
          <div className="inline-flex items-center gap-1">
            <TextField
              type="number"
              value={gracePeriod}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 0 && val <= 30) setGracePeriod(val);
              }}
              size="small"
              inputProps={{
                min: 0,
                max: 30,
                style: { textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
              }}
              sx={{ width: 80 }}
            />
            <p className="cn-text-body1 text-[0.72rem] text-muted-foreground font-semibold tracking-[0.02em]">
              {t('common.daysShort', 'jours')}
            </p>
          </div>
        </div>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          <Alert
            onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            sx={{ borderRadius: '8px' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </SettingsSection>
    );
  },
);

export default PayoutScheduleSettings;
