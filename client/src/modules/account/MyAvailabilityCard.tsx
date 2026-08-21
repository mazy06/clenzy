import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  Separator,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
} from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/StatusChip';
import { AccessTime, Add, Close, DeleteOutline, EventAvailable, Save, Tune } from '../../icons';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import {
  myAvailabilityApi,
  type Absence,
  type WeeklySlotInput,
} from '../../services/api/myAvailabilityApi';

interface Props {
  onSaved?: () => void;
}

/** ISO-8601 : 1 = lundi … 7 = dimanche, comme cote serveur. */
const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';

/** « 09:00:00 » venant du serveur → « 09:00 » pour un <input type="time">. */
const toInputTime = (value: string) => value.slice(0, 5);

/** « 09:00 » → « 9 h », « 09:30 » → « 9 h 30 » : on lit une heure, pas une donnee. */
const humanTime = (value: string) => {
  const [h, m] = value.split(':');
  const hour = Number(h);
  return m && m !== '00' ? `${hour} h ${m}` : `${hour} h`;
};

export default function MyAvailabilityCard({ onSaved }: Props) {
  const { t } = useTranslation();
  const { notify } = useNotification();

  const [slots, setSlots] = useState<WeeklySlotInput[] | null>(null);
  const [absences, setAbsences] = useState<Absence[]>([]);
  /** Horaires par jour deplies : la majorite travaille aux memes heures. */
  const [perDay, setPerDay] = useState(false);
  const [commonStart, setCommonStart] = useState(DEFAULT_START);
  const [commonEnd, setCommonEnd] = useState(DEFAULT_END);
  const [absenceFormOpen, setAbsenceFormOpen] = useState(false);
  const [absenceStart, setAbsenceStart] = useState('');
  const [absenceEnd, setAbsenceEnd] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayLabel = (day: number) => t(`availability.days.${day}`, {
    1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi',
    5: 'Vendredi', 6: 'Samedi', 7: 'Dimanche',
  }[day] as string);

  /** Initiale du jour pour le selecteur : L M M J V S D. */
  const dayInitial = (day: number) => dayLabel(day).charAt(0).toUpperCase();

  useEffect(() => {
    myAvailabilityApi.getMine()
      .then((data) => {
        const loaded = data.weekly.map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          startTime: toInputTime(slot.startTime),
          endTime: toInputTime(slot.endTime),
        }));
        setSlots(loaded);
        setAbsences(data.absences);
        if (loaded.length > 0) {
          setCommonStart(loaded[0].startTime);
          setCommonEnd(loaded[0].endTime);
          // Horaires differents d'un jour a l'autre : on ouvre le detail, sinon
          // l'affichage commun mentirait sur ce qui est enregistre.
          setPerDay(loaded.some((slot) =>
            slot.startTime !== loaded[0].startTime || slot.endTime !== loaded[0].endTime));
        }
      })
      .catch(() => {
        setSlots([]);
        setError(t('availability.loadError', 'Impossible de charger vos disponibilités.'));
      });
  }, [t]);

  const activeDays = useMemo(() => (slots ?? []).map((slot) => String(slot.dayOfWeek)), [slots]);

  const toggleDays = (values: string[]) => {
    setSlots((prev) => {
      if (!prev) return prev;
      const wanted = values.map(Number).sort((a, b) => a - b);
      return wanted.map((day) => prev.find((slot) => slot.dayOfWeek === day) ?? {
        dayOfWeek: day,
        startTime: commonStart,
        endTime: commonEnd,
      });
    });
  };

  const updateSlot = (day: number, patch: Partial<WeeklySlotInput>) => {
    setSlots((prev) => prev?.map((slot) =>
      slot.dayOfWeek === day ? { ...slot, ...patch } : slot) ?? prev);
  };

  /** Horaires communs : ils s'appliquent a tous les jours coches d'un coup. */
  const applyCommon = (start: string, end: string) => {
    setCommonStart(start);
    setCommonEnd(end);
    setSlots((prev) => prev?.map((slot) => ({ ...slot, startTime: start, endTime: end })) ?? prev);
  };

  /**
   * Resume lisible de la semaine declaree : c'est ce qu'on vient verifier d'un
   * coup d'oeil. « Lun–Ven, 9 h – 17 h » en dit plus qu'un compteur de jours.
   */
  const summary = useMemo(() => {
    if (!slots || slots.length === 0) return null;
    const sorted = [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    const days = sorted.map((slot) => dayLabel(slot.dayOfWeek).slice(0, 3));
    const consecutive = sorted.every((slot, index) =>
      index === 0 || slot.dayOfWeek === sorted[index - 1].dayOfWeek + 1);
    const daysLabel = consecutive && sorted.length > 2
      ? `${days[0]} – ${days[days.length - 1]}`
      : days.join(', ');
    const sameHours = sorted.every((slot) =>
      slot.startTime === sorted[0].startTime && slot.endTime === sorted[0].endTime);
    const hours = sameHours
      ? `${humanTime(sorted[0].startTime)} – ${humanTime(sorted[0].endTime)}`
      : t('availability.variableHours', 'horaires variables');
    return `${daysLabel} · ${hours}`;
  }, [slots, t, dayLabel]);

  const saveWeekly = async () => {
    setSaving(true);
    setError(null);
    try {
      // Un creneau dont la fin precede le debut serait refuse par la contrainte
      // en base : on l'ecarte ici pour ne pas perdre tout l'enregistrement.
      const valid = (slots ?? []).filter((slot) => slot.endTime > slot.startTime);
      const saved = await myAvailabilityApi.replaceWeekly(valid);
      setSlots(saved.map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: toInputTime(slot.startTime),
        endTime: toInputTime(slot.endTime),
      })));
      notify.success(t('availability.saved', 'Disponibilités enregistrées'));
      onSaved?.();
    } catch {
      setError(t('availability.saveError', "L'enregistrement a échoué, réessayez."));
    } finally {
      setSaving(false);
    }
  };

  const addAbsence = async () => {
    if (!absenceStart || !absenceEnd) return;
    setError(null);
    try {
      const created = await myAvailabilityApi.addAbsence(absenceStart, absenceEnd, absenceReason || null);
      setAbsences((prev) => [...prev, created].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      setAbsenceStart('');
      setAbsenceEnd('');
      setAbsenceReason('');
      setAbsenceFormOpen(false);
    } catch {
      setError(t('availability.absenceError', "Impossible d'enregistrer cette absence."));
    }
  };

  const removeAbsence = async (id: number) => {
    await myAvailabilityApi.removeAbsence(id).catch(() => undefined);
    setAbsences((prev) => prev.filter((absence) => absence.id !== id));
  };

  if (slots === null) {
    return (
      <Card size="sm" className="shadow-none">
        <CardContent className="flex justify-center py-10"><Spinner className="size-6" /></CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert variant="destructive" className="py-1.5">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Semaine type ──────────────────────────────────────────────── */}
      <Card size="sm" className="shadow-none">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-foreground">
                {t('availability.weekTitle', 'Semaine type')}
              </p>
              {/* Le RESUME plutot qu'un compteur : on vient verifier ce qu'on a
                  declare, pas compter des jours. */}
              <p className="m-0 mt-0.5 text-xs text-muted-foreground tabular-nums">
                {summary ?? t('availability.alwaysAvailableLong',
                  'Aucun créneau déclaré — vous restez disponible à tout moment.')}
              </p>
            </div>
            <StatusChip
              tone={slots.length > 0 ? 'ok' : 'neutral'}
              label={slots.length > 0
                ? t('availability.limited', 'Horaires définis')
                : t('availability.alwaysAvailable', 'Toujours disponible')}
              size="sm"
              dot
            />
          </div>

          {/* Selecteur de jours : le pattern universel de la recurrence. Sept
              cibles de 44px sur une ligne, la ou sept lignes empilees faisaient
              defiler l'ecran. */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t('availability.workingDays', 'Jours travaillés')}
            </span>
            <ToggleGroup
              type="multiple"
              variant="outline"
              value={activeDays}
              onValueChange={toggleDays}
              className="flex-wrap"
            >
              {DAYS.map((day) => (
                <ToggleGroupItem
                  key={day}
                  value={String(day)}
                  aria-label={dayLabel(day)}
                  className="size-9 rounded-full text-sm font-semibold data-[state=on]:border-transparent data-[state=on]:bg-success-soft data-[state=on]:text-success-ink"
                >
                  {dayInitial(day)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {slots.length > 0 && (
            <>
              <Separator />

              {/* Horaires COMMUNS par defaut : saisir 9 h – 17 h cinq fois etait
                  la corvee de l'ancien ecran. Le detail par jour reste a un clic
                  pour qui en a besoin. */}
              {!perDay ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="common-start">
                      {t('availability.from', 'De')}
                    </label>
                    <Input
                      id="common-start"
                      type="time"
                      className="w-auto tabular-nums"
                      value={commonStart}
                      onChange={(event) => applyCommon(event.target.value, commonEnd)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="common-end">
                      {t('availability.to', 'à')}
                    </label>
                    <Input
                      id="common-end"
                      type="time"
                      className="w-auto tabular-nums"
                      value={commonEnd}
                      onChange={(event) => applyCommon(commonStart, event.target.value)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPerDay(true)}
                  >
                    <Tune size={16} strokeWidth={1.75} />
                    {t('availability.perDay', 'Horaires différents selon les jours')}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {[...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((slot) => (
                    <div key={slot.dayOfWeek} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-[92px] text-sm font-medium text-foreground">
                        {dayLabel(slot.dayOfWeek)}
                      </span>
                      <Input
                        type="time"
                        className="w-auto tabular-nums"
                        aria-label={`${dayLabel(slot.dayOfWeek)} — ${t('availability.from', 'De')}`}
                        value={slot.startTime}
                        onChange={(event) => updateSlot(slot.dayOfWeek, { startTime: event.target.value })}
                      />
                      <span className="text-xs text-muted-foreground">{t('availability.to', 'à')}</span>
                      <Input
                        type="time"
                        className="w-auto tabular-nums"
                        aria-label={`${dayLabel(slot.dayOfWeek)} — ${t('availability.to', 'à')}`}
                        value={slot.endTime}
                        onChange={(event) => updateSlot(slot.dayOfWeek, { endTime: event.target.value })}
                      />
                    </div>
                  ))}
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      
                      onClick={() => { setPerDay(false); applyCommon(commonStart, commonEnd); }}
                    >
                      <Close size={16} strokeWidth={1.75} />
                      {t('availability.sameHours', 'Mêmes horaires tous les jours')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <Button variant="secondary" size="sm" onClick={saveWeekly} disabled={saving}>
              {saving ? <Spinner className="size-4" /> : <Save size={16} strokeWidth={1.75} />}
              {t('availability.save', 'Enregistrer mes horaires')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Absences ──────────────────────────────────────────────────── */}
      <Card size="sm" className="shadow-none">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-foreground">
                {t('availability.absences', 'Absences')}
              </p>
              <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                {t('availability.absencesHelp',
                  'Congés et indisponibilités ponctuelles — aucune mission ne vous sera proposée sur ces dates.')}
              </p>
            </div>
            {!absenceFormOpen && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAbsenceFormOpen(true)}
              >
                <Add size={16} strokeWidth={1.75} />
                {t('availability.addAbsence', 'Ajouter')}
              </Button>
            )}
          </div>

          {/* Formulaire a la DEMANDE : trois champs affiches en permanence
              donnaient l'impression qu'il fallait les remplir. */}
          {absenceFormOpen && (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-solid border-border bg-muted/30 p-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="absence-start">
                  {t('availability.absenceFrom', 'Du')}
                </label>
                <Input
                  id="absence-start"
                  type="date"
                  className="w-auto tabular-nums"
                  value={absenceStart}
                  onChange={(event) => setAbsenceStart(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="absence-end">
                  {t('availability.absenceTo', 'Au (inclus)')}
                </label>
                <Input
                  id="absence-end"
                  type="date"
                  className="w-auto tabular-nums"
                  value={absenceEnd}
                  onChange={(event) => setAbsenceEnd(event.target.value)}
                />
              </div>
              <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="absence-reason">
                  {t('availability.absenceReason', 'Motif (optionnel)')}
                </label>
                <Input
                  id="absence-reason"
                  maxLength={200}
                  value={absenceReason}
                  onChange={(event) => setAbsenceReason(event.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addAbsence}
                  disabled={!absenceStart || !absenceEnd}
                >
                  {t('availability.confirmAbsence', 'Enregistrer')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAbsenceFormOpen(false)}
                >
                  {t('common.cancel', 'Annuler')}
                </Button>
              </div>
            </div>
          )}

          {absences.length === 0 ? (
            <EmptyState
              icon={<EventAvailable />}
              title={t('availability.noAbsence', 'Aucune absence déclarée')}
              description={t('availability.noAbsenceHelp',
                'Déclarez vos congés à l’avance : les missions cesseront de vous être proposées sur ces dates.')}
              variant="dashed"
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              {absences.map((absence) => (
                <Item key={absence.id} variant="outline" size="sm">
                  <ItemMedia variant="icon">
                    <AccessTime size={16} strokeWidth={1.75} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="tabular-nums">
                      {absence.startDate === absence.endDate
                        ? absence.startDate
                        : `${absence.startDate} → ${absence.endDate}`}
                    </ItemTitle>
                    {absence.reason && <ItemDescription>{absence.reason}</ItemDescription>}
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive-ink"
                      aria-label={t('availability.removeAbsence', 'Retirer cette absence')}
                      onClick={() => removeAbsence(absence.id)}
                    >
                      <DeleteOutline size={16} strokeWidth={1.75} />
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
