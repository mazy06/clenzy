import React, { useState, useCallback, useMemo } from 'react';
import { Badge } from '../../components/ui';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Paper, Typography, TextField, Button, IconButton, Switch, FormControlLabel, Stack, Tooltip, Divider } from '@mui/material';
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

const inputSx = { '& .MuiInputBase-input': { fontSize: '0.82rem' } };

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
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 5, minWidth: 300 }}>
        <div className="flex items-center justify-between mb-2">
          <p className="cn-text-body1 text-[0.8rem] font-bold tracking-[0.01em]">
            {editingId != null
              ? t('restrictions.editTitle', 'Modifier la restriction')
              : t('restrictions.newTitle', 'Nouvelle restriction')}
          </p>
          {editingId != null && (
            <Tooltip title={t('common.cancel', 'Annuler')}>
              <IconButton size="small" onClick={resetForm}><X size={15} /></IconButton>
            </Tooltip>
          )}
        </div>

        <Stack spacing={1.5}>
          <div className="flex gap-1.5">
            <TextField
              label={t('restrictions.start', 'Début')} type="date" size="small" fullWidth
              InputLabelProps={{ shrink: true }} sx={inputSx}
              value={form.startDate}
              onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))}
            />
            <TextField
              label={t('restrictions.end', 'Fin')} type="date" size="small" fullWidth
              InputLabelProps={{ shrink: true }} sx={inputSx}
              value={form.endDate}
              onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))}
            />
          </div>

          <div className="flex gap-1.5">
            <TextField
              label={t('restrictions.minStay', 'Séjour min (nuits)')} type="number" size="small" fullWidth
              InputLabelProps={{ shrink: true }} inputProps={{ min: 1 }} sx={inputSx}
              value={form.minStay}
              onChange={(e) => setForm((s) => ({ ...s, minStay: e.target.value }))}
            />
            <TextField
              label={t('restrictions.maxStay', 'Séjour max (nuits)')} type="number" size="small" fullWidth
              InputLabelProps={{ shrink: true }} inputProps={{ min: 1 }} sx={inputSx}
              value={form.maxStay}
              onChange={(e) => setForm((s) => ({ ...s, maxStay: e.target.value }))}
            />
          </div>

          <Stack direction="row" spacing={2}>
            <FormControlLabel
              control={<Switch size="small" checked={form.closedToArrival}
                onChange={(e) => setForm((s) => ({ ...s, closedToArrival: e.target.checked }))} />}
              label={<p className="cn-text-body1 text-[0.78rem]">{t('restrictions.cta', 'Arrivée fermée (CTA)')}</p>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={form.closedToDeparture}
                onChange={(e) => setForm((s) => ({ ...s, closedToDeparture: e.target.checked }))} />}
              label={<p className="cn-text-body1 text-[0.78rem]">{t('restrictions.ctd', 'Départ fermé (CTD)')}</p>}
            />
          </Stack>

          <div>
            <p className="cn-text-body1 text-[0.72rem] text-muted-foreground mb-0.5">
              {t('restrictions.daysOfWeek', 'Jours concernés (vide = tous)')}
            </p>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
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
            </Stack>
          </div>

          <TextField
            label={t('restrictions.priority', 'Priorité (optionnel)')} type="number" size="small"
            InputLabelProps={{ shrink: true }} sx={{ ...inputSx, maxWidth: 180 }}
            value={form.priority}
            onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}
          />

          {error && (
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--err, #C97A7A)' }}>{error}</Typography>
          )}

          <div className="flex justify-end gap-1.5">
            {editingId != null && (
              <Button size="small" onClick={resetForm} sx={{ textTransform: 'none' }}>
                {t('common.cancel', 'Annuler')}
              </Button>
            )}
            <Button
              variant="contained" size="small" disableElevation
              startIcon={saving ? <Spinner className="size-[13px]" /> : <Plus size={14} />}
              onClick={handleSubmit} disabled={saving}
              sx={{ textTransform: 'none' }}
            >
              {editingId != null ? t('common.save', 'Enregistrer') : t('restrictions.add', 'Ajouter')}
            </Button>
          </div>
        </Stack>
      </Paper>

      {/* ── Liste des restrictions ── */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 7, minWidth: 320 }}>
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
          <Stack divider={<Divider flexItem />} spacing={0}>
            {restrictions.map((r) => (
              <div className="flex items-center gap-1.5 py-1.5" key={r.id}>
                <div className="flex-1 min-w-0">
                  <p className="cn-text-body1 text-[0.8rem] font-semibold tabular-nums">
                    {r.startDate} → {r.endDate}
                  </p>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {r.minStay != null && <Badge variant="secondary" className="text-[0.68rem] h-[20px]">{`min ${r.minStay}`}</Badge>}
                    {r.maxStay != null && <Badge variant="secondary" className="text-[0.68rem] h-[20px]">{`max ${r.maxStay}`}</Badge>}
                    {r.closedToArrival && <Badge variant="warning" className="text-[0.68rem] h-[20px]">CTA</Badge>}
                    {r.closedToDeparture && <Badge variant="warning" className="text-[0.68rem] h-[20px]">CTD</Badge>}
                    {!!r.daysOfWeek?.length && (
                      <Badge variant="outline" className="text-[0.68rem] h-[20px]">{r.daysOfWeek.map((d) => DOW.find((x) => x.v === d)?.label).join(' ')}</Badge>
                    )}
                  </Stack>
                </div>
                <Tooltip title={t('common.edit', 'Modifier')}>
                  <IconButton size="small" onClick={() => handleEdit(r)}><Pencil size={14} /></IconButton>
                </Tooltip>
                <Tooltip title={t('common.delete', 'Supprimer')}>
                  <span>
                    <IconButton size="small" onClick={() => deleteMutation.mutate(r.id)}
                      disabled={deleteMutation.isPending} sx={{ color: 'var(--err, #C97A7A)' }}>
                      <Trash2 size={14} />
                    </IconButton>
                  </span>
                </Tooltip>
              </div>
            ))}
          </Stack>
        )}
      </Paper>
    </div>
  );
};

export default RestrictionsPanel;
