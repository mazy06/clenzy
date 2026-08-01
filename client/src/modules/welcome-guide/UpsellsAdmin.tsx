import React, { useState, useEffect, useMemo } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { Info } from 'lucide-react';
import {
  Spinner,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Switch,
  Textarea,
} from '../../components/ui';
import { useQuery } from '@tanstack/react-query';
// Rescapes MUI. `Snackbar` + `Alert` flottante : changer le mecanisme de
// notification depasse la migration. `Menu`/`MenuItem` : le menu d'actions par
// ligne est declenche par un `anchorEl` fourni par <ServicesCatalog>, un
// DropdownMenu exigerait de deplacer le declencheur dans ce composant tiers ;
// les deux menus de filtre restent en MUI pour que les trois popups du meme
// ecran gardent le meme rendu. `TextField select multiple` : cf. commentaire
// au point d'usage.
import { Alert, Menu, MenuItem, Snackbar, TextField } from '@mui/material';
import type { AlertColor } from '@mui/material';
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
import { useScreenSearch } from '../../components/ScreenChrome';

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

// Filtre du PageHeader actif (Canal / Catégorie) : seule la teinte accent reste
// a porter, le gabarit (hauteur, rayon, graisse) vient du bouton du kit.
const HEADER_FILTER_ACTIVE = 'text-[var(--accent)] border-[var(--accent)] bg-[var(--accent-soft)]';

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
  // Recherche de l'écran → champ UNIQUE du PageHeader (cf. ScreenChrome).
  useScreenSearch(search, setSearch, t('upsells.search.placeholder', 'Rechercher un service…'));
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

  const editingOffer = edit.id != null ? offers.find((o) => o.id === edit.id) ?? null : null;

  // Actions portées dans le PageHeader (slot multi-tabs partagé) — comme l'onglet Livret.
  const headerActions = usePageHeaderActions(
    <>
      <Button variant="outline" onClick={() => setCommissionsOpen(true)}>
        <Percent size={15} strokeWidth={2} />
        {t('upsells.actions.commissions', 'Commissions')}
      </Button>
      <Button variant="outline" onClick={() => setOrdersOpen(true)}>
        <Receipt size={15} strokeWidth={2} />
        {t('upsells.actions.orders', 'Ventes')}
      </Button>
      <Button onClick={() => openCreate()}>
        <Add size={15} strokeWidth={2} />
        {t('upsells.actions.new', 'Nouveau service')}
      </Button>
    </>,
  );

  // Filtres portés dans le PageHeader (recherche + Canal + Catégorie). Uniquement
  // en vue catalogue (masqués sur l'écran détaillé d'un service).
  const headerFilters = usePageHeaderFilters(
    selected ? null : (
      <>
        <Button variant="outline" className={canalFilter !== 'all' ? HEADER_FILTER_ACTIVE : undefined} onClick={(e) => setCanalAnchor(e.currentTarget)}>
          <SlidersHorizontal size={15} strokeWidth={2} /> {canalFilter === 'livret' ? t('upsells.channel.guide', 'Livret') : canalFilter === 'booking' ? t('upsells.channel.booking', 'Booking') : t('upsells.filters.channel', 'Canal')}
        </Button>
        <Button variant="outline" className={catFilter ? HEADER_FILTER_ACTIVE : undefined} onClick={(e) => setCatAnchor(e.currentTarget)}>
          <Tag size={15} strokeWidth={2} /> {catFilter ? typeLabel(catFilter) : t('upsells.filters.category', 'Catégorie')}
        </Button>
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
              <Button size="sm" onClick={() => openEdit(offer)}>
                <Edit size={16} strokeWidth={2} />
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
                        // L'URL vient de la donnee : style inline, pas de classe generee.
                        <i key={i} style={{ backgroundImage: `url(${offer.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: i === 0 ? 1 : 0.55 }} />
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
    <div>
      {headerActions}
      {headerFilters}

      {/* Aperçu guest d'un service : carte telle que le voyageur la voit (livret / booking engine). */}
      <Dialog open={!!previewOffer} onOpenChange={(next) => !next && setPreviewOffer(null)}>
        <DialogContent className="sm:max-w-[444px]">
          <DialogHeader className="border-b pb-2">
            <DialogTitle>{t('upsells.preview.title', 'Aperçu côté voyageur')}</DialogTitle>
          </DialogHeader>
          {previewOffer && (
            <div className="border border-solid border-[var(--line)] rounded-[2px] overflow-hidden max-w-[320px] mx-auto">
              <div
                className="h-[150px] bg-[var(--hover)] bg-cover bg-center"
                style={{ backgroundImage: previewOffer.imageUrl ? `url(${previewOffer.imageUrl})` : 'none' }}
              />
              <div className="p-3">
                <div className="font-semibold">{previewOffer.title}</div>
                {previewOffer.description ? (
                  <div className="text-[14px] text-muted-foreground mt-0.5">{previewOffer.description}</div>
                ) : null}
                <div className="font-bold mt-1.5"><Money value={previewOffer.price} from={previewOffer.currency} /></div>
                <Button className="w-full mt-[9px] shrink" disabled>
                  {t('upsells.preview.add', 'Ajouter')}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewOffer(null)}>{t('common.close', 'Fermer')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commissions (résumé activités + ma part conciergerie) — dans un dialog pour libérer l'écran. */}
      <Dialog open={commissionsOpen} onOpenChange={(next) => !next && setCommissionsOpen(false)}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b pb-2">
            <DialogTitle>{t('upsells.commissions.dialogTitle', 'Commissions & ma part')}</DialogTitle>
          </DialogHeader>
          <div>
      {commissionSummary ? (
        <Card className="mb-3">
          <CardContent>
            <SectionHeading
              icon={<Percent size={17} strokeWidth={1.75} />}
              title={t('upsells.commissions.title', 'Commissions activités')}
              actions={
                <div className="text-end">
                  <h6 className="cn-text-subtitle1 font-bold tabular-nums text-[var(--ok)] leading-[1.15]">
                    <Money value={commissionSummary.totalHostShare} from={commissionSummary.currency} />
                  </h6>
                  <span className="cn-text-caption text-muted-foreground block">
                    {commissionSummary.count} {t('upsells.commissions.bookings', 'réservation(s)')}
                  </span>
                </div>
              }
            />
            <span className="cn-text-caption text-muted-foreground block">
              {t('upsells.commissions.note', "Votre part sur les réservations d'activités, reversée via vos paiements. Active dès qu'un fournisseur d'activités est connecté.")}
            </span>
          </CardContent>
        </Card>
      ) : null}

      {/* La part conciergerie sur les upsells se regle desormais dans
          Parametres > Paiement, avec les autres repartitions. La garder ici
          aussi donnait deux champs pour une meme valeur, chacun affichant
          l'ancienne tant que l'autre n'etait pas recharge. */}
      <UiAlert variant="info">
        <Info />
        <AlertDescription>{t(
          'upsells.orgCommission.movedToPayment',
          'Votre part sur les upsells se règle dans Paramètres › Paiement, onglet « Services & activités ».',
        )}</AlertDescription>
      </UiAlert>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCommissionsOpen(false)}>{t('upsells.actions.close', 'Fermer')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Catalogue des services distribués aux canaux (liste ↔ détail) ──── */}
      <div className="be-home" data-accent="indigo">
        <div className="canvas" style={{ paddingTop: 8, maxWidth: 1160 }}>
          {selected ? renderDetail() : renderList()}
        </div>
      </div>

      {/* Éditeur d'offre */}
      <Dialog open={edit.open} onOpenChange={(next) => !next && setEdit(emptyEdit)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="border-b pb-2">
            <DialogTitle>
              {edit.id == null ? t('upsells.form.createTitle', 'Nouveau service') : t('upsells.form.editTitle', 'Modifier le service')}
            </DialogTitle>
          </DialogHeader>
          <div className="-mx-4 max-h-[60vh] overflow-y-auto px-4">
          <div className="flex flex-col gap-3 mt-[3px]">
            <div className="flex gap-2 flex-wrap">
              <Field className="w-auto min-w-[180px]">
                <FieldLabel htmlFor="upsell-type">{t('upsells.fields.type', 'Catégorie')}</FieldLabel>
                <NativeSelect
                  id="upsell-type"
                  className="w-full"
                  value={edit.type}
                  onChange={(e) => setEdit((s) => ({ ...s, type: e.target.value }))}
                >
                  {TYPES.map((id) => (
                    <option key={id} value={id}>
                      {typeLabel(id)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field className="w-auto flex-1 min-w-[200px]">
                <FieldLabel htmlFor="upsell-title">{t('upsells.fields.title', 'Titre')}</FieldLabel>
                <Input
                  id="upsell-title"
                  value={edit.title}
                  onChange={(e) => setEdit((s) => ({ ...s, title: e.target.value }))}
                />
              </Field>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Field className="w-[140px]">
                <FieldLabel htmlFor="upsell-price">{t('upsells.fields.price', 'Prix')}</FieldLabel>
                <Input
                  id="upsell-price"
                  value={edit.price}
                  onChange={(e) => setEdit((s) => ({ ...s, price: e.target.value }))}
                  type="number"
                  min={0}
                  step="0.01"
                />
              </Field>
              <Field className="w-[100px]">
                <FieldLabel htmlFor="upsell-currency">{t('upsells.fields.currency', 'Devise')}</FieldLabel>
                <Input
                  id="upsell-currency"
                  value={edit.currency}
                  onChange={(e) => setEdit((s) => ({ ...s, currency: e.target.value.toUpperCase() }))}
                  maxLength={3}
                />
              </Field>
              <Field className="w-auto flex-1 min-w-[180px]">
                <FieldLabel htmlFor="upsell-property">{t('upsells.fields.property', 'Propriété')}</FieldLabel>
                <NativeSelect
                  id="upsell-property"
                  className="w-full"
                  value={edit.propertyId}
                  onChange={(e) => setEdit((s) => ({ ...s, propertyId: e.target.value }))}
                >
                  <option value="">{t('upsells.allProperties', 'Toutes les propriétés')}</option>
                  {properties.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="upsell-description">
                {t('upsells.fields.description', 'Description (optionnel)')}
              </FieldLabel>
              <Textarea
                id="upsell-description"
                rows={2}
                value={edit.description}
                onChange={(e) => setEdit((s) => ({ ...s, description: e.target.value }))}
              />
            </Field>
            {/* Productisation (2.10) : conditionnel + fenêtre horaire de commande. */}
            <div className="flex gap-2 flex-wrap">
              <Field className="w-[200px]">
                <FieldLabel htmlFor="upsell-min-nights">
                  {t('upsells.fields.minNights', 'Séjour min. (nuits)')}
                </FieldLabel>
                <Input
                  id="upsell-min-nights"
                  value={edit.minNights}
                  onChange={(e) => setEdit((s) => ({ ...s, minNights: e.target.value }))}
                  type="number"
                  min={0}
                  step={1}
                />
                <FieldDescription>
                  {t('upsells.fields.minNightsHelp', 'Proposé si le séjour atteint ce nb de nuits. Vide = toujours.')}
                </FieldDescription>
              </Field>
              <Field className="w-auto flex-1 min-w-[220px]">
                <FieldLabel htmlFor="upsell-lead-time">
                  {t('upsells.fields.leadTimeHours', 'Délai mini avant arrivée (h)')}
                </FieldLabel>
                <Input
                  id="upsell-lead-time"
                  value={edit.leadTimeHours}
                  onChange={(e) => setEdit((s) => ({ ...s, leadTimeHours: e.target.value }))}
                  type="number"
                  min={0}
                  step={1}
                />
                <FieldDescription>
                  {t('upsells.fields.leadTimeHoursHelp', 'Commandable seulement si l’arrivée est ≥ X h. Vide = aucun délai.')}
                </FieldDescription>
              </Field>
            </div>
            {/* Bundle : reste un Select MUI multiple. Le <select multiple> natif du kit
                se rend en liste deroulee a selection multiple (Ctrl/Cmd) et ne renvoie
                qu'une valeur dans e.target.value — la saisie ne serait plus la meme. */}
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
            <div>
              <span className="cn-text-caption text-muted-foreground block mb-1">
                {t('upsells.fields.image', 'Image (optionnel)')}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {edit.imageUrl ? (
                  <img className="w-[72px] h-[72px] rounded-[1.5px] object-cover block border border-[var(--line)]" src={edit.imageUrl} alt="" />
                ) : null}
                {/* asChild : le declencheur reste un <label> pour ouvrir l'input fichier masque.
                    cursor-pointer explicite : la regle globale du kit ne vise que button/[role=button]. */}
                <Button asChild variant="outline" size="sm" className="cursor-pointer">
                  <label>
                    <ImagePlus size={15} strokeWidth={1.75} />
                    {edit.imageUrl ? t('upsells.fields.imageChange', 'Changer') : t('upsells.fields.imageUpload', 'Choisir une image')}
                    <input type="file" accept="image/*" hidden onChange={onImageFile} />
                  </label>
                </Button>
                {edit.imageUrl ? (
                  <Button variant="destructive" size="sm" onClick={() => setEdit((s) => ({ ...s, imageUrl: '' }))}>
                    {t('upsells.fields.imageRemove', 'Retirer')}
                  </Button>
                ) : null}
              </div>
            </div>
            <Field orientation="horizontal" className="gap-1.5">
              <Switch
                id="upsell-active"
                checked={edit.active}
                onCheckedChange={(checked) => setEdit((s) => ({ ...s, active: checked }))}
              />
              <FieldLabel htmlFor="upsell-active" className="font-normal">
                {t('upsells.fields.active', 'Service actif (visible sur le livret)')}
              </FieldLabel>
            </Field>
          </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {editingOffer ? (
              <Button variant="destructive" onClick={() => { const o = editingOffer; setEdit(emptyEdit); handleDelete(o); }}>
                <Delete size={15} strokeWidth={1.75} />
                {t('upsells.actions.delete', 'Supprimer')}
              </Button>
            ) : <span />}
            <div className="flex gap-1.5">
              <Button variant="ghost" onClick={() => setEdit(emptyEdit)}>{t('upsells.actions.cancel', 'Annuler')}</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Spinner className="size-3.5" /> : <Save size={14} strokeWidth={1.75} />}
                {t('upsells.actions.save', 'Enregistrer')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ventes */}
      <Dialog open={ordersOpen} onOpenChange={(next) => !next && setOrdersOpen(false)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="border-b pb-2">
            <DialogTitle>{t('upsells.orders.title', 'Ventes de services')}</DialogTitle>
          </DialogHeader>
          <div className="-mx-4 max-h-[60vh] overflow-y-auto px-4">
          {ordersLoading ? (
            <div className="flex justify-center py-4">
              <Spinner className="size-10" />
            </div>
          ) : orders.length === 0 ? (
            <p className="cn-text-body2 text-muted-foreground">
              {t('upsells.orders.empty', 'Aucune vente pour le moment.')}
            </p>
          ) : (
            <div className="flex flex-col gap-[7.5px]">
              {orders.map((order: UpsellOrder) => (
                <div className="border-b border-[var(--line)] pb-1.5" key={order.id}>
                  <div className="flex justify-between items-center gap-1.5">
                    <p className="cn-text-body2 font-semibold">
                      {order.title}
                    </p>
                    <StatusChip color={semanticToHex(order.status === 'PAID' ? 'success' : 'default')} label={orderStatusLabel(order.status)} />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="cn-text-caption text-muted-foreground">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}
                      {order.guestEmail ? ` · ${order.guestEmail}` : ''}
                    </span>
                    <span className="cn-text-caption tabular-nums">
                      <Money value={order.amount} from={order.currency} />
                      {order.hostAmount != null ? (
                        <>
                          {' · '}{t('upsells.orders.yourShare', 'votre part')}{' '}
                          <Money value={order.hostAmount} from={order.currency} />
                        </>
                      ) : null}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOrdersOpen(false)}>{t('upsells.actions.close', 'Fermer')}</Button>
          </DialogFooter>
        </DialogContent>
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
    </div>
  );
};

export default UpsellsAdmin;
