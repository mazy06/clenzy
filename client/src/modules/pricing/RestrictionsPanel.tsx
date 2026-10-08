import React, { useState, useCallback, useMemo } from 'react';
import { Spinner } from '../../components/ui';
import { Card, Button } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { Field, FieldLabel, Input } from '../../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Switch,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import { Plus, CalendarRange, TriangleAlert, X } from 'lucide-react';
import BaitlyStayRulesWorkspace from './BaitlyStayRulesWorkspace';
import './baitlyStayRules.css';
import { useTranslation } from '../../hooks/useTranslation';
import {
  calendarPricingApi,
  type BookingRestriction,
  type CreateBookingRestrictionData,
} from '../../services/api/calendarPricingApi';

// Restrictions de séjour (min/max stay, CTA/CTD) poussées vers les OTAs via le hub.
// Backend : /api/booking-restrictions → BookingRestrictionService (émet
// RESTRICTION_UPDATED → Channex ARI).

interface RestrictionsPanelProps {
  propertyId: number | null;
}

const DOW = [
  { v: 1, label: 'Lun' },
  { v: 2, label: 'Mar' },
  { v: 3, label: 'Mer' },
  { v: 4, label: 'Jeu' },
  { v: 5, label: 'Ven' },
  { v: 6, label: 'Sam' },
  { v: 7, label: 'Dim' },
];

interface FormState {
  startDate: string;
  endDate: string;
  minStay: string;
  maxStay: string;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  daysOfWeek: number[];
  priority: string;
}

const EMPTY_FORM: FormState = {
  startDate: '',
  endDate: '',
  minStay: '',
  maxStay: '',
  closedToArrival: false,
  closedToDeparture: false,
  daysOfWeek: [],
  priority: '',
};

const RestrictionsPanel: React.FC<RestrictionsPanelProps> = ({ propertyId }) => {
  const { t, currentLanguage } = useTranslation();
  const days = DOW.map((day, index) => ({ ...day, label: new Intl.DateTimeFormat(currentLanguage, { weekday: 'short' }).format(new Date(2024, 0, index + 1)) }));
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryKey = useMemo(() => ['booking-restrictions', propertyId], [propertyId]);

  const { data: restrictions = [], isLoading, isError, refetch } = useQuery<BookingRestriction[]>({
    queryKey,
    queryFn: () => calendarPricingApi.getBookingRestrictions(propertyId as number),
    enabled: propertyId != null,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormOpen(false);
    setError(null);
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: CreateBookingRestrictionData) => calendarPricingApi.createBookingRestriction(data),
    onSuccess: () => { invalidate(); resetForm(); },
    onError: () => setError(t('restrictions.saveError', "Échec de l'enregistrement de la restriction.")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateBookingRestrictionData }) =>
      calendarPricingApi.updateBookingRestriction(id, data),
    onSuccess: () => { invalidate(); resetForm(); },
    onError: () => setError(t('restrictions.saveError', "Échec de l'enregistrement de la restriction.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => calendarPricingApi.deleteBookingRestriction(id),
    onSuccess: () => invalidate(),
    onError: () => setError(t('common.error')),
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  const toggleDow = useCallback((v: number) => {
    setForm((s) => ({
      ...s,
      daysOfWeek: s.daysOfWeek.includes(v)
        ? s.daysOfWeek.filter((d) => d !== v)
        : [...s.daysOfWeek, v].sort((a, b) => a - b),
    }));
  }, []);

  const handleEdit = useCallback((r: BookingRestriction) => {
    setEditingId(r.id);
    setFormOpen(true);
    setError(null);
    setForm({
      startDate: r.startDate,
      endDate: r.endDate,
      minStay: r.minStay != null ? String(r.minStay) : '',
      maxStay: r.maxStay != null ? String(r.maxStay) : '',
      closedToArrival: !!r.closedToArrival,
      closedToDeparture: !!r.closedToDeparture,
      daysOfWeek: r.daysOfWeek ?? [],
      priority: r.priority != null ? String(r.priority) : '',
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (propertyId == null) return;
    setError(null);
    if (!form.startDate || !form.endDate) {
      setError(t('restrictions.datesRequired', 'Renseignez la date de début et de fin.'));
      return;
    }
    if (form.endDate < form.startDate) {
      setError(t('restrictions.endBeforeStart', 'La date de fin doit être après la date de début.'));
      return;
    }
    const toInt = (s: string): number | null => (s.trim() === '' ? null : Number(s));
    const min = toInt(form.minStay), max = toInt(form.maxStay), priority = toInt(form.priority);
    if ([min, max].some(value => value != null && (!Number.isSafeInteger(value) || value < 1))
      || (priority != null && !Number.isSafeInteger(priority)) || (min != null && max != null && max < min)) {
      setError(t('baitlyPricing.stay.invalidLength', 'Utilisez un nombre entier de nuits, avec un maximum supérieur ou égal au minimum.'));
      return;
    }
    const existing = restrictions.find(rule => rule.id === editingId);
    const data: CreateBookingRestrictionData = {
      propertyId,
      startDate: form.startDate,
      endDate: form.endDate,
      minStay: min,
      maxStay: max,
      closedToArrival: form.closedToArrival,
      closedToDeparture: form.closedToDeparture,
      daysOfWeek: form.daysOfWeek.length ? form.daysOfWeek : null,
      priority,
      ...(existing ? { gapDays: existing.gapDays, advanceNoticeDays: existing.advanceNoticeDays } : {}),
    };
    if (editingId != null) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  }, [propertyId, form, editingId, createMutation, updateMutation, t, restrictions]);

  if (propertyId == null) {
    return (
      <EmptyState
        icon={<CalendarRange />}
        title={t('restrictions.selectProperty', 'Sélectionnez un logement pour gérer ses restrictions de séjour.')}
        variant="plain"
      />
    );
  }

  const editor = formOpen ? <Card className="bs-editor gap-0 p-5 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold tracking-tight">
            {editingId != null
              ? t('restrictions.editTitle', 'Modifier la restriction')
              : t('restrictions.newTitle', 'Nouvelle restriction')}
          </p>
          {(
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={resetForm} aria-label={t('common.cancel', 'Annuler')}>
                  <X size={15} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.cancel', 'Annuler')}</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex flex-col gap-[9px]">
          <div className="bs-editor-fields">
            <Field>
              <FieldLabel htmlFor="restriction-start-date">{t('restrictions.start', 'Début')}</FieldLabel>
              <Input
                id="restriction-start-date"
                autoFocus
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="restriction-end-date">{t('restrictions.end', 'Fin')}</FieldLabel>
              <Input
                id="restriction-end-date"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))}
              />
            </Field>
          </div>

          <div className="bs-editor-fields">
            <Field>
              <FieldLabel htmlFor="restriction-min-stay">{t('restrictions.minStay', 'Séjour min (nuits)')}</FieldLabel>
              <Input
                id="restriction-min-stay"
                type="number"
                min={1}
                value={form.minStay}
                onChange={(e) => setForm((s) => ({ ...s, minStay: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="restriction-max-stay">{t('restrictions.maxStay', 'Séjour max (nuits)')}</FieldLabel>
              <Input
                id="restriction-max-stay"
                type="number"
                min={1}
                value={form.maxStay}
                onChange={(e) => setForm((s) => ({ ...s, maxStay: e.target.value }))}
              />
            </Field>
          </div>

          <div className="bs-editor-fields">
            <Field orientation="horizontal" className="w-auto">
              <Switch
                id="restriction-cta"
                size="sm"
                checked={form.closedToArrival}
                onCheckedChange={(checked) => setForm((s) => ({ ...s, closedToArrival: checked }))}
              />
              <FieldLabel htmlFor="restriction-cta" className="text-xs font-normal">
                {t('baitlyPricing.stay.arrivalBlocked', 'Arrivées bloquées')}
              </FieldLabel>
            </Field>
            <Field orientation="horizontal" className="w-auto">
              <Switch
                id="restriction-ctd"
                size="sm"
                checked={form.closedToDeparture}
                onCheckedChange={(checked) => setForm((s) => ({ ...s, closedToDeparture: checked }))}
              />
              <FieldLabel htmlFor="restriction-ctd" className="text-xs font-normal">
                {t('baitlyPricing.stay.departureBlocked', 'Départs bloqués')}
              </FieldLabel>
            </Field>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {t('restrictions.daysOfWeek', 'Jours concernés (vide = tous)')}
            </p>
            <div className="flex flex-row flex-wrap gap-[3px]">
              <Button variant="ghost" size="sm" aria-pressed={!form.daysOfWeek.length} onClick={() => setForm(previous => ({ ...previous, daysOfWeek: [] }))}>{t('baitlyPricing.stay.everyDayShort', 'Tous les jours')}</Button>
              {days.map((d) => (
                <StatusChip
                  key={d.v}
                  label={d.label}
                  tone="accent"
                  outlined
                  selected={!form.daysOfWeek.length || form.daysOfWeek.includes(d.v)}
                  pressed={!form.daysOfWeek.length || form.daysOfWeek.includes(d.v)}
                  onClick={() => toggleDow(d.v)}
                  className="border-solid text-[0.7rem] h-6"
                />
              ))}
            </div>
          </div>

          <Field className="max-w-[180px]">
            <FieldLabel htmlFor="restriction-priority">{t('restrictions.priority', 'Priorité (optionnel)')}</FieldLabel>
            <Input
              id="restriction-priority"
              type="number"
              value={form.priority}
              onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}
            />
          </Field>

          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-1.5">
            {editingId != null && (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                {t('common.cancel', 'Annuler')}
              </Button>
            )}
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? <Spinner className="size-[13px]" /> : <Plus size={14} />}
              {editingId != null ? t('common.save', 'Enregistrer') : t('restrictions.add', 'Ajouter')}
            </Button>
          </div>
        </div>
      </Card> : null;

  return <div className="bs-controller">
    {!formOpen && error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {isError && <Alert variant="destructive"><AlertDescription>{t('baitlyPricing.stay.loadError', 'Impossible de charger les règles de séjour. Réessayez.')} <Button variant="outline" onClick={() => void refetch()}>{t('common.retry')}</Button></AlertDescription></Alert>}
    <BaitlyStayRulesWorkspace restrictions={restrictions} loading={isLoading} deleting={deleteMutation.isPending}
      editor={editor} onCreate={() => { resetForm(); setFormOpen(true); }} onEdit={handleEdit} onDelete={rule => deleteMutation.mutate(rule.id)} />
  </div>;
};

export default RestrictionsPanel;
