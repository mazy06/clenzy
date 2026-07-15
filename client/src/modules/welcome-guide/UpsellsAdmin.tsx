import React, { useState, useEffect, useMemo } from 'react';
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
  InputAdornment,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { AlertColor, SxProps, Theme } from '@mui/material';
import { Add, Save, Edit, Delete } from '../../icons';
import {
  Receipt, Percent, Wallet, Tag, Sparkles, ImagePlus,
  LogIn, Clock, Coffee, Car, SquareParking,
  SlidersHorizontal, Search, BookOpen, Network, ChevronRight, ArrowLeft, Eye, Home,
  MoreHorizontal, Power,
} from 'lucide-react';
// Feuille de style « studio accueil » partagée (scopée .be-home, accent indigo).
import '../booking-engine/studio/studioHome.css';
import ServicesCatalog from './marketplace/ServicesCatalog';
import { type MarketplaceExperience } from './marketplace/marketplaceData';
import { useTranslation } from '../../hooks/useTranslation';
import { usePropertiesList } from '../../hooks/usePropertiesList';
import { useCurrency } from '../../hooks/useCurrency';
import { softChipSx, semanticToHex } from '../../utils/statusUtils';
import { usePageHeaderActions, usePageHeaderFilters } from '../../components/PageHeaderActionsContext';
import { Money } from '../../components/Money';
import { SectionHeading } from './formPrimitives';
import ConfirmationModal from '../../components/ConfirmationModal';
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
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Actions d'en-tête uniformes (même hauteur / rayon / typo). Deux secondaires
// « ghost » (Commissions, Ventes) + une primaire pleine (Nouveau service).
const HEADER_ACTION_BASE = {
  height: 34, textTransform: 'none', fontWeight: 600, fontSize: 13,
  borderRadius: '10px', px: 1.75, whiteSpace: 'nowrap',
  '& .MuiButton-startIcon': { mr: 0.625 },
} satisfies SxProps<Theme>;
const headerSecondarySx: SxProps<Theme> = {
  ...HEADER_ACTION_BASE,
  color: 'var(--body)', borderColor: 'var(--line-2)', bgcolor: 'transparent',
  '&:hover': { borderColor: 'var(--faint)', bgcolor: 'var(--hover)' },
};
const headerPrimarySx: SxProps<Theme> = {
  ...HEADER_ACTION_BASE,
  boxShadow: 'none',
  '&:hover': { boxShadow: 'none' },
};
// Filtres dans le PageHeader (Canal / Catégorie) : boutons étiquetés (icône en
// enfant, PAS startIcon → non repliés en icon-only par PageHeaderActions).
const headerFilterSx = {
  height: 34, textTransform: 'none', fontWeight: 600, fontSize: 13,
  borderRadius: '10px', px: 1.5, gap: 0.75, whiteSpace: 'nowrap',
  color: 'var(--body)', borderColor: 'var(--line-2)', bgcolor: 'transparent',
  '& svg': { color: 'var(--muted)' },
  '&:hover': { borderColor: 'var(--faint)', bgcolor: 'var(--hover)' },
} satisfies SxProps<Theme>;
const headerFilterActiveSx: SxProps<Theme> = {
  ...headerFilterSx,
  color: 'var(--accent)', borderColor: 'var(--accent)', bgcolor: 'var(--accent-soft)',
  '& svg': { color: 'var(--accent)' },
};

// Icône lucide par type de service.
const TYPE_ICON: Record<string, typeof Tag> = {
  EARLY_CHECKIN: LogIn, LATE_CHECKOUT: Clock, CLEANING: Sparkles,
  TRANSFER: Car, BREAKFAST: Coffee, PARKING: SquareParking,
};
const typeIcon = (type: string): typeof Tag => TYPE_ICON[type] ?? Tag;

// Marketplace partenaire : données (fixtures) + composant refondu dans `./marketplace/` (refonte 2026-06).
type CanalFilter = 'all' | 'livret' | 'booking';
/** Données minimales d'aperçu guest d'un service (carte telle que vue par le voyageur). */
interface PreviewData { title: string; description: string | null; price: number; currency: string; imageUrl: string | null; }
// null = vue catalogue ; sinon = écran détaillé (service interne ou expérience partenaire).
type Selected = { kind: 'internal'; id: number };

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
  minNights: string;
  leadTimeHours: string;
  bundleOfferIds: string[];
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
  minNights: '',
  leadTimeHours: '',
  bundleOfferIds: [],
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
  const { t } = useTranslation();
  const { properties } = usePropertiesList();
  const { convert } = useCurrency();

  const { data: offers = [], isLoading, refetch } = useQuery({
    queryKey: ['upsell-offers'],
    queryFn: () => upsellApi.listOffers(),
  });

  // Ventes : chargées dès le montage (KPIs + perf par service + dialog Ventes).
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['upsell-orders'],
    queryFn: () => upsellApi.listOrders(),
  });

  // ── Vue catalogue ↔ détail + filtres ──────────────────────────────────────
  const [selected, setSelected] = useState<Selected | null>(null);
  const [search, setSearch] = useState('');
  const [canalFilter, setCanalFilter] = useState<CanalFilter>('all');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [canalAnchor, setCanalAnchor] = useState<HTMLElement | null>(null);
  const [catAnchor, setCatAnchor] = useState<HTMLElement | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [previewOffer, setPreviewOffer] = useState<PreviewData | null>(null);

  const [edit, setEdit] = useState<EditState>(emptyEdit);
  const [saving, setSaving] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [commissionsOpen, setCommissionsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UpsellOffer | null>(null);
  // Menu « … » d'actions par ligne (table « Mes services », parité Booking Engine / Welcome guide).
  const [rowMenu, setRowMenu] = useState<{ el: HTMLElement; offer: UpsellOffer } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: AlertColor }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const notify = (message: string, severity: AlertColor = 'success') =>
    setSnackbar({ open: true, message, severity });

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

  // ── KPIs + performance (30 j), branchés sur les ventes réelles ─────────────
  const paidLast30 = useMemo(() => {
    const now = Date.now();
    return orders.filter((o) => {
      if (o.status !== 'PAID' && !o.paidAt) return false;
      if (!o.createdAt) return false;
      return now - new Date(o.createdAt).getTime() <= THIRTY_DAYS_MS;
    });
  }, [orders]);
  const activeCount = useMemo(() => offers.filter((o) => o.active).length, [offers]);
  const bookings30 = paidLast30.length;
  // Revenu agrégé converti dans la devise d'affichage (somme correcte multi-devise).
  const revenue30 = useMemo(
    () => paidLast30.reduce((sum, o) => sum + convert(o.amount, o.currency), 0),
    [paidLast30, convert],
  );
  // Perf par service, matché par titre (les ventes ne portent pas l'id d'offre).
  const perfByTitle = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const o of paidLast30) {
      const cur = map.get(o.title) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += convert(o.amount, o.currency);
      map.set(o.title, cur);
    }
    return map;
  }, [paidLast30, convert]);
  const perfFor = (title: string) => perfByTitle.get(title) ?? { count: 0, revenue: 0 };

  const presentTypes = useMemo(() => Array.from(new Set(offers.map((o) => o.type))), [offers]);

  const filteredOffers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offers.filter((o) => {
      if (catFilter && o.type !== catFilter) return false;
      // Filtre par canal de diffusion (persisté : diffuseOnLivret / diffuseOnBooking).
      if (canalFilter === 'livret' && !o.diffuseOnLivret) return false;
      if (canalFilter === 'booking' && !o.diffuseOnBooking) return false;
      if (q && !o.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [offers, catFilter, canalFilter, search]);

  // Refermer le détail si le service affiché a été supprimé.
  useEffect(() => {
    if (selected?.kind === 'internal' && !isLoading && !offers.some((o) => o.id === selected.id)) {
      setSelected(null);
    }
  }, [selected, offers, isLoading]);

  const openInternalDetail = (o: UpsellOffer) => {
    setSelected({ kind: 'internal', id: o.id });
  };

  const openCreate = (prefill?: Partial<EditState>) => setEdit({ ...emptyEdit, open: true, ...prefill });
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
      minNights: o.minNights != null ? String(o.minNights) : '',
      leadTimeHours: o.leadTimeHours != null ? String(o.leadTimeHours) : '',
      bundleOfferIds: o.bundleOfferIds ? o.bundleOfferIds.split(',').map((x) => x.trim()).filter(Boolean) : [],
    });

  // « Ajouter » depuis la marketplace : création directe (optimiste côté ServicesCatalog) → service interne.
  const handleMarketplaceAdd = async (m: MarketplaceExperience) => {
    try {
      await upsellApi.createOffer({ type: 'EXPERIENCE', title: m.title, description: m.desc, price: m.price, currency: DEFAULT_CURRENCY, active: true });
      await refetch();
      notify(`« ${m.title} » ajouté à vos services.`, 'success');
    } catch (e) {
      notify(t('upsells.messages.error', 'Une erreur est survenue'), 'error');
      throw e; // remonte pour que ServicesCatalog annule l'état optimiste
    }
  };

  // Aperçu guest d'un service : à brancher (pas de route d'aperçu par service pour l'instant).
  // Aperçu guest d'un service : ouvre un modal rendant la carte telle que le voyageur la voit (livret /
  // booking engine). Données minimales (titre/desc/prix/image) — pas d'achat (aperçu non interactif).
  const handlePreview = (data: PreviewData) => setPreviewOffer(data);

  // Statut on/off — persisté via updateOffer (CAS simple : on renvoie l'offre, active inversé).
  const toggleActive = async (o: UpsellOffer) => {
    setTogglingId(o.id);
    try {
      await upsellApi.updateOffer(o.id, {
        propertyId: o.propertyId,
        type: o.type,
        title: o.title,
        description: o.description,
        price: o.price,
        currency: o.currency,
        imageUrl: o.imageUrl,
        active: !o.active,
        sortOrder: o.sortOrder,
        minNights: o.minNights,
        leadTimeHours: o.leadTimeHours,
        bundleOfferIds: o.bundleOfferIds,
      });
      await refetch();
    } catch {
      notify(t('upsells.messages.error', 'Une erreur est survenue'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  // Diffusion par canal (livret / booking engine) — persistée via updateOffer (colonnes back 0280).
  const setChannel = async (o: UpsellOffer, channel: 'livret' | 'booking', value: boolean) => {
    setTogglingId(o.id);
    try {
      await upsellApi.updateOffer(o.id, {
        propertyId: o.propertyId,
        type: o.type,
        title: o.title,
        description: o.description,
        price: o.price,
        currency: o.currency,
        imageUrl: o.imageUrl,
        active: o.active,
        sortOrder: o.sortOrder,
        minNights: o.minNights,
        leadTimeHours: o.leadTimeHours,
        bundleOfferIds: o.bundleOfferIds,
        diffuseOnLivret: channel === 'livret' ? value : o.diffuseOnLivret,
        diffuseOnBooking: channel === 'booking' ? value : o.diffuseOnBooking,
      });
      await refetch();
    } catch {
      notify(t('upsells.messages.error', 'Une erreur est survenue'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

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
        minNights: edit.minNights ? Number(edit.minNights) : null,
        leadTimeHours: edit.leadTimeHours ? Number(edit.leadTimeHours) : null,
        bundleOfferIds: edit.bundleOfferIds.length ? edit.bundleOfferIds.join(',') : null,
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

  const handleDelete = (o: UpsellOffer) => setDeleteTarget(o);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await upsellApi.removeOffer(deleteTarget.id);
      notify(t('upsells.messages.deleted', 'Service supprimé'));
      setDeleteTarget(null);
      await refetch();
    } catch {
      notify(t('upsells.messages.error', 'Une erreur est survenue'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const propertyName = (id: number | null) =>
    id == null
      ? t('upsells.allProperties', 'Toutes les propriétés')
      : properties.find((p) => String(p.id) === String(id))?.name ?? `#${id}`;

  const orderStatusLabel = (status: string) => t(`upsells.status.${status}`, status);

  // Active un handler au clavier (Enter / Espace) — lignes & cartes cliquables.
  // Garde-fou : ne déclenche que si l'élément lui-même a le focus (et non un
  // bouton interne : statut, « Ajouter »), pour éviter une double action.
  const onActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  const editingOffer = edit.id != null ? offers.find((o) => o.id === edit.id) ?? null : null;

  // Actions portées dans le PageHeader (slot multi-tabs partagé) — comme l'onglet Livret.
  const headerActions = usePageHeaderActions(
    <>
      <Button variant="outlined" sx={headerSecondarySx} startIcon={<Percent size={15} strokeWidth={2} />} onClick={() => setCommissionsOpen(true)}>
        {t('upsells.actions.commissions', 'Commissions')}
      </Button>
      <Button variant="outlined" sx={headerSecondarySx} startIcon={<Receipt size={15} strokeWidth={2} />} onClick={() => setOrdersOpen(true)}>
        {t('upsells.actions.orders', 'Ventes')}
      </Button>
      <Button variant="contained" disableElevation sx={headerPrimarySx} startIcon={<Add size={15} strokeWidth={2} />} onClick={() => openCreate()}>
        {t('upsells.actions.new', 'Nouveau service')}
      </Button>
    </>,
  );

  // Filtres portés dans le PageHeader (recherche + Canal + Catégorie). Uniquement
  // en vue catalogue (masqués sur l'écran détaillé d'un service).
  const headerFilters = usePageHeaderFilters(
    selected ? null : (
      <>
        <Button variant="outlined" size="small" sx={canalFilter !== 'all' ? headerFilterActiveSx : headerFilterSx} onClick={(e) => setCanalAnchor(e.currentTarget)}>
          <SlidersHorizontal size={15} strokeWidth={2} /> {canalFilter === 'livret' ? t('upsells.channel.guide', 'Livret') : canalFilter === 'booking' ? t('upsells.channel.booking', 'Booking') : t('upsells.filters.channel', 'Canal')}
        </Button>
        <Button variant="outlined" size="small" sx={catFilter ? headerFilterActiveSx : headerFilterSx} onClick={(e) => setCatAnchor(e.currentTarget)}>
          <Tag size={15} strokeWidth={2} /> {catFilter ? typeLabel(catFilter) : t('upsells.filters.category', 'Catégorie')}
        </Button>
        <TextField
          size="small"
          placeholder={t('upsells.search.placeholder', 'Rechercher un service…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
                  <Search size={'1.05rem'} strokeWidth={2} />
                </Box>
              </InputAdornment>
            ),
          }}
          sx={{ width: { xs: 150, sm: 230 }, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.8125rem', height: 34 } }}
        />
      </>
    ),
  );

  // ── Catalogue (vue liste) ──────────────────────────────────────────────────
  const renderList = () => (
    <>
      {/* Catalogue unifié : services internes + expériences partenaires (filtre source + pagination).
          Recherche / filtres Canal-Catégorie restent dans le PageHeader (alimentent filteredOffers). */}
      <ServicesCatalog
        loading={isLoading}
        offers={filteredOffers}
        search={search}
        addedTitles={offers.map((o) => o.title)}
        typeLabel={typeLabel}
        onAdd={handleMarketplaceAdd}
        onOpenInternal={openInternalDetail}
        onMenuInternal={(el, o) => setRowMenu({ el, offer: o })}
        kpis={(
          <div className="svc-band">
            <div className="kpis">
              <div className="kpi"><b>{activeCount}</b><span>{t('upsells.kpi.active', 'Services actifs')}</span></div>
              <div className="kpi"><b>{bookings30}</b><span>{t('upsells.kpi.bookings', 'Réservations · 30 j')}</span></div>
              <div className="kpi"><b><Money value={revenue30} decimals={0} /></b><span>{t('upsells.kpi.revenue', 'Revenu · 30 j')}</span></div>
            </div>
          </div>
        )}
      />

      <Menu anchorEl={canalAnchor} open={!!canalAnchor} onClose={() => setCanalAnchor(null)}>
        {(['all', 'livret', 'booking'] as CanalFilter[]).map((v) => (
          <MenuItem key={v} selected={canalFilter === v} onClick={() => { setCanalFilter(v); setCanalAnchor(null); }}>
            {v === 'all' ? t('upsells.filters.allChannels', 'Tous les canaux') : v === 'livret' ? t('upsells.channel.guide', 'Livret') : t('upsells.channel.booking', 'Booking')}
          </MenuItem>
        ))}
      </Menu>
      <Menu anchorEl={catAnchor} open={!!catAnchor} onClose={() => setCatAnchor(null)}>
        <MenuItem selected={!catFilter} onClick={() => { setCatFilter(null); setCatAnchor(null); }}>
          {t('upsells.filters.allCategories', 'Toutes les catégories')}
        </MenuItem>
        {presentTypes.map((tp) => (
          <MenuItem key={tp} selected={catFilter === tp} onClick={() => { setCatFilter(tp); setCatAnchor(null); }}>
            {typeLabel(tp)}
          </MenuItem>
        ))}
      </Menu>
      {/* Menu d'actions par ligne — toggle actif / modifier / supprimer (aucune action perdue). */}
      <Menu anchorEl={rowMenu?.el ?? null} open={!!rowMenu} onClose={() => setRowMenu(null)}>
        {rowMenu && ([
          <MenuItem key="toggle" disabled={togglingId === rowMenu.offer.id} onClick={() => { toggleActive(rowMenu.offer); setRowMenu(null); }} sx={{ fontSize: 13, gap: 1 }}>
            <Power size={16} strokeWidth={2} /> {rowMenu.offer.active ? t('upsells.actions.deactivate', 'Désactiver') : t('upsells.actions.activate', 'Activer')}
          </MenuItem>,
          <MenuItem key="edit" onClick={() => { openEdit(rowMenu.offer); setRowMenu(null); }} sx={{ fontSize: 13, gap: 1 }}>
            <Edit size={16} strokeWidth={2} /> {t('upsells.actions.edit', 'Modifier')}
          </MenuItem>,
          <MenuItem key="del" onClick={() => { handleDelete(rowMenu.offer); setRowMenu(null); }} sx={{ fontSize: 13, gap: 1, color: 'error.main' }}>
            <Delete size={16} strokeWidth={2} /> {t('upsells.actions.delete', 'Supprimer')}
          </MenuItem>,
        ])}
      </Menu>
    </>
  );

  // ── Écran détaillé ──────────────────────────────────────────────────────────
  const renderDetail = () => {
    if (!selected) return null;
    const backBtn = (
      <button type="button" className="back" onClick={() => setSelected(null)}>
        <ArrowLeft size={16} strokeWidth={2} /> {t('upsells.detail.back', 'Services payants')}
      </button>
    );

    if (selected.kind === 'internal') {
      const offer = offers.find((o) => o.id === selected.id);
      if (!offer) return null;
      const Ic = typeIcon(offer.type);
      const perf = perfFor(offer.title);
      const ch = { livret: offer.diffuseOnLivret, booking: offer.diffuseOnBooking };
      const chanBusy = togglingId === offer.id;
      return (
        <div className="detail">
          {backBtn}
          <div className="dhead">
            <div className="dhead__ic"><Ic size={28} strokeWidth={2} /></div>
            <div className="dhead__t">
              <h1>{offer.title}</h1>
              <div className="dhead__meta">
                <span>{typeLabel(offer.type)}</span><span>·</span>
                <span className="src-tag int"><span className="pdot" style={{ background: 'var(--accent)' }} />{t('upsells.detail.internal', 'Service interne')}</span>
              </div>
            </div>
            <div className="dhead__act">
              <button type="button" className="btn-ghost" onClick={() => handlePreview({ title: offer.title, description: offer.description, price: offer.price, currency: offer.currency, imageUrl: offer.imageUrl })}><Eye size={16} strokeWidth={2} /> {t('upsells.detail.preview', 'Aperçu')}</button>
              <Button variant="contained" size="small" startIcon={<Edit size={16} strokeWidth={2} />} onClick={() => openEdit(offer)}>
                {t('upsells.detail.edit', 'Modifier')}
              </Button>
            </div>
          </div>

          <div className="dgrid">
            <div>
              <div className="dcard">
                <h3>{t('upsells.detail.description', 'Description')}</h3>
                <p className="lead">{offer.description || t('upsells.detail.noDescription', 'Aucune description.')}</p>
                <div className="gallery">
                  {offer.imageUrl
                    ? [0, 1, 2].map((i) => (
                        <Box key={i} component="i" sx={{ backgroundImage: `url(${offer.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: i === 0 ? 1 : 0.55 }} />
                      ))
                    : [0, 1, 2].map((i) => (
                        <i key={i} style={{ background: 'linear-gradient(150deg,#c7c6ee,#a9a8e0)', opacity: 0.85 }} />
                      ))}
                </div>
              </div>
              <div className="dcard">
                <h3>{t('upsells.detail.pricing', 'Tarification')}</h3>
                <div className="price-row"><b><Money value={offer.price} from={offer.currency} /></b><span>{t('upsells.detail.perReservationUnit', 'par réservation')}</span></div>
                <div className="deflist">
                  <div className="d"><span>{t('upsells.detail.billing', 'Facturation')}</span><b>{t('upsells.detail.perReservation', 'Par réservation')}</b></div>
                  <div className="d"><span>{t('upsells.detail.availability', 'Disponibilité')}</span><b>{propertyName(offer.propertyId)}</b></div>
                  <div className="d"><span>{t('upsells.fields.minNights', 'Séjour min.')}</span><b>{offer.minNights ? `${offer.minNights} ${t('upsells.detail.nights', 'nuits')}` : t('upsells.detail.none', 'Aucun')}</b></div>
                  <div className="d"><span>{t('upsells.detail.leadTime', 'Délai de commande')}</span><b>{offer.leadTimeHours ? `${offer.leadTimeHours} h` : t('upsells.detail.none', 'Aucun')}</b></div>
                </div>
              </div>
            </div>

            <aside>
              <div className="dcard">
                <h3>{t('upsells.detail.distribution', 'Distribution')}</h3>
                <div className="dist">
                  <div className="dist__row">
                    <span className="ic l"><BookOpen size={18} strokeWidth={2} /></span>
                    <div className="t"><b>{t('upsells.detail.guideChannel', "Livret d'accueil")}</b><small>{t('upsells.detail.guideChannelHint', 'Affiché dans la marketplace du livret')}</small></div>
                    <button type="button" className={`switch ${ch.livret ? '' : 'off'}`} disabled={chanBusy} aria-label={t('upsells.detail.guideChannel', "Livret d'accueil")} onClick={() => setChannel(offer, 'livret', !ch.livret)} />
                  </div>
                  <div className="dist__row">
                    <span className="ic b"><Network size={18} strokeWidth={2} /></span>
                    <div className="t"><b>{t('upsells.detail.bookingChannel', 'Booking Engine')}</b><small>{t('upsells.detail.bookingChannelHint', 'Proposé en extra au paiement')}</small></div>
                    <button type="button" className={`switch ${ch.booking ? '' : 'off'}`} disabled={chanBusy} aria-label={t('upsells.detail.bookingChannel', 'Booking Engine')} onClick={() => setChannel(offer, 'booking', !ch.booking)} />
                  </div>
                </div>
                <div className="scope-line"><Home size={15} strokeWidth={2} /> {t('upsells.detail.scope', 'Appliqué à')} <strong style={{ marginLeft: 4 }}>{propertyName(offer.propertyId)}</strong></div>
              </div>

              <div className="dcard">
                <h3>{t('upsells.detail.perf', 'Performance · 30 jours')}</h3>
                <div className="perf">
                  <div className="p"><b>{perf.count}</b><span>{t('upsells.detail.bookings', 'Réservations')}</span></div>
                  <div className="p"><b><Money value={perf.revenue} decimals={0} /></b><span>{t('upsells.detail.revenue', 'Revenu généré')}</span></div>
                  <div className="p full"><b>{perf.count ? <Money value={perf.revenue / perf.count} decimals={0} /> : '—'}</b><span>{t('upsells.detail.aov', 'Panier moyen')}</span></div>
                </div>
              </div>

              <div className="dcard">
                <h3>{t('upsells.detail.details', 'Détails')}</h3>
                <div className="deflist">
                  <div className="d"><span>{t('upsells.fields.type', 'Catégorie')}</span><b>{typeLabel(offer.type)}</b></div>
                  <div className="d"><span>{t('upsells.detail.source', 'Source')}</span><b>{t('upsells.detail.internalShort', 'Interne')}</b></div>
                  <div className="d"><span>{t('upsells.fields.currency', 'Devise')}</span><b>{offer.currency}</b></div>
                  <div className="d"><span>{t('upsells.detail.statusLabel', 'Statut')}</span><b style={{ color: offer.active ? 'var(--ok)' : 'var(--muted)' }}>{offer.active ? t('upsells.active', 'Actif') : t('upsells.inactive', 'Inactif')}</b></div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      );
    }

    // Détail d'une expérience partenaire : désormais géré par <ServicesCatalog> (état local interne).
    return null;
  };

  return (
    <Box>
      {headerActions}
      {headerFilters}

      {/* Aperçu guest d'un service : carte telle que le voyageur la voit (livret / booking engine). */}
      <Dialog open={!!previewOffer} onClose={() => setPreviewOffer(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('upsells.preview.title', 'Aperçu côté voyageur')}</DialogTitle>
        <DialogContent dividers>
          {previewOffer && (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', maxWidth: 320, mx: 'auto' }}>
              <Box sx={{
                height: 150, bgcolor: 'action.hover',
                backgroundImage: previewOffer.imageUrl ? `url(${previewOffer.imageUrl})` : 'none',
                backgroundSize: 'cover', backgroundPosition: 'center',
              }} />
              <Box sx={{ p: 2 }}>
                <Box sx={{ fontWeight: 600 }}>{previewOffer.title}</Box>
                {previewOffer.description ? (
                  <Box sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>{previewOffer.description}</Box>
                ) : null}
                <Box sx={{ fontWeight: 700, mt: 1 }}><Money value={previewOffer.price} from={previewOffer.currency} /></Box>
                <Button variant="contained" fullWidth sx={{ mt: 1.5 }} disabled>
                  {t('upsells.preview.add', 'Ajouter')}
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOffer(null)}>{t('common.close', 'Fermer')}</Button>
        </DialogActions>
      </Dialog>

      {/* Commissions (résumé activités + ma part conciergerie) — dans un dialog pour libérer l'écran. */}
      <Dialog open={commissionsOpen} onClose={() => setCommissionsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('upsells.commissions.dialogTitle', 'Commissions & ma part')}</DialogTitle>
        <DialogContent dividers>
      {commissionSummary ? (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ '&:last-child': { pb: 2 } }}>
            <SectionHeading
              icon={<Percent size={17} strokeWidth={1.75} />}
              title={t('upsells.commissions.title', 'Commissions activités')}
              actions={
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--ok)', lineHeight: 1.15 }}>
                    <Money value={commissionSummary.totalHostShare} from={commissionSummary.currency} />
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommissionsOpen(false)}>{t('upsells.actions.close', 'Fermer')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Catalogue des services distribués aux canaux (liste ↔ détail) ──── */}
      <Box className="be-home" data-accent="indigo">
        <div className="canvas" style={{ paddingTop: 8, maxWidth: 1160 }}>
          {selected ? renderDetail() : renderList()}
        </div>
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
            {/* Productisation (2.10) : conditionnel + fenêtre horaire de commande. */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                label={t('upsells.fields.minNights', 'Séjour min. (nuits)')}
                helperText={t('upsells.fields.minNightsHelp', 'Proposé si le séjour atteint ce nb de nuits. Vide = toujours.')}
                value={edit.minNights}
                onChange={(e) => setEdit((s) => ({ ...s, minNights: e.target.value }))}
                size="small"
                type="number"
                sx={{ width: 200 }}
                inputProps={{ min: 0, step: 1 }}
              />
              <TextField
                label={t('upsells.fields.leadTimeHours', 'Délai mini avant arrivée (h)')}
                helperText={t('upsells.fields.leadTimeHoursHelp', 'Commandable seulement si l’arrivée est ≥ X h. Vide = aucun délai.')}
                value={edit.leadTimeHours}
                onChange={(e) => setEdit((s) => ({ ...s, leadTimeHours: e.target.value }))}
                size="small"
                type="number"
                sx={{ flex: 1, minWidth: 220 }}
                inputProps={{ min: 0, step: 1 }}
              />
            </Box>
            <TextField
              select
              label={t('upsells.fields.bundle', 'Offres incluses (bundle)')}
              helperText={t('upsells.fields.bundleHelp', 'Sélectionne des offres → celle-ci devient un bundle (prix combiné, défini ci-dessus).')}
              value={edit.bundleOfferIds}
              onChange={(e) => {
                const v = e.target.value as unknown as string[];
                setEdit((s) => ({ ...s, bundleOfferIds: typeof v === 'string' ? (v as string).split(',') : v }));
              }}
              size="small"
              fullWidth
              SelectProps={{ multiple: true }}
            >
              {offers.flatMap((o) =>
                o.id !== edit.id ? [<MenuItem key={o.id} value={String(o.id)}>{o.title}</MenuItem>] : [],
              )}
            </TextField>
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
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          {editingOffer ? (
            <Button color="error" startIcon={<Delete size={15} strokeWidth={1.75} />} onClick={() => { const o = editingOffer; setEdit(emptyEdit); handleDelete(o); }}>
              {t('upsells.actions.delete', 'Supprimer')}
            </Button>
          ) : <span />}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setEdit(emptyEdit)}>{t('upsells.actions.cancel', 'Annuler')}</Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save size={14} strokeWidth={1.75} />}
              onClick={handleSave}
              disabled={saving}
            >
              {t('upsells.actions.save', 'Enregistrer')}
            </Button>
          </Box>
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
                      <Money value={order.amount} from={order.currency} />
                      {order.hostAmount != null ? (
                        <>
                          {' · '}{t('upsells.orders.yourShare', 'votre part')}{' '}
                          <Money value={order.hostAmount} from={order.currency} />
                        </>
                      ) : null}
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

      <ConfirmationModal
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        title={t('upsells.messages.confirmDelete', 'Supprimer ce service ?')}
        message={t(
          'upsells.messages.confirmDeleteHint',
          'Ce service et ses informations seront supprimés définitivement. Cette action est irréversible.',
        )}
        confirmText={t('upsells.actions.delete', 'Supprimer')}
        cancelText={t('upsells.actions.cancel', 'Annuler')}
        severity="error"
        loading={deleting}
      />

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
