import React, { useState } from 'react';
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
import { Receipt, Percent } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import { usePropertiesList } from '../../hooks/usePropertiesList';
import { softChipSx, semanticToHex } from '../../utils/statusUtils';
import { upsellApi, type UpsellOffer, type UpsellOrder } from '../../services/api/upsellApi';
import { activitiesApi } from '../../services/api/activitiesApi';

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

const UpsellsAdmin: React.FC = () => {
  const { t } = useTranslation();
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

  const typeLabel = (id: string) => t(`upsells.types.${id}`, TYPE_FALLBACK[id] ?? id);
  const fmtMoney = (amount: number | null, currency: string) =>
    amount == null ? '—' : `${amount.toFixed(2)} ${currency}`;

  const openCreate = () => setEdit({ ...emptyEdit, open: true });
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
        <Button variant="outlined" size="small" startIcon={<Receipt size={14} strokeWidth={1.75} />} onClick={() => setOrdersOpen(true)}>
          {t('upsells.actions.orders', 'Ventes')}
        </Button>
        <Button variant="contained" size="small" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={openCreate}>
          {t('upsells.actions.new', 'Nouveau service')}
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        {t(
          'upsells.intro',
          "Proposez des services payants à vos voyageurs (arrivée anticipée, ménage, transfert…). Le paiement se fait depuis le livret ; votre part est reversée via vos paiements habituels (la plateforme prélève une commission).",
        )}
      </Alert>

      {commissionSummary ? (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent
            sx={{ display: 'flex', alignItems: 'center', gap: 2, '&:last-child': { pb: 2 }, flexWrap: 'wrap' }}
          >
            <Percent size={20} strokeWidth={1.75} style={{ color: '#4A9B8E', flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('upsells.commissions.title', 'Commissions activités')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('upsells.commissions.note', "Votre part sur les réservations d'activités, reversée via vos paiements. Active dès qu'un fournisseur d'activités est connecté.")}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#4A9B8E' }}>
                {commissionSummary.totalHostShare.toFixed(2)} {commissionSummary.currency}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {commissionSummary.count} {t('upsells.commissions.bookings', 'réservation(s)')}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : offers.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title={t('upsells.empty.title', 'Aucun service payant')}
          description={t('upsells.empty.description', 'Créez votre premier service additionnel à proposer aux voyageurs.')}
          action={
            <Button variant="contained" startIcon={<Add size={16} strokeWidth={1.75} />} onClick={openCreate}>
              {t('upsells.actions.new', 'Nouveau service')}
            </Button>
          }
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
            <TextField
              label={t('upsells.fields.imageUrl', "URL de l'image (optionnel)")}
              value={edit.imageUrl}
              onChange={(e) => setEdit((s) => ({ ...s, imageUrl: e.target.value }))}
              size="small"
              fullWidth
              placeholder="https://…"
            />
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
