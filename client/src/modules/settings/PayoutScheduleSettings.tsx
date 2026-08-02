import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Spinner, Switch, Input } from '../../components/ui';
import { cn } from '../../utils/cn';
import { CalendarMonth } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import { usePayoutSchedule, useUpdatePayoutSchedule } from '../../hooks/usePayoutSchedule';
import SettingsSection from './components/SettingsSection';
import SettingSentence from '../../components/baitly/SettingSentence';

const VALID_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

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
    const { notify } = useNotification();
    const { data: config, isLoading } = usePayoutSchedule();
    const updateMutation = useUpdatePayoutSchedule();

    const [selectedDays, setSelectedDays] = useState<number[]>([1, 15]);
    const [gracePeriod, setGracePeriod] = useState(2);
    const [autoGenerate, setAutoGenerate] = useState(true);

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
        notify.error(t('settings.payoutSchedule.validationDays'));
        throw new Error('Validation: au moins un jour requis');
      }

      try {
        await updateMutation.mutateAsync({
          payoutDaysOfMonth: selectedDays,
          gracePeriodDays: gracePeriod,
          autoGenerateEnabled: autoGenerate,
        });
        notify.success(t('settings.payoutSchedule.saved'));
      } catch (err) {
        notify.error(t('settings.payoutSchedule.error'));
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
            size="sm"
            aria-label={t('settings.payoutSchedule.autoGenerate')}
            checked={autoGenerate}
            onCheckedChange={setAutoGenerate}
          />
        </div>

        {/* Days of month selector */}
        <div
          className={cn(
            'p-[9px] mb-[9px] rounded-[8px] border border-solid border-[var(--line)]',
            autoGenerate ? 'opacity-100 pointer-events-auto' : 'opacity-50 pointer-events-none',
          )}
          style={{ transition: 'opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)' }}
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
                <div
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
                  className={cn(
                    'min-w-[30px] h-[26px] px-1.5 rounded-[6px] inline-flex items-center justify-center',
                    'cursor-pointer select-none text-[0.72rem] tabular-nums tracking-[0.01em] border border-solid',
                    'focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]',
                    active
                      ? 'font-bold border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
                      : 'font-medium border-[var(--line)] bg-[var(--card)] text-[var(--ink)] hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:bg-[var(--accent-soft)]',
                  )}
                  style={{
                    transition:
                      'border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        {/* Délai de rappel — premier usage réel du primitive SettingSentence
            (projection « Réglages en phrase ») : la règle s'écrit telle
            qu'elle se lit, au lieu d'une pile libellé / champ. */}
        <div className="p-2 rounded-[8px] border border-[var(--line)]">
          <SettingSentence label={t('settings.payoutSchedule.gracePeriod')}>
            {t('settings.payoutSchedule.reminderSentenceStart', "Envoyer un rappel d'approbation")}
            <Input
              id="payout-grace-period"
              aria-label={t('settings.payoutSchedule.gracePeriod')}
              className="w-16 text-center tabular-nums font-semibold"
              type="number"
              min={0}
              max={30}
              value={gracePeriod}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 0 && val <= 30) setGracePeriod(val);
              }}
            />
            {t('settings.payoutSchedule.reminderSentenceEnd', 'jours après la génération.')}
          </SettingSentence>
        </div>
      </SettingsSection>
    );
  },
);

export default PayoutScheduleSettings;
