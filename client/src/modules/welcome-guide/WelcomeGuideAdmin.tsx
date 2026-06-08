import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Snackbar,
  Alert,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { AlertColor } from '@mui/material';
import { Add, Save, Edit, Delete, ContentCopy, Link as LinkIcon, OpenInNew } from '../../icons';
import {
  MessageSquare,
  Star,
  BarChart3,
  Eye,
  MapPin,
  MessageCircle,
  DoorOpen,
  Sparkles,
  Check,
  Image as ImageIcon,
  FileText,
  Ticket,
  Globe,
  Quote,
  ConciergeBell,
  CalendarDays,
  Link2,
  Unlink,
  Lock,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import EmptyState from '../../components/EmptyState';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { usePropertiesList } from '../../hooks/usePropertiesList';
import { softChipSx, semanticToHex } from '../../utils/statusUtils';
import {
  welcomeGuideApi,
  parseSections,
  serializeSections,
  parsePois,
  serializePois,
  parseActivities,
  serializeActivities,
  parseHeroPhotoIds,
  type WelcomeGuide,
  type GuideSection,
  type GuideSectionItem,
  type GuideSectionLayout,
  type GuidePoi,
  type GuideActivity,
  type GuestbookEntry,
  type WelcomeGuideStats,
  type PoiSuggestion,
  type GuideReservationRef,
  isGuideConflict,
} from '../../services/api/welcomeGuideApi';
import { POI_CATEGORIES, poiCategory, poiLabel } from './poiCatalog';
import { nominatimApi } from '../../services/nominatimApi';
import { propertyPhotosApi } from '../../services/api/propertyPhotosApi';
import { upsellApi, type PublicUpsell } from '../../services/api/upsellApi';
import WelcomeBookView, { type Lang, type WelcomeBookModel } from './WelcomeBookView';
import GuidePhotoCarousel from './GuidePhotoCarousel';
import { WELCOME_BOOK_THEMES, themeAccent } from './welcomeBookThemes';
import { GUIDE_LABELS } from './guideLabels';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import { SectionHeading, EmptyHint, ToggleRow } from './formPrimitives';
import {
  templateWelcomeMessage,
  buildTemplateSections,
  buildTemplatePois,
  buildTemplateActivities,
} from './guideTemplate';
import { guideIcon, GUIDE_ICON_OPTIONS } from './guideIcons';

type View = 'list' | 'form';

const LANGUAGES = ['fr', 'en', 'ar'] as const;
const DEFAULT_COLOR = '#6B8A9A';
const DEFAULT_THEME = 'atelier';

/** Parse la sélection de services d'un livret (JSON array d'ids) → number[] | null (null = tous). */
function parseOfferIdSelection(json: string | null | undefined): number[] | null {
  if (!json) return null;
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isFinite(n)) : null;
  } catch {
    return null;
  }
}

const SECTION_LAYOUT_OPTIONS: GuideSectionLayout[] = ['text', 'steps', 'rules', 'list'];

const newSection = (): GuideSection => ({
  id: `s-${Date.now()}`,
  icon: 'file-text',
  title: '',
  subtitle: '',
  layout: 'text',
  body: '',
  items: [],
});

const newSectionItem = (): GuideSectionItem => ({ id: `it-${Date.now()}`, icon: 'sparkles', label: '', detail: '', steps: [] });

/** Sélecteur d'icône lucide compact (aperçu + nom). */
const IconSelect: React.FC<{ value: string; onChange: (v: string) => void; label?: string }> = ({ value, onChange, label }) => (
  <TextField
    select
    size="small"
    label={label}
    value={GUIDE_ICON_OPTIONS.includes(value) ? value : ''}
    onChange={(e) => onChange(e.target.value)}
    sx={{ width: 76, '& .MuiSelect-select': { display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1 } }}
    SelectProps={{
      renderValue: (v) => {
        const Icon = guideIcon(v as string);
        return <Icon size={18} strokeWidth={1.75} />;
      },
      MenuProps: { PaperProps: { sx: { maxHeight: 320 } } },
    }}
  >
    {GUIDE_ICON_OPTIONS.map((name) => {
      const Icon = guideIcon(name);
      return (
        <MenuItem key={name} value={name}>
          <Icon size={18} strokeWidth={1.75} style={{ marginRight: 10 }} /> {name}
        </MenuItem>
      );
    })}
  </TextField>
);

/** Formate une plage de dates d'une réservation (ex : « 12 juin → 15 juin »). Dates ISO en entrée. */
function formatReservationRange(r: GuideReservationRef, locale: string): string {
  const fmt = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };
  const ci = fmt(r.checkIn);
  const co = fmt(r.checkOut);
  if (ci && co) return `${ci} → ${co}`;
  return ci || co || '';
}

const WelcomeGuideAdmin: React.FC = () => {
  const { t, currentLanguage } = useTranslation();
  const { isPlatformStaff } = useAuth();
  // Création réservée au staff plateforme (cf. POST /welcome-guides côté backend).
  // L'édition d'un livret existant reste ouverte à tous les rôles métier.
  const isStaff = isPlatformStaff();
  const { properties } = usePropertiesList();

  const { data: guides = [], isLoading, refetch } = useQuery({
    queryKey: ['welcome-guides'],
    queryFn: () => welcomeGuideApi.list(),
  });

  // Services payants de l'org : alimentent l'aperçu (mêmes données que l'onglet « Services payants »).
  const { data: upsellOffers = [] } = useQuery({
    queryKey: ['upsell-offers'],
    queryFn: () => upsellApi.listOffers(),
  });

  const [view, setView] = useState<View>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // Conflit 409 « un livret existe déjà pour cette réservation » : ouvre un modal de
  // confirmation d'écrasement (re-POST avec overwrite=true). null = fermé.
  const [overwriteConfirm, setOverwriteConfirm] = useState(false);
  // Wizard : étape courante (0–5 = formulaire, 6 = récapitulatif) + étape la plus
  // loin atteinte (autorise le saut arrière libre, le saut avant uniquement vers
  // une étape déjà visitée).
  const [step, setStep] = useState(0);
  // Suppression : cible du modal de confirmation (null = fermé) + état en cours.
  const [deleteTarget, setDeleteTarget] = useState<WelcomeGuide | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [propertyId, setPropertyId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<string>('fr');
  const [brandingColor, setBrandingColor] = useState<string>(DEFAULT_COLOR);
  const [theme, setTheme] = useState<string>(DEFAULT_THEME);
  // Photos de couverture (carrousel) : liste d'ids de PropertyPhoto sélectionnées.
  const [heroPhotoIds, setHeroPhotoIds] = useState<number[]>([]);
  // Distingue « choix explicite de l'hôte » de « pas encore choisi » : tant que false,
  // toutes les photos du logement sont sélectionnées par défaut quand elles arrivent.
  const [heroTouched, setHeroTouched] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [hostNames, setHostNames] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [published, setPublished] = useState(false);
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [guestbookEnabled, setGuestbookEnabled] = useState(true);
  const [activitiesEnabled, setActivitiesEnabled] = useState(true);
  const [upsellsEnabled, setUpsellsEnabled] = useState(true);
  // Sélection des services affichés sur ce livret : null = tous (défaut), sinon liste d'ids.
  const [upsellOfferIds, setUpsellOfferIds] = useState<number[] | null>(null);
  const [sections, setSections] = useState<GuideSection[]>([]);
  const [pois, setPois] = useState<GuidePoi[]>([]);
  const [geocoding, setGeocoding] = useState<string | null>(null);
  const [curatedActivities, setCuratedActivities] = useState<GuideActivity[]>([]);

  // Photos du logement : grille du sélecteur de photo de couverture (hero).
  const { data: propertyPhotos = [] } = useQuery({
    queryKey: ['property-photos', propertyId],
    queryFn: () => propertyPhotosApi.list(Number(propertyId)),
    enabled: view === 'form' && !!propertyId,
  });

  // Données réelles du logement (adresse, wifi, digicode, horaires) → aperçu live fidèle.
  const { data: previewData } = useQuery({
    queryKey: ['guide-preview-data', propertyId],
    queryFn: () => welcomeGuideApi.propertyPreview(Number(propertyId)),
    enabled: view === 'form' && !!propertyId,
  });

  // ─── Réservation rattachée (affichage + gating de création) ─────────────────
  // Édition : la réservation déjà liée au livret. Création : la réservation en cours
  // ou à venir du logement (celle à laquelle le livret serait rattaché), via l'aperçu.
  const editingGuide = editingId != null ? guides.find((g) => g.id === editingId) ?? null : null;
  const linkedReservation: GuideReservationRef | null =
    editingId != null ? editingGuide?.reservation ?? null : previewData?.currentReservation ?? null;
  // En création, il faut une réservation en cours/à venir pour que le livret soit créable.
  const canCreate = editingId == null ? isStaff && linkedReservation != null : true;

  // Hero par défaut = toutes les photos du logement, tant que l'hôte n'a pas choisi.
  useEffect(() => {
    if (!heroTouched && heroPhotoIds.length === 0 && propertyPhotos.length > 0) {
      setHeroPhotoIds(propertyPhotos.map((ph) => ph.id));
    }
  }, [propertyPhotos, heroTouched, heroPhotoIds.length]);
  const [suggest, setSuggest] = useState<{ open: boolean; loading: boolean; items: PoiSuggestion[]; selected: Set<number> }>({
    open: false,
    loading: false,
    items: [],
    selected: new Set(),
  });

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: AlertColor }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; link: string; qrCode: string }>({
    open: false,
    link: '',
    qrCode: '',
  });
  const [copied, setCopied] = useState(false);
  const [guestbook, setGuestbook] = useState<{
    open: boolean;
    title: string;
    entries: GuestbookEntry[];
    loading: boolean;
  }>({ open: false, title: '', entries: [], loading: false });
  const [stats, setStats] = useState<{ open: boolean; title: string; loading: boolean; data: WelcomeGuideStats | null }>({
    open: false,
    title: '',
    loading: false,
    data: null,
  });

  const notify = (message: string, severity: AlertColor = 'success') =>
    setSnackbar({ open: true, message, severity });

  const openCreate = () => {
    // Nouveau livret pré-rempli avec un modèle riche (template Baitly) que l'hôte
    // personnalise, complète ou supprime ensuite. Langue par défaut = fr.
    const tplLang = 'fr';
    setEditingId(null);
    setPropertyId('');
    setTitle('');
    setLanguage(tplLang);
    setBrandingColor(DEFAULT_COLOR);
    setTheme(DEFAULT_THEME);
    setHeroPhotoIds([]);
    setHeroTouched(false);
    setWelcomeMessage(templateWelcomeMessage(tplLang));
    setHostNames('');
    setLogoUrl('');
    setPublished(false);
    setChatbotEnabled(true);
    setGuestbookEnabled(true);
    setActivitiesEnabled(true);
    setUpsellsEnabled(true);
    setUpsellOfferIds(null);
    setSections(buildTemplateSections(tplLang));
    setPois(buildTemplatePois(tplLang));
    setCuratedActivities(buildTemplateActivities(tplLang));
    setStep(0);
    setView('form');
  };

  const openEdit = (g: WelcomeGuide) => {
    setEditingId(g.id);
    setPropertyId(g.propertyId != null ? String(g.propertyId) : '');
    setTitle(g.title);
    setLanguage(g.language || 'fr');
    setBrandingColor(g.brandingColor || DEFAULT_COLOR);
    setTheme(g.theme || DEFAULT_THEME);
    setHeroPhotoIds(parseHeroPhotoIds(g.heroPhotoIds));
    setHeroTouched(true); // édition : on respecte la sélection sauvegardée (pas d'auto-défaut)
    setWelcomeMessage(g.welcomeMessage || '');
    setHostNames(g.hostNames || '');
    setLogoUrl(g.logoUrl || '');
    setPublished(g.published);
    setChatbotEnabled(g.chatbotEnabled);
    setGuestbookEnabled(g.guestbookEnabled);
    setActivitiesEnabled(g.activitiesEnabled);
    setUpsellsEnabled(g.upsellsEnabled ?? true);
    setUpsellOfferIds(parseOfferIdSelection(g.upsellOfferIds));
    setSections(parseSections(g.sections));
    setPois(parsePois(g.pois));
    setCuratedActivities(parseActivities(g.curatedActivities));
    setStep(0);
    setView('form');
  };

  // Quitter le formulaire (Annuler) → retour liste + reset de l'assistant.
  const closeForm = () => {
    setStep(0);
    setView('list');
  };

  // overwrite=true : relance après confirmation du conflit 409 (écrase l'ancien livret de la réservation).
  const handleSave = async (overwrite = false) => {
    if (!title.trim()) {
      notify(t('welcomeGuide.messages.titleRequired', 'Le titre est obligatoire'), 'error');
      return;
    }
    if (editingId == null && !propertyId) {
      notify(t('welcomeGuide.messages.propertyRequired', 'Sélectionnez un logement'), 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        propertyId: Number(propertyId),
        title: title.trim(),
        language,
        sections: serializeSections(sections),
        pois: serializePois(pois),
        curatedActivities: serializeActivities(curatedActivities),
        brandingColor,
        theme,
        heroPhotoIds: JSON.stringify(heroPhotoIds),
        welcomeMessage: welcomeMessage.trim() || null,
        hostNames: hostNames.trim() || null,
        logoUrl: logoUrl.trim() || null,
        published,
        chatbotEnabled,
        guestbookEnabled,
        activitiesEnabled,
        upsellsEnabled,
        upsellOfferIds: upsellOfferIds === null ? null : JSON.stringify(upsellOfferIds),
      };
      if (editingId == null) {
        await welcomeGuideApi.create(payload, overwrite);
        notify(t('welcomeGuide.messages.created', 'Livret créé'));
      } else {
        await welcomeGuideApi.update(editingId, payload);
        notify(t('welcomeGuide.messages.updated', 'Livret mis à jour'));
      }
      setOverwriteConfirm(false);
      await refetch();
      closeForm();
    } catch (err) {
      // Conflit : un livret existe déjà pour cette réservation → on propose l'écrasement.
      if (isGuideConflict(err)) {
        setOverwriteConfirm(true);
      } else {
        notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (g: WelcomeGuide) => setDeleteTarget(g);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await welcomeGuideApi.remove(deleteTarget.id);
      notify(t('welcomeGuide.messages.deleted', 'Livret supprimé'));
      setDeleteTarget(null);
      await refetch();
    } catch {
      notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateLink = async (g: WelcomeGuide) => {
    try {
      const res = await welcomeGuideApi.share(g.id);
      setCopied(false);
      setLinkDialog({ open: true, link: res.link, qrCode: res.qrCode });
    } catch {
      notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
    }
  };

  const handleOpenStats = async (g: WelcomeGuide) => {
    setStats({ open: true, title: g.title, loading: true, data: null });
    try {
      const data = await welcomeGuideApi.getStats(g.id);
      setStats({ open: true, title: g.title, loading: false, data });
    } catch {
      setStats({ open: true, title: g.title, loading: false, data: null });
      notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
    }
  };

  const handleOpenGuestbook = async (g: WelcomeGuide) => {
    setGuestbook({ open: true, title: g.title, entries: [], loading: true });
    try {
      const entries = await welcomeGuideApi.listGuestbook(g.id);
      setGuestbook({ open: true, title: g.title, entries, loading: false });
    } catch {
      setGuestbook({ open: true, title: g.title, entries: [], loading: false });
      notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard?.writeText(linkDialog.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponible : l'utilisateur copiera manuellement */
    }
  };

  // ─── Section editor handlers ───────────────────────────────────────────────
  const addSection = () => setSections((prev) => [...prev, newSection()]);
  const updateSection = (idx: number, patch: Partial<GuideSection>) =>
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const removeSection = (idx: number) => setSections((prev) => prev.filter((_, i) => i !== idx));
  const addSectionItem = (sIdx: number) =>
    setSections((prev) => prev.map((s, i) => (i === sIdx ? { ...s, items: [...s.items, newSectionItem()] } : s)));
  const updateSectionItem = (sIdx: number, iIdx: number, patch: Partial<GuideSectionItem>) =>
    setSections((prev) =>
      prev.map((s, i) => (i === sIdx ? { ...s, items: s.items.map((it, j) => (j === iIdx ? { ...it, ...patch } : it)) } : s)),
    );
  const removeSectionItem = (sIdx: number, iIdx: number) =>
    setSections((prev) => prev.map((s, i) => (i === sIdx ? { ...s, items: s.items.filter((_, j) => j !== iIdx) } : s)));

  // ─── POI editor handlers ("autour de moi") ─────────────────────────────────
  const addPoi = () =>
    setPois((prev) => [
      ...prev,
      { id: `poi-${Date.now()}`, category: 'RESTAURANT', name: '', type: '', address: '', lat: null, lng: null, note: '', featured: false },
    ]);
  const updatePoi = (idx: number, patch: Partial<GuidePoi>) =>
    setPois((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const removePoi = (idx: number) => setPois((prev) => prev.filter((_, i) => i !== idx));

  // Geocode via Nominatim (OSM, sans clé) → lat/lng pour le pin sur la carte guest.
  const geocodePoi = async (idx: number) => {
    const poi = pois[idx];
    const query = [poi.name, poi.address].filter((s) => s.trim()).join(' ').trim();
    if (query.length < 3) {
      notify(t('welcomeGuide.pois.queryTooShort', 'Renseignez un nom ou une adresse à localiser'), 'error');
      return;
    }
    setGeocoding(poi.id);
    try {
      const results = await nominatimApi.search(query, [], 1);
      if (results.length === 0) {
        notify(t('welcomeGuide.pois.notFound', 'Lieu introuvable — précisez l’adresse'), 'error');
        return;
      }
      const r = results[0];
      updatePoi(idx, { lat: r.latitude, lng: r.longitude, address: poi.address.trim() || r.label });
      notify(t('welcomeGuide.pois.located', 'Position trouvée'));
    } catch {
      notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
    } finally {
      setGeocoding(null);
    }
  };

  // Suggestions auto (OSM) autour du logement → import sélectif dans les POI.
  const openSuggest = async () => {
    if (editingId == null) {
      notify(t('welcomeGuide.pois.suggestSaveFirst', "Enregistrez d'abord le livret pour suggérer des lieux"), 'info');
      return;
    }
    setSuggest({ open: true, loading: true, items: [], selected: new Set() });
    try {
      const items = await welcomeGuideApi.suggestPois(editingId);
      setSuggest({ open: true, loading: false, items, selected: new Set() });
    } catch {
      setSuggest({ open: false, loading: false, items: [], selected: new Set() });
      notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
    }
  };
  const toggleSuggest = (idx: number) =>
    setSuggest((s) => {
      const selected = new Set(s.selected);
      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);
      return { ...s, selected };
    });
  const addSuggested = () => {
    setPois((prev) => [
      ...prev,
      ...suggest.items
        .filter((_, i) => suggest.selected.has(i))
        .map((sug, i) => ({
          id: `poi-${Date.now()}-${i}`,
          category: sug.category,
          name: sug.name,
          type: '',
          address: sug.address ?? '',
          lat: sug.lat,
          lng: sug.lng,
          note: '',
          featured: false,
        })),
    ]);
    setSuggest({ open: false, loading: false, items: [], selected: new Set() });
  };

  // ─── Curation d'activités ("met en avant" = featured) ──────────────────────
  const addActivity = () =>
    setCuratedActivities((prev) => [
      ...prev,
      { id: `act-${Date.now()}`, source: 'MANUAL', externalId: null, title: '', imageUrl: null, price: null, bookingUrl: '', description: '', featured: false },
    ]);
  const updateActivity = (idx: number, patch: Partial<GuideActivity>) =>
    setCuratedActivities((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  const removeActivity = (idx: number) => setCuratedActivities((prev) => prev.filter((_, i) => i !== idx));

  // ─── Actions portées dans le PageHeader (slot multi-tabs partagé) ───────────
  // Liste → « Nouveau livret » ; formulaire → « Annuler » seul (l'« Enregistrer »
  // vit désormais dans le pied du récapitulatif, étape finale de l'assistant).
  const headerActions = usePageHeaderActions(
    view === 'list' ? (
      isStaff ? (
        <Button variant="contained" size="small" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={openCreate}>
          {t('welcomeGuide.actions.new', 'Nouveau livret')}
        </Button>
      ) : null
    ) : (
      <Button variant="text" size="small" onClick={closeForm}>
        {t('welcomeGuide.actions.cancel', 'Annuler')}
      </Button>
    ),
  );

  // ─── Render: list ──────────────────────────────────────────────────────────
  const renderList = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      );
    }
    if (guides.length === 0) {
      return (
        <EmptyState
          icon={<LinkIcon />}
          title={t('welcomeGuide.list.emptyTitle', 'Aucun livret pour le moment')}
          description={t(
            'welcomeGuide.list.emptyDescription',
            "Créez un livret d'accueil pour partager le wifi, le digicode et vos bons plans avec vos voyageurs.",
          )}
          action={
            isStaff ? (
              <Button variant="contained" startIcon={<Add size={16} strokeWidth={1.75} />} onClick={openCreate}>
                {t('welcomeGuide.actions.new', 'Nouveau livret')}
              </Button>
            ) : undefined
          }
        />
      );
    }
    return (
      <Stack spacing={1.5}>
        {guides.map((g) => {
          const prop = properties.find((p) => p.id === String(g.propertyId));
          const heroIds = parseHeroPhotoIds(g.heroPhotoIds);
          const statusLabel = g.published
            ? t('welcomeGuide.status.published', 'Publié')
            : t('welcomeGuide.status.draft', 'Brouillon');
          return (
            <Card
              key={g.id}
              variant="outlined"
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                transition: 'border-color .2s ease, box-shadow .2s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: '0 8px 24px -12px rgba(107,138,154,0.45)',
                },
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
                {/* Zone cliquable : ouvre l'éditeur du livret */}
                <Box
                  role="button"
                  tabIndex={0}
                  aria-label={t('welcomeGuide.actions.edit', 'Modifier') + ' — ' + g.title}
                  onClick={() => openEdit(g)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openEdit(g);
                    }
                  }}
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1.5, sm: 2 },
                    alignItems: { sm: 'center' },
                    p: 1.5,
                    flex: 1,
                    minWidth: 0,
                    cursor: 'pointer',
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: '-2px',
                    },
                  }}
                >
                  <Box sx={{ width: { xs: '100%', sm: 188 }, flexShrink: 0 }}>
                    <GuidePhotoCarousel
                      propertyId={g.propertyId}
                      theme={g.theme}
                      alt={g.propertyName || g.title}
                      priorityIds={heroIds}
                    />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          bgcolor: themeAccent(g.theme),
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600, minWidth: 0 }}>
                        {g.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
                      {g.propertyName || '—'}
                      {prop?.city ? ` · ${prop.city}` : ''}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        label={statusLabel}
                        sx={softChipSx(semanticToHex(g.published ? 'success' : 'default'))}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        icon={<Globe size={13} strokeWidth={1.75} />}
                        label={g.language.toUpperCase()}
                        sx={{ height: 24, '& .MuiChip-label': { px: 0.75, fontSize: 12, letterSpacing: 0.3 } }}
                      />
                    </Box>
                  </Box>
                </Box>
                {/* Actions du livret */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 0.25,
                    px: 1,
                    py: { xs: 0.5, sm: 1.5 },
                    borderTop: { xs: '1px solid', sm: 'none' },
                    borderLeft: { sm: '1px solid' },
                    borderColor: 'divider',
                  }}
                >
                  <Tooltip title={t('welcomeGuide.actions.generateLink', 'Générer le lien')}>
                    <span>
                      <IconButton size="small" onClick={() => handleGenerateLink(g)} disabled={!g.published}>
                        <LinkIcon size={16} strokeWidth={1.75} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('welcomeGuide.actions.guestbook', "Livre d'or")}>
                    <IconButton size="small" onClick={() => handleOpenGuestbook(g)}>
                      <MessageSquare size={16} strokeWidth={1.75} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('welcomeGuide.actions.stats', 'Statistiques')}>
                    <IconButton size="small" onClick={() => handleOpenStats(g)}>
                      <BarChart3 size={16} strokeWidth={1.75} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('welcomeGuide.actions.edit', 'Modifier')}>
                    <IconButton size="small" onClick={() => openEdit(g)}>
                      <Edit size={16} strokeWidth={1.75} />
                    </IconButton>
                  </Tooltip>
                  {isStaff && (
                    <Tooltip title={t('welcomeGuide.actions.delete', 'Supprimer')}>
                      <IconButton size="small" color="error" onClick={() => handleDelete(g)}>
                        <Delete size={16} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Card>
          );
        })}
      </Stack>
    );
  };

  // ─── Aperçu live : view-model depuis l'état du formulaire ───────────────────
  // Les champs auto-remplis côté serveur (wifi, digicode, dates) sont représentés
  // par des échantillons pour donner un aperçu réaliste au voyageur.
  const previewLang: Lang = (LANGUAGES as readonly string[]).includes(language) ? (language as Lang) : 'fr';
  const previewProperty = properties.find((p) => String(p.id) === propertyId);
  const previewHeroImages = propertyId
    ? heroPhotoIds.map((id) => propertyPhotosApi.getPhotoUrl(Number(propertyId), id))
    : [];
  // Services payants de l'aperçu : actifs + (toute l'org OU logement sélectionné), mappés au
  // format guest. Reflète la logique de listForToken côté serveur (logement du livret).
  // Services de l'org applicables à ce livret (actifs + toute l'org OU logement sélectionné).
  const applicableOffers = upsellOffers.filter(
    (o) => o.active && (o.propertyId == null || String(o.propertyId) === propertyId),
  );
  // Sélection par livret : null = tous affichés ; sinon uniquement les ids cochés.
  const isOfferShown = (id: number) => upsellOfferIds === null || upsellOfferIds.includes(id);
  const toggleOfferShown = (id: number) => {
    const base = upsellOfferIds === null ? applicableOffers.map((o) => o.id) : upsellOfferIds;
    const next = isOfferShown(id) ? base.filter((x) => x !== id) : [...base, id];
    const allIds = applicableOffers.map((o) => o.id);
    // Tout coché → null (= « tous », les futurs services apparaissent automatiquement).
    setUpsellOfferIds(allIds.length === next.length && allIds.every((x) => next.includes(x)) ? null : next);
  };
  const previewUpsells: PublicUpsell[] = applicableOffers
    .filter((o) => isOfferShown(o.id))
    .map((o) => ({
      offerId: o.id,
      type: o.type,
      title: o.title,
      description: o.description,
      price: o.price,
      currency: o.currency,
      imageUrl: o.imageUrl,
    }));
  const previewModel: WelcomeBookModel = {
    title: title.trim() || previewProperty?.name || t('welcomeGuide.preview.sampleTitle', 'Votre logement'),
    welcomeMessage: welcomeMessage.trim() || null,
    hostNames: hostNames.trim() || null,
    logoUrl: logoUrl.trim() || null,
    // Vraies données du logement sélectionné (adresse, wifi, digicode, horaires par défaut),
    // chargées via l'API — l'aperçu reflète exactement ce que verra le voyageur.
    property:
      previewData?.property ?? {
        name: previewProperty?.name ?? null,
        address: null,
        city: null,
        postalCode: null,
        country: null,
        latitude: null,
        longitude: null,
      },
    practical: previewData?.practical ?? null,
    // En config il n'y a pas de réservation : on injecte un prénom-échantillon pour montrer
    // que l'accueil affichera automatiquement le prénom du voyageur (chargé depuis la résa).
    stay: {
      checkIn: previewData?.stay?.checkIn ?? null,
      checkOut: previewData?.stay?.checkOut ?? null,
      checkInTime: previewData?.stay?.checkInTime ?? null,
      checkOutTime: previewData?.stay?.checkOutTime ?? null,
      guestName: previewData?.stay?.guestName || t('welcomeGuide.preview.sampleGuest', 'Marie'),
      guestCount: previewData?.stay?.guestCount ?? null,
    },
    checkIn: null,
    accessPhotos: [],
    sections,
    pois,
    activities: [...curatedActivities].sort((a, b) => Number(b.featured) - Number(a.featured)),
    upsells: previewUpsells,
    guestbookEnabled,
    activitiesEnabled,
    upsellsEnabled,
  };

  // ─── Assistant pas-à-pas : titres des étapes (0–5 = saisie, 6 = récap) ──────
  const WIZARD_STEPS = [
    t('welcomeGuide.wizard.step1', 'Logement'),
    t('welcomeGuide.wizard.step2', 'Apparence'),
    t('welcomeGuide.wizard.step3', 'Accueil'),
    t('welcomeGuide.wizard.step4', 'Contenu'),
    t('welcomeGuide.wizard.step5', 'Expériences & services'),
    t('welcomeGuide.wizard.step6', 'Options & publication'),
    t('welcomeGuide.wizard.recap', 'Récapitulatif'),
  ];
  const LAST_STEP = WIZARD_STEPS.length - 1; // 6 (récapitulatif)

  // Validation par étape — seule l'étape 0 (Logement) est bloquante.
  const validateStep = (s: number): boolean => {
    if (s === 0) {
      if (editingId == null && !propertyId) {
        notify(t('welcomeGuide.messages.propertyRequired', 'Sélectionnez un logement'), 'error');
        return false;
      }
      if (!title.trim()) {
        notify(t('welcomeGuide.messages.titleRequired', 'Le titre est obligatoire'), 'error');
        return false;
      }
    }
    return true;
  };

  const goToStep = (target: number) => {
    // Navigation libre : saut direct vers n'importe quelle étape.
    if (target !== step) setStep(target);
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, LAST_STEP));
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  // ─── Stepper compact (haut de la colonne 1) ─────────────────────────────────
  const renderStepper = () => (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
          {WIZARD_STEPS[step]}
        </Typography>
        {step < LAST_STEP ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
          >
            {t('welcomeGuide.wizard.stepCounter', 'Étape {{current}} / {{total}}', {
              current: step + 1,
              total: LAST_STEP,
            })}
          </Typography>
        ) : null}
      </Box>
      {/* Précédent | numéros d'étape (centrés, cliquables → saut direct) | Suivant/Enregistrer */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button variant="outlined" size="small" onClick={goBack} disabled={step === 0} sx={{ flexShrink: 0 }}>
          {t('welcomeGuide.wizard.previous', 'Précédent')}
        </Button>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {WIZARD_STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <Tooltip key={i} title={label} arrow>
                <Box
                  role="button"
                  aria-label={label}
                  aria-current={active ? 'step' : undefined}
                  tabIndex={0}
                  onClick={() => goToStep(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      goToStep(i);
                    }
                  }}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    userSelect: 'none',
                    cursor: 'pointer',
                    bgcolor: active ? 'primary.main' : done ? 'rgba(107,138,154,0.16)' : 'action.hover',
                    color: active ? '#fff' : done ? 'primary.main' : 'text.secondary',
                    border: '1px solid',
                    borderColor: active ? 'primary.main' : done ? 'rgba(107,138,154,0.35)' : 'divider',
                    transition: 'background-color .18s ease, color .18s ease, border-color .18s ease',
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                    '&:hover': !active ? { borderColor: 'primary.main', color: 'primary.main' } : undefined,
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                  }}
                >
                  {done ? <Check size={15} strokeWidth={2.5} /> : i + 1}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
        {step < LAST_STEP ? (
          <Button variant="contained" size="small" onClick={goNext} sx={{ flexShrink: 0 }}>
            {t('welcomeGuide.wizard.next', 'Suivant')}
          </Button>
        ) : (
          // Création réservée au staff + nécessite une réservation en cours/à venir.
          // Tooltip explicatif quand l'action est bloquée (édition jamais bloquée).
          <Tooltip
            arrow
            title={
              canCreate
                ? ''
                : !isStaff
                  ? t('welcomeGuide.reservationLink.staffOnly', 'La création d’un livret est réservée au staff Clenzy.')
                  : t(
                      'welcomeGuide.reservationLink.noReservation',
                      'Aucune réservation en cours ou à venir pour ce logement : livret non créable.',
                    )
            }
          >
            <span style={{ flexShrink: 0 }}>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleSave()}
                disabled={saving || !canCreate}
                startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save size={14} strokeWidth={1.75} />}
              >
                {t('welcomeGuide.actions.save', 'Enregistrer')}
              </Button>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  // ─── Récapitulatif (étape finale) ───────────────────────────────────────────
  const renderRecap = () => {
    const propertyName =
      properties.find((p) => String(p.id) === propertyId)?.name ??
      t('welcomeGuide.wizard.notSet', 'Non renseigné');
    const yes = t('welcomeGuide.wizard.yes', 'Oui');
    const no = t('welcomeGuide.wizard.no', 'Non');
    const themeName = t(
      `welcomeGuide.themes.${theme}.name`,
      WELCOME_BOOK_THEMES.find((th) => th.id === theme)?.name ?? theme,
    );
    const rows: Array<{ label: string; value: React.ReactNode; num?: boolean }> = [
      { label: t('welcomeGuide.wizard.recapProperty', 'Logement'), value: propertyName },
      {
        label: t('welcomeGuide.wizard.recapTitleField', 'Titre'),
        value: title.trim() || t('welcomeGuide.wizard.notSet', 'Non renseigné'),
      },
      { label: t('welcomeGuide.wizard.recapLanguage', 'Langue'), value: t(`welcomeGuide.languages.${language}`, language.toUpperCase()) },
      { label: t('welcomeGuide.wizard.recapTheme', 'Thème'), value: themeName },
      { label: t('welcomeGuide.wizard.recapHeroPhotos', 'Photos de couverture'), value: heroPhotoIds.length, num: true },
      { label: t('welcomeGuide.wizard.recapSections', 'Sections'), value: sections.length, num: true },
      { label: t('welcomeGuide.wizard.recapPois', 'Lieux autour'), value: pois.length, num: true },
      { label: t('welcomeGuide.wizard.recapActivities', 'Activités'), value: curatedActivities.length, num: true },
      { label: t('welcomeGuide.wizard.recapUpsells', 'Services payants'), value: upsellsEnabled ? yes : no },
      { label: t('welcomeGuide.wizard.recapPublished', 'Publié'), value: published ? yes : no },
    ];
    return (
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <SectionHeading
            icon={<Check size={17} strokeWidth={1.75} />}
            title={t('welcomeGuide.wizard.recapTitle', 'Vérifiez votre livret')}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: -0.5, mb: 1.5 }}>
            {t('welcomeGuide.wizard.recapSubtitle', "Un dernier coup d'œil avant d'enregistrer.")}
          </Typography>
          <Stack divider={<Divider />} spacing={0}>
            {rows.map((r) => (
              <Box
                key={r.label}
                sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, py: 0.85 }}
              >
                <Typography variant="body2" color="text.secondary">
                  {r.label}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, textAlign: 'right', minWidth: 0, ...(r.num ? { fontVariantNumeric: 'tabular-nums' } : {}) }}
                >
                  {r.value}
                </Typography>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  // ─── Réservation rattachée (étape Logement) ─────────────────────────────────
  // Édition : réservation déjà liée. Création : réservation en cours/à venir du
  // logement (ce à quoi le livret sera rattaché). Badge « Lié » / « Non lié ».
  const renderReservationLink = () => {
    const isCreate = editingId == null;
    const linked = linkedReservation != null;
    const dates = linkedReservation ? formatReservationRange(linkedReservation, currentLanguage) : '';
    // Message d'absence : selon le mode (édition d'un orphelin vs création sans résa courante).
    const emptyText = isCreate
      ? t('welcomeGuide.reservationLink.noneCreate', 'Aucune réservation en cours ou à venir')
      : t('welcomeGuide.reservationLink.none', 'Aucune réservation liée');
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t('welcomeGuide.reservationLink.title', 'Réservation en cours / à venir')}
          </Typography>
          <Chip
            size="small"
            icon={linked ? <Link2 size={13} strokeWidth={1.9} /> : <Unlink size={13} strokeWidth={1.9} />}
            label={
              linked
                ? t('welcomeGuide.reservationLink.linked', 'Lié')
                : t('welcomeGuide.reservationLink.notLinked', 'Non lié')
            }
            sx={softChipSx(semanticToHex(linked ? 'success' : 'default'))}
          />
        </Box>
        {linked && linkedReservation ? (
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarDays size={18} strokeWidth={1.75} style={{ color: DEFAULT_COLOR, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {linkedReservation.guestName || t('welcomeGuide.reservationLink.guestUnknown', 'Voyageur')}
                  </Typography>
                  {dates ? (
                    <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {dates}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <EmptyHint icon={<CalendarDays size={18} strokeWidth={1.75} />} text={emptyText} />
        )}
        {/* Garde-fous de création (étape Logement uniquement) */}
        {isCreate && !isStaff ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1, color: 'text.secondary' }}>
            <Lock size={14} strokeWidth={1.75} style={{ flexShrink: 0 }} />
            <Typography variant="caption">
              {t('welcomeGuide.reservationLink.staffOnly', 'La création d’un livret est réservée au staff Clenzy.')}
            </Typography>
          </Box>
        ) : null}
        {isCreate && isStaff && propertyId && !linked ? (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
            {t(
              'welcomeGuide.reservationLink.noReservation',
              'Aucune réservation en cours ou à venir pour ce logement : livret non créable.',
            )}
          </Typography>
        ) : null}
      </Box>
    );
  };

  // ─── Render: form ──────────────────────────────────────────────────────────
  const renderForm = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 392px' }, gap: 3, alignItems: 'start' }}>
      <Stack spacing={2.5}>
      {renderStepper()}

      {/* ── Étape 0 — Logement ── */}
      {step === 0 && (
      <>
      <TextField
        select
        label={t('welcomeGuide.fields.property', 'Logement')}
        value={propertyId}
        onChange={(e) => {
          setPropertyId(e.target.value);
          // Nouveau logement → on réinitialise le hero pour reprendre ses photos.
          setHeroPhotoIds([]);
          setHeroTouched(false);
        }}
        disabled={editingId != null}
        fullWidth
        size="small"
        helperText={
          editingId != null
            ? t('welcomeGuide.fields.propertyLocked', 'Le logement ne peut pas être changé après création')
            : undefined
        }
      >
        {properties.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label={t('welcomeGuide.fields.title', 'Titre du livret')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        fullWidth
        size="small"
        placeholder={t('welcomeGuide.fields.titlePlaceholder', 'Bienvenue à l’Appartement du Vieux-Port')}
      />

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          select
          label={t('welcomeGuide.fields.language', 'Langue')}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          size="small"
          sx={{ minWidth: 160 }}
        >
          {LANGUAGES.map((lng) => (
            <MenuItem key={lng} value={lng}>
              {t(`welcomeGuide.languages.${lng}`, lng.toUpperCase())}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label={t('welcomeGuide.fields.logoUrl', 'URL du logo')}
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 220 }}
          placeholder="https://…"
        />
      </Box>

      {/* Réservation rattachée (lecture seule) + badge Lié/Non lié */}
      {renderReservationLink()}
      </>
      )}

      {/* ── Étape 2 — Accueil ── */}
      {step === 2 && (
      <>
      {/* Message d'accueil de l'hôte : note dédiée (serif italique) affichée sous le hero. */}
      <Box>
        <SectionHeading
          icon={<Quote size={17} strokeWidth={1.75} />}
          title={t('welcomeGuide.welcomeNote.title', "Message d'accueil")}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {t(
            'welcomeGuide.welcomeNote.guestHint',
            "Le prénom du voyageur s'affiche automatiquement en haut de l'accueil, chargé depuis la réservation.",
          )}
        </Typography>
        <Stack spacing={1.5}>
          <TextField
            label={t('welcomeGuide.welcomeNote.message', "Mot d'accueil")}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={2}
            placeholder={t(
              'welcomeGuide.welcomeNote.messagePlaceholder',
              'Bienvenue chez nous. Installez-vous, respirez — tout ce qu’il vous faut pour un séjour parfait est ici.',
            )}
          />
          <TextField
            label={t('welcomeGuide.welcomeNote.signature', 'Signature (vos noms)')}
            value={hostNames}
            onChange={(e) => setHostNames(e.target.value)}
            size="small"
            sx={{ maxWidth: 320 }}
            placeholder={t('welcomeGuide.welcomeNote.signaturePlaceholder', 'ex : Camille & Antoine')}
          />
        </Stack>
      </Box>
      </>
      )}

      {/* ── Étape 1 — Apparence (thème + photos de couverture) ── */}
      {step === 1 && (
      <>
      {/* Thème du livret : carrés de couleur seuls, nom + description en tooltip.
          Taille fixe → le retour à la ligne s'adapte à la largeur (flex-wrap). */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.25 }}>
          {t('welcomeGuide.themes.sectionTitle', 'Thème du livret')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
          {WELCOME_BOOK_THEMES.map((th) => {
            const on = theme === th.id;
            return (
              <Tooltip
                key={th.id}
                arrow
                title={
                  <Box sx={{ textAlign: 'center', py: 0.25 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                      {t(`welcomeGuide.themes.${th.id}.name`, th.name)}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.85 }}>
                      {t(`welcomeGuide.themes.${th.id}.desc`, th.desc)}
                    </Typography>
                  </Box>
                }
              >
                <Box
                  role="button"
                  aria-label={t(`welcomeGuide.themes.${th.id}.name`, th.name)}
                  onClick={() => setTheme(th.id)}
                  sx={{
                    position: 'relative',
                    flexShrink: 0,
                    width: 52,
                    height: 52,
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: on
                      ? `0 0 0 2px ${DEFAULT_COLOR}, 0 0 0 4px rgba(107,138,154,0.20)`
                      : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                    transition: 'box-shadow .15s',
                    '&:hover': on ? undefined : { boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.28)' },
                  }}
                >
                  <Box sx={{ flex: 1, bgcolor: th.swatch.bg }} />
                  <Box sx={{ flex: 1, bgcolor: th.swatch.surface }} />
                  <Box sx={{ height: 16, bgcolor: th.swatch.accent }} />
                  {on ? (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          bgcolor: 'rgba(255,255,255,0.92)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                        }}
                      >
                        <Check size={14} strokeWidth={2.75} style={{ color: DEFAULT_COLOR }} />
                      </Box>
                    </Box>
                  ) : null}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {/* Photo de couverture (hero) : choix parmi les photos du logement */}
      <Box>
        <SectionHeading
          icon={<ImageIcon size={17} strokeWidth={1.75} />}
          title={t('welcomeGuide.hero.title', 'Photos de couverture')}
          actions={
            propertyPhotos.length > 0 ? (
              <Button
                size="small"
                onClick={() => {
                  setHeroTouched(true);
                  setHeroPhotoIds(
                    heroPhotoIds.length === propertyPhotos.length ? [] : propertyPhotos.map((p) => p.id),
                  );
                }}
              >
                {heroPhotoIds.length === propertyPhotos.length
                  ? t('welcomeGuide.hero.clearAll', 'Tout retirer')
                  : t('welcomeGuide.hero.selectAll', 'Tout sélectionner')}
              </Button>
            ) : undefined
          }
        />
        {!propertyId ? (
          <EmptyHint
            icon={<ImageIcon size={18} strokeWidth={1.75} />}
            text={t('welcomeGuide.hero.selectPropertyFirst', "Sélectionnez d'abord un logement pour voir ses photos.")}
          />
        ) : propertyPhotos.length === 0 ? (
          <EmptyHint
            icon={<ImageIcon size={18} strokeWidth={1.75} />}
            text={t('welcomeGuide.hero.empty', "Ce logement n'a pas encore de photos. Ajoutez-en depuis sa fiche.")}
          />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 1 }}>
            {propertyPhotos.map((ph) => {
              const on = heroPhotoIds.includes(ph.id);
              return (
                <Box
                  key={ph.id}
                  onClick={() => {
                    setHeroTouched(true);
                    setHeroPhotoIds((prev) =>
                      prev.includes(ph.id) ? prev.filter((id) => id !== ph.id) : [...prev, ph.id],
                    );
                  }}
                  sx={{
                    position: 'relative',
                    aspectRatio: '4 / 3',
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: on ? 'primary.main' : 'rgba(0,0,0,0.10)',
                    transition: 'border-color .15s',
                  }}
                >
                  <Box
                    component="img"
                    src={propertyPhotosApi.getPhotoUrl(Number(propertyId), ph.id)}
                    alt={ph.caption || ''}
                    loading="lazy"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {on ? (
                    <Box sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'primary.main', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} strokeWidth={2.5} />
                    </Box>
                  ) : null}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
      </>
      )}

      {/* ── Étape 3 — Contenu (sections + autour de moi) ── */}
      {step === 3 && (
      <>
      <Box>
        <SectionHeading
          icon={<FileText size={17} strokeWidth={1.75} />}
          title={t('welcomeGuide.form.sectionsTitle', 'Sections du livret')}
          actions={
            <Button size="small" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={addSection}>
              {t('welcomeGuide.actions.addSection', 'Ajouter une section')}
            </Button>
          }
        />

        {sections.length === 0 ? (
          <EmptyHint
            icon={<FileText size={18} strokeWidth={1.75} />}
            text={t('welcomeGuide.form.noSection', 'Aucune section. Ajoutez un message d’accueil ou des recommandations.')}
          />
        ) : (
          <Stack spacing={1.5}>
            {sections.map((s, idx) => (
              <Card key={s.id} variant="outlined">
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1, flexWrap: 'wrap' }}>
                    <IconSelect value={s.icon} onChange={(v) => updateSection(idx, { icon: v })} label={t('welcomeGuide.fields.sectionIcon', 'Icône')} />
                    <TextField
                      label={t('welcomeGuide.fields.sectionTitle', 'Titre')}
                      value={s.title}
                      onChange={(e) => updateSection(idx, { title: e.target.value })}
                      size="small"
                      sx={{ flex: 1, minWidth: 150 }}
                    />
                    <TextField
                      select
                      label={t('welcomeGuide.fields.sectionLayout', 'Type')}
                      value={s.layout}
                      onChange={(e) => updateSection(idx, { layout: e.target.value as GuideSectionLayout })}
                      size="small"
                      sx={{ width: 150 }}
                    >
                      {SECTION_LAYOUT_OPTIONS.map((l) => (
                        <MenuItem key={l} value={l}>{t(`welcomeGuide.layouts.${l}`, l)}</MenuItem>
                      ))}
                    </TextField>
                    <IconButton size="small" color="error" onClick={() => removeSection(idx)} sx={{ mt: 0.5 }}>
                      <Delete size={16} strokeWidth={1.75} />
                    </IconButton>
                  </Box>
                  <TextField
                    label={t('welcomeGuide.fields.sectionSubtitle', 'Sous-titre (liste de navigation)')}
                    value={s.subtitle}
                    onChange={(e) => updateSection(idx, { subtitle: e.target.value })}
                    fullWidth
                    size="small"
                    sx={{ mb: 1.25 }}
                  />
                  {s.layout === 'text' ? (
                    <TextField
                      label={t('welcomeGuide.fields.sectionBody', 'Contenu')}
                      value={s.body}
                      onChange={(e) => updateSection(idx, { body: e.target.value })}
                      fullWidth
                      size="small"
                      multiline
                      minRows={3}
                    />
                  ) : (
                    <Box>
                      {s.items.map((item, iIdx) => (
                        <Box key={item.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1, p: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                          <IconSelect value={item.icon} onChange={(v) => updateSectionItem(idx, iIdx, { icon: v })} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <TextField
                              label={t('welcomeGuide.sectionItems.label', 'Intitulé')}
                              value={item.label}
                              onChange={(e) => updateSectionItem(idx, iIdx, { label: e.target.value })}
                              fullWidth
                              size="small"
                            />
                            {s.layout === 'list' ? (
                              <TextField
                                label={t('welcomeGuide.sectionItems.detail', 'Détail')}
                                value={item.detail}
                                onChange={(e) => updateSectionItem(idx, iIdx, { detail: e.target.value })}
                                fullWidth
                                size="small"
                                sx={{ mt: 1 }}
                              />
                            ) : null}
                            {s.layout === 'steps' ? (
                              <TextField
                                label={t('welcomeGuide.sectionItems.steps', 'Étapes (une par ligne)')}
                                value={item.steps.join('\n')}
                                onChange={(e) => updateSectionItem(idx, iIdx, { steps: e.target.value.split('\n') })}
                                fullWidth
                                size="small"
                                multiline
                                minRows={2}
                                sx={{ mt: 1 }}
                              />
                            ) : null}
                          </Box>
                          <IconButton size="small" color="error" onClick={() => removeSectionItem(idx, iIdx)}>
                            <Delete size={15} strokeWidth={1.75} />
                          </IconButton>
                        </Box>
                      ))}
                      <Button size="small" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={() => addSectionItem(idx)}>
                        {t('welcomeGuide.sectionItems.add', 'Ajouter un élément')}
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      <Box>
        <SectionHeading
          icon={<MapPin size={17} strokeWidth={1.75} />}
          title={t('welcomeGuide.pois.title', 'Autour de moi')}
          actions={
            <>
              <Button size="small" startIcon={<Sparkles size={14} strokeWidth={1.75} />} onClick={openSuggest}>
                {t('welcomeGuide.pois.suggest', 'Suggérer')}
              </Button>
              <Button size="small" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={addPoi}>
                {t('welcomeGuide.pois.add', 'Ajouter un lieu')}
              </Button>
            </>
          }
        />

        {pois.length === 0 ? (
          <EmptyHint
            icon={<MapPin size={18} strokeWidth={1.75} />}
            text={t('welcomeGuide.pois.empty', 'Aucun lieu. Ajoutez vos restaurants, transports et incontournables.')}
          />
        ) : (
          <Stack spacing={1.5}>
            {pois.map((p, idx) => (
              <Card key={p.id} variant="outlined">
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <TextField
                          select
                          size="small"
                          label={t('welcomeGuide.pois.category', 'Catégorie')}
                          value={p.category}
                          onChange={(e) => updatePoi(idx, { category: e.target.value })}
                          sx={{ minWidth: 160 }}
                        >
                          {POI_CATEGORIES.map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                              {poiLabel(c.id, currentLanguage)}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          size="small"
                          label={t('welcomeGuide.pois.name', 'Nom')}
                          value={p.name}
                          onChange={(e) => updatePoi(idx, { name: e.target.value })}
                          sx={{ flex: 1, minWidth: 180 }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                        <TextField
                          size="small"
                          label={t('welcomeGuide.pois.address', 'Adresse')}
                          value={p.address}
                          onChange={(e) => updatePoi(idx, { address: e.target.value })}
                          fullWidth
                        />
                        <Tooltip title={t('welcomeGuide.pois.geocode', 'Localiser sur la carte')}>
                          <span>
                            <IconButton size="small" onClick={() => geocodePoi(idx)} disabled={geocoding === p.id}>
                              {geocoding === p.id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <MapPin size={16} strokeWidth={1.75} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                      <TextField
                        size="small"
                        label={t('welcomeGuide.pois.note', 'Note (optionnel)')}
                        value={p.note}
                        onChange={(e) => updatePoi(idx, { note: e.target.value })}
                        fullWidth
                      />
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 1, flexWrap: 'wrap' }}>
                        <TextField
                          size="small"
                          label={t('welcomeGuide.pois.type', 'Type (ex : Bistrot)')}
                          value={p.type}
                          onChange={(e) => updatePoi(idx, { type: e.target.value })}
                          sx={{ flex: 1, minWidth: 160 }}
                        />
                        <FormControlLabel
                          control={<Switch size="small" checked={p.featured} onChange={(e) => updatePoi(idx, { featured: e.target.checked })} />}
                          label={t('welcomeGuide.pois.featured', 'Coup de cœur')}
                        />
                      </Box>
                      {p.lat != null && p.lng != null ? (
                        <Typography
                          variant="caption"
                          sx={{ color: 'success.main', display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}
                        >
                          <MapPin size={12} strokeWidth={2} /> {t('welcomeGuide.pois.located', 'Position trouvée')}
                        </Typography>
                      ) : null}
                    </Box>
                    <IconButton size="small" color="error" onClick={() => removePoi(idx)} sx={{ mt: 0.5 }}>
                      <Delete size={16} strokeWidth={1.75} />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      </>
      )}

      {/* ── Étape 4 — Expériences & services ── */}
      {step === 4 && (
      <>
      <Box>
        <SectionHeading
          icon={<Ticket size={17} strokeWidth={1.75} />}
          title={t('welcomeGuide.curation.title', 'Activités à proposer')}
          actions={
            <Button size="small" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={addActivity}>
              {t('welcomeGuide.curation.add', 'Ajouter une activité')}
            </Button>
          }
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {t(
            'welcomeGuide.curation.affiliateHint',
            "Collez un lien Klook, GetYourGuide ou Viator : si le fournisseur est connecté (onglet Intégrations), votre identifiant d'affiliation est ajouté automatiquement au lien pour toucher votre commission.",
          )}
        </Typography>

        {curatedActivities.length === 0 ? (
          <EmptyHint
            icon={<Ticket size={18} strokeWidth={1.75} />}
            text={t('welcomeGuide.curation.empty', 'Aucune activité. Ajoutez vos excursions et bons plans à réserver.')}
          />
        ) : (
          <Stack spacing={1.5}>
            {curatedActivities.map((a, idx) => (
              <Card key={a.id} variant="outlined" sx={a.featured ? { borderColor: '#D4A574' } : undefined}>
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <TextField
                          size="small"
                          label={t('welcomeGuide.curation.activityTitle', 'Titre')}
                          value={a.title}
                          onChange={(e) => updateActivity(idx, { title: e.target.value })}
                          sx={{ flex: 1, minWidth: 180 }}
                        />
                        <TextField
                          size="small"
                          label={t('welcomeGuide.curation.price', 'Prix')}
                          value={a.price ?? ''}
                          onChange={(e) => updateActivity(idx, { price: e.target.value || null })}
                          sx={{ width: 120 }}
                          placeholder="ex : 29 €"
                        />
                      </Box>
                      <TextField
                        size="small"
                        label={t('welcomeGuide.curation.bookingUrl', 'Lien de réservation')}
                        value={a.bookingUrl}
                        onChange={(e) => updateActivity(idx, { bookingUrl: e.target.value })}
                        fullWidth
                        placeholder="https://…"
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        size="small"
                        label={t('welcomeGuide.curation.imageUrl', "URL de l'image (optionnel)")}
                        value={a.imageUrl ?? ''}
                        onChange={(e) => updateActivity(idx, { imageUrl: e.target.value || null })}
                        fullWidth
                        placeholder="https://…"
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        size="small"
                        label={t('welcomeGuide.curation.description', 'Description (optionnel)')}
                        value={a.description}
                        onChange={(e) => updateActivity(idx, { description: e.target.value })}
                        fullWidth
                        multiline
                        minRows={2}
                      />
                      <FormControlLabel
                        sx={{ mt: 0.5 }}
                        control={
                          <Switch
                            size="small"
                            checked={a.featured}
                            onChange={(e) => updateActivity(idx, { featured: e.target.checked })}
                          />
                        }
                        label={t('welcomeGuide.curation.featured', 'Mettre en avant')}
                      />
                    </Box>
                    <IconButton size="small" color="error" onClick={() => removeActivity(idx)} sx={{ mt: 0.5 }}>
                      <Delete size={16} strokeWidth={1.75} />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      {/* Activation des sections « Activités » et « Services payants » (split de la carte Fonctionnalités) */}
      <Card variant="outlined">
        <CardContent sx={{ '&:last-child': { pb: 0.5 }, pt: 1, px: 2 }}>
          <ToggleRow
            icon={<Ticket size={18} strokeWidth={1.75} />}
            label={t('welcomeGuide.fields.activitiesEnabled', 'Activités')}
            description={t('welcomeGuide.fields.activitiesHint', 'Section expériences à réserver.')}
            checked={activitiesEnabled}
            onChange={setActivitiesEnabled}
          />
          <Divider />
          <ToggleRow
            icon={<ConciergeBell size={18} strokeWidth={1.75} />}
            label={t('welcomeGuide.fields.upsellsEnabled', 'Services payants')}
            description={t('welcomeGuide.fields.upsellsHint', 'Section des services additionnels à réserver.')}
            checked={upsellsEnabled}
            onChange={setUpsellsEnabled}
          />
        </CardContent>
      </Card>

      {/* Sélection des services payants affichés sur CE livret (par défaut : tous) */}
      {upsellsEnabled && (
        <Card variant="outlined">
          <CardContent sx={{ '&:last-child': { pb: 2 }, pt: 1.5, px: 2 }}>
            <SectionHeading
              icon={<ConciergeBell size={16} strokeWidth={1.75} />}
              title={t('welcomeGuide.fields.upsellSelectionTitle', 'Services affichés sur ce livret')}
            />
            {applicableOffers.length === 0 ? (
              <EmptyHint
                icon={<ConciergeBell size={18} strokeWidth={1.5} />}
                text={t(
                  'welcomeGuide.fields.upsellSelectionEmpty',
                  'Aucun service payant pour ce logement. Créez vos services dans l’onglet « Services payants », puis cochez ici ceux à afficher.',
                )}
              />
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {t(
                    'welcomeGuide.fields.upsellSelectionHint',
                    'Décochez un service pour le masquer sur ce livret uniquement.',
                  )}
                </Typography>
                <Stack spacing={0}>
                  {applicableOffers.map((o) => (
                    <FormControlLabel
                      key={o.id}
                      control={
                        <Checkbox
                          size="small"
                          checked={isOfferShown(o.id)}
                          onChange={() => toggleOfferShown(o.id)}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                          <Typography variant="body2">{o.title}</Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {o.price.toFixed(0)} {o.currency}
                          </Typography>
                        </Box>
                      }
                    />
                  ))}
                </Stack>
              </>
            )}
          </CardContent>
        </Card>
      )}
      </>
      )}

      {/* ── Étape 5 — Options & publication ── */}
      {step === 5 && (
      <>
      {/* Fonctionnalités optionnelles : chatbot + livre d'or (split de la carte Fonctionnalités) */}
      <Card variant="outlined">
        <CardContent sx={{ '&:last-child': { pb: 0.5 }, pt: 1, px: 2 }}>
          <ToggleRow
            icon={<MessageCircle size={18} strokeWidth={1.75} />}
            label={t('welcomeGuide.fields.chatbotEnabled', 'Chatbot assistant')}
            description={t('welcomeGuide.fields.chatbotHint', 'Répond aux questions du voyageur (IA).')}
            checked={chatbotEnabled}
            onChange={setChatbotEnabled}
          />
          <Divider />
          <ToggleRow
            icon={<Star size={18} strokeWidth={1.75} />}
            label={t('welcomeGuide.fields.guestbookEnabled', "Livre d'or")}
            description={t('welcomeGuide.fields.guestbookHint', 'Avis et notes laissés par les voyageurs.')}
            checked={guestbookEnabled}
            onChange={setGuestbookEnabled}
          />
        </CardContent>
      </Card>

      {/* Visibilité : publication du livret (action principale, mise en avant) */}
      <Card
        variant="outlined"
        sx={{
          borderColor: published ? 'success.main' : 'divider',
          bgcolor: published ? 'rgba(74,155,142,0.06)' : 'transparent',
          transition: 'border-color .15s, background-color .15s',
        }}
      >
        <CardContent sx={{ '&:last-child': { pb: 1.5 }, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              flexShrink: 0,
              width: 34,
              height: 34,
              borderRadius: 1.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: published ? 'success.main' : 'action.hover',
              color: published ? '#fff' : 'text.secondary',
            }}
          >
            <Globe size={18} strokeWidth={1.75} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {t('welcomeGuide.fields.publishTitle', 'Publier le livret')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('welcomeGuide.fields.publishHint', 'Rend le livret accessible à vos voyageurs via le lien partagé.')}
            </Typography>
          </Box>
          <Switch checked={published} onChange={(e) => setPublished(e.target.checked)} />
        </CardContent>
      </Card>
      </>
      )}

      {/* ── Étape 6 — Récapitulatif ── */}
      {step === LAST_STEP && renderRecap()}
      </Stack>

      {/* ── Aperçu téléphone live (reflète l'état du formulaire en temps réel) ── */}
      <Box sx={{ position: { lg: 'sticky' }, top: 12, justifySelf: { xs: 'center', lg: 'start' }, width: '100%' }}>
        <Box
          sx={{
            width: 360,
            maxWidth: '100%',
            height: 720,
            mx: 'auto',
            borderRadius: '34px',
            overflow: 'hidden',
            border: '10px solid',
            borderColor: '#1B2A35',
            boxShadow: '0 28px 70px -28px rgba(27,42,53,0.55)',
            bgcolor: '#000',
          }}
        >
          <WelcomeBookView
            model={previewModel}
            theme={theme}
            lang={previewLang}
            labels={GUIDE_LABELS[previewLang]}
            heroImages={previewHeroImages}
            interactive={false}
            previewFocus={step === 3 ? 'content' : step === 4 ? 'experiences' : 'home'}
          />
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box>
      {headerActions}
      {view === 'list' ? renderList() : renderForm()}

      <Dialog open={linkDialog.open} onClose={() => setLinkDialog({ open: false, link: '', qrCode: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>{t('welcomeGuide.link.dialogTitle', "Lien du livret d'accueil")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'welcomeGuide.link.note',
              'Lien de partage manuel (aperçu). La diffusion automatique d’un lien propre à chaque réservation — valable uniquement le temps du séjour — arrive prochainement.',
            )}
          </Typography>
          <TextField
            value={linkDialog.link}
            fullWidth
            size="small"
            InputProps={{ readOnly: true }}
            onFocus={(e) => e.target.select()}
          />
          {linkDialog.qrCode ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2, gap: 1 }}>
              <Box component="img" src={linkDialog.qrCode} alt="QR code" sx={{ width: 200, height: 200 }} />
              <Button size="small" href={linkDialog.qrCode} download="livret-qr.png">
                {t('welcomeGuide.link.downloadQr', 'Télécharger le QR')}
              </Button>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            href={linkDialog.link}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<OpenInNew size={16} strokeWidth={1.75} />}
          >
            {t('welcomeGuide.link.open', 'Ouvrir')}
          </Button>
          <Button
            variant="contained"
            startIcon={<ContentCopy size={16} strokeWidth={1.75} />}
            onClick={copyLink}
          >
            {copied ? t('welcomeGuide.link.copied', 'Copié !') : t('welcomeGuide.link.copy', 'Copier')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        title={t('welcomeGuide.messages.confirmDelete', 'Supprimer ce livret ?')}
        message={t(
          'welcomeGuide.messages.confirmDeleteHint',
          'Ce livret et ses liens de partage seront supprimés définitivement. Cette action est irréversible.',
        )}
        confirmText={t('welcomeGuide.actions.delete', 'Supprimer')}
        cancelText={t('welcomeGuide.actions.cancel', 'Annuler')}
        severity="error"
        loading={deleting}
      />

      {/* Conflit 409 : un livret existe déjà pour la réservation → confirmation d'écrasement. */}
      <ConfirmationModal
        open={overwriteConfirm}
        onClose={() => {
          if (!saving) setOverwriteConfirm(false);
        }}
        onConfirm={() => handleSave(true)}
        title={t('welcomeGuide.reservationLink.overwriteTitle', 'Un livret existe déjà')}
        message={t(
          'welcomeGuide.reservationLink.overwriteMessage',
          'Un livret existe déjà pour cette réservation. Voulez-vous écraser l’ancien livret ?',
        )}
        confirmText={t('welcomeGuide.reservationLink.overwriteConfirm', 'Écraser')}
        cancelText={t('welcomeGuide.actions.cancel', 'Annuler')}
        severity="warning"
        confirmColor="warning"
        confirmIcon={<Save size={18} strokeWidth={1.75} />}
        loading={saving}
      />

      <Dialog open={guestbook.open} onClose={() => setGuestbook((s) => ({ ...s, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t('welcomeGuide.guestbook.title', "Livre d'or")} — {guestbook.title}
        </DialogTitle>
        <DialogContent dividers>
          {guestbook.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : guestbook.entries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('welcomeGuide.guestbook.empty', 'Aucun message pour le moment.')}
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {guestbook.entries.map((e) => (
                <Box key={e.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {e.authorName || '—'}
                    </Typography>
                    {e.rating ? (
                      <Box sx={{ display: 'flex', gap: 0.25 }}>
                        {Array.from({ length: e.rating }).map((_, i) => (
                          <Star key={i} size={14} strokeWidth={1.75} fill="currentColor" style={{ color: '#D4A574' }} />
                        ))}
                      </Box>
                    ) : null}
                  </Box>
                  {e.message ? (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mt: 0.5 }}>
                      {e.message}
                    </Typography>
                  ) : null}
                  {e.createdAt ? (
                    <Typography variant="caption" color="text.secondary">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </Typography>
                  ) : null}
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGuestbook((s) => ({ ...s, open: false }))}>
            {t('welcomeGuide.actions.close', 'Fermer')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={stats.open} onClose={() => setStats((s) => ({ ...s, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t('welcomeGuide.stats.title', 'Statistiques')} — {stats.title}
        </DialogTitle>
        <DialogContent dividers>
          {stats.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : !stats.data ? (
            <Typography variant="body2" color="text.secondary">
              {t('welcomeGuide.stats.empty', 'Aucune donnée pour le moment.')}
            </Typography>
          ) : (
            <Stack spacing={2.5}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                  gap: 1,
                }}
              >
                {[
                  { key: 'opens', icon: <Eye size={14} strokeWidth={1.75} />, label: t('welcomeGuide.stats.opens', 'Ouvertures'), value: stats.data.totalOpens },
                  { key: 'chat', icon: <MessageCircle size={14} strokeWidth={1.75} />, label: t('welcomeGuide.stats.chat', 'Messages chatbot'), value: stats.data.chatMessages },
                  { key: 'guestbook', icon: <Star size={14} strokeWidth={1.75} />, label: t('welcomeGuide.stats.guestbook', "Avis livre d'or"), value: stats.data.guestbookEntries },
                  { key: 'activities', icon: <MapPin size={14} strokeWidth={1.75} />, label: t('welcomeGuide.stats.activities', 'Clics activités'), value: stats.data.activityClicks },
                  { key: 'checkin', icon: <DoorOpen size={14} strokeWidth={1.75} />, label: t('welcomeGuide.stats.checkin', 'Clics check-in'), value: stats.data.checkinClicks },
                ].map((tile) => (
                  <Box key={tile.key} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', mb: 0.5 }}>
                      {tile.icon}
                      <Typography variant="caption">{tile.label}</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {tile.value}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('welcomeGuide.stats.trend', 'Ouvertures (30 derniers jours)')}
                </Typography>
                {stats.data.dailyOpens.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('welcomeGuide.stats.noTrend', 'Pas encore d’ouvertures.')}
                  </Typography>
                ) : (
                  <Box sx={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.data.dailyOpens.map((d) => ({ day: d.date.slice(5), count: d.count }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
                        <RechartsTooltip />
                        <Bar dataKey="count" fill={DEFAULT_COLOR} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </Box>

              {stats.data.topActivities.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    {t('welcomeGuide.stats.topActivities', 'Activités les plus cliquées')}
                  </Typography>
                  <Stack spacing={0.75}>
                    {stats.data.topActivities.map((a, i) => (
                      <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" noWrap>
                          {a.label}
                        </Typography>
                        <Chip size="small" label={a.count} sx={softChipSx(DEFAULT_COLOR)} />
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStats((s) => ({ ...s, open: false }))}>
            {t('welcomeGuide.actions.close', 'Fermer')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Suggestions auto (OSM) autour du logement */}
      <Dialog open={suggest.open} onClose={() => setSuggest((s) => ({ ...s, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle>{t('welcomeGuide.pois.suggestTitle', 'Suggestions autour du logement')}</DialogTitle>
        <DialogContent dividers>
          {suggest.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : suggest.items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('welcomeGuide.pois.suggestEmpty', 'Aucune suggestion trouvée autour du logement.')}
            </Typography>
          ) : (
            <Stack spacing={0.25}>
              {suggest.items.map((sug, i) => {
                const cat = poiCategory(sug.category);
                const CatIcon = cat.Icon;
                return (
                  <FormControlLabel
                    key={i}
                    sx={{ alignItems: 'flex-start', m: 0, py: 0.5 }}
                    control={<Checkbox size="small" checked={suggest.selected.has(i)} onChange={() => toggleSuggest(i)} />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                        <CatIcon size={14} strokeWidth={1.9} style={{ color: cat.color, flexShrink: 0 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {sug.name}
                          </Typography>
                          {sug.address ? (
                            <Typography variant="caption" color="text.secondary">
                              {sug.address}
                            </Typography>
                          ) : null}
                        </Box>
                      </Box>
                    }
                  />
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuggest((s) => ({ ...s, open: false }))}>
            {t('welcomeGuide.actions.close', 'Fermer')}
          </Button>
          <Button variant="contained" disabled={suggest.selected.size === 0} onClick={addSuggested}>
            {t('welcomeGuide.pois.suggestAdd', 'Ajouter')} ({suggest.selected.size})
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WelcomeGuideAdmin;
