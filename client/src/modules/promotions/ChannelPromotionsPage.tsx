import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Switch, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  Campaign as CampaignIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useTranslation } from '../../hooks/useTranslation';
import { SPACING } from '../../theme/spacing';
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

const CELL_SX = { fontSize: '0.8125rem', py: 1.25 } as const;
const HEAD_CELL_SX = { fontSize: '0.75rem', fontWeight: 700, py: 1, color: 'text.secondary' } as const;

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

  const channelColor = (name: string) =>
    CHANNEL_OPTIONS.find((c) => c.value === name)?.color ?? '#666';

  return (
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      <PageHeader
        title={t('promotions.title', 'Promotions OTA')}
        subtitle={t('promotions.subtitle', 'Gerez vos promotions sur les channels OTA')}
        showBackButton={false}
        backPath="/channels"
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {propertyId && (
              <Button
                size="small"
                variant="outlined"
                startIcon={syncMutation.isPending ? <CircularProgress size={14} /> : <SyncIcon />}
                onClick={handleSync}
                disabled={syncMutation.isPending}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                {t('common.sync', 'Synchroniser')}
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              {t('promotions.create', 'Nouvelle promotion')}
            </Button>
          </Box>
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
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => syncMutation.reset()}>
          {t('promotions.syncSuccess', 'Synchronisation terminee')}
        </Alert>
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : isError ? (
        <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
          {t('promotions.error', 'Erreur lors du chargement des promotions')}
        </Alert>
      ) : promotions.length === 0 ? (
        <Paper sx={{ ...CARD_SX, p: 4, textAlign: 'center' }}>
          <CampaignIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            {t('promotions.empty', 'Aucune promotion configuree')}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{ mt: 1.5, textTransform: 'none', fontSize: '0.75rem' }}
          >
            {t('promotions.create', 'Nouvelle promotion')}
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={CARD_SX}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={HEAD_CELL_SX}>{t('promotions.col.channel', 'Channel')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('promotions.col.property', 'Propriete')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('promotions.col.type', 'Type')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="center">{t('promotions.col.discount', 'Reduction')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('promotions.col.dates', 'Dates')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="center">{t('promotions.col.status', 'Status')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="center">{t('promotions.col.enabled', 'Active')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {promotions.map((promo) => (
                <TableRow key={promo.id} hover>
                  <TableCell sx={CELL_SX}>
                    <Chip
                      label={promo.channelName}
                      size="small"
                      sx={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        backgroundColor: channelColor(promo.channelName),
                        color: '#fff',
                        height: 22,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={CELL_SX}>
                    {propertyMap[promo.propertyId] ?? `#${promo.propertyId}`}
                  </TableCell>
                  <TableCell sx={CELL_SX}>
                    {PROMOTION_TYPE_LABELS[promo.promotionType] ?? promo.promotionType}
                  </TableCell>
                  <TableCell sx={{ ...CELL_SX, fontWeight: 600 }} align="center">
                    {promo.discountPercentage != null ? `${promo.discountPercentage}%` : '—'}
                  </TableCell>
                  <TableCell sx={{ ...CELL_SX, fontSize: '0.75rem' }}>
                    {promo.startDate && promo.endDate
                      ? `${new Date(promo.startDate).toLocaleDateString('fr-FR')} → ${new Date(promo.endDate).toLocaleDateString('fr-FR')}`
                      : '—'}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={promo.status}
                      size="small"
                      sx={{
                        fontSize: '0.625rem',
                        height: 20,
                        fontWeight: 700,
                        backgroundColor: PROMOTION_STATUS_COLORS[promo.status] ?? '#9e9e9e',
                        color: '#fff',
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      size="small"
                      checked={promo.enabled}
                      onChange={() => handleToggle(promo.id)}
                      disabled={toggleMutation.isPending}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.edit', 'Modifier')}>
                      <IconButton size="small" onClick={() => handleOpenEdit(promo)}>
                        <EditIcon sx={{ fontSize: '1rem' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete', 'Supprimer')}>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(promo)}>
                        <DeleteIcon sx={{ fontSize: '1rem' }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.color }} />
                    {c.label}
                  </Box>
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

          <Box sx={{ display: 'flex', gap: 1.5 }}>
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
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormOpen(false)} size="small" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSubmit}
            disabled={isMutating || !formData.propertyId}
            sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
          >
            {isMutating ? <CircularProgress size={16} /> : editingPromo ? t('common.save', 'Enregistrer') : t('common.create', 'Creer')}
          </Button>
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
    </Box>
  );
};

export default ChannelPromotionsPage;
