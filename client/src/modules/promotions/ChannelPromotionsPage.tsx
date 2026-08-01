import React, { useState, useMemo, useCallback } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { CircleCheck, X, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Paper, Switch, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  Campaign as CampaignIcon,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useTranslation } from '../../hooks/useTranslation';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';
import {
  useChannelPromotions,
  useCreatePromotion,
  useUpdatePromotion,
  useTogglePromotion,
  useSyncPromotions,
  useDeletePromotion,
} from '../../hooks/useChannelPromotions';
import type {
  ChannelPromotion,
  CreateChannelPromotionData,
  ChannelName,
  PromotionType,
} from '../../services/api/channelPromotionsApi';
import {
  PROMOTION_TYPE_LABELS,
  PROMOTION_STATUS_COLORS,
} from '../../services/api/channelPromotionsApi';
import { useQuery } from '@tanstack/react-query';

// ─── Constants ──────────────────────────────────────────────────────────────

const CHANNEL_OPTIONS: { value: ChannelName; label: string; color: string }[] = [
  { value: 'AIRBNB', label: 'Airbnb', color: '#FF5A5F' },
  { value: 'BOOKING', label: 'Booking.com', color: '#003580' },
];

const PROMOTION_TYPE_OPTIONS: { value: PromotionType; label: string }[] = [
  { value: 'early_bird_ota', label: 'Early Bird' },
  { value: 'flash_sale', label: 'Flash Sale' },
  { value: 'long_stay_ota', label: 'Long Stay' },
  { value: 'mobile_rate', label: 'Mobile Rate' },
  { value: 'genius', label: 'Genius (Booking)' },
  { value: 'preferred_partner', label: 'Preferred Partner' },
  { value: 'visibility_booster', label: 'Visibility Booster' },
  { value: 'country_rate', label: 'Country Rate' },
];

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;

const channelColor = (name: string) =>
  CHANNEL_OPTIONS.find((c) => c.value === name)?.color ?? '#666';

// ─── Component ──────────────────────────────────────────────────────────────

const ChannelPromotionsPage: React.FC = () => {
  const { t } = useTranslation();

  // Filters
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | ''>('');

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<ChannelPromotion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChannelPromotion | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateChannelPromotionData>({
    propertyId: 0,
    channelName: 'AIRBNB',
    promotionType: 'early_bird_ota',
    discountPercentage: undefined,
    startDate: undefined,
    endDate: undefined,
  });

  // Data queries
  const propertyId = selectedPropertyId === '' ? undefined : selectedPropertyId;
  const { data: promotions = [], isLoading, isError } = useChannelPromotions(propertyId);
  const { data: properties = [] } = useQuery({
    queryKey: ['properties-list'],
    queryFn: () => propertiesApi.getAll(),
    staleTime: 120_000,
  });

  // Mutations
  const createMutation = useCreatePromotion();
  const updateMutation = useUpdatePromotion();
  const toggleMutation = useTogglePromotion();
  const syncMutation = useSyncPromotions();
  const deleteMutation = useDeletePromotion();

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // ── Handlers ──

  const handleOpenCreate = useCallback(() => {
    setEditingPromo(null);
    setFormData({
      propertyId: properties[0]?.id ?? 0,
      channelName: 'AIRBNB',
      promotionType: 'early_bird_ota',
      discountPercentage: undefined,
      startDate: undefined,
      endDate: undefined,
    });
    setFormOpen(true);
  }, [properties]);

  const handleOpenEdit = useCallback((promo: ChannelPromotion) => {
    setEditingPromo(promo);
    setFormData({
      propertyId: promo.propertyId,
      channelName: promo.channelName,
      promotionType: promo.promotionType,
      discountPercentage: promo.discountPercentage ?? undefined,
      startDate: promo.startDate ?? undefined,
      endDate: promo.endDate ?? undefined,
    });
    setFormOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (editingPromo) {
      await updateMutation.mutateAsync({ id: editingPromo.id, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
    setFormOpen(false);
  }, [editingPromo, formData, createMutation, updateMutation]);

  const handleToggle = useCallback((id: number) => {
    toggleMutation.mutate(id);
  }, [toggleMutation]);

  const handleSync = useCallback(() => {
    if (propertyId) {
      syncMutation.mutate(propertyId);
    }
  }, [propertyId, syncMutation]);

  const handleDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteMutation]);

  // ── Derived ──

  const propertyMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const p of properties) {
      map[p.id] = p.name;
    }
    return map;
  }, [properties]);

  return (
    // Padding de page : SPACING.PAGE_PADDING (2) = 12px avec theme.spacing = 6
    <div className="p-3">
      <PageHeader
        title={t('promotions.title', 'Promotions OTA')}
        subtitle={t('promotions.subtitle', 'Gerez vos promotions sur les channels OTA')}
        showBackButton={false}
        backPath="/channels"
        actions={
          <div className="flex gap-1.5">
            {propertyId && (
              <BuiButton
                size="sm"
                variant="outline"
                onClick={handleSync}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? <Spinner className="size-3.5" /> : <SyncIcon />}
                {t('common.sync', 'Synchroniser')}
              </BuiButton>
            )}
            <BuiButton size="sm" onClick={handleOpenCreate}>
              <AddIcon />
              {t('promotions.create', 'Nouvelle promotion')}
            </BuiButton>
          </div>
        }
      />

      {/* ── Filter ── */}
      <Paper sx={{ ...CARD_SX, p: 2, mb: 1.5 }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel sx={{ fontSize: '0.8125rem' }}>
            {t('promotions.filterProperty', 'Filtrer par propriete')}
          </InputLabel>
          <Select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value as number | '')}
            label={t('promotions.filterProperty', 'Filtrer par propriete')}
            sx={{ fontSize: '0.8125rem' }}
          >
            <MenuItem value="">
              <em>{t('common.all', 'Toutes')}</em>
            </MenuItem>
            {properties.map((p: Property) => (
              <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.8125rem' }}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {/* ── Alerts ── */}
      {syncMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-2 text-[0.8125rem]">
          <CircleCheck />
          <AlertDescription>{t('promotions.syncSuccess', 'Synchronisation terminee')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => syncMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-8" />
        </div>
      ) : isError ? (
        <BuiAlert variant="destructive" className="text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{t('promotions.error', 'Erreur lors du chargement des promotions')}</AlertDescription>
        </BuiAlert>
      ) : promotions.length === 0 ? (
        <Paper sx={{ ...CARD_SX, p: 4, textAlign: 'center' }}>
          <span className="inline-flex text-muted-foreground opacity-60 mb-1.5"><CampaignIcon size={48} strokeWidth={1.75} /></span>
          <p className="cn-text-body1 text-[0.875rem] text-muted-foreground">
            {t('promotions.empty', 'Aucune promotion configuree')}
          </p>
          <BuiButton
            size="sm"
            variant="outline"
            className="mt-[9px]"
            onClick={handleOpenCreate}
          >
            <AddIcon />
            {t('promotions.create', 'Nouvelle promotion')}
          </BuiButton>
        </Paper>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border border-solid border-[var(--line)] bg-[var(--card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('promotions.col.channel', 'Channel')}</TableHead>
                <TableHead>{t('promotions.col.property', 'Propriete')}</TableHead>
                <TableHead>{t('promotions.col.type', 'Type')}</TableHead>
                <TableHead className="text-center">{t('promotions.col.discount', 'Reduction')}</TableHead>
                <TableHead>{t('promotions.col.dates', 'Dates')}</TableHead>
                <TableHead className="text-center">{t('promotions.col.status', 'Status')}</TableHead>
                <TableHead className="text-center">{t('promotions.col.enabled', 'Active')}</TableHead>
                <TableHead className="text-end">{t('common.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell>
                    <StatusChip tokens={{ color: '#fff', bg: channelColor(promo.channelName) }} label={promo.channelName} />
                  </TableCell>
                  <TableCell>
                    {propertyMap[promo.propertyId] ?? `#${promo.propertyId}`}
                  </TableCell>
                  <TableCell>
                    {PROMOTION_TYPE_LABELS[promo.promotionType] ?? promo.promotionType}
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    {promo.discountPercentage != null ? `${promo.discountPercentage}%` : '—'}
                  </TableCell>
                  {/* Colonne dates volontairement plus petite que le gabarit du corps. */}
                  <TableCell className="text-[12px]">
                    {promo.startDate && promo.endDate
                      ? `${new Date(promo.startDate).toLocaleDateString('fr-FR')} → ${new Date(promo.endDate).toLocaleDateString('fr-FR')}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusChip size="sm" tokens={{ color: '#fff', bg: PROMOTION_STATUS_COLORS[promo.status] ?? '#9e9e9e' }} label={promo.status} className="h-[20px]" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      size="small"
                      checked={promo.enabled}
                      onChange={() => handleToggle(promo.id)}
                      disabled={toggleMutation.isPending}
                    />
                  </TableCell>
                  <TableCell className="text-end">
                    <Tooltip title={t('common.edit', 'Modifier')}>
                      <IconButton size="small" onClick={() => handleOpenEdit(promo)}>
                        <EditIcon size={'1rem'} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete', 'Supprimer')}>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(promo)}>
                        <DeleteIcon size={'1rem'} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Create / Edit Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
          {editingPromo
            ? t('promotions.editTitle', 'Modifier la promotion')
            : t('promotions.createTitle', 'Nouvelle promotion OTA')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('promotions.form.property', 'Propriete')}</InputLabel>
            <Select
              value={formData.propertyId || ''}
              onChange={(e) => setFormData({ ...formData, propertyId: Number(e.target.value) })}
              label={t('promotions.form.property', 'Propriete')}
              sx={{ fontSize: '0.8125rem' }}
              disabled={!!editingPromo}
            >
              {properties.map((p: Property) => (
                <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.8125rem' }}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('promotions.form.channel', 'Channel')}</InputLabel>
            <Select
              value={formData.channelName}
              onChange={(e) => setFormData({ ...formData, channelName: e.target.value as ChannelName })}
              label={t('promotions.form.channel', 'Channel')}
              sx={{ fontSize: '0.8125rem' }}
            >
              {CHANNEL_OPTIONS.map((c) => (
                <MenuItem key={c.value} value={c.value} sx={{ fontSize: '0.8125rem' }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-[8px] h-[8px] rounded-[50%]" style={{ backgroundColor: c.color }} />
                    {c.label}
                  </div>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('promotions.form.type', 'Type')}</InputLabel>
            <Select
              value={formData.promotionType}
              onChange={(e) => setFormData({ ...formData, promotionType: e.target.value as PromotionType })}
              label={t('promotions.form.type', 'Type')}
              sx={{ fontSize: '0.8125rem' }}
            >
              {PROMOTION_TYPE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.8125rem' }}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label={t('promotions.form.discount', 'Reduction (%)')}
            type="number"
            size="small"
            fullWidth
            value={formData.discountPercentage ?? ''}
            onChange={(e) =>
              setFormData({ ...formData, discountPercentage: e.target.value ? Number(e.target.value) : undefined })
            }
            inputProps={{ min: 0, max: 100, step: 1 }}
            InputProps={{ sx: { fontSize: '0.8125rem' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          />

          <div className="flex gap-2">
            <TextField
              label={t('promotions.form.startDate', 'Date debut')}
              type="date"
              size="small"
              fullWidth
              value={formData.startDate ?? ''}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value || undefined })}
              InputLabelProps={{ shrink: true, sx: { fontSize: '0.8125rem' } }}
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
            />
            <TextField
              label={t('promotions.form.endDate', 'Date fin')}
              type="date"
              size="small"
              fullWidth
              value={formData.endDate ?? ''}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value || undefined })}
              InputLabelProps={{ shrink: true, sx: { fontSize: '0.8125rem' } }}
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
            />
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <BuiButton variant="outline" size="sm" onClick={() => setFormOpen(false)}>
            {t('common.cancel', 'Annuler')}
          </BuiButton>
          <BuiButton
            size="sm"
            onClick={handleSubmit}
            disabled={isMutating || !formData.propertyId}
          >
            {isMutating ? <Spinner className="size-4" /> : editingPromo ? t('common.save', 'Enregistrer') : t('common.create', 'Creer')}
          </BuiButton>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <ConfirmationModal
        open={!!deleteTarget}
        title={t('promotions.deleteTitle', 'Supprimer la promotion')}
        message={t('promotions.deleteMessage', 'Voulez-vous vraiment supprimer cette promotion ?')}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ChannelPromotionsPage;
