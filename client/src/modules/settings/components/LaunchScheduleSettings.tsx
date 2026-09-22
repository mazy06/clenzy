import { useState } from 'react';
import { CalendarDays, Clock3, Pause } from 'lucide-react';
import { Button, Field, FieldLabel, Input } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSetLaunchSettings } from '../../../hooks/usePlatformSettings';
import type { PlatformSettings } from '../../../services/api/platformSettingsApi';
import SettingsToggleRow from './SettingsToggleRow';

function localDateTime(instant: string | null) {
  if (!instant) return '';
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Brouillon de formulaire local, persisté uniquement en base au clic Enregistrer. */
export default function LaunchScheduleSettings({
  settings,
}: {
  settings: PlatformSettings;
}) {
  const { t } = useTranslation();
  const mutation = useSetLaunchSettings();
  const [draft, setDraft] = useState<{
    paused: boolean;
    date: string;
    time: string;
  } | null>(null);
  const paused = draft?.paused ?? settings.registrationsPaused ?? true;
  const [savedDate = '', savedTime = ''] = localDateTime(
    settings.launchAt,
  ).split('T');
  const date = draft?.date ?? savedDate;
  const time = draft?.time ?? savedTime;
  const [invalidDate, setInvalidDate] = useState(false);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const description = `launch-date-hint${invalidDate ? ' launch-date-error' : ''}`;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const local = date && time ? `${date}T${time}` : '';
        const instant = local ? new Date(local) : null;
        if (
          Boolean(date) !== Boolean(time) ||
          (instant &&
            (!Number.isFinite(instant.getTime()) ||
              localDateTime(instant.toISOString()) !== local))
        ) {
          setInvalidDate(true);
          return;
        }
        setInvalidDate(false);
        mutation.mutate(
          {
            registrationsPaused: paused,
            launchAt: instant?.toISOString() ?? null,
            launchTimeZone: timeZone,
          },
          {
            onSuccess: () => setDraft(null),
          },
        );
      }}
      className="border-b border-border pb-5 mb-3"
    >
      <SettingsToggleRow
        icon={Pause}
        title={t('settings.launch.pauseRegistrations')}
        description={t('settings.launch.pauseHint')}
        checked={paused}
        onChange={(next) => {
          mutation.reset();
          setDraft({ paused: next, date, time });
        }}
        disabled={mutation.isPending}
        divider={false}
      />
      <fieldset className="min-w-0 pt-3">
        <legend className="text-sm font-semibold text-foreground">
          {t('settings.launch.dateLabel')}
        </legend>
        <div className="flex flex-wrap items-end gap-3 pt-3">
          <Field className="max-w-[240px] flex-1 min-w-[160px]">
            <FieldLabel htmlFor="launch-date">
              <CalendarDays size={16} />
              {t('settings.launch.launchDate')}
            </FieldLabel>
            <Input
              id="launch-date"
              type="date"
              value={date}
              className="tabular-nums"
              disabled={mutation.isPending}
              onChange={(event) => {
                mutation.reset();
                setInvalidDate(false);
                setDraft({ paused, date: event.target.value, time });
              }}
              aria-describedby={description}
              aria-invalid={invalidDate}
            />
          </Field>
          <Field className="w-[144px]">
            <FieldLabel htmlFor="launch-time">
              <Clock3 size={16} />
              {t('settings.launch.launchTime')}
            </FieldLabel>
            <Input
              id="launch-time"
              type="time"
              value={time}
              step={60}
              className="tabular-nums"
              disabled={mutation.isPending}
              onChange={(event) => {
                mutation.reset();
                setInvalidDate(false);
                setDraft({ paused, date, time: event.target.value });
              }}
              aria-describedby={description}
              aria-invalid={invalidDate}
            />
          </Field>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? t('settings.launch.saving')
              : t('settings.launch.save')}
          </Button>
          {(date || time) && (
            <Button
              type="button"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => {
                mutation.reset();
                setInvalidDate(false);
                setDraft({ paused, date: '', time: '' });
              }}
            >
              {t('settings.launch.clearDate')}
            </Button>
          )}
        </div>
        <p id="launch-date-hint" className="mt-2 text-xs text-muted-foreground">
          {t('settings.launch.dateHint', { timeZone })}
        </p>
        {invalidDate && (
          <p
            id="launch-date-error"
            role="alert"
            className="mt-2 text-sm text-destructive-ink"
          >
            {t('settings.launch.invalidDateTime')}
          </p>
        )}
      </fieldset>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('settings.launch.manualOpening')}
      </p>
      {mutation.isError && (
        <p role="alert" className="mt-2 text-sm text-destructive-ink">
          {t('settings.launch.saveError')}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="mt-2 text-sm text-success-ink">
          {t('settings.launch.saved')}
        </p>
      )}
    </form>
  );
}
