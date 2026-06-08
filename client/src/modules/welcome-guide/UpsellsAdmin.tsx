import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { AlertColor } from '@mui/material';
import { Add, Save, Edit, Delete } from '../../icons';
import { Receipt, Percent, Wallet, Tag, Sparkles, ImagePlus } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { usePropertiesList } from '../../hooks/usePropertiesList';
import { softChipSx, semanticToHex } from '../../utils/statusUtils';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import { SectionHeading, EmptyHint } from './formPrimitives';
import { guideIcon } from './guideIcons';
import { upsellSuggestions, type UpsellSuggestion } from './upsellTemplate';
import { upsellApi, type UpsellOffer, type UpsellOrder } from '../../services/api/upsellApi';
import { activitiesApi } from '../../services/api/activitiesApi';
import { monetizationConfigApi } from '../../services/api/monetizationConfigApi';

const TYPE_FALLBACK: Record<string, string> = {
  EARLY_CHECKIN: 'Arrivée anticipée',
  LATE_CHECKOUT: 'Départ tardif',
  CLEANING: 'Ménage',
  TRANSFER: 'Transfert',
  BREAKFAST: 'Petit-déjeuner',
  PARKING: 'Parking',
  EQUIPMENT: 'Équipement',
  EXPERIENCE: 'Expérience',
  OTHER: 'Autre',
};
const TYPES = Object.keys(TYPE_FALLBACK);
const DEFAULT_CURRENCY = 'EUR';

interface EditState {
  open: boolean;
  id: number | null;
  type: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  imageUrl: string;
  propertyId: string;
  active: boolean;
}

const emptyEdit: EditState = {
  open: false,
  id: null,
  type: 'EARLY_CHECKIN',
  title: '',
  description: '',
  price: '',
  currency: DEFAULT_CURRENCY,
  imageUrl: '',
  propertyId: '',
  active: true,
};

/**
 * Compresse une image (fichier) en data URL JPEG base64, redimensionnée à `maxSize`px.
 * L'image des services est stockée en base (data URL) — pas d'URL externe. La vignette
 * est petite côté guest, donc on compresse fort pour garder un poids raisonnable.
 */
function compressImageToDataUrl(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode_failed'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('no_ctx'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const UpsellsAdmin: React.FC = () => {
  const { t, currentLanguage } = useTranslation();
  const { properties } = usePropertiesList();

  const { data: offers = [], isLoading, refetch } = useQuery({
    queryKey: ['upsell-offers'],
    queryFn: () => upsellApi.listOffers(),
  });

  const [edit, setEdit] = useState<EditState>(emptyEdit);
  const [saving, setSaving] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: AlertColor }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const notify = (message: string, severity: AlertColor = 'success') =>
    setSnackbar({ open: true, message, severity });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['upsell-orders'],
    queryFn: () => upsellApi.listOrders(),
    enabled: ordersOpen,
  });

  const { data: commissionSummary } = useQuery({
    queryKey: ['activity-commission-summary'],
    queryFn: () => activitiesApi.commissionSummary(),
  });

  // Commission org/conciergerie (éditable par l'org) — la commission plateforme est en lecture seule.
  const { data: monetConfig, refetch: refetchMonet } = useQuery({
    queryKey: ['monetization-config'],
    queryFn: () => monetizationConfigApi.get(),
  });
  const [orgUpsellPct, setOrgUpsellPct] = useState('');
  const [orgActivityPct, setOrgActivityPct] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);
  useEffect(() => {
    if (monetConfig) {
      setOrgUpsellPct(String(monetConfig.upsellOrgCommissionPct ?? 0));
      setOrgActivityPct(String(monetConfig.activityOrgCommissionPct ?? 0));
    }
  }, [monetConfig]);
  const saveOrgCommission = async () => {
    setSavingOrg(true);
    try {
      await monetizationConfigApi.updateOrg({
        upsellOrgCommissionPct: parseFloat(orgUpsellPct) || 0,
        activityOrgCommissionPct: parseFloat(orgActivityPct) || 0,
      });
      await refetchMonet();
      notify(t('upsells.orgCommission.saved', 'Commission enregistrée'));
    } catch {
      notify(t('upsells.messages.error', 'Une erreur est survenue'), 'error');
    } finally {
      setSavingOrg(false);
    }
  };

  const typeLabel = (id: string) => t(`upsells.types.${id}`, TYPE_FALLBACK[id] ?? id);
  const fmtMoney = (amount: number | null, currency: string) =>
    amount == null ? '—' : `${amount.toFixed(2)} ${currency}`;

  const openCreate = () => setEdit({ ...emptyEdit, open: true });
  // Pré-remplit l'éditeur depuis un service suggéré (l'hôte modifie/complète puis enregistre).
  const openFromSuggestion = (s: UpsellSuggestion) =>
    setEdit({
      open: true,
      id: null,
      type: s.type,
      title: s.title,
      description: s.description,
      price: String(s.price),
      currency: s.currency,
      imageUrl: '',
      propertyId: '',
      active: true,
    });
  const openEdit = (o: UpsellOffer) =>
    setEdit({
      open: true,
      id: o.id,
      type: o.type,
      title: o.title,
      description: o.description ?? '',
      price: String(o.price),
      currency: o.currency || DEFAULT_CURRENCY,
      imageUrl: o.imageUrl ?? '',
      propertyId: o.propertyId != null ? String(o.propertyId) : '',
      active: o.active,
    });

  // Upload d'une image → compressée en data URL base64, stockée en base (pas d'URL externe).
  const onImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify(t('upsells.messages.imageType', 'Veuillez choisir un fichier image.'), 'error');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      notify(t('upsells.messages.imageSize', 'Image trop lourde (max 12 Mo).'), 'error');
      return;
    }
    try {
      const dataUrl = await compressImageToDataUrl(file, 800, 0.78);
      setEdit((s) => ({ ...s, imageUrl: dataUrl }));
    } catch {
      notify(t('upsells.messages.error', 'Une erreur est survenue'), 'error');
    }
  };

  const handleSave = async () => {
    const priceNum = Number(edit.price);
    if (!edit.title.trim()) {
      notify(t('upsells.messages.titleRequired', 'Le titre est obligatoire'), 'error');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      notify(t('upsells.messages.priceRequired', 'Le prix doit être supérieur à 0'), 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        propertyId: edit.propertyId ? Number(edit.propertyId) : null,
        type: edit.type,
        title: edit.title.trim(),
        description: edit.description.trim() || null,
        price: priceNum,
        currency: edit.currency || DEFAULT_CURRENCY,
        imageUrl: edit.imageUrl.trim() || null,
        active: edit.active,
      };
      if (edit.id == null) {
        await upsellApi.createOffer(payload);
        notify(t('upsells.messages.created', 'Service créé'));
      } else {
        await upsellApi.updateOffer(edit.id, payload);
        notify(t('upsells.messages.updated', 'Service mis à jour'));
      }
      setEdit(emptyEdit);
      await refetch();
    } catch {
      notify(t('upsells.messages.error', 'Une erreur est survenue'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (o: UpsellOffer) => {
    if (!window.confirm(t('upsells.messages.confirmDelete', 'Supprimer ce service ?'))) return;
    try {
      await upsellApi.removeOffer(o.id);
      notify(t('upsells.messages.deleted', 'Service supprimé'));
      await refetch();
    } catch {
      notify(t('upsells.messages.error', 'Une erreur est survenue'), 'error');
    }
  };

  const propertyName = (id: number | null) =>
    id == null
      ? t('upsells.allProperties', 'Toutes les propriétés')
      : properties.find((p) => String(p.id) === String(id))?.name ?? `#${id}`;

  const orderStatusLabel = (status: string) => t(`upsells.status.${status}`, status);

  // Actions portées dans le PageHeader (slot multi-tabs partagé) — comme l'onglet Livret.
  const headerActions = usePageHeaderActions(
    <>
      <Button variant="outlined" size="small" startIcon={<Receipt size={14} strokeWidth={1.75} />} onClick={() => setOrdersOpen(true)}>
        {t('upsells.actions.orders', 'Ventes')}
      </Button>
      <Button variant="contained" size="small" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={openCreate}>
        {t('upsells.actions.new', 'Nouveau service')}
      </Button>
    </>,
  );

  return (
    <Box>
      {headerActions}

      {commissionSummary ? (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ '&:last-child': { pb: 2 } }}>
            <SectionHeading
              icon={<Percent size={17} strokeWidth={1.75} />}
              title={t('upsells.commissions.title', 'Commissions activités')}
              actions={
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#4A9B8E', lineHeight: 1.15 }}>
                    {commissionSummary.totalHostShare.toFixed(2)} {commissionSummary.currency}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {commissionSummary.count} {t('upsells.commissions.bookings', 'réservation(s)')}
                  </Typography>
                </Box>
              }
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {t('upsells.commissions.note', "Votre part sur les réservations d'activités, reversée via vos paiements. Active dès qu'un fournisseur d'activités est connecté.")}
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      {monetConfig ? (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ '&:last-child': { pb: 2 } }}>
            <SectionHeading
              icon={<Wallet size={17} strokeWidth={1.75} />}
              title={t('upsells.orgCommission.title', 'Ma commission (conciergerie)')}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {t('upsells.orgCommission.note', 'Votre part sur le reste après la commission plateforme. Le propriétaire reçoit le solde.')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {t('upsells.orgCommission.platformInfo', 'Commission plateforme (fixée par la plateforme)')} : {monetConfig.upsellPlatformFeePct}% · {monetConfig.activityPlatformCommissionPct}%
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <TextField
                type="number"
                size="small"
                fullWidth
                label={t('upsells.orgCommission.upsell', 'Ma part (upsells)')}
                value={orgUpsellPct}
                onChange={(e) => setOrgUpsellPct(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment>, inputProps: { min: 0, max: 100, step: 0.5 } }}
              />
              <TextField
                type="number"
                size="small"
                fullWidth
                label={t('upsells.orgCommission.activity', 'Ma part (activités)')}
                value={orgActivityPct}
                onChange={(e) => setOrgActivityPct(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment>, inputProps: { min: 0, max: 100, step: 0.5 } }}
              />
            </Stack>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.25 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={savingOrg ? <CircularProgress size={14} color="inherit" /> : <Save size={14} strokeWidth={1.75} />}
                disabled={savingOrg}
                onClick={saveOrgCommission}
              >
                {t('upsells.actions.save', 'Enregistrer')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : null}

      <SectionHeading
        icon={<Tag size={17} strokeWidth={1.75} />}
        title={t('upsells.section.title', 'Services proposés')}
      />
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : offers.length === 0 ? (
        <EmptyHint
          icon={<Tag size={18} strokeWidth={1.75} />}
          text={t('upsells.empty.description', 'Créez votre premier service additionnel à proposer aux voyageurs.')}
        />
      ) : (
        <Stack spacing={1.5}>
          {offers.map((o) => (
            <Card key={o.id} variant="outlined">
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, '&:last-child': { pb: 2 }, flexWrap: 'wrap' }}>
                {o.imageUrl ? (
                  <Box component="img" src={o.imageUrl} alt="" sx={{ width: 48, height: 48, borderRadius: 1.5, objectFit: 'cover', flexShrink: 0 }} />
                ) : null}
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {o.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {typeLabel(o.type)} · {propertyName(o.propertyId)}
                  </Typography>
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {o.price.toFixed(2)} {o.currency}
                </Typography>
                <Chip
                  size="small"
                  label={o.active ? t('upsells.active', 'Actif') : t('upsells.inactive', 'Inactif')}
                  sx={softChipSx(semanticToHex(o.active ? 'success' : 'default'))}
                />
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title={t('upsells.actions.edit', 'Modifier')}>
                    <IconButton size="small" onClick={() => openEdit(o)}>
                      <Edit size={16} strokeWidth={1.75} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('upsells.actions.delete', 'Supprimer')}>
                    <IconButton size="small" color="error" onClick={() => handleDelete(o)}>
                      <Delete size={16} strokeWidth={1.75} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Services suggérés : catalogue de base, un clic pré-remplit l'éditeur */}
      <Box sx={{ mt: 2.5 }}>
        <SectionHeading
          icon={<Sparkles size={17} strokeWidth={1.75} />}
          title={t('upsells.suggestions.title', 'Services suggérés')}
        />
        <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
          {upsellSuggestions(currentLanguage).map((s, i) => {
            const Icon = guideIcon(s.icon);
            return (
              <Card key={i} variant="outlined" sx={{ flexShrink: 0, width: 224 }}>
                <CardContent sx={{ '&:last-child': { pb: 1.5 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box sx={{ flexShrink: 0, width: 34, height: 34, borderRadius: 1.5, bgcolor: 'action.hover', color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={18} strokeWidth={1.75} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{s.title}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ minHeight: 32 }}>{s.description}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.price.toFixed(0)} {s.currency}</Typography>
                    <Button size="small" variant="outlined" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={() => openFromSuggestion(s)}>
                      {t('upsells.actions.add', 'Ajouter')}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </Box>

      {/* Éditeur d'offre */}
      <Dialog open={edit.open} onClose={() => setEdit(emptyEdit)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {edit.id == null ? t('upsells.form.createTitle', 'Nouveau service') : t('upsells.form.editTitle', 'Modifier le service')}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                select
                label={t('upsells.fields.type', 'Catégorie')}
                value={edit.type}
                onChange={(e) => setEdit((s) => ({ ...s, type: e.target.value }))}
                size="small"
                sx={{ minWidth: 180 }}
              >
                {TYPES.map((id) => (
                  <MenuItem key={id} value={id}>
                    {typeLabel(id)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('upsells.fields.title', 'Titre')}
                value={edit.title}
                onChange={(e) => setEdit((s) => ({ ...s, title: e.target.value }))}
                size="small"
                sx={{ flex: 1, minWidth: 200 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                label={t('upsells.fields.price', 'Prix')}
                value={edit.price}
                onChange={(e) => setEdit((s) => ({ ...s, price: e.target.value }))}
                size="small"
                type="number"
                sx={{ width: 140 }}
                inputProps={{ min: 0, step: '0.01' }}
              />
              <TextField
                label={t('upsells.fields.currency', 'Devise')}
                value={edit.currency}
                onChange={(e) => setEdit((s) => ({ ...s, currency: e.target.value.toUpperCase() }))}
                size="small"
                sx={{ width: 100 }}
                inputProps={{ maxLength: 3 }}
              />
              <TextField
                select
                label={t('upsells.fields.property', 'Propriété')}
                value={edit.propertyId}
                onChange={(e) => setEdit((s) => ({ ...s, propertyId: e.target.value }))}
                size="small"
                sx={{ flex: 1, minWidth: 180 }}
              >
                <MenuItem value="">{t('upsells.allProperties', 'Toutes les propriétés')}</MenuItem>
                {properties.map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <TextField
              label={t('upsells.fields.description', 'Description (optionnel)')}
              value={edit.description}
              onChange={(e) => setEdit((s) => ({ ...s, description: e.target.value }))}
              size="small"
              fullWidth
              multiline
              minRows={2}
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                {t('upsells.fields.image', 'Image (optionnel)')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                {edit.imageUrl ? (
                  <Box
                    component="img"
                    src={edit.imageUrl}
                    alt=""
                    sx={{ width: 72, height: 72, borderRadius: 1.5, objectFit: 'cover', display: 'block', border: '1px solid', borderColor: 'divider' }}
                  />
                ) : null}
                <Button component="label" variant="outlined" size="small" startIcon={<ImagePlus size={15} strokeWidth={1.75} />}>
                  {edit.imageUrl ? t('upsells.fields.imageChange', 'Changer') : t('upsells.fields.imageUpload', 'Choisir une image')}
                  <input type="file" accept="image/*" hidden onChange={onImageFile} />
                </Button>
                {edit.imageUrl ? (
                  <Button size="small" color="error" onClick={() => setEdit((s) => ({ ...s, imageUrl: '' }))}>
                    {t('upsells.fields.imageRemove', 'Retirer')}
                  </Button>
                ) : null}
              </Box>
            </Box>
            <FormControlLabel
              control={<Switch checked={edit.active} onChange={(e) => setEdit((s) => ({ ...s, active: e.target.checked }))} />}
              label={t('upsells.fields.active', 'Service actif (visible sur le livret)')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEdit(emptyEdit)}>{t('upsells.actions.cancel', 'Annuler')}</Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save size={14} strokeWidth={1.75} />}
            onClick={handleSave}
            disabled={saving}
          >
            {t('upsells.actions.save', 'Enregistrer')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ventes */}
      <Dialog open={ordersOpen} onClose={() => setOrdersOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('upsells.orders.title', 'Ventes de services')}</DialogTitle>
        <DialogContent dividers>
          {ordersLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : orders.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('upsells.orders.empty', 'Aucune vente pour le moment.')}
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              {orders.map((order: UpsellOrder) => (
                <Box key={order.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {order.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={orderStatusLabel(order.status)}
                      sx={softChipSx(semanticToHex(order.status === 'PAID' ? 'success' : 'default'))}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
                    <Typography variant="caption" color="text.secondary">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}
                      {order.guestEmail ? ` · ${order.guestEmail}` : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoney(order.amount, order.currency)}
                      {order.hostAmount != null
                        ? ` · ${t('upsells.orders.yourShare', 'votre part')} ${fmtMoney(order.hostAmount, order.currency)}`
                        : ''}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrdersOpen(false)}>{t('upsells.actions.close', 'Fermer')}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UpsellsAdmin;
