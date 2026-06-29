import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Menu, MenuItem, Divider, Popover, InputBase, Skeleton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  Plus, LayoutDashboard, ArrowUp, Search, Home, Layers, Sparkles, Languages, Feather, X,
  ArrowRight, List as ListIcon, LayoutGrid, AlertTriangle, ChevronDown, Trash2,
  Users, Target, Gem, MapPin, Coins, BadgeCheck, Files,
} from 'lucide-react';
import { bookingEngineApi, type BookingEngineConfig, type BookingEngineConfigUpdate } from '../../../services/api/bookingEngineApi';
import { sitesApi, type SiteGenerationBrief } from '../../../services/api/sitesApi';
import { BUILTIN_FUNNEL_PRESETS } from './grapes/funnelPresets';
import { FunnelArt } from './funnelArt';
import { GALLERY_TEMPLATES, type GalleryTemplate } from './grapes/import/galleryTemplates';
import { DESIGN_PRESETS } from '../constants';
import { useAuth } from '../../../hooks/useAuth';
import { useAiFeatureToggles } from '../../../hooks/useAi';
import { useNotification } from '../../../hooks/useNotification';
import SiteGenerationModal from './SiteGenerationModal';
import './studioHome.css';

/**
 * Accueil « studio » du Booking Engine (refonte handoff design_handoff_booking_accueil) :
 * hero + champ IA + éventail de funnels + galerie de templates + liste « Mes booking engines ».
 * Zone de CONTENU uniquement — le chrome (sidebar, top bar segmentée, sous-onglets) est fourni
 * par le parent. Accent module = indigo via le wrapper `data-accent="indigo"`.
 *
 * Câblage : la liste, la création (vierge / depuis funnel / depuis template / depuis le champ IA)
 * sont réelles (bookingEngineApi). Les champs sûrs (couleur/police d'un style ou d'un template,
 * URL source) sont posés sur la config à la création. L'APPLICATION fine en éditeur (analyse IA
 * du site, insertion des widgets du funnel, import des pages d'un template) vit dans l'éditeur
 * GrapesJS et est transmise via `location.state` — cf. les TODO marqués ci-dessous.
 */

/** Payload de création d'un booking engine vierge (éditeur démarre sur page blanche). */
export function buildConfigPayload(name: string): BookingEngineConfigUpdate {
  return {
    name,
    primaryColor: '#5453D6', accentColor: null, logoUrl: null, fontFamily: 'Inter',
    defaultLanguage: 'fr', defaultCurrency: 'EUR', minAdvanceDays: 1, maxAdvanceDays: 365,
    cancellationPolicy: null, termsUrl: null, privacyUrl: null, allowedOrigins: null,
    collectPaymentOnBooking: true, autoConfirm: true, showCleaningFee: true, showTouristTax: true,
    directBookingDiscountPercent: null, memberDiscountPercent: null, pendingHoldMinutes: null,
    customCss: null, customJs: null, componentConfig: null, pageLayout: null,
    funnelPresets: null, compositeWidgets: null, featuredPropertyIds: null, designTokens: null,
    sourceWebsiteUrl: null, aiAnalysisAt: null, widgetPosition: 'bottom', inlineTargetId: null,
    inlinePlacement: 'after',
  };
}

// ── Données d'affichage ──────────────────────────────────────────────────────

/** Funnels mis en avant dans la rangée (5 parmi les presets intégrés). Schéma via `FunnelArt`. */
const FAN_FUNNELS = ['catalogue', 'single', 'inquiry', 'extras', 'express']
  .map((id) => BUILTIN_FUNNEL_PRESETS.find((f) => f.id === id))
  .filter((f): f is NonNullable<typeof f> => !!f);

/** Funnel associé à chaque template : filtre la galerie par funnel sélectionné. Redistribués pour couvrir tous
 *  les funnels (gardés : Conciergerie→catalogue, Duplex→single). Défaut : catalogue. */
const TEMPLATE_FUNNEL: Record<string, string> = {
  'conciergerie-marrakech': 'catalogue',
  'duplex-marrakech': 'single',
  'villa-bord-de-mer': 'inquiry',
  'bord-de-mer-balneaire': 'extras',
  'appartement-urbain': 'cart',
  'maison-campagne': 'express',
  'recherche-catalogue-premium': 'confirmation',
};
const templateFunnel = (id: string): string => TEMPLATE_FUNNEL[id] ?? 'catalogue';

/** Rotation (deg) / lift (px) d'une carte de l'éventail selon sa position i et le total n → fan symétrique
 *  pour un nombre VARIABLE de cartes (les funnels = 5 fixes via nth-child ; les templates = inline via ceci). */
const fanTip = (i: number, n: number): number => (n <= 1 ? 0 : +(((n - 1) / 2 - i) * 3).toFixed(2));
const fanLift = (i: number, n: number): number => (n <= 1 ? 0 : +(Math.abs(i - (n - 1) / 2) * 6).toFixed(1));

/** Mini-aperçu « screenshot » d'un site, teinté à une couleur de marque. Styles INLINE (marche aussi dans les
 *  popovers MUI / portail hors `.be-home`), remplit son conteneur (position:absolute) et s'adapte à toute taille. */
function MiniPreview({ color }: { color: string }) {
  const c = color || '#5453d6';
  return (
    <span aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 2, padding: 4, boxSizing: 'border-box' }}>
      <span style={{ height: 4, width: '55%', borderRadius: 2, background: c, opacity: 0.9 }} />
      <span style={{ flex: 1, borderRadius: 3, background: c, opacity: 0.22 }} />
      <span style={{ display: 'flex', gap: 2 }}>
        <span style={{ flex: 1, height: 7, borderRadius: 2, background: c, opacity: 0.4 }} />
        <span style={{ flex: 1, height: 7, borderRadius: 2, background: c, opacity: 0.4 }} />
      </span>
    </span>
  );
}

/** Vignette d'un template : vraie image si dispo, sinon mini-aperçu teinté à la couleur de marque. */
function TemplateThumb({ tpl }: { tpl: GalleryTemplate }) {
  if (tpl.thumbnail) {
    return <img src={tpl.thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  return <MiniPreview color={tpl.theme?.primaryColor || '#5453d6'} />;
}

const URL_RE =/^(https?:\/\/|www\.)|\.[a-z]{2,}(\/|$)/i;

// ── Constructeur de prompt : champs ajoutables au champ hero ───────────────────
// Le « + » propose des champs à ajouter à la barre pour composer un brief COMPLET et STANDARDISÉ
// (meilleure requête IA). « Funnel » est présent par défaut ; les autres s'ajoutent à la demande et
// pré-remplissent la modale de génération (ou les overrides de config à l'analyse d'URL).
type PromptOptionId =
  | 'funnel' | 'template' | 'style' | 'tone' | 'languages'
  | 'audience' | 'goal' | 'tier' | 'location' | 'currency' | 'usps' | 'pages';

/** Tonalités proposées (la valeur affichée alimente `brief.tone`). */
const TONE_CHOICES = [
  { id: 'chaleureux', label: 'Chaleureux & authentique' },
  { id: 'epure', label: 'Épuré & moderne' },
  { id: 'luxe', label: 'Luxe & raffiné' },
  { id: 'convivial', label: 'Convivial & familial' },
] as const;

/** Langues générables (alignées sur les locales du Studio ; alimente `brief.languages`). */
const LANGUAGE_OPTIONS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'Anglais' },
  { code: 'ar', label: 'Arabe' },
] as const;

/** Clientèle cible (valeur = libellé, alimente directement `brief.audience`). */
const AUDIENCE_CHOICES = ['Familles', 'Couples', "Voyageurs d'affaires", 'Groupes', 'Voyageurs de luxe'] as const;
/** Objectif principal / appel à l'action (`brief.goal`). */
const GOAL_CHOICES = ['Réservation directe', 'Demande de devis', 'Capture de leads', 'Découverte'] as const;
/** Niveau de gamme (`brief.tier`). */
const TIER_CHOICES = ['Économique', 'Milieu de gamme', 'Premium', 'Luxe'] as const;
/** Devises proposées (code ISO → libellé ; `brief.currency` = code). */
const CURRENCY_CHOICES = [
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'MAD', label: 'MAD — Dirham' },
  { code: 'USD', label: 'USD — Dollar' },
  { code: 'GBP', label: 'GBP — Livre' },
  { code: 'SAR', label: 'SAR — Riyal' },
] as const;
/** Points forts (multiselect, valeurs = libellés ; `brief.usps`). */
const USP_CHOICES = [
  'Sans commission', 'Conciergerie 24/7', 'Check-in autonome', 'Animaux acceptés',
  'Spa / piscine', 'Vue mer', 'Petit-déjeuner inclus', 'Parking',
] as const;
/** Pages générables (clé stable → libellé ; `brief.pages` = clés ; miroir de `SiteGenerationPrompts.PAGE_CATALOG`). */
const PAGE_CHOICES = [
  { key: 'accueil', label: 'Accueil' },
  { key: 'logements', label: 'Logements' },
  { key: 'a-propos', label: 'À propos' },
  { key: 'contact', label: 'Contact' },
  { key: 'blog', label: 'Blog' },
  { key: 'faq', label: 'FAQ' },
  { key: 'avis', label: 'Avis' },
  { key: 'galerie', label: 'Galerie' },
  { key: 'experiences', label: 'Expériences' },
  { key: 'tarifs', label: 'Tarifs' },
] as const;
/** Set de pages par défaut (miroir de `SiteGenerationPrompts.DEFAULT_PAGES`). */
const DEFAULT_PAGES = ['accueil', 'logements', 'a-propos', 'contact'];

// ── Cohérence inter-champs ─────────────────────────────────────────────────────
// Le brief ne doit JAMAIS être contradictoire (sous peine d'ambiguïté côté LLM). Un funnel porte un
// MODE de conversion (payment | inquiry) et une PORTÉE (single | multi) ; ces traits contraignent les
// autres champs. Les choix incompatibles sont rendus NON sélectionnables, et changer un champ
// réconcilie automatiquement les champs dépendants.
const FUNNEL_TRAITS: Record<string, { mode: 'payment' | 'inquiry'; scope: 'single' | 'multi' }> = {
  catalogue: { mode: 'payment', scope: 'multi' },
  single: { mode: 'payment', scope: 'single' },
  inquiry: { mode: 'inquiry', scope: 'multi' },
  extras: { mode: 'payment', scope: 'multi' },
  cart: { mode: 'payment', scope: 'multi' },
  express: { mode: 'payment', scope: 'multi' },
  confirmation: { mode: 'payment', scope: 'multi' },
};
const funnelTraits = (id: string) => FUNNEL_TRAITS[id] ?? { mode: 'payment' as const, scope: 'multi' as const };

/** Mode de conversion d'un objectif (`any` = compatible avec tout funnel). */
const GOAL_MODE: Record<string, 'payment' | 'inquiry' | 'any'> = {
  'Réservation directe': 'payment',
  'Demande de devis': 'inquiry',
  'Capture de leads': 'any',
  'Découverte': 'any',
};
/** Objectif incompatible : son mode contredit le mode du funnel (ex. « réservation directe » + funnel devis). */
const goalConflicts = (goalValue: string, funnelId: string): boolean => {
  const gm = GOAL_MODE[goalValue] ?? 'any';
  return gm !== 'any' && gm !== funnelTraits(funnelId).mode;
};
/** Page incompatible : la liste de logements n'a pas de sens pour un funnel mono-bien. */
const pageConflicts = (pageKey: string, funnelId: string): boolean =>
  pageKey === 'logements' && funnelTraits(funnelId).scope === 'single';

// ── Suggestions inter-champs (cohérence POSITIVE : pré-remplissage proposé, modifiable) ────────────
/** Devise suggérée d'après des mots-clés de localisation (alimente `brief.currency`). */
const CURRENCY_BY_LOCATION: { match: RegExp; code: string }[] = [
  { match: /maroc|marrakech|casablanca|rabat|f[èe]s|tanger|agadir|essaouira/i, code: 'MAD' },
  { match: /arabie|saoudite|riyad|riyadh|j[ei]ddah|la mecque|m[ée]dine/i, code: 'SAR' },
  { match: /royaume-uni|angleterre|londres|london|[ée]cosse/i, code: 'GBP' },
  { match: /[ée]tats-unis|usa|new york|miami|californie|los angeles/i, code: 'USD' },
  { match: /france|paris|lyon|c[ôo]te d'azur|nice|marseille|bordeaux|provence|corse|espagne|italie|portugal|europe/i, code: 'EUR' },
];
const suggestCurrency = (loc: string): string | null =>
  loc.trim() ? (CURRENCY_BY_LOCATION.find((c) => c.match.test(loc))?.code ?? null) : null;

/** Défauts cohérents proposés selon l'audience (ton = id `TONE_CHOICES`, gamme = libellé `TIER_CHOICES`). */
const AUDIENCE_DEFAULTS: Record<string, { tone?: string; tier?: string }> = {
  'Voyageurs de luxe': { tone: 'luxe', tier: 'Luxe' },
  'Familles': { tone: 'convivial', tier: 'Milieu de gamme' },
  'Couples': { tone: 'chaleureux', tier: 'Premium' },
  "Voyageurs d'affaires": { tone: 'epure', tier: 'Premium' },
  'Groupes': { tone: 'convivial', tier: 'Milieu de gamme' },
};

/** Libellé lisible d'un style preset (à défaut d'i18n ici). */
function styleLabel(id: string): string {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Champs disponibles dans le constructeur de prompt (ordre d'affichage + icône + (non) retirable). */
const PROMPT_OPTIONS: { id: PromptOptionId; label: string; icon: typeof LayoutDashboard; removable: boolean }[] = [
  { id: 'funnel', label: 'Funnel', icon: LayoutDashboard, removable: false },
  { id: 'template', label: 'Template', icon: Layers, removable: false },
  { id: 'style', label: 'Style', icon: Sparkles, removable: true },
  { id: 'tone', label: 'Ton', icon: Feather, removable: true },
  { id: 'languages', label: 'Langues', icon: Languages, removable: true },
  { id: 'audience', label: 'Audience', icon: Users, removable: true },
  { id: 'goal', label: 'Objectif', icon: Target, removable: true },
  { id: 'tier', label: 'Gamme', icon: Gem, removable: true },
  { id: 'location', label: 'Lieu', icon: MapPin, removable: true },
  { id: 'currency', label: 'Devise', icon: Coins, removable: true },
  { id: 'usps', label: 'Points forts', icon: BadgeCheck, removable: true },
  { id: 'pages', label: 'Pages', icon: Files, removable: true },
];

export default function StudioHome({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { notify } = useNotification();
  const { user } = useAuth();
  const [configs, setConfigs] = useState<BookingEngineConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Génération de site par IA : modale de brief → création config + site → ai-generate → ouverture.
  const [genOpen, setGenOpen] = useState(false);

  // Champ IA — texte libre + champs structurés (constructeur de prompt)
  const [prompt, setPrompt] = useState('');
  const [funnelId, setFunnelId] = useState<string | null>(null);   // null = aucun funnel choisi à l'init
  // Aperçu au survol des cartes : le chip « Funnel » reflète le funnel survolé (sans le sélectionner).
  const [hoveredFunnelId, setHoveredFunnelId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);          // template choisi (optionnel, filtré par funnel)
  const [hoveredTemplateId, setHoveredTemplateId] = useState<string | null>(null);
  const [styleId, setStyleId] = useState<string | null>(null);   // null = automatique
  const [tone, setTone] = useState<string | null>(null);
  const [languages, setLanguages] = useState<string[]>(['fr']);
  const [audience, setAudience] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [usps, setUsps] = useState<string[]>([]);
  const [location, setLocation] = useState<string>('');
  const [pages, setPages] = useState<string[]>(DEFAULT_PAGES);
  // Champs actuellement ajoutés à la barre (Funnel par défaut) + ancres des menus (« + » / valeur / lieu).
  const [activeOptions, setActiveOptions] = useState<PromptOptionId[]>(['funnel', 'template']);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [optionAnchor, setOptionAnchor] = useState<{ id: PromptOptionId; el: HTMLElement } | null>(null);
  const [locationAnchor, setLocationAnchor] = useState<HTMLElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Liste
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  // Suppression d'un booking engine (depuis « Mes booking engines ») : confirmation puis DELETE org-scopé.
  const [confirmDelete, setConfirmDelete] = useState<BookingEngineConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    bookingEngineApi.listConfigs()
      .then((data) => { if (alive) setConfigs(data); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Erreur de chargement'); });
    return () => { alive = false; };
  }, []);

  const initials = useMemo(() => {
    const fromName = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase();
    if (fromName) return fromName;
    const src = (user?.fullName || user?.email || 'AU').trim();
    return src.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('') || 'AU';
  }, [user]);

  // Champ IA gated par le toggle STUDIO_ASSIST (Paramètres IA). Optimiste : actif tant que non chargé.
  const { data: aiToggles } = useAiFeatureToggles();
  const aiAssistOn = !aiToggles || (aiToggles.find((t) => t.feature === 'STUDIO_ASSIST')?.enabled ?? true);

  // Le backend impose l'unicité (org + nom) → un nom déjà pris renvoie 400 « nom déjà existant ». On
  // suffixe (" 2", " 3"…) contre la liste chargée pour que la création aboutisse toujours ; repli
  // horodaté si saturé. Évite le « Création impossible » sur les boutons à nom fixe (vierge, +, template).
  const uniqueConfigName = (base: string): string => {
    const taken = new Set((configs ?? []).map((c) => c.name));
    if (!taken.has(base)) return base;
    for (let i = 2; i <= 99; i += 1) { const n = `${base} ${i}`; if (!taken.has(n)) return n; }
    return `${base} ${Date.now().toString(36)}`;
  };

  /** Crée une config (avec overrides sûrs) puis ouvre l'éditeur. Si `analyzeUrl` est fourni (champ IA +
   *  STUDIO_ASSIST actif), lance l'analyse de site → tokens design + CSS appliqués à la config (best-effort). */
  const createAndOpen = async (
    name: string,
    overrides: Partial<BookingEngineConfigUpdate>,
    navState?: Record<string, unknown>,
    analyzeUrl?: string | null,
  ) => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await bookingEngineApi.createConfig({ ...buildConfigPayload(uniqueConfigName(name)), ...overrides });
      if (analyzeUrl) {
        // Analyse IA du site avant d'ouvrir l'éditeur (non bloquant : un échec n'empêche pas l'édition).
        try { await bookingEngineApi.analyzeWebsite(created.id, analyzeUrl); } catch { /* best-effort */ }
      }
      navigate(`/booking-engine/studio/${created.id}`, navState ? { state: navState } : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible');
      setCreating(false);
    }
  };

  // Le funnel sélectionné (obligatoire) est porté par la création, même « page vierge ».
  const handleCreateBlank = () => createAndOpen('Nouveau booking engine', {}, { funnelId });

  // ── Constructeur de prompt : ajout / retrait de champs + libellé de valeur courante ──
  const addOption = (id: PromptOptionId) => {
    setActiveOptions((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setAddAnchor(null);
    // Suggestion : ajouter « Devise » alors qu'un lieu est saisi → propose la devise locale (modifiable).
    if (id === 'currency' && !currency) {
      const s = suggestCurrency(location);
      if (s) setCurrency(s);
    }
  };
  // Choix d'une audience : propose des défauts cohérents (ton/gamme) si ces champs sont actifs et vides.
  const chooseAudience = (a: string) => {
    setAudience(a);
    const d = AUDIENCE_DEFAULTS[a];
    if (d) {
      if (d.tone && activeOptions.includes('tone') && !tone) setTone(d.tone);
      if (d.tier && activeOptions.includes('tier') && !tier) setTier(d.tier);
    }
    setOptionAnchor(null);
  };
  // Validation du lieu : ferme le popover et, si « Devise » est active et vide, propose la devise locale.
  const commitLocation = () => {
    setLocationAnchor(null);
    if (activeOptions.includes('currency') && !currency) {
      const s = suggestCurrency(location);
      if (s) setCurrency(s);
    }
  };
  // Choix d'un funnel : réconcilie les champs dépendants (objectif, pages) pour rester cohérent.
  const applyFunnel = (id: string) => {
    setFunnelId(id);
    // Le template choisi ne reste que s'il appartient au nouveau funnel, sinon on le réinitialise.
    setTemplateId((t) => (t && templateFunnel(t) === id ? t : null));
    setGoal((g) => (g && goalConflicts(g, id) ? null : g));
    setPages((ps) => ps.filter((k) => !pageConflicts(k, id)));
    setOptionAnchor(null);
  };
  // Choix d'un template : possible UNIQUEMENT après avoir choisi un funnel (gating). Le template filtré l'est déjà.
  const applyTemplate = (id: string) => {
    if (!funnelId) return;
    setTemplateId(id);
    setOptionAnchor(null);
  };
  // Templates visibles = ceux du funnel sélectionné (vide tant qu'aucun funnel → section verrouillée/grisée).
  const visibleTemplates = funnelId ? GALLERY_TEMPLATES.filter((t) => templateFunnel(t.id) === funnelId) : [];
  // Éventail borné : au-delà de TPL_FAN_MAX, on coupe + une carte « Voir tous », et le chevauchement CROÎT avec
  // le nombre de cartes pour garder une largeur de rangée stable (≈ 760px) — plus de cartes = plus superposées.
  const TPL_FAN_MAX = 8;
  const fanTemplates = visibleTemplates.slice(0, TPL_FAN_MAX);
  const fanExtra = visibleTemplates.length - fanTemplates.length;
  const fanTotal = fanTemplates.length + (fanExtra > 0 ? 1 : 0);
  const fanOverlap = fanTotal > 1 ? Math.max(6, (fanTotal * 124 - 760) / (fanTotal - 1)) : 0;
  // Retirer un champ réinitialise sa valeur (évite un brief alimenté par une valeur masquée).
  const removeOption = (id: PromptOptionId) => {
    setActiveOptions((prev) => prev.filter((o) => o !== id));
    if (id === 'style') setStyleId(null);
    if (id === 'tone') setTone(null);
    if (id === 'languages') setLanguages(['fr']);
    if (id === 'audience') setAudience(null);
    if (id === 'goal') setGoal(null);
    if (id === 'tier') setTier(null);
    if (id === 'currency') setCurrency(null);
    if (id === 'usps') setUsps([]);
    if (id === 'location') setLocation('');
    if (id === 'pages') setPages(DEFAULT_PAGES);
    setOptionAnchor(null);
    setLocationAnchor(null);
  };
  const optionValueLabel = (id: PromptOptionId): string => {
    switch (id) {
      // La sélection prime : le chip reste sur le funnel choisi ; le survol ne PRÉVISUALISE que si rien n'est sélectionné.
      case 'funnel': return BUILTIN_FUNNEL_PRESETS.find((f) => f.id === (funnelId ?? hoveredFunnelId))?.label ?? 'Aucun';
      case 'template': {
        const tid = templateId ?? hoveredTemplateId;
        if (tid) return GALLERY_TEMPLATES.find((t) => t.id === tid)?.name ?? 'Template';
        return funnelId ? 'Aucun' : 'Choisir un funnel';
      }
      case 'style': return styleId ? styleLabel(styleId) : 'Automatique';
      case 'tone': return tone ? (TONE_CHOICES.find((c) => c.id === tone)?.label ?? tone) : 'Au choix';
      case 'languages': return languages.length ? languages.map((c) => c.toUpperCase()).join(' · ') : 'Aucune';
      case 'audience': return audience ?? 'Au choix';
      case 'goal': return goal ?? 'Au choix';
      case 'tier': return tier ?? 'Au choix';
      case 'currency': return currency ?? 'Auto';
      case 'usps': return usps.length ? `${usps.length} sélectionné${usps.length > 1 ? 's' : ''}` : 'Aucun';
      case 'location': return location.trim() || 'À préciser';
      case 'pages': return pages.length ? `${pages.length} page${pages.length > 1 ? 's' : ''}` : 'Aucune';
    }
  };

  /** Ouvre le bon contrôle pour un champ : popover texte pour « Lieu », menu de valeurs sinon. */
  const openOption = (id: PromptOptionId, el: HTMLElement) => {
    if (id === 'location') setLocationAnchor(el);
    else setOptionAnchor({ id, el });
  };

  /** Brief structuré assemblé depuis les champs ACTIFS (mémoïsé → identité stable tant que la modale est ouverte). */
  const studioBrief = useMemo<Partial<SiteGenerationBrief>>(() => {
    const has = (id: PromptOptionId) => activeOptions.includes(id);
    return {
      propertyType: prompt.trim(),
      tone: tone ? (TONE_CHOICES.find((c) => c.id === tone)?.label ?? null) : null,
      primaryColorHint: styleId ? (DESIGN_PRESETS.find((p) => p.id === styleId)?.primaryColor ?? null) : null,
      languages: has('languages') ? languages : undefined,
      audience: has('audience') ? audience : null,
      // Filet de cohérence : on n'envoie jamais un objectif/des pages qui contredisent le funnel.
      goal: has('goal') && goal && (!funnelId || !goalConflicts(goal, funnelId)) ? goal : null,
      tier: has('tier') ? tier : null,
      location: has('location') && location.trim() ? location.trim() : null,
      currency: has('currency') ? currency : null,
      usps: has('usps') && usps.length ? usps : undefined,
      pages: has('pages') ? pages.filter((k) => !funnelId || !pageConflicts(k, funnelId)) : undefined,
    };
  }, [prompt, tone, styleId, languages, audience, goal, tier, currency, usps, location, pages, activeOptions, funnelId]);

  /** Récapitulatif lisible des champs structurés (affiché en lecture seule dans la modale). */
  const briefRecap = useMemo<string>(() => {
    const parts: string[] = [];
    if (activeOptions.includes('audience') && audience) parts.push(`Audience : ${audience}`);
    if (activeOptions.includes('goal') && goal) parts.push(`Objectif : ${goal}`);
    if (activeOptions.includes('tier') && tier) parts.push(`Gamme : ${tier}`);
    if (activeOptions.includes('location') && location.trim()) parts.push(`Lieu : ${location.trim()}`);
    if (activeOptions.includes('currency') && currency) parts.push(`Devise : ${currency}`);
    if (activeOptions.includes('usps') && usps.length) parts.push(`Points forts : ${usps.join(', ')}`);
    if (activeOptions.includes('pages')) {
      const labels = pages.map((k) => PAGE_CHOICES.find((p) => p.key === k)?.label ?? k);
      parts.push(`Pages : ${labels.join(', ')}`);
    }
    return parts.join('  ·  ');
  }, [activeOptions, audience, goal, tier, location, currency, usps, pages]);

  // Point d'entrée IA unique du Studio. Une URL → analyse du site existant (tokens design) puis éditeur ;
  // une description libre → génération de site complète par IA (ouvre la modale de brief, pré-remplie).
  const handleAiSubmit = () => {
    // Un template sélectionné prime : le bouton ↑ crée l'engine en important le template (+ funnel).
    if (templateId) { createWithTemplate(templateId); return; }
    const value = prompt.trim();
    if (!value) { areaRef.current?.focus(); return; }
    if (URL_RE.test(value)) {
      const style = styleId ? DESIGN_PRESETS.find((p) => p.id === styleId) : undefined;
      const name = value.replace(/^https?:\/\//, '').split(/[\s/]+/)[0].slice(0, 40) || 'Nouveau booking engine';
      createAndOpen(
        name,
        { sourceWebsiteUrl: value, ...(style ? { primaryColor: style.primaryColor, fontFamily: style.fontFamily } : {}) },
        // navState : le funnel choisi reste consommé par l'éditeur (insertion des widgets au chargement).
        { aiPrompt: value, funnelId },
        aiAssistOn ? value : null,
      );
      return;
    }
    // Description libre → génération : la modale s'ouvre pré-remplie par les champs du constructeur.
    setGenOpen(true);
  };

  const createWithTemplate = (tplId: string) => {
    const tpl = GALLERY_TEMPLATES.find((t) => t.id === tplId);
    createAndOpen(
      tpl?.name ?? 'Nouveau booking engine',
      { ...(tpl?.theme?.primaryColor ? { primaryColor: tpl.theme.primaryColor } : {}), ...(tpl?.theme?.fontFamily ? { fontFamily: tpl.theme.fontFamily } : {}) },
      // `templateId` + `funnelId` consommés par GrapesStudio (auto-import + widgets) une fois l'éditeur prêt.
      { templateId: tplId, funnelId },
    );
  };

  /**
   * Génère un site complet par IA : crée un booking engine vierge, résout son site (`ensureForConfig`),
   * lance la génération (`ai-generate`) puis ouvre l'éditeur sur le site généré (pages en BROUILLON).
   * Rejette en cas d'échec (message remonté + affiché par la modale ; l'échec 502 reste lisible).
   */
  const handleGenerateSite = async (brief: SiteGenerationBrief) => {
    const name = (brief.brandName?.trim() || brief.propertyType.trim()).slice(0, 40) || 'Nouveau booking engine';
    const overrides: Partial<BookingEngineConfigUpdate> = {};
    if (brief.primaryColorHint && /^#[0-9a-fA-F]{6}$/.test(brief.primaryColorHint)) {
      overrides.primaryColor = brief.primaryColorHint;
    }
    const created = await bookingEngineApi.createConfig({ ...buildConfigPayload(uniqueConfigName(name)), ...overrides });
    const site = await sitesApi.ensureForConfig(created.id);
    const result = await sitesApi.generateSite(site.id, brief);
    const count = result.pagesCreated.length;
    setGenOpen(false);
    notify.success(
      t('bookingEngine.studio.ai.generate.success', '{{count}} pages créées en brouillon — à relire avant publication.', { count }),
    );
    navigate(`/booking-engine/studio/${created.id}`);
  };

  // Supprime le booking engine confirmé (DELETE org-scopé côté serveur) puis retire la ligne localement.
  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await bookingEngineApi.deleteConfig(confirmDelete.id);
      setConfigs((prev) => (prev ? prev.filter((c) => c.id !== confirmDelete.id) : prev));
      setConfirmDelete(null);
    } catch {
      setError('La suppression du booking engine a échoué.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(
    () => (configs ?? []).filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [configs, query],
  );

  const content = (
    <Box className="be-home" data-accent="indigo">
      <div className="canvas" style={{ maxWidth: 1180 }}>
        {error && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 13 }}>
            <AlertTriangle size={16} strokeWidth={2} /> {error}
          </Box>
        )}

        {/* Studio à 2 colonnes : création (gauche) + rail templates vertical (droite). */}
        <div className="studio-split">
          <div className="studio-split__main">

        {/* 1 · Hero */}
        <div className="hero">
          <p className="eyebrow">Booking Engine · Studio</p>
          <h1>Quel booking engine créons-nous&nbsp;?</h1>
        </div>

        {/* 2 · Champ IA */}
        {creating ? (
          <Skeleton variant="rounded" height={170} sx={{ borderRadius: '20px', bgcolor: 'var(--hover)' }} />
        ) : (
          <div className="field">
            <textarea
              ref={areaRef}
              className="field__area"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              aria-label="Décrivez votre activité ou collez l'URL de votre site"
              placeholder={aiAssistOn
                ? "Collez l'URL de votre site actuel à analyser, ou décrivez votre conciergerie…"
                : "Décrivez votre conciergerie (l'analyse IA de site est désactivée — Paramètres › IA)…"}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAiSubmit(); }}
            />
            <div className="field__bar">
              <button className="chip chip--icon" aria-label="Ajouter un champ au prompt" type="button" title="Ajouter un champ (style, ton, langues…)" onClick={(e) => setAddAnchor(e.currentTarget)}>
                <Plus size={16} strokeWidth={2} />
              </button>
              {activeOptions.map((id) => {
                const opt = PROMPT_OPTIONS.find((o) => o.id === id);
                if (!opt) return null;
                // Funnel : schéma qui glisse. Template : vignette qui glisse, grisé tant qu'aucun funnel choisi.
                const shownFunnel = id === 'funnel' ? (funnelId ?? hoveredFunnelId) : null;
                const shownTplId = id === 'template' ? (templateId ?? hoveredTemplateId) : null;
                const shownTpl = shownTplId ? GALLERY_TEMPLATES.find((t) => t.id === shownTplId) : null;
                const lockedTpl = id === 'template' && !funnelId;
                return (
                  <button key={id} className={'chip' + (lockedTpl ? ' chip--locked' : '')} type="button" disabled={lockedTpl} onClick={(e) => openOption(id, e.currentTarget)}>
                    {id === 'funnel' && (
                      <span className={'chip__slide' + (shownFunnel ? ' chip__slide--open' : '')}>
                        {shownFunnel && <span className="chip__art"><FunnelArt id={shownFunnel} /></span>}
                      </span>
                    )}
                    {id === 'template' && (
                      <span className={'chip__slide' + (shownTpl ? ' chip__slide--open' : '')}>
                        {shownTpl && <span className="chip__art chip__art--img"><TemplateThumb tpl={shownTpl} /></span>}
                      </span>
                    )}
                    <span className="chip__text">
                      <span className="chip__lbl">{opt.label}</span>
                      <span className="chip__val">{optionValueLabel(id)}</span>
                    </span>
                    <ChevronDown size={14} strokeWidth={2} />
                  </button>
                );
              })}
              <div className="field__spacer" />
              <button className="send" type="button" aria-label="Générer" disabled={creating} onClick={handleAiSubmit}>
                <ArrowUp size={19} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        )}

        {/* « + » : propose les champs non encore ajoutés pour un prompt complet et standardisé. */}
        <Menu anchorEl={addAnchor} open={!!addAnchor} onClose={() => setAddAnchor(null)}>
          {PROMPT_OPTIONS.filter((o) => !activeOptions.includes(o.id)).map((o) => {
            const Icon = o.icon;
            return (
              <MenuItem key={o.id} onClick={() => addOption(o.id)} sx={{ fontSize: 13, gap: 1 }}>
                <Icon size={15} strokeWidth={2} /> {o.label}
              </MenuItem>
            );
          })}
          {PROMPT_OPTIONS.every((o) => activeOptions.includes(o.id)) && (
            <MenuItem disabled sx={{ fontSize: 13 }}>Tous les champs sont ajoutés</MenuItem>
          )}
        </Menu>

        {/* Menu de valeur du champ cliqué (+ « Retirer ce champ », sauf Funnel par défaut). */}
        <Menu anchorEl={optionAnchor?.el ?? null} open={!!optionAnchor} onClose={() => setOptionAnchor(null)}>
          {optionAnchor?.id === 'funnel' && BUILTIN_FUNNEL_PRESETS.map((f) => (
            <MenuItem key={f.id} selected={f.id === funnelId} onClick={() => applyFunnel(f.id)} sx={{ fontSize: 13, gap: 1.25, alignItems: 'center' }}>
              <Box component="span" sx={{ width: 46, height: 32, flexShrink: 0, borderRadius: '5px', bgcolor: 'var(--surface-2, rgba(255,255,255,0.06))', border: '1px solid var(--line, rgba(255,255,255,0.12))', color: 'var(--accent, #5453d6)', display: 'grid', placeItems: 'center', overflow: 'hidden', p: '4px', '& svg': { width: '100%', height: '100%', display: 'block' } }}>
                <FunnelArt id={f.id} />
              </Box>
              {f.label}
            </MenuItem>
          ))}
          {optionAnchor?.id === 'template' && visibleTemplates.map((tpl) => (
            <MenuItem key={tpl.id} selected={tpl.id === templateId} onClick={() => applyTemplate(tpl.id)} sx={{ fontSize: 13, gap: 1.25, alignItems: 'center' }}>
              <Box component="span" sx={{ width: 46, height: 32, flexShrink: 0, borderRadius: '5px', position: 'relative', overflow: 'hidden', bgcolor: 'var(--surface-2, rgba(255,255,255,0.06))', border: '1px solid var(--line, rgba(255,255,255,0.12))' }}>
                <TemplateThumb tpl={tpl} />
              </Box>
              {tpl.name}
            </MenuItem>
          ))}
          {optionAnchor?.id === 'style' && [
            <MenuItem key="auto" selected={!styleId} onClick={() => { setStyleId(null); setOptionAnchor(null); }} sx={{ fontSize: 13 }}>Automatique</MenuItem>,
            ...DESIGN_PRESETS.map((p) => (
              <MenuItem key={p.id} selected={p.id === styleId} onClick={() => { setStyleId(p.id); setOptionAnchor(null); }} sx={{ fontSize: 13, gap: 1 }}>
                <Box component="span" sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: p.primaryColor, flexShrink: 0 }} />
                {styleLabel(p.id)}
              </MenuItem>
            )),
          ]}
          {optionAnchor?.id === 'tone' && TONE_CHOICES.map((c) => (
            <MenuItem key={c.id} selected={c.id === tone} onClick={() => { setTone(c.id); setOptionAnchor(null); }} sx={{ fontSize: 13 }}>{c.label}</MenuItem>
          ))}
          {optionAnchor?.id === 'languages' && LANGUAGE_OPTIONS.map((l) => (
            <MenuItem
              key={l.code}
              selected={languages.includes(l.code)}
              onClick={() => setLanguages((prev) => (prev.includes(l.code) ? prev.filter((c) => c !== l.code) : [...prev, l.code]))}
              sx={{ fontSize: 13 }}
            >
              {l.label}
            </MenuItem>
          ))}
          {optionAnchor?.id === 'audience' && AUDIENCE_CHOICES.map((a) => (
            <MenuItem key={a} selected={a === audience} onClick={() => chooseAudience(a)} sx={{ fontSize: 13 }}>{a}</MenuItem>
          ))}
          {optionAnchor?.id === 'goal' && GOAL_CHOICES.map((g) => {
            const incompatible = !!funnelId && goalConflicts(g, funnelId);
            return (
              <MenuItem
                key={g}
                selected={g === goal}
                disabled={incompatible}
                title={incompatible ? 'Incompatible avec le funnel choisi' : undefined}
                onClick={() => { setGoal(g); setOptionAnchor(null); }}
                sx={{ fontSize: 13 }}
              >
                {g}
              </MenuItem>
            );
          })}
          {optionAnchor?.id === 'tier' && TIER_CHOICES.map((tr) => (
            <MenuItem key={tr} selected={tr === tier} onClick={() => { setTier(tr); setOptionAnchor(null); }} sx={{ fontSize: 13 }}>{tr}</MenuItem>
          ))}
          {optionAnchor?.id === 'currency' && CURRENCY_CHOICES.map((c) => (
            <MenuItem key={c.code} selected={c.code === currency} onClick={() => { setCurrency(c.code); setOptionAnchor(null); }} sx={{ fontSize: 13 }}>{c.label}</MenuItem>
          ))}
          {optionAnchor?.id === 'usps' && USP_CHOICES.map((u) => (
            <MenuItem
              key={u}
              selected={usps.includes(u)}
              onClick={() => setUsps((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]))}
              sx={{ fontSize: 13 }}
            >
              {u}
            </MenuItem>
          ))}
          {optionAnchor?.id === 'pages' && PAGE_CHOICES.map((pg) => {
            const incompatible = !!funnelId && pageConflicts(pg.key, funnelId);
            return (
              <MenuItem
                key={pg.key}
                selected={pages.includes(pg.key)}
                disabled={incompatible}
                title={incompatible ? 'Sans objet pour un funnel mono-bien' : undefined}
                onClick={() => setPages((prev) => (prev.includes(pg.key) ? prev.filter((x) => x !== pg.key) : [...prev, pg.key]))}
                sx={{ fontSize: 13 }}
              >
                {pg.label}
              </MenuItem>
            );
          })}
          {optionAnchor && PROMPT_OPTIONS.find((o) => o.id === optionAnchor.id)?.removable && [
            <Divider key="div" sx={{ my: 0.5 }} />,
            <MenuItem key="remove" onClick={() => removeOption(optionAnchor.id)} sx={{ fontSize: 13, gap: 1, color: 'var(--err, #c0392b)' }}>
              <X size={15} strokeWidth={2} /> Retirer ce champ
            </MenuItem>,
          ]}
        </Menu>

        {/* Champ « Lieu » : saisie libre (ville / région) en popover + retrait. */}
        <Popover
          anchorEl={locationAnchor}
          open={!!locationAnchor}
          onClose={commitLocation}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1, width: 260 }}>
            <InputBase
              autoFocus
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitLocation(); }}
              placeholder="Ex. Marrakech, Côte d'Azur…"
              sx={{ px: 1.25, py: 0.75, fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--radius-md, 8px)', bgcolor: 'var(--field)' }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box component="button" type="button" onClick={() => removeOption('location')}
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, border: 0, bgcolor: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--err, #c0392b)' }}>
                <X size={14} strokeWidth={2} /> Retirer
              </Box>
              <Box component="button" type="button" onClick={commitLocation}
                sx={{ border: 0, bgcolor: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>
                OK
              </Box>
            </Box>
          </Box>
        </Popover>
        {/* 3 · Éventail de funnels */}
        <div className="fan-wrap">
          <p className="fan-lead">Ou partez d'un funnel prêt à l'emploi…</p>
          <div className="fan">
            {FAN_FUNNELS.map((f) => {
              return (
                <article
                  key={f.id}
                  className={'fan__card' + (f.id === funnelId ? ' fan__card--active' : '')}
                  role="button" tabIndex={0} aria-pressed={f.id === funnelId}
                  title={`Choisir le funnel « ${f.label} »`}
                  onClick={() => applyFunnel(f.id)}
                  onMouseEnter={() => setHoveredFunnelId(f.id)}
                  onMouseLeave={() => setHoveredFunnelId(null)}
                  onFocus={() => setHoveredFunnelId(f.id)}
                  onBlur={() => setHoveredFunnelId(null)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyFunnel(f.id); } }}
                >
                  <div className="fan__vig"><FunnelArt id={f.id} /></div>
                  <p className="fan__name">{f.label}</p>
                </article>
              );
            })}
          </div>
        </div>

        {/* 4 · Templates du funnel : grisés tant qu'aucun funnel choisi ; filtrés par type de funnel ; même éventail. */}
        <div className="fan-wrap">
          <p className="fan-lead">
            Puis choisissez un template
            <button className="fan-lead__link" type="button" onClick={() => navigate('/booking-engine/templates')}>Voir tous →</button>
          </p>
          {!funnelId ? (
            <p className="fan-locked">Sélectionnez d'abord un funnel ci-dessus pour débloquer les templates.</p>
          ) : visibleTemplates.length ? (
            <div className="fan fan--tpl" style={{ ['--fan-mx' as string]: `${-(fanOverlap / 2)}px` }}>
              {fanTemplates.map((tpl, i) => (
                <article
                  key={tpl.id}
                  className={'fan__card' + (tpl.id === templateId ? ' fan__card--active' : '')}
                  style={{ ['--tip' as string]: fanTip(i, fanTotal), ['--lift' as string]: fanLift(i, fanTotal) }}
                  role="button" tabIndex={0} aria-pressed={tpl.id === templateId}
                  title={`Choisir le template « ${tpl.name} »`}
                  onClick={() => applyTemplate(tpl.id)}
                  onMouseEnter={() => setHoveredTemplateId(tpl.id)}
                  onMouseLeave={() => setHoveredTemplateId(null)}
                  onFocus={() => setHoveredTemplateId(tpl.id)}
                  onBlur={() => setHoveredTemplateId(null)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyTemplate(tpl.id); } }}
                >
                  <div className="fan__vig fan__vig--img"><TemplateThumb tpl={tpl} /></div>
                  <p className="fan__name">{tpl.name}</p>
                </article>
              ))}
              {fanExtra > 0 && (
                <article
                  key="__more"
                  className="fan__card fan__card--more"
                  style={{ ['--tip' as string]: fanTip(fanTemplates.length, fanTotal), ['--lift' as string]: fanLift(fanTemplates.length, fanTotal) }}
                  role="button" tabIndex={0} title={`Voir les ${fanExtra} autres templates`}
                  onClick={() => navigate('/booking-engine/templates')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/booking-engine/templates'); } }}
                >
                  <div className="fan__vig fan__vig--more"><span className="fan__more">+{fanExtra}</span></div>
                  <p className="fan__name">Voir tous</p>
                </article>
              )}
            </div>
          ) : (
            <p className="fan-locked">Aucun template pour ce funnel — partez d'une page vierge.</p>
          )}
        </div>

        {/* Page vierge (sans template) */}
        <div className="blank-row">
          <button className="blank" type="button" onClick={handleCreateBlank} disabled={creating}>
            Partir d'une page vierge <ArrowRight size={16} strokeWidth={2} />
          </button>
        </div>

          </div>{/* /studio-split__main */}

        </div>{/* /studio-split */}

        {/* 5 · Mes booking engines */}
        <section className="list">
          <div className="list__head">
            <h2>Mes booking engines</h2>
            <span className="count">{configs?.length ?? 0}</span>
            <div className="sp" />
            <label className="search">
              <Search size={15} strokeWidth={2} />
              <input placeholder="Rechercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="view">
              <button className={view === 'list' ? 'on' : ''} aria-label="Liste" type="button" onClick={() => setView('list')}><ListIcon size={16} strokeWidth={2} /></button>
              <button className={view === 'grid' ? 'on' : ''} aria-label="Grille" type="button" onClick={() => setView('grid')}><LayoutGrid size={16} strokeWidth={2} /></button>
            </div>
          </div>

          {configs === null && !error && <Skeleton variant="rounded" height={132} sx={{ borderRadius: '14px', bgcolor: 'var(--hover)' }} />}

          {configs && configs.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6, color: 'var(--muted)', fontSize: 14 }}>
              Aucun booking engine pour l'instant — partez d'un funnel, d'un template, ou décrivez votre activité ci-dessus.
            </Box>
          )}

          {configs && configs.length > 0 && view === 'list' && (
            <div className="tbl">
              <div className="tbl__h"><span>Nom</span><span>Statut</span><span>Dernière modif.</span><span>Propriétaire</span></div>
              {filtered.map((c) => (
                <div key={c.id} className="row-wrap">
                  <button className="row" type="button" onClick={() => navigate(`/booking-engine/studio/${c.id}`)}>
                    <div className="row__name">
                      <div className="row__thumb"><MiniPreview color={c.primaryColor || '#5453d6'} /></div>
                      <div>
                        <p className="row__t">{c.name}</p>
                        {/* TODO : vraie URL publique (la config n'expose pas de slug). */}
                        <p className="row__u">{c.enabled ? 'Publié' : 'Brouillon · non publié'}</p>
                      </div>
                    </div>
                    <span className={`status ${c.enabled ? 'active' : 'off'}`}><span className="led" /> {c.enabled ? 'Actif' : 'Désactivé'}</span>
                    {/* TODO : « dernière modif » (la config n'expose pas updatedAt). */}
                    <span className="row__meta">—</span>
                    <div className="row__acc"><span className="av-sm">{initials}</span><span className="row__owner">Vous</span></div>
                  </button>
                  <button className="row__del" type="button" aria-label={`Supprimer ${c.name}`} title="Supprimer" onClick={() => setConfirmDelete(c)}><Trash2 size={16} strokeWidth={2} /></button>
                </div>
              ))}
            </div>
          )}

          {configs && configs.length > 0 && view === 'grid' && (
            <div className="grid">
              {filtered.map((c) => (
                <div key={c.id} className="gcard-wrap">
                  <button className="gcard" type="button" onClick={() => navigate(`/booking-engine/studio/${c.id}`)}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                      <Box sx={{ position: 'relative', width: 52, height: 36, borderRadius: '6px', flexShrink: 0, overflow: 'hidden', bgcolor: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                        <MiniPreview color={c.primaryColor || '#5453d6'} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Box sx={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--ink)' }}>{c.name}</Box>
                        <span className={`status ${c.enabled ? 'active' : 'off'}`} style={{ fontSize: 12 }}><span className="led" /> {c.enabled ? 'Actif' : 'Désactivé'}</span>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto', color: 'var(--accent)', fontSize: 13, fontWeight: 500 }}>
                      Ouvrir <ArrowRight size={14} strokeWidth={2} />
                    </Box>
                  </button>
                  <button className="gcard__del" type="button" aria-label={`Supprimer ${c.name}`} title="Supprimer" onClick={() => setConfirmDelete(c)}><Trash2 size={15} strokeWidth={2} /></button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <SiteGenerationModal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        onGenerate={handleGenerateSite}
        initialBrief={studioBrief}
        recap={briefRecap}
      />

      <Dialog open={!!confirmDelete} onClose={() => !deleting && setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Supprimer ce booking engine ?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'var(--muted)' }}>
            « {confirmDelete?.name} » sera définitivement supprimé, avec ses pages et son contenu. Cette action est irréversible.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)} disabled={deleting} sx={{ textTransform: 'none', color: 'var(--muted)' }}>Annuler</Button>
          <Button onClick={handleDelete} disabled={deleting} color="error" variant="contained" disableElevation startIcon={<Trash2 size={16} strokeWidth={2} />} sx={{ textTransform: 'none' }}>
            {deleting ? 'Suppression…' : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );

  return (
    <>
      {embedded ? (
        <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>{content}</Box>
      ) : (
        <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg)' }}>
          <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>{content}</Box>
        </Box>
      )}
    </>
  );
}
