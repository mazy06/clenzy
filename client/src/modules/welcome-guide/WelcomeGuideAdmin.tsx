import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import {
  Badge,
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from '../../components/ui';
import { Spinner } from '../../components/ui';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, Menu, MenuItem, Snackbar, Alert, Stack, Switch, TextField, Tooltip } from '@mui/material';
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
  Tag,
  ArrowUp,
  ArrowRight,
  Zap,
  LayoutGrid,
  Download,
  Search,
  List as ListIcon,
  Home as HomeIcon,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
// Feuille de style « studio accueil » partagée (scopée .be-home, accent indigo)
// avec l'onglet Booking Engine — hero, champ IA, éventail, thèmes, cartes.
import '../booking-engine/studio/studioHome.css';
import { StructureArt } from './structureArt';
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
import { useAiFeatureToggles } from '../../hooks/useAi';
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
    return Array.isArray(arr)
      ? arr.flatMap((v) => {
          const n = Number(v);
          return Number.isFinite(n) ? [n] : [];
        })
      : null;
  } catch {
    return null;
  }
}

const SECTION_LAYOUT_OPTIONS: GuideSectionLayout[] = ['text', 'steps', 'rules', 'list'];

/** Catégories de POI géocodées automatiquement (lieux PUBLICS à noms réels) — cf. géocodage IA. */
const GEOCODABLE_POI_CATS = new Set(['ATTRACTION', 'TRANSPORT', 'ACTIVITY']);

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

// Rotation (deg) / lift (px) d'une carte d'éventail — fan symétrique pour un nombre VARIABLE de cartes.
const fanTip = (i: number, n: number): number => (n <= 1 ? 0 : +(((n - 1) / 2 - i) * 3).toFixed(2));
const fanLift = (i: number, n: number): number => (n <= 1 ? 0 : +(Math.abs(i - (n - 1) / 2) * 6).toFixed(1));

// Structures de contenu (éventail) — préréglages de sections du livret.
const LIVRET_STRUCTURES: { id: string; name: string; desc: string; icon: typeof Zap; badge?: string }[] = [
  { id: 'essentiel', name: "L'Essentiel", desc: 'Wifi, arrivée & départ', icon: Zap, badge: 'Rapide' },
  { id: 'complet', name: 'Complet', desc: 'Toutes les sections pré-remplies', icon: LayoutGrid },
  { id: 'cityguide', name: 'City Guide', desc: 'Quartier & recommandations', icon: MapPin },
  { id: 'longue', name: 'Longue durée', desc: 'Infos pratiques étendues', icon: CalendarDays },
  { id: 'conciergerie', name: 'Conciergerie', desc: 'Expériences & services payants', icon: ConciergeBell },
];

const WelcomeGuideAdmin: React.FC = () => {
  const { t, currentLanguage } = useTranslation();
  const { isPlatformStaff, user } = useAuth();
  // Création réservée au staff plateforme (cf. POST /welcome-guides côté backend).
  // L'édition d'un livret existant reste ouverte à tous les rôles métier.
  const isStaff = isPlatformStaff();
  // Initiales du propriétaire (colonne « Propriétaire » de la liste, façon Booking Engine).
  const ownerInitials = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase()
    || (user?.fullName || user?.email || 'V').trim().charAt(0).toUpperCase();
  // Menu « … » d'actions par ligne de la liste (toutes les actions y sont conservées).
  const [rowMenu, setRowMenu] = useState<{ el: HTMLElement; guide: WelcomeGuide } | null>(null);
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
  // Champ IA du livret (gated STUDIO_ASSIST). Optimiste : actif tant que les toggles ne sont pas chargés.
  const [generating, setGenerating] = useState(false);
  const { data: aiToggles } = useAiFeatureToggles();
  const aiAssistOn = !aiToggles || (aiToggles.find((tg) => tg.feature === 'STUDIO_ASSIST')?.enabled ?? true);
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
  // Publication/dépublication depuis la liste : id du livret en cours de bascule (désactive le toggle).
  const [togglingPublishId, setTogglingPublishId] = useState<number | null>(null);
  // Accueil « studio » : saisie du champ IA + recherche dans la liste des livrets.
  const [livretPrompt, setLivretPrompt] = useState('');
  const [livretQuery, setLivretQuery] = useState('');

  // Form state
  const [propertyId, setPropertyId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<string>('fr');
  // Couleur de marque : passthrough load->save, jamais affichee au render : ref.
  const brandingColorRef = useRef<string>(DEFAULT_COLOR);
  const [theme, setTheme] = useState<string>(DEFAULT_THEME);
  // Sélection « studio » (parité Booking Engine) : structure obligatoire → thème (gated) → le bouton ↑ crée.
  const [structureId, setStructureId] = useState<string | null>(null);
  const [hoveredStructureId, setHoveredStructureId] = useState<string | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [hoveredThemeId, setHoveredThemeId] = useState<string | null>(null);
  // Photos de couverture (carrousel) : liste d'ids de PropertyPhoto sélectionnées.
  const [heroPhotoIds, setHeroPhotoIds] = useState<number[]>([]);
  // Distingue « choix explicite de l'hôte » de « pas encore choisi » : tant que false,
  // toutes les photos du logement sont sélectionnées par défaut quand elles arrivent.
  const [heroTouched, setHeroTouched] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [hostNames, setHostNames] = useState('');
  const welcomeMessageRef = useRef<HTMLTextAreaElement | null>(null);
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

  // Nom du voyageur chargé depuis la réservation liée (lecture seule). Insérable dans le mot
  // d'accueil via le tag {prénom}, substitué au rendu (cf. WelcomeBookView).
  const loadedGuestName = linkedReservation?.guestName?.trim() || '';
  const insertGuestFirstNameTag = () => {
    const tag = '{prénom}';
    const el = welcomeMessageRef.current;
    if (!el) {
      setWelcomeMessage((m) => `${m}${tag}`);
      return;
    }
    const start = el.selectionStart ?? welcomeMessage.length;
    const end = el.selectionEnd ?? welcomeMessage.length;
    setWelcomeMessage(welcomeMessage.slice(0, start) + tag + welcomeMessage.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

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

  const openCreate = (opts?: { theme?: string }) => {
    // Nouveau livret pré-rempli avec un modèle riche (template Baitly) que l'hôte
    // personnalise, complète ou supprime ensuite. Langue par défaut = fr.
    // `opts.theme` : présélection depuis une carte de thème de l'accueil.
    const tplLang = 'fr';
    setEditingId(null);
    setPropertyId('');
    setTitle('');
    setLanguage(tplLang);
    brandingColorRef.current = DEFAULT_COLOR;
    setTheme(opts?.theme ?? DEFAULT_THEME);
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

  // Sélection « studio » (parité Booking Engine) ───────────────────────────────
  const applyStructure = (id: string) => setStructureId(id);                              // structure obligatoire
  const applyThemeSel = (id: string) => { if (structureId) setSelectedThemeId(id); };     // thème gated par la structure
  // Bouton ↑ : si une structure est choisie → crée le livret (structure + thème) ; sinon → génération IA.
  const handleStudioSubmit = () => {
    if (structureId) { openCreate({ theme: selectedThemeId ?? DEFAULT_THEME }); return; }
    void handleGenerateGuide();
  };

  // Champ IA du livret (gated STUDIO_ASSIST) : génère un brouillon complet (message d'accueil + sections
  // + recommandations du quartier) depuis la description/URL saisie, puis ouvre le formulaire pré-rempli
  // (le contenu IA écrase le modèle par défaut). Toggle off OU champ vide → repli création depuis modèle.
  const handleGenerateGuide = async () => {
    const value = livretPrompt.trim();
    if (!value || !aiAssistOn) { openCreate(); return; }
    setGenerating(true);
    try {
      const res = await welcomeGuideApi.generateGuide(value, currentLanguage);
      openCreate();
      if (res.welcomeMessage) setWelcomeMessage(res.welcomeMessage);
      const secs = parseSections(res.sections);
      if (secs.length) setSections(secs);
      const generatedPois = parsePois(res.pois);
      if (generatedPois.length) {
        setPois(generatedPois);
        // Géocodage auto best-effort des POI publics (attractions/transport/activités) → pins carte.
        // En arrière-plan (séquentiel, rate-limit Nominatim) : la liste est déjà affichée, les coords
        // arrivent au fil de l'eau. Les commerces génériques restent sans coords (liste seule).
        void geocodeGeneratedPois(generatedPois, res.area);
      }
    } catch {
      notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
      openCreate(); // repli : on ouvre quand même le formulaire (modèle par défaut)
    } finally {
      setGenerating(false);
    }
  };

  // Géocode best-effort les POI générés des catégories PUBLIQUES (noms réels géocodables). Séquentiel
  // (Nominatim ~1 req/s). Met à jour les coords par index+nom (sans écraser celles posées par l'hôte).
  // Les commerces privés (noms génériques) sont ignorés → ils restent en liste, sans pin carte.
  const geocodeGeneratedPois = async (generated: GuidePoi[], area: string | null) => {
    for (let i = 0; i < generated.length; i++) {
      const p = generated[i];
      if (!GEOCODABLE_POI_CATS.has(p.category) || !p.name?.trim()) continue;
      const query = area && area.trim() ? `${p.name}, ${area}` : p.name;
      const results = await nominatimApi.search(query, [], 1);
      if (results.length) {
        const { latitude, longitude } = results[0];
        setPois((prev) => prev.map((q, idx) =>
          idx === i && q.name === p.name && q.lat == null ? { ...q, lat: latitude, lng: longitude } : q));
      }
      // Respect de la politique Nominatim (1 req/s) entre deux géocodages.
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  };

  const openEdit = (g: WelcomeGuide) => {
    setEditingId(g.id);
    setPropertyId(g.propertyId != null ? String(g.propertyId) : '');
    setTitle(g.title);
    setLanguage(g.language || 'fr');
    brandingColorRef.current = g.brandingColor || DEFAULT_COLOR;
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
        brandingColor: brandingColorRef.current,
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

  // Publie / dépublie un livret directement depuis la liste (update partiel, sans ouvrir l'éditeur).
  const handleTogglePublish = async (g: WelcomeGuide) => {
    setTogglingPublishId(g.id);
    try {
      // propertyId (@NotNull) + title (@NotBlank) sont validés même en update (DTO partagé) ; on
      // renvoie les valeurs courantes (propertyId est ignoré côté service), seul `published` change.
      await welcomeGuideApi.update(g.id, {
        propertyId: g.propertyId ?? 0,
        title: g.title,
        published: !g.published,
      });
      notify(
        g.published
          ? t('welcomeGuide.actions.unpublishOk', 'Livret dépublié')
          : t('welcomeGuide.actions.publishOk', 'Livret publié'),
      );
      await refetch();
    } catch {
      notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
    } finally {
      setTogglingPublishId(null);
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
      ...suggest.items.flatMap((sug, i) =>
        suggest.selected.has(i)
          ? [{
              id: `poi-${Date.now()}-${i}`,
              category: sug.category,
              name: sug.name,
              type: '',
              address: sug.address ?? '',
              lat: sug.lat,
              lng: sug.lng,
              note: '',
              featured: false,
            }]
          : [],
      ),
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
        <Button size="sm" onClick={() => openCreate()}>
          <Add size={14} strokeWidth={1.75} />
          {t('welcomeGuide.actions.new', 'Nouveau livret')}
        </Button>
      ) : null
    ) : (
      <Button variant="ghost" size="sm" onClick={closeForm}>
        {t('welcomeGuide.actions.cancel', 'Annuler')}
      </Button>
    ),
  );

  // ─── Render: list ──────────────────────────────────────────────────────────
  const renderList = () => {
    const q = livretQuery.trim().toLowerCase();
    const filtered = q
      ? guides.filter((g) => g.title.toLowerCase().includes(q) || (g.propertyName ?? '').toLowerCase().includes(q))
      : guides;
    // Sélection courante (sélectionné, sinon survolé) pour les chips + chevauchement dynamique des thèmes.
    const curStructure = LIVRET_STRUCTURES.find((s) => s.id === (structureId ?? hoveredStructureId)) ?? null;
    const curTheme = WELCOME_BOOK_THEMES.find((tt) => tt.id === (selectedThemeId ?? hoveredThemeId)) ?? null;
    const themeOverlap = WELCOME_BOOK_THEMES.length > 1
      ? Math.max(6, (WELCOME_BOOK_THEMES.length * 124 - 760) / (WELCOME_BOOK_THEMES.length - 1)) : 0;
    return (
      <div className="be-home px-3 min-[900px]:px-[18px] py-3 min-[900px]:py-[18px]" data-accent="indigo">
        <div className="canvas" style={{ maxWidth: 860, margin: '0 auto' }}>
          {/* Bloc création (studio) — réservé au staff plateforme (cf. POST /welcome-guides).
              Même écran que le Booking Engine : TOUJOURS affiché (pas d'écran différent selon
              qu'on ait ou non un livret). Studio à gauche, thèmes en rail vertical à droite. */}
          {isStaff && (
            <div className="studio-split">
              <div className="studio-split__main">
              <div className="hero">
                <p className="eyebrow">Livret d'accueil · Studio</p>
                <h1>Quel livret d'accueil créons-nous&nbsp;?</h1>
              </div>

              {/* Champ IA : génère un brouillon (welcomeMessage + sections) via IA (gated STUDIO_ASSIST). */}
              <div className="field">
                <textarea
                  className="field__area"
                  value={livretPrompt}
                  onChange={(e) => setLivretPrompt(e.target.value)}
                  aria-label="Décrivez votre logement ou collez le lien de votre annonce"
                  placeholder={aiAssistOn
                    ? "Collez le lien de votre annonce Airbnb / Booking à importer, ou décrivez votre logement…"
                    : "Décrivez votre logement (l'assistant IA est désactivé — Paramètres › IA)…"}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerateGuide(); }}
                />
                <div className="field__bar">
                  <button className="chip chip--icon" type="button" aria-label="Importer une photo" disabled><Add size={16} strokeWidth={2} /></button>
                  {/* Structure (obligatoire) : reflète la sélection de l'éventail. */}
                  <div className="chip">
                    <span className={'chip__slide' + (curStructure ? ' chip__slide--open' : '')}>
                      {curStructure && <span className="chip__art"><StructureArt id={curStructure.id} /></span>}
                    </span>
                    <span className="chip__text"><span className="chip__lbl">Structure</span><span className="chip__val">{curStructure ? curStructure.name : 'Aucune'}</span></span>
                  </div>
                  {/* Thème : grisé tant qu'aucune structure choisie. */}
                  <div className={'chip' + (!structureId ? ' chip--locked' : '')}>
                    <span className={'chip__slide' + (curTheme ? ' chip__slide--open' : '')}>
                      {curTheme && <span className="chip__art chip__art--img"><span aria-hidden style={{ position: 'absolute', inset: 0, background: curTheme.swatch.accent }} /></span>}
                    </span>
                    <span className="chip__text"><span className="chip__lbl">Thème</span><span className="chip__val">{curTheme ? curTheme.name : (structureId ? 'Aucun' : 'Choisir une structure')}</span></span>
                  </div>
                  <div className="field__spacer" />
                  <button className="send" type="button" aria-label={structureId ? 'Créer le livret' : 'Générer le livret'} disabled={generating} onClick={handleStudioSubmit}><ArrowUp size={19} strokeWidth={2.2} /></button>
                </div>
              </div>

              {/* Structures (éventail, sélection obligatoire) */}
              <div className="fan-wrap">
                <p className="fan-lead">Choisissez une structure de livret…</p>
                <div className="fan">
                  {LIVRET_STRUCTURES.map((s, i) => (
                    <article
                      key={s.id}
                      className={'fan__card' + (s.id === structureId ? ' fan__card--active' : '')}
                      style={{ ['--tip']: fanTip(i, LIVRET_STRUCTURES.length), ['--lift']: fanLift(i, LIVRET_STRUCTURES.length) } as React.CSSProperties}
                      role="button" tabIndex={0} aria-pressed={s.id === structureId}
                      title={`Choisir la structure « ${s.name} »`}
                      onClick={() => applyStructure(s.id)}
                      onMouseEnter={() => setHoveredStructureId(s.id)}
                      onMouseLeave={() => setHoveredStructureId(null)}
                      onFocus={() => setHoveredStructureId(s.id)}
                      onBlur={() => setHoveredStructureId(null)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyStructure(s.id); } }}
                    >
                      <div className="fan__vig"><StructureArt id={s.id} /></div>
                      <p className="fan__name">{s.name}</p>
                    </article>
                  ))}
                </div>
              </div>

              {/* Thèmes (éventail, grisés tant qu'aucune structure ; le ↑ crée avec structure + thème). */}
              <div className="fan-wrap">
                <p className="fan-lead">Puis choisissez un thème…</p>
                {!structureId ? (
                  <p className="fan-locked">Sélectionnez d'abord une structure ci-dessus pour débloquer les thèmes.</p>
                ) : (
                  <div className="fan fan--tpl" style={{ ['--fan-mx']: `${-(themeOverlap / 2)}px` } as React.CSSProperties}>
                    {WELCOME_BOOK_THEMES.map((th, i) => (
                      <article
                        key={th.id}
                        className={'fan__card' + (th.id === selectedThemeId ? ' fan__card--active' : '')}
                        style={{ ['--tip']: fanTip(i, WELCOME_BOOK_THEMES.length), ['--lift']: fanLift(i, WELCOME_BOOK_THEMES.length) } as React.CSSProperties}
                        role="button" tabIndex={0} aria-pressed={th.id === selectedThemeId}
                        title={`Choisir le thème « ${th.name} »`}
                        onClick={() => applyThemeSel(th.id)}
                        onMouseEnter={() => setHoveredThemeId(th.id)}
                        onMouseLeave={() => setHoveredThemeId(null)}
                        onFocus={() => setHoveredThemeId(th.id)}
                        onBlur={() => setHoveredThemeId(null)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyThemeSel(th.id); } }}
                      >
                        <div className="fan__vig fan__vig--img" style={{ background: th.swatch.bg }}>
                          <span aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 2, padding: 5, boxSizing: 'border-box' }}>
                            <span style={{ height: 4, width: '52%', borderRadius: 2, background: th.swatch.accent }} />
                            <span style={{ flex: 1, borderRadius: 3, background: th.swatch.surface, border: `1px solid ${th.swatch.accent}40` }} />
                            <span style={{ height: 6, borderRadius: 2, background: th.swatch.accent, opacity: 0.5 }} />
                          </span>
                        </div>
                        <p className="fan__name">{th.name}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {/* Page vierge (sans structure ni thème) */}
              <div className="blank-row">
                <button className="blank" type="button" onClick={() => openCreate()}>Créer un livret vierge <ArrowRight size={16} strokeWidth={2} /></button>
              </div>

              </div>{/* /studio-split__main */}
            </div>
          )}

          {/* Mes livrets — TOUJOURS affiché (même écran avec ou sans livret, comme le Booking Engine). */}
          <section className="list lv-list" style={isStaff ? undefined : { marginTop: 0 }}>
            <div className="list__head">
              <h2>Mes livrets d'accueil</h2>
              <span className="count">{guides.length}</span>
              <div className="sp" />
              <label className="search">
                <Search size={15} strokeWidth={2} />
                <input placeholder="Rechercher…" value={livretQuery} onChange={(e) => setLivretQuery(e.target.value)} />
              </label>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-9"><Spinner className="size-10" /></div>
            ) : guides.length === 0 ? (
              <EmptyState
                icon={<LinkIcon />}
                title={t('welcomeGuide.list.emptyTitle', 'Aucun livret pour le moment')}
                description={t('welcomeGuide.list.emptyDescription', "Créez un livret d'accueil pour partager le wifi, le digicode et vos bons plans avec vos voyageurs.")}
                action={isStaff ? (
                  <Button onClick={() => openCreate()}>
                    <Add size={16} strokeWidth={1.75} />
                    {t('welcomeGuide.actions.new', 'Nouveau livret')}
                  </Button>
                ) : undefined}
              />
            ) : (
              <div className="tbl lv-tbl">
                <div className="tbl__h"><span>Nom</span><span>Statut</span><span>Langue</span><span>Propriétaire</span></div>
                {filtered.map((g) => {
                  const prop = properties.find((p) => p.id === String(g.propertyId));
                  const heroIds = parseHeroPhotoIds(g.heroPhotoIds);
                  return (
                    <div key={g.id} className="row-wrap">
                      <button className="row" type="button" onClick={() => openEdit(g)}>
                        <div className="row__name">
                          <div className="row__thumb"><GuidePhotoCarousel propertyId={g.propertyId} theme={g.theme} alt={g.propertyName || g.title} priorityIds={heroIds} /></div>
                          <div>
                            <p className="row__t"><span className="pd" style={{ background: themeAccent(g.theme) }} /> {g.title}</p>
                            <p className="row__u">{g.propertyName || '—'}{prop?.city ? ` · ${prop.city}` : ''}</p>
                          </div>
                        </div>
                        <span className={`status ${g.published ? 'active' : 'off'}`}><span className="led" /> {g.published ? 'Publié' : 'Brouillon'}</span>
                        <span className="row__meta">{g.language.toUpperCase()}</span>
                        <div className="row__acc"><span className="av-sm">{ownerInitials}</span><span className="row__owner">Vous</span></div>
                      </button>
                      <button className="row__menu" type="button" aria-label={t('common.actions', 'Actions')} title={t('common.actions', 'Actions')} onClick={(e) => setRowMenu({ el: e.currentTarget, guide: g })}><MoreHorizontal size={18} strokeWidth={2} /></button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Menu d'actions par ligne — TOUTES les actions de l'ancienne carte sont conservées ici. */}
            <Menu anchorEl={rowMenu?.el ?? null} open={!!rowMenu} onClose={() => setRowMenu(null)}>
              {rowMenu && ([
                <MenuItem key="pub" disabled={togglingPublishId === rowMenu.guide.id} onClick={() => { handleTogglePublish(rowMenu.guide); setRowMenu(null); }} sx={{ fontSize: 13, gap: 1 }}>
                  {rowMenu.guide.published ? <Unlink size={16} strokeWidth={2} /> : <Check size={16} strokeWidth={2} />}
                  {rowMenu.guide.published ? t('welcomeGuide.actions.unpublish', 'Dépublier') : t('welcomeGuide.actions.publish', 'Publier')}
                </MenuItem>,
                <MenuItem key="link" disabled={!rowMenu.guide.published} onClick={() => { handleGenerateLink(rowMenu.guide); setRowMenu(null); }} sx={{ fontSize: 13, gap: 1 }}>
                  <Link2 size={16} strokeWidth={2} /> {t('welcomeGuide.actions.generateLink', 'Générer le lien')}
                </MenuItem>,
                <MenuItem key="gb" onClick={() => { handleOpenGuestbook(rowMenu.guide); setRowMenu(null); }} sx={{ fontSize: 13, gap: 1 }}>
                  <MessageSquare size={16} strokeWidth={2} /> {t('welcomeGuide.actions.guestbook', "Livre d'or")}
                </MenuItem>,
                <MenuItem key="stats" onClick={() => { handleOpenStats(rowMenu.guide); setRowMenu(null); }} sx={{ fontSize: 13, gap: 1 }}>
                  <BarChart3 size={16} strokeWidth={2} /> {t('welcomeGuide.actions.stats', 'Statistiques')}
                </MenuItem>,
                <MenuItem key="edit" onClick={() => { openEdit(rowMenu.guide); setRowMenu(null); }} sx={{ fontSize: 13, gap: 1 }}>
                  <Edit size={16} strokeWidth={2} /> {t('welcomeGuide.actions.edit', 'Modifier')}
                </MenuItem>,
                ...(isStaff ? [
                  <Divider key="div" sx={{ my: 0.5 }} />,
                  <MenuItem key="del" onClick={() => { handleDelete(rowMenu.guide); setRowMenu(null); }} sx={{ fontSize: 13, gap: 1, color: 'error.main' }}>
                    <Delete size={16} strokeWidth={2} /> {t('welcomeGuide.actions.delete', 'Supprimer')}
                  </MenuItem>,
                ] : []),
              ])}
            </Menu>
          </section>
        </div>
      </div>
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
  const upsellOfferIdSet = upsellOfferIds === null ? null : new Set(upsellOfferIds);
  const isOfferShown = (id: number) => upsellOfferIdSet === null || upsellOfferIdSet.has(id);
  const toggleOfferShown = (id: number) => {
    const base = upsellOfferIds === null ? applicableOffers.map((o) => o.id) : upsellOfferIds;
    const next = isOfferShown(id) ? base.filter((x) => x !== id) : [...base, id];
    const allIds = applicableOffers.map((o) => o.id);
    const nextSet = new Set(next);
    // Tout coché → null (= « tous », les futurs services apparaissent automatiquement).
    setUpsellOfferIds(allIds.length === next.length && allIds.every((x) => nextSet.has(x)) ? null : next);
  };
  const previewUpsells: PublicUpsell[] = applicableOffers.flatMap((o) =>
    isOfferShown(o.id)
      ? [{
          offerId: o.id,
          type: o.type,
          title: o.title,
          description: o.description,
          price: o.price,
          currency: o.currency,
          imageUrl: o.imageUrl,
          bundleItems: o.bundleOfferIds
            ? o.bundleOfferIds.split(',').map((x) => x.trim()).filter(Boolean)
                .map((id) => applicableOffers.find((c) => String(c.id) === id)?.title).filter((x): x is string => !!x)
            : [],
        }]
      : [],
  );
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
    <div>
      <div className="flex items-baseline justify-between gap-1.5 mb-1.5">
        <h6 className="cn-text-subtitle2 font-bold truncate">
          {WIZARD_STEPS[step]}
        </h6>
        {step < LAST_STEP ? (
          <span className="cn-text-caption text-muted-foreground shrink-0 tabular-nums">
            {t('welcomeGuide.wizard.stepCounter', 'Étape {{current}} / {{total}}', {
              current: step + 1,
              total: LAST_STEP,
            })}
          </span>
        ) : null}
      </div>
      {/* Précédent | numéros d'étape (centrés, cliquables → saut direct) | Suivant/Enregistrer */}
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="shrink-0" onClick={goBack} disabled={step === 0}>
          {t('welcomeGuide.wizard.previous', 'Précédent')}
        </Button>
        <div className="flex-1 flex items-center justify-center gap-1 flex-wrap">
          {WIZARD_STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <Tooltip key={label} title={label} arrow>
                <div
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
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold tabular-nums select-none cursor-pointer border border-solid',
                    'transition-[background-color,color,border-color] duration-[180ms] ease-[ease] motion-reduce:transition-none',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
                    active && 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]',
                    // Le hover n'existait que hors etape active (sx `!active ? … : undefined`).
                    !active && 'hover:border-[var(--accent)] hover:text-[var(--accent)]',
                    !active && done && 'bg-[var(--accent-soft)] text-[var(--accent)] border-[color-mix(in_srgb,_var(--accent)_35%,_transparent)]',
                    !active && !done && 'bg-[var(--hover)] text-[var(--muted)] border-[var(--line)]',
                  )}
                >
                  {done ? <Check size={15} strokeWidth={2.5} /> : i + 1}
                </div>
              </Tooltip>
            );
          })}
        </div>
        {step < LAST_STEP ? (
          <Button size="sm" className="shrink-0" onClick={goNext}>
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
              <Button size="sm" onClick={() => handleSave()} disabled={saving || !canCreate}>
                {saving ? <Spinner className="size-3.5" /> : <Save size={14} strokeWidth={1.75} />}
                {t('welcomeGuide.actions.save', 'Enregistrer')}
              </Button>
            </span>
          </Tooltip>
        )}
      </div>
    </div>
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
      <Card variant="outlined">
        <CardContent>
          <SectionHeading
            icon={<Check size={17} strokeWidth={1.75} />}
            title={t('welcomeGuide.wizard.recapTitle', 'Vérifiez votre livret')}
          />
          {/* theme.spacing = 6 : mt -0.5 -> -3px, mb 1.5 -> 9px */}
          <p className="cn-text-body2 text-[var(--muted)] mt-[-3px] mb-[9px]">
            {t('welcomeGuide.wizard.recapSubtitle', "Un dernier coup d'œil avant d'enregistrer.")}
          </p>
          <Stack divider={<Divider />} spacing={0}>
            {rows.map((r) => (
              <div className="flex items-baseline justify-between gap-3 py-1.5" key={r.label}>
                <p className="cn-text-body2 text-muted-foreground">
                  {r.label}
                </p>
                <p className={cn('cn-text-body2 font-semibold text-right min-w-0', r.num && 'tabular-nums')}>
                  {r.value}
                </p>
              </div>
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
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <h6 className="cn-text-subtitle2 font-semibold">
            {t('welcomeGuide.reservationLink.title', 'Réservation en cours / à venir')}
          </h6>
          <StatusChip color={semanticToHex(linked ? 'success' : 'default')} label={linked
                ? t('welcomeGuide.reservationLink.linked', 'Lié')
                : t('welcomeGuide.reservationLink.notLinked', 'Non lié')} icon={linked ? <Link2 size={13} strokeWidth={1.9} /> : <Unlink size={13} strokeWidth={1.9} />} />
        </div>
        {linked && linkedReservation ? (
          <Card variant="outlined">
            <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
              <div className="flex items-center gap-1.5">
                <CalendarDays size={18} strokeWidth={1.75} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div className="min-w-0">
                  <p className="cn-text-body2 font-semibold truncate">
                    {linkedReservation.guestName || t('welcomeGuide.reservationLink.guestUnknown', 'Voyageur')}
                  </p>
                  {dates ? (
                    <span className="cn-text-caption text-muted-foreground tabular-nums">
                      {dates}
                    </span>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyHint icon={<CalendarDays size={18} strokeWidth={1.75} />} text={emptyText} />
        )}
        {/* Garde-fous de création (étape Logement uniquement) */}
        {isCreate && !isStaff ? (
          <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
            <Lock size={14} strokeWidth={1.75} style={{ flexShrink: 0 }} />
            <span className="cn-text-caption">
              {t('welcomeGuide.reservationLink.staffOnly', 'La création d’un livret est réservée au staff Clenzy.')}
            </span>
          </div>
        ) : null}
        {isCreate && isStaff && propertyId && !linked ? (
          <span className="cn-text-caption text-[var(--bui-warning-ink)] block mt-1.5">
            {t(
              'welcomeGuide.reservationLink.noReservation',
              'Aucune réservation en cours ou à venir pour ce logement : livret non créable.',
            )}
          </span>
        ) : null}
      </div>
    );
  };

  // ─── Render: form ──────────────────────────────────────────────────────────
  const renderForm = () => (
    // Rupture MUI lg = 1200px (breakpoints non configures) ; gap: 3 = 18px.
    <div className="grid grid-cols-[1fr] min-[1200px]:grid-cols-[minmax(0,_1fr)_392px] gap-[18px] items-start">
      <Stack spacing={2.5}>
      {renderStepper()}

      {/* ── Étape 0 — Logement ── */}
      {step === 0 && (
      <>
      <Field>
        <FieldLabel htmlFor="guide-property">{t('welcomeGuide.fields.property', 'Logement')}</FieldLabel>
        <NativeSelect
          id="guide-property"
          value={propertyId}
          onChange={(e) => {
            setPropertyId(e.target.value);
            // Nouveau logement → on réinitialise le hero pour reprendre ses photos.
            setHeroPhotoIds([]);
            setHeroTouched(false);
          }}
          disabled={editingId != null}
        >
          {/* Option vide obligatoire : un select natif sans elle afficherait le
              premier logement alors que propertyId vaut encore ''. */}
          <NativeSelectOption value="" />
          {properties.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {editingId != null && (
          <FieldDescription>
            {t('welcomeGuide.fields.propertyLocked', 'Le logement ne peut pas être changé après création')}
          </FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="guide-title">{t('welcomeGuide.fields.title', 'Titre du livret')}</FieldLabel>
        <Input
          id="guide-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('welcomeGuide.fields.titlePlaceholder', 'Bienvenue à l’Appartement du Vieux-Port')}
        />
      </Field>

      <div className="flex gap-3 flex-wrap">
        <Field className="w-auto min-w-[160px]">
          <FieldLabel htmlFor="guide-language">{t('welcomeGuide.fields.language', 'Langue')}</FieldLabel>
          <NativeSelect
            id="guide-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((lng) => (
              <NativeSelectOption key={lng} value={lng}>
                {t(`welcomeGuide.languages.${lng}`, lng.toUpperCase())}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field className="flex-1 min-w-[220px]">
          <FieldLabel htmlFor="guide-logo-url">{t('welcomeGuide.fields.logoUrl', 'URL du logo')}</FieldLabel>
          <Input
            id="guide-logo-url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
      </div>

      {/* Réservation rattachée (lecture seule) + badge Lié/Non lié */}
      {renderReservationLink()}
      </>
      )}

      {/* ── Étape 2 — Accueil ── */}
      {step === 2 && (
      <>
      {/* Message d'accueil de l'hôte : note dédiée (serif italique) affichée sous le hero. */}
      <div>
        <SectionHeading
          icon={<Quote size={17} strokeWidth={1.75} />}
          title={t('welcomeGuide.welcomeNote.title', "Message d'accueil")}
        />
        <span className="cn-text-caption text-muted-foreground block mb-2">
          {t(
            'welcomeGuide.welcomeNote.guestHint',
            "Le prénom du voyageur s'affiche automatiquement en haut de l'accueil, chargé depuis la réservation.",
          )}
        </span>
        <Stack spacing={1.5}>
          {/* Laisse en MUI : ce champ a besoin d'un handle sur le textarea pour
              inserer le tag prenom a la position du curseur. Le Textarea du kit
              est un composant fonction simple — sous React 18 il ne transmet pas
              ref, et l'insertion retomberait en simple ajout en fin de texte. */}
          <TextField
            label={t('welcomeGuide.welcomeNote.message', "Mot d'accueil")}
            inputRef={welcomeMessageRef}
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
          {/* Nom du voyageur chargé depuis la réservation (lecture seule), insérable dans le
              message via un tag. Remplace l'ancienne signature d'hôte (champ libre). */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="cn-text-caption text-muted-foreground">
              {t('welcomeGuide.welcomeNote.guestLabel', 'Voyageur (chargé depuis la réservation)')} :
            </span>
            <Badge variant="secondary" className="h-[24px] px-1.5 text-[12.5px] font-semibold">{loadedGuestName || t('welcomeGuide.welcomeNote.guestPending', 'chargé à l’arrivée')}</Badge>
            <Button variant="ghost" size="sm" onClick={insertGuestFirstNameTag}>
              <Tag size={14} strokeWidth={1.9} />
              {t('welcomeGuide.welcomeNote.insertFirstName', 'Insérer le prénom dans le message')}
            </Button>
          </div>
          <span className="cn-text-caption text-muted-foreground">
            {t('welcomeGuide.welcomeNote.tagHint', 'Le tag {prénom} sera remplacé par le prénom du voyageur.')}
          </span>
          <Field className="max-w-[320px]">
            <FieldLabel htmlFor="guide-host-names">
              {t('welcomeGuide.welcomeNote.signature', 'Signature (vos noms)')}
            </FieldLabel>
            <Input
              id="guide-host-names"
              value={hostNames}
              onChange={(e) => setHostNames(e.target.value)}
              placeholder={t('welcomeGuide.welcomeNote.signaturePlaceholder', 'ex : Camille & Antoine')}
            />
          </Field>
        </Stack>
      </div>
      </>
      )}

      {/* ── Étape 1 — Apparence (thème + photos de couverture) ── */}
      {step === 1 && (
      <>
      {/* Thème du livret : carrés de couleur seuls, nom + description en tooltip.
          Taille fixe → le retour à la ligne s'adapte à la largeur (flex-wrap). */}
      <div>
        <h6 className="cn-text-subtitle2 font-semibold mb-2">
          {t('welcomeGuide.themes.sectionTitle', 'Thème du livret')}
        </h6>
        <div className="flex flex-wrap gap-2">
          {WELCOME_BOOK_THEMES.map((th) => {
            const on = theme === th.id;
            return (
              <Tooltip
                key={th.id}
                arrow
                title={
                  <div className="text-center py-0.5">
                    <span className="cn-text-caption font-bold block">
                      {t(`welcomeGuide.themes.${th.id}.name`, th.name)}
                    </span>
                    <span className="cn-text-caption opacity-85">
                      {t(`welcomeGuide.themes.${th.id}.desc`, th.desc)}
                    </span>
                  </div>
                }
              >
                {/* borderRadius: 1.5 avec theme.shape.borderRadius = 8 => 12px. */}
                <div
                  role="button"
                  aria-label={t(`welcomeGuide.themes.${th.id}.name`, th.name)}
                  onClick={() => setTheme(th.id)}
                  className={cn(
                    'relative shrink-0 w-[52px] h-[52px] rounded-[12px] overflow-hidden cursor-pointer flex flex-col',
                    'transition-shadow duration-150',
                    on
                      ? 'shadow-[0_0_0_2px_var(--accent),0_0_0_4px_var(--accent-soft)]'
                      : 'shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--faint)]',
                  )}
                >
                  <div className="flex-1" style={{ backgroundColor: th.swatch.bg }} />
                  <div className="flex-1" style={{ backgroundColor: th.swatch.surface }} />
                  <div className="h-[16px]" style={{ backgroundColor: th.swatch.accent }} />
                  {on ? (
                    <div className="absolute inset-[0px] flex items-center justify-center">
                      <div className="w-[22px] h-[22px] rounded-[50%] bg-[rgba(255,255,255,0.92)] flex items-center justify-center" style={{ boxShadow: '0 1px 3px rgba(21,36,45,.3)' }}>
                        <Check size={14} strokeWidth={2.75} style={{ color: 'var(--accent)' }} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Photo de couverture (hero) : choix parmi les photos du logement */}
      <div>
        <SectionHeading
          icon={<ImageIcon size={17} strokeWidth={1.75} />}
          title={t('welcomeGuide.hero.title', 'Photos de couverture')}
          actions={
            propertyPhotos.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
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
          <div className="grid grid-cols-[repeat(auto-fill,_minmax(92px,_1fr))] gap-1.5">
            {propertyPhotos.map((ph) => {
              const on = heroPhotoIds.includes(ph.id);
              return (
                <div className={cn('relative aspect-[4_/_3] rounded-[12px] overflow-hidden cursor-pointer border-[2px] border-solid', on ? 'border-[var(--accent)]' : 'border-[var(--line-2)]')} style={{ transition: 'border-color .15s' }} key={ph.id} onClick={() => {
                    setHeroTouched(true);
                    setHeroPhotoIds((prev) =>
                      prev.includes(ph.id) ? prev.filter((id) => id !== ph.id) : [...prev, ph.id],
                    );
                  }}>
                  <img className="w-full h-full object-cover block" src={propertyPhotosApi.getPhotoUrl(Number(propertyId), ph.id)} alt={ph.caption || ''} loading="lazy" />
                  {on ? (
                    <div className="absolute top-[4px] end-[4px] bg-[var(--accent)] text-[var(--on-accent)] rounded-[50%] w-[22px] h-[22px] flex items-center justify-center">
                      <Check size={14} strokeWidth={2.5} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}

      {/* ── Étape 3 — Contenu (sections + autour de moi) ── */}
      {step === 3 && (
      <>
      <div>
        <SectionHeading
          icon={<FileText size={17} strokeWidth={1.75} />}
          title={t('welcomeGuide.form.sectionsTitle', 'Sections du livret')}
          actions={
            <Button variant="ghost" size="sm" onClick={addSection}>
              <Add size={14} strokeWidth={1.75} />
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
                  <div className="flex gap-1.5 items-start mb-1.5 flex-wrap">
                    <IconSelect value={s.icon} onChange={(v) => updateSection(idx, { icon: v })} label={t('welcomeGuide.fields.sectionIcon', 'Icône')} />
                    <Field className="flex-1 min-w-[150px]">
                      <FieldLabel htmlFor={`guide-section-${s.id}-title`}>
                        {t('welcomeGuide.fields.sectionTitle', 'Titre')}
                      </FieldLabel>
                      <Input
                        id={`guide-section-${s.id}-title`}
                        value={s.title}
                        onChange={(e) => updateSection(idx, { title: e.target.value })}
                      />
                    </Field>
                    <Field className="w-[150px]">
                      <FieldLabel htmlFor={`guide-section-${s.id}-layout`}>
                        {t('welcomeGuide.fields.sectionLayout', 'Type')}
                      </FieldLabel>
                      <NativeSelect
                        id={`guide-section-${s.id}-layout`}
                        value={s.layout}
                        onChange={(e) => updateSection(idx, { layout: e.target.value as GuideSectionLayout })}
                      >
                        {SECTION_LAYOUT_OPTIONS.map((l) => (
                          <NativeSelectOption key={l} value={l}>{t(`welcomeGuide.layouts.${l}`, l)}</NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <IconButton size="small" color="error" onClick={() => removeSection(idx)} sx={{ mt: 0.5 }}>
                      <Delete size={16} strokeWidth={1.75} />
                    </IconButton>
                  </div>
                  <Field className="mb-[7.5px]">
                    <FieldLabel htmlFor={`guide-section-${s.id}-subtitle`}>
                      {t('welcomeGuide.fields.sectionSubtitle', 'Sous-titre (liste de navigation)')}
                    </FieldLabel>
                    <Input
                      id={`guide-section-${s.id}-subtitle`}
                      value={s.subtitle}
                      onChange={(e) => updateSection(idx, { subtitle: e.target.value })}
                    />
                  </Field>
                  {s.layout === 'text' ? (
                    <Field>
                      <FieldLabel htmlFor={`guide-section-${s.id}-body`}>
                        {t('welcomeGuide.fields.sectionBody', 'Contenu')}
                      </FieldLabel>
                      <Textarea
                        id={`guide-section-${s.id}-body`}
                        value={s.body}
                        onChange={(e) => updateSection(idx, { body: e.target.value })}
                        rows={3}
                      />
                    </Field>
                  ) : (
                    <div>
                      {s.items.map((item, iIdx) => (
                        <div className="flex gap-1.5 items-start mb-1.5 p-1.5 rounded-[1.5px] bg-[var(--hover)]" key={item.id}>
                          <IconSelect value={item.icon} onChange={(v) => updateSectionItem(idx, iIdx, { icon: v })} />
                          <div className="flex-1 min-w-0">
                            <Field>
                              <FieldLabel htmlFor={`guide-item-${item.id}-label`}>
                                {t('welcomeGuide.sectionItems.label', 'Intitulé')}
                              </FieldLabel>
                              <Input
                                id={`guide-item-${item.id}-label`}
                                value={item.label}
                                onChange={(e) => updateSectionItem(idx, iIdx, { label: e.target.value })}
                              />
                            </Field>
                            {s.layout === 'list' ? (
                              <Field className="mt-1.5">
                                <FieldLabel htmlFor={`guide-item-${item.id}-detail`}>
                                  {t('welcomeGuide.sectionItems.detail', 'Détail')}
                                </FieldLabel>
                                <Input
                                  id={`guide-item-${item.id}-detail`}
                                  value={item.detail}
                                  onChange={(e) => updateSectionItem(idx, iIdx, { detail: e.target.value })}
                                />
                              </Field>
                            ) : null}
                            {s.layout === 'steps' ? (
                              <Field className="mt-1.5">
                                <FieldLabel htmlFor={`guide-item-${item.id}-steps`}>
                                  {t('welcomeGuide.sectionItems.steps', 'Étapes (une par ligne)')}
                                </FieldLabel>
                                <Textarea
                                  id={`guide-item-${item.id}-steps`}
                                  value={item.steps.join('\n')}
                                  onChange={(e) => updateSectionItem(idx, iIdx, { steps: e.target.value.split('\n') })}
                                  rows={2}
                                />
                              </Field>
                            ) : null}
                          </div>
                          <IconButton size="small" color="error" onClick={() => removeSectionItem(idx, iIdx)}>
                            <Delete size={15} strokeWidth={1.75} />
                          </IconButton>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => addSectionItem(idx)}>
                        <Add size={14} strokeWidth={1.75} />
                        {t('welcomeGuide.sectionItems.add', 'Ajouter un élément')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </div>

      <div>
        <SectionHeading
          icon={<MapPin size={17} strokeWidth={1.75} />}
          title={t('welcomeGuide.pois.title', 'Autour de moi')}
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={openSuggest}>
                <Sparkles size={14} strokeWidth={1.75} />
                {t('welcomeGuide.pois.suggest', 'Suggérer')}
              </Button>
              <Button variant="ghost" size="sm" onClick={addPoi}>
                <Add size={14} strokeWidth={1.75} />
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
                  <div className="flex gap-1.5 items-start">
                    <div className="flex-1">
                      <div className="flex gap-1.5 mb-1.5 flex-wrap">
                        <Field className="w-auto min-w-[160px]">
                          <FieldLabel htmlFor={`guide-poi-${p.id}-category`}>
                            {t('welcomeGuide.pois.category', 'Catégorie')}
                          </FieldLabel>
                          <NativeSelect
                            id={`guide-poi-${p.id}-category`}
                            value={p.category}
                            onChange={(e) => updatePoi(idx, { category: e.target.value })}
                          >
                            {POI_CATEGORIES.map((c) => (
                              <NativeSelectOption key={c.id} value={c.id}>
                                {poiLabel(c.id, currentLanguage)}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </Field>
                        <Field className="flex-1 min-w-[180px]">
                          <FieldLabel htmlFor={`guide-poi-${p.id}-name`}>
                            {t('welcomeGuide.pois.name', 'Nom')}
                          </FieldLabel>
                          <Input
                            id={`guide-poi-${p.id}-name`}
                            value={p.name}
                            onChange={(e) => updatePoi(idx, { name: e.target.value })}
                          />
                        </Field>
                      </div>
                      <div className="flex gap-1.5 mb-1.5 items-end">
                        <Field>
                          <FieldLabel htmlFor={`guide-poi-${p.id}-address`}>
                            {t('welcomeGuide.pois.address', 'Adresse')}
                          </FieldLabel>
                          <Input
                            id={`guide-poi-${p.id}-address`}
                            value={p.address}
                            onChange={(e) => updatePoi(idx, { address: e.target.value })}
                          />
                        </Field>
                        <Tooltip title={t('welcomeGuide.pois.geocode', 'Localiser sur la carte')}>
                          <span>
                            <IconButton size="small" onClick={() => geocodePoi(idx)} disabled={geocoding === p.id}>
                              {geocoding === p.id ? (
                                <Spinner className="size-4" />
                              ) : (
                                <MapPin size={16} strokeWidth={1.75} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </div>
                      <Field>
                        <FieldLabel htmlFor={`guide-poi-${p.id}-note`}>
                          {t('welcomeGuide.pois.note', 'Note (optionnel)')}
                        </FieldLabel>
                        <Input
                          id={`guide-poi-${p.id}-note`}
                          value={p.note}
                          onChange={(e) => updatePoi(idx, { note: e.target.value })}
                        />
                      </Field>
                      <div className="flex gap-2 items-end mt-1.5 flex-wrap">
                        <Field className="flex-1 min-w-[160px]">
                          <FieldLabel htmlFor={`guide-poi-${p.id}-type`}>
                            {t('welcomeGuide.pois.type', 'Type (ex : Bistrot)')}
                          </FieldLabel>
                          <Input
                            id={`guide-poi-${p.id}-type`}
                            value={p.type}
                            onChange={(e) => updatePoi(idx, { type: e.target.value })}
                          />
                        </Field>
                        <FormControlLabel
                          control={<Switch size="small" checked={p.featured} onChange={(e) => updatePoi(idx, { featured: e.target.checked })} />}
                          label={t('welcomeGuide.pois.featured', 'Coup de cœur')}
                        />
                      </div>
                      {p.lat != null && p.lng != null ? (
                        <span className="cn-text-caption text-[var(--bui-success-ink)] inline-flex items-center gap-0.5 mt-1">
                          <MapPin size={12} strokeWidth={2} /> {t('welcomeGuide.pois.located', 'Position trouvée')}
                        </span>
                      ) : null}
                    </div>
                    <IconButton size="small" color="error" onClick={() => removePoi(idx)} sx={{ mt: 0.5 }}>
                      <Delete size={16} strokeWidth={1.75} />
                    </IconButton>
                  </div>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </div>

      </>
      )}

      {/* ── Étape 4 — Expériences & services ── */}
      {step === 4 && (
      <>
      <div>
        <SectionHeading
          icon={<Ticket size={17} strokeWidth={1.75} />}
          title={t('welcomeGuide.curation.title', 'Activités à proposer')}
          actions={
            <Button variant="ghost" size="sm" onClick={addActivity}>
              <Add size={14} strokeWidth={1.75} />
              {t('welcomeGuide.curation.add', 'Ajouter une activité')}
            </Button>
          }
        />
        <span className="cn-text-caption text-muted-foreground block mb-2">
          {t(
            'welcomeGuide.curation.affiliateHint',
            "Collez un lien Klook, GetYourGuide ou Viator : si le fournisseur est connecté (onglet Intégrations), votre identifiant d'affiliation est ajouté automatiquement au lien pour toucher votre commission.",
          )}
        </span>

        {curatedActivities.length === 0 ? (
          <EmptyHint
            icon={<Ticket size={18} strokeWidth={1.75} />}
            text={t('welcomeGuide.curation.empty', 'Aucune activité. Ajoutez vos excursions et bons plans à réserver.')}
          />
        ) : (
          <Stack spacing={1.5}>
            {curatedActivities.map((a, idx) => (
              <Card key={a.id} variant="outlined" sx={a.featured ? { borderColor: 'var(--warn)' } : undefined}>
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <div className="flex gap-1.5 items-start">
                    <div className="flex-1">
                      <div className="flex gap-1.5 mb-1.5 flex-wrap">
                        <Field className="flex-1 min-w-[180px]">
                          <FieldLabel htmlFor={`guide-activity-${a.id}-title`}>
                            {t('welcomeGuide.curation.activityTitle', 'Titre')}
                          </FieldLabel>
                          <Input
                            id={`guide-activity-${a.id}-title`}
                            value={a.title}
                            onChange={(e) => updateActivity(idx, { title: e.target.value })}
                          />
                        </Field>
                        <Field className="w-[120px]">
                          <FieldLabel htmlFor={`guide-activity-${a.id}-price`}>
                            {t('welcomeGuide.curation.price', 'Prix')}
                          </FieldLabel>
                          <Input
                            id={`guide-activity-${a.id}-price`}
                            value={a.price ?? ''}
                            onChange={(e) => updateActivity(idx, { price: e.target.value || null })}
                            placeholder="ex : 29 €"
                          />
                        </Field>
                      </div>
                      <Field className="mb-1.5">
                        <FieldLabel htmlFor={`guide-activity-${a.id}-booking-url`}>
                          {t('welcomeGuide.curation.bookingUrl', 'Lien de réservation')}
                        </FieldLabel>
                        <Input
                          id={`guide-activity-${a.id}-booking-url`}
                          value={a.bookingUrl}
                          onChange={(e) => updateActivity(idx, { bookingUrl: e.target.value })}
                          placeholder="https://…"
                        />
                      </Field>
                      <Field className="mb-1.5">
                        <FieldLabel htmlFor={`guide-activity-${a.id}-image-url`}>
                          {t('welcomeGuide.curation.imageUrl', "URL de l'image (optionnel)")}
                        </FieldLabel>
                        <Input
                          id={`guide-activity-${a.id}-image-url`}
                          value={a.imageUrl ?? ''}
                          onChange={(e) => updateActivity(idx, { imageUrl: e.target.value || null })}
                          placeholder="https://…"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`guide-activity-${a.id}-description`}>
                          {t('welcomeGuide.curation.description', 'Description (optionnel)')}
                        </FieldLabel>
                        <Textarea
                          id={`guide-activity-${a.id}-description`}
                          value={a.description}
                          onChange={(e) => updateActivity(idx, { description: e.target.value })}
                          rows={2}
                        />
                      </Field>
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
                    </div>
                    <IconButton size="small" color="error" onClick={() => removeActivity(idx)} sx={{ mt: 0.5 }}>
                      <Delete size={16} strokeWidth={1.75} />
                    </IconButton>
                  </div>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </div>

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
                <span className="cn-text-caption text-muted-foreground block mb-1.5">
                  {t(
                    'welcomeGuide.fields.upsellSelectionHint',
                    'Décochez un service pour le masquer sur ce livret uniquement.',
                  )}
                </span>
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
                        <div className="flex items-baseline gap-1.5">
                          <p className="cn-text-body2">{o.title}</p>
                          <span className="cn-text-caption text-muted-foreground tabular-nums">
                            {o.price.toFixed(0)} {o.currency}
                          </span>
                        </div>
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

      {/* Publication déplacée sur la liste des livrets (toggle par carte) : ici on informe seulement. */}
      <Card variant="outlined">
        <CardContent sx={{ '&:last-child': { pb: 1.5 }, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <div className="shrink-0 w-[34px] h-[34px] rounded-[1.25px] flex items-center justify-center bg-[var(--hover)] text-muted-foreground">
            <Globe size={18} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h6 className="cn-text-subtitle2 font-semibold">
              {t('welcomeGuide.fields.publishTitle', 'Publier le livret')}
            </h6>
            <span className="cn-text-caption text-muted-foreground">
              {t(
                'welcomeGuide.actions.publishFromListHint',
                'La publication se fait depuis la liste des livrets, via le bouton sur chaque carte.',
              )}
            </span>
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {/* ── Étape 6 — Récapitulatif ── */}
      {step === LAST_STEP && renderRecap()}
      </Stack>

      {/* ── Aperçu téléphone live (reflète l'état du formulaire en temps réel) ── */}
      <div className="min-[1200px]:sticky top-3 justify-self-center min-[1200px]:justify-self-start w-full">
        <div className="w-[360px] max-w-full h-[720px] mx-auto rounded-[34px] overflow-hidden border-[10px] border-solid border-[var(--chrome-1)] bg-[var(--chrome-2)]" style={{ boxShadow: '0 28px 70px -28px rgba(21,36,45,0.55)' }}>
          <WelcomeBookView
            model={previewModel}
            theme={theme}
            lang={previewLang}
            labels={GUIDE_LABELS[previewLang]}
            heroImages={previewHeroImages}
            interactive={false}
            previewFocus={step === 3 ? 'content' : step === 4 ? 'experiences' : 'home'}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {headerActions}
      {view === 'list' ? renderList() : renderForm()}

      <Dialog open={linkDialog.open} onClose={() => setLinkDialog({ open: false, link: '', qrCode: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>{t('welcomeGuide.link.dialogTitle', "Lien du livret d'accueil")}</DialogTitle>
        <DialogContent>
          <p className="cn-text-body2 text-muted-foreground mb-3">
            {t(
              'welcomeGuide.link.note',
              'Lien de partage manuel (aperçu). La diffusion automatique d’un lien propre à chaque réservation — valable uniquement le temps du séjour — arrive prochainement.',
            )}
          </p>
          <Input
            id="guide-share-link"
            value={linkDialog.link}
            readOnly
            aria-label={t('welcomeGuide.link.dialogTitle', "Lien du livret d'accueil")}
            onFocus={(e) => e.target.select()}
            className="w-full"
          />
          {linkDialog.qrCode ? (
            <div className="flex flex-col items-center mt-3 gap-1.5">
              <img className="w-[200px] h-[200px]" src={linkDialog.qrCode} alt="QR code" />
              {/* `href` : le kit ne rend pas d'ancre, on delegue via asChild. */}
              <Button variant="ghost" size="sm" asChild>
                <a href={linkDialog.qrCode} download="livret-qr.png">
                  {t('welcomeGuide.link.downloadQr', 'Télécharger le QR')}
                </a>
              </Button>
            </div>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" asChild>
            <a href={linkDialog.link} target="_blank" rel="noopener noreferrer">
              <OpenInNew size={16} strokeWidth={1.75} />
              {t('welcomeGuide.link.open', 'Ouvrir')}
            </a>
          </Button>
          <Button onClick={copyLink}>
            <ContentCopy size={16} strokeWidth={1.75} />
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
            <div className="flex justify-center py-4">
              <Spinner className="size-10" />
            </div>
          ) : guestbook.entries.length === 0 ? (
            <p className="cn-text-body2 text-muted-foreground">
              {t('welcomeGuide.guestbook.empty', 'Aucun message pour le moment.')}
            </p>
          ) : (
            <Stack spacing={1.5}>
              {guestbook.entries.map((e) => (
                <div className="border-b border-[var(--line)] pb-2" key={e.id}>
                  <div className="flex justify-between items-center">
                    <h6 className="cn-text-subtitle2 font-semibold">
                      {e.authorName || '—'}
                    </h6>
                    {e.rating ? (
                      <div className="flex gap-0.5">
                        {Array.from({ length: e.rating }).map((_, i) => (
                          <Star key={i} size={14} strokeWidth={1.75} fill="currentColor" style={{ color: 'var(--warn)' }} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {e.message ? (
                    <p className="cn-text-body2 whitespace-pre-line mt-0.5">
                      {e.message}
                    </p>
                  ) : null}
                  {e.createdAt ? (
                    <span className="cn-text-caption text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={() => setGuestbook((s) => ({ ...s, open: false }))}>
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
            <div className="flex justify-center py-4">
              <Spinner className="size-10" />
            </div>
          ) : !stats.data ? (
            <p className="cn-text-body2 text-muted-foreground">
              {t('welcomeGuide.stats.empty', 'Aucune donnée pour le moment.')}
            </p>
          ) : (
            <Stack spacing={2.5}>
              <div className="grid grid-cols-[repeat(2,_1fr)] min-[600px]:grid-cols-[repeat(3,_1fr)] gap-1.5">
                {[
                  { key: 'opens', icon: <Eye size={14} strokeWidth={1.75} />, label: t('welcomeGuide.stats.opens', 'Ouvertures'), value: stats.data.totalOpens },
                  { key: 'chat', icon: <MessageCircle size={14} strokeWidth={1.75} />, label: t('welcomeGuide.stats.chat', 'Messages chatbot'), value: stats.data.chatMessages },
                  { key: 'guestbook', icon: <Star size={14} strokeWidth={1.75} />, label: t('welcomeGuide.stats.guestbook', "Avis livre d'or"), value: stats.data.guestbookEntries },
                  { key: 'activities', icon: <MapPin size={14} strokeWidth={1.75} />, label: t('welcomeGuide.stats.activities', 'Clics activités'), value: stats.data.activityClicks },
                  { key: 'checkin', icon: <DoorOpen size={14} strokeWidth={1.75} />, label: t('welcomeGuide.stats.checkin', 'Clics check-in'), value: stats.data.checkinClicks },
                ].map((tile) => (
                  <div className="border border-[var(--line)] rounded-[2px] p-2" key={tile.key}>
                    <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                      {tile.icon}
                      <span className="cn-text-caption">{tile.label}</span>
                    </div>
                    <h6 className="cn-text-h6 font-bold tabular-nums">
                      {tile.value}
                    </h6>
                  </div>
                ))}
              </div>

              <div>
                <h6 className="cn-text-subtitle2 font-semibold mb-1.5">
                  {t('welcomeGuide.stats.trend', 'Ouvertures (30 derniers jours)')}
                </h6>
                {stats.data.dailyOpens.length === 0 ? (
                  <p className="cn-text-body2 text-muted-foreground">
                    {t('welcomeGuide.stats.noTrend', 'Pas encore d’ouvertures.')}
                  </p>
                ) : (
                  <div className="w-full h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.data.dailyOpens.map((d) => ({ day: d.date.slice(5), count: d.count }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
                        <RechartsTooltip />
                        <Bar dataKey="count" fill={DEFAULT_COLOR} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {stats.data.topActivities.length > 0 ? (
                <div>
                  <h6 className="cn-text-subtitle2 font-semibold mb-1.5">
                    {t('welcomeGuide.stats.topActivities', 'Activités les plus cliquées')}
                  </h6>
                  <Stack spacing={0.75}>
                    {stats.data.topActivities.map((a) => (
                      <div className="flex justify-between items-center gap-1.5" key={a.label}>
                        <p className="cn-text-body2 truncate">
                          {a.label}
                        </p>
                        <StatusChip color={DEFAULT_COLOR} label={a.count} />
                      </div>
                    ))}
                  </Stack>
                </div>
              ) : null}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={() => setStats((s) => ({ ...s, open: false }))}>
            {t('welcomeGuide.actions.close', 'Fermer')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Suggestions auto (OSM) autour du logement */}
      <Dialog open={suggest.open} onClose={() => setSuggest((s) => ({ ...s, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle>{t('welcomeGuide.pois.suggestTitle', 'Suggestions autour du logement')}</DialogTitle>
        <DialogContent dividers>
          {suggest.loading ? (
            <div className="flex justify-center py-4">
              <Spinner className="size-10" />
            </div>
          ) : suggest.items.length === 0 ? (
            <p className="cn-text-body2 text-muted-foreground">
              {t('welcomeGuide.pois.suggestEmpty', 'Aucune suggestion trouvée autour du logement.')}
            </p>
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
                      <div className="flex items-center gap-1 mt-0.5">
                        <CatIcon size={14} strokeWidth={1.9} style={{ color: cat.color, flexShrink: 0 }} />
                        <div>
                          <p className="cn-text-body2 font-semibold">
                            {sug.name}
                          </p>
                          {sug.address ? (
                            <span className="cn-text-caption text-muted-foreground">
                              {sug.address}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    }
                  />
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={() => setSuggest((s) => ({ ...s, open: false }))}>
            {t('welcomeGuide.actions.close', 'Fermer')}
          </Button>
          <Button disabled={suggest.selected.size === 0} onClick={addSuggested}>
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
    </div>
  );
};

export default WelcomeGuideAdmin;
