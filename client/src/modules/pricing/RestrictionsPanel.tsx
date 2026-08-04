import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { Badge } from '../../components/ui';
import { Spinner } from '../../components/ui';
import { Card, Button } from '../../components/ui';
import { Field, FieldLabel, Input } from '../../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Switch,
  Separator,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import { Plus, Pencil, Trash2, CalendarRange, X } from 'lucide-react';
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryKey = useMemo(() => ['booking-restrictions', propertyId], [propertyId]);

  const { data: restrictions = [], isLoading } = useQuery<BookingRestriction[]>({
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
    const toInt = (s: string): number | null => (s.trim() === '' ? null : Number.parseInt(s, 10));
    const data: CreateBookingRestrictionData = {
      propertyId,
      startDate: form.startDate,
      endDate: form.endDate,
      minStay: toInt(form.minStay),
      maxStay: toInt(form.maxStay),
      closedToArrival: form.closedToArrival,
      closedToDeparture: form.closedToDeparture,
      daysOfWeek: form.daysOfWeek.length ? form.daysOfWeek : null,
      priority: toInt(form.priority),
    };
    if (editingId != null) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  }, [propertyId, form, editingId, createMutation, updateMutation, t]);

  if (propertyId == null) {
    return (
      <Card className="gap-0 py-0 p-4 text-center">
        <p className="cn-text-body1 text-[0.85rem] text-muted-foreground">
          {t('restrictions.selectProperty', 'Sélectionnez un logement pour gérer ses restrictions de séjour.')}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex gap-[9px] items-start flex-wrap min-[1200px]:flex-nowrap">
      {/* ── Formulaire (création / édition) ── */}
      <Card className="gap-0 p-3 flex-[5] min-w-[300px]">
        <div className="flex items-center justify-between mb-2">
          <p className="cn-text-body1 text-[0.8rem] font-bold tracking-[0.01em]">
            {editingId != null
              ? t('restrictions.editTitle', 'Modifier la restriction')
              : t('restrictions.newTitle', 'Nouvelle restriction')}
          </p>
          {editingId != null && (
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
          <div className="flex gap-1.5">
            <Field>
              <FieldLabel htmlFor="restriction-start-date">{t('restrictions.start', 'Début')}</FieldLabel>
              <Input
                id="restriction-start-date"
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

          <div className="flex gap-1.5">
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

          <div className="flex flex-row gap-3">
            <Field orientation="horizontal" className="w-auto">
              <Switch
                id="restriction-cta"
                size="sm"
                checked={form.closedToArrival}
                onCheckedChange={(checked) => setForm((s) => ({ ...s, closedToArrival: checked }))}
              />
              <FieldLabel htmlFor="restriction-cta" className="text-[0.78rem] font-normal">
                {t('restrictions.cta', 'Arrivée fermée (CTA)')}
              </FieldLabel>
            </Field>
            <Field orientation="horizontal" className="w-auto">
              <Switch
                id="restriction-ctd"
                size="sm"
                checked={form.closedToDeparture}
                onCheckedChange={(checked) => setForm((s) => ({ ...s, closedToDeparture: checked }))}
              />
              <FieldLabel htmlFor="restriction-ctd" className="text-[0.78rem] font-normal">
                {t('restrictions.ctd', 'Départ fermé (CTD)')}
              </FieldLabel>
            </Field>
          </div>

          <div>
            <p className="cn-text-body1 text-[0.72rem] text-muted-foreground mb-0.5">
              {t('restrictions.daysOfWeek', 'Jours concernés (vide = tous)')}
            </p>
            <div className="flex flex-row flex-wrap gap-[3px]">
              {DOW.map((d) => (
                <StatusChip
                  key={d.v}
                  label={d.label}
                  tone="accent"
                  outlined
                  selected={form.daysOfWeek.includes(d.v)}
                  pressed={form.daysOfWeek.includes(d.v)}
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
            <p className="cn-text-body1 text-[0.75rem] text-[var(--err,_#C97A7A)]">{error}</p>
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
      </Card>

      {/* ── Liste des restrictions ── */}
      <Card className="gap-0 p-3 flex-[7] min-w-[320px]">
        <p className="cn-text-body1 text-[0.8rem] font-bold mb-2">
          {t('restrictions.listTitle', 'Restrictions actives')}{' '}
          <span className="text-[0.72rem] text-muted-foreground tabular-nums">
            ({restrictions.length})
          </span>
        </p>

        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner className="size-[22px]" /></div>
        ) : restrictions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CalendarRange size={26} strokeWidth={1.5} style={{ opacity: 0.5 }} />
            <p className="cn-text-body1 text-[0.78rem] mt-1.5">
              {t('restrictions.empty', 'Aucune restriction pour ce logement.')}
            </p>
          </div>
        ) : (
          // Le `divider` du Stack MUI n'a pas d'equivalent declaratif : le filet
          // est insere explicitement entre deux lignes.
          <div className="flex flex-col">
            {restrictions.map((r, idx) => (
              <React.Fragment key={r.id}>
                {idx > 0 && <Separator />}
                <div className="flex items-center gap-1.5 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="cn-text-body1 text-[0.8rem] font-semibold tabular-nums">
                    {r.startDate} → {r.endDate}
                  </p>
                  <div className="flex flex-row flex-wrap gap-[3px] mt-[3px]">
                    {r.minStay != null && <Badge variant="secondary" className="text-[0.68rem] h-[20px]">{`min ${r.minStay}`}</Badge>}
                    {r.maxStay != null && <Badge variant="secondary" className="text-[0.68rem] h-[20px]">{`max ${r.maxStay}`}</Badge>}
                    {r.closedToArrival && <Badge variant="warning" className="text-[0.68rem] h-[20px]">CTA</Badge>}
                    {r.closedToDeparture && <Badge variant="warning" className="text-[0.68rem] h-[20px]">CTD</Badge>}
                    {!!r.daysOfWeek?.length && (
                      <Badge variant="outline" className="text-[0.68rem] h-[20px]">{r.daysOfWeek.map((d) => DOW.find((x) => x.v === d)?.label).join(' ')}</Badge>
                    )}
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(r)} aria-label={t('common.edit', 'Modifier')}>
                      <Pencil size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('common.edit', 'Modifier')}</TooltipContent>
                </Tooltip>
                {/* Le span garde l'infobulle atteignable quand le bouton est
                    desactive (un bouton disabled n'emet plus d'evenement). */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteMutation.mutate(r.id)}
                        disabled={deleteMutation.isPending}
                        aria-label={t('common.delete', 'Supprimer')}
                        className="text-[var(--err,_#C97A7A)]"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('common.delete', 'Supprimer')}</TooltipContent>
                </Tooltip>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default RestrictionsPanel;
