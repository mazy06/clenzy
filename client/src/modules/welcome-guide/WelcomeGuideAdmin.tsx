import React, { useState } from 'react';
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
import { Add, Save, Edit, Delete, ContentCopy, Link as LinkIcon, OpenInNew, Info } from '../../icons';
import { MessageSquare, Star, BarChart3, Eye, MapPin, MessageCircle, DoorOpen, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
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
  type WelcomeGuide,
  type GuideSection,
  type GuidePoi,
  type GuideActivity,
  type GuestbookEntry,
  type WelcomeGuideStats,
  type PoiSuggestion,
} from '../../services/api/welcomeGuideApi';
import { POI_CATEGORIES, poiCategory, poiLabel } from './poiCatalog';
import { nominatimApi } from '../../services/nominatimApi';

type View = 'list' | 'form';

const LANGUAGES = ['fr', 'en', 'ar'] as const;
const DEFAULT_COLOR = '#6B8A9A';

const newSection = (): GuideSection => ({ id: `s-${Date.now()}`, title: '', body: '' });

const WelcomeGuideAdmin: React.FC = () => {
  const { t, currentLanguage } = useTranslation();
  const { properties } = usePropertiesList();

  const { data: guides = [], isLoading, refetch } = useQuery({
    queryKey: ['welcome-guides'],
    queryFn: () => welcomeGuideApi.list(),
  });

  const [view, setView] = useState<View>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [propertyId, setPropertyId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<string>('fr');
  const [brandingColor, setBrandingColor] = useState<string>(DEFAULT_COLOR);
  const [logoUrl, setLogoUrl] = useState('');
  const [published, setPublished] = useState(false);
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [guestbookEnabled, setGuestbookEnabled] = useState(true);
  const [activitiesEnabled, setActivitiesEnabled] = useState(true);
  const [sections, setSections] = useState<GuideSection[]>([]);
  const [pois, setPois] = useState<GuidePoi[]>([]);
  const [geocoding, setGeocoding] = useState<string | null>(null);
  const [curatedActivities, setCuratedActivities] = useState<GuideActivity[]>([]);
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
    setEditingId(null);
    setPropertyId('');
    setTitle('');
    setLanguage('fr');
    setBrandingColor(DEFAULT_COLOR);
    setLogoUrl('');
    setPublished(false);
    setChatbotEnabled(true);
    setGuestbookEnabled(true);
    setActivitiesEnabled(true);
    setSections([]);
    setPois([]);
    setCuratedActivities([]);
    setView('form');
  };

  const openEdit = (g: WelcomeGuide) => {
    setEditingId(g.id);
    setPropertyId(g.propertyId != null ? String(g.propertyId) : '');
    setTitle(g.title);
    setLanguage(g.language || 'fr');
    setBrandingColor(g.brandingColor || DEFAULT_COLOR);
    setLogoUrl(g.logoUrl || '');
    setPublished(g.published);
    setChatbotEnabled(g.chatbotEnabled);
    setGuestbookEnabled(g.guestbookEnabled);
    setActivitiesEnabled(g.activitiesEnabled);
    setSections(parseSections(g.sections));
    setPois(parsePois(g.pois));
    setCuratedActivities(parseActivities(g.curatedActivities));
    setView('form');
  };

  const handleSave = async () => {
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
        logoUrl: logoUrl.trim() || null,
        published,
        chatbotEnabled,
        guestbookEnabled,
        activitiesEnabled,
      };
      if (editingId == null) {
        await welcomeGuideApi.create(payload);
        notify(t('welcomeGuide.messages.created', 'Livret créé'));
      } else {
        await welcomeGuideApi.update(editingId, payload);
        notify(t('welcomeGuide.messages.updated', 'Livret mis à jour'));
      }
      await refetch();
      setView('list');
    } catch {
      notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g: WelcomeGuide) => {
    if (!window.confirm(t('welcomeGuide.messages.confirmDelete', 'Supprimer ce livret ?'))) return;
    try {
      await welcomeGuideApi.remove(g.id);
      notify(t('welcomeGuide.messages.deleted', 'Livret supprimé'));
      await refetch();
    } catch {
      notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
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
  const updateSection = (idx: number, field: 'title' | 'body', value: string) =>
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  const removeSection = (idx: number) => setSections((prev) => prev.filter((_, i) => i !== idx));

  // ─── POI editor handlers ("autour de moi") ─────────────────────────────────
  const addPoi = () =>
    setPois((prev) => [
      ...prev,
      { id: `poi-${Date.now()}`, category: 'RESTAURANT', name: '', address: '', lat: null, lng: null, note: '' },
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
          address: sug.address ?? '',
          lat: sug.lat,
          lng: sug.lng,
          note: '',
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

  // ─── Render: toolbar ───────────────────────────────────────────────────────
  const toolbar = (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
      {view === 'list' ? (
        <Button variant="contained" size="small" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={openCreate}>
          {t('welcomeGuide.actions.new', 'Nouveau livret')}
        </Button>
      ) : (
        <>
          <Button variant="text" size="small" onClick={() => setView('list')}>
            {t('welcomeGuide.actions.cancel', 'Annuler')}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save size={14} strokeWidth={1.75} />}
            onClick={handleSave}
            disabled={saving}
          >
            {t('welcomeGuide.actions.save', 'Enregistrer')}
          </Button>
        </>
      )}
    </Box>
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
            <Button variant="contained" startIcon={<Add size={16} strokeWidth={1.75} />} onClick={openCreate}>
              {t('welcomeGuide.actions.new', 'Nouveau livret')}
            </Button>
          }
        />
      );
    }
    return (
      <Stack spacing={1.5}>
        {guides.map((g) => (
          <Card key={g.id} variant="outlined">
            <CardContent
              sx={{ display: 'flex', alignItems: 'center', gap: 2, '&:last-child': { pb: 2 }, flexWrap: 'wrap' }}
            >
              <Box
                sx={{
                  width: 8,
                  alignSelf: 'stretch',
                  minHeight: 36,
                  borderRadius: 1,
                  bgcolor: g.brandingColor || DEFAULT_COLOR,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {g.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {g.propertyName || '—'} · {g.language.toUpperCase()}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={
                  g.published
                    ? t('welcomeGuide.status.published', 'Publié')
                    : t('welcomeGuide.status.draft', 'Brouillon')
                }
                sx={softChipSx(semanticToHex(g.published ? 'success' : 'default'))}
              />
              <Box sx={{ display: 'flex', gap: 0.5 }}>
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
                <Tooltip title={t('welcomeGuide.actions.delete', 'Supprimer')}>
                  <IconButton size="small" color="error" onClick={() => handleDelete(g)}>
                    <Delete size={16} strokeWidth={1.75} />
                  </IconButton>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  };

  // ─── Render: form ──────────────────────────────────────────────────────────
  const renderForm = () => (
    <Stack spacing={2.5} sx={{ maxWidth: 720 }}>
      <Alert severity="info" icon={<Info size={18} strokeWidth={1.75} />}>
        {t(
          'welcomeGuide.form.autofillHint',
          "Le wifi, le digicode, les règles et les numéros utiles sont remplis automatiquement depuis la fiche du logement (instructions de check-in). Ici, ajoutez le message d'accueil et vos recommandations « autour de moi ».",
        )}
      </Alert>

      <TextField
        select
        label={t('welcomeGuide.fields.property', 'Logement')}
        value={propertyId}
        onChange={(e) => setPropertyId(e.target.value)}
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
          type="color"
          label={t('welcomeGuide.fields.brandingColor', 'Couleur')}
          value={brandingColor}
          onChange={(e) => setBrandingColor(e.target.value)}
          size="small"
          sx={{ width: 120 }}
        />

        <TextField
          label={t('welcomeGuide.fields.logoUrl', 'URL du logo')}
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 220 }}
          placeholder="https://…"
        />
      </Box>

      <Divider />

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t('welcomeGuide.form.sectionsTitle', 'Sections du livret')}
          </Typography>
          <Button size="small" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={addSection}>
            {t('welcomeGuide.actions.addSection', 'Ajouter une section')}
          </Button>
        </Box>

        {sections.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('welcomeGuide.form.noSection', 'Aucune section. Ajoutez un message d’accueil ou des recommandations.')}
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {sections.map((s, idx) => (
              <Card key={s.id} variant="outlined">
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <TextField
                        label={t('welcomeGuide.fields.sectionTitle', 'Titre de la section')}
                        value={s.title}
                        onChange={(e) => updateSection(idx, 'title', e.target.value)}
                        fullWidth
                        size="small"
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        label={t('welcomeGuide.fields.sectionBody', 'Contenu')}
                        value={s.body}
                        onChange={(e) => updateSection(idx, 'body', e.target.value)}
                        fullWidth
                        size="small"
                        multiline
                        minRows={2}
                      />
                    </Box>
                    <IconButton size="small" color="error" onClick={() => removeSection(idx)} sx={{ mt: 0.5 }}>
                      <Delete size={16} strokeWidth={1.75} />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      <Divider />

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, gap: 1 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {t('welcomeGuide.pois.title', 'Autour de moi')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('welcomeGuide.pois.hint', 'Recommandations géolocalisées affichées sur une carte dans le livret.')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button size="small" startIcon={<Sparkles size={14} strokeWidth={1.75} />} onClick={openSuggest}>
              {t('welcomeGuide.pois.suggest', 'Suggérer')}
            </Button>
            <Button size="small" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={addPoi}>
              {t('welcomeGuide.pois.add', 'Ajouter un lieu')}
            </Button>
          </Box>
        </Box>

        {pois.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('welcomeGuide.pois.empty', 'Aucun lieu. Ajoutez vos restaurants, transports et incontournables.')}
          </Typography>
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

      <Divider />

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, gap: 1 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {t('welcomeGuide.curation.title', 'Activités à proposer')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('welcomeGuide.curation.hint', 'Choisissez les activités à afficher sur le livret et mettez-en certaines en avant.')}
            </Typography>
          </Box>
          <Button size="small" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={addActivity}>
            {t('welcomeGuide.curation.add', 'Ajouter une activité')}
          </Button>
        </Box>

        {curatedActivities.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('welcomeGuide.curation.empty', 'Aucune activité. Ajoutez vos excursions et bons plans à réserver.')}
          </Typography>
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

      <Divider />

      <FormControlLabel
        control={<Switch checked={published} onChange={(e) => setPublished(e.target.checked)} />}
        label={t('welcomeGuide.fields.published', 'Publier le livret (accessible aux voyageurs)')}
      />
      <FormControlLabel
        control={<Switch checked={chatbotEnabled} onChange={(e) => setChatbotEnabled(e.target.checked)} />}
        label={t('welcomeGuide.fields.chatbotEnabled', 'Chatbot assistant')}
      />
      <FormControlLabel
        control={<Switch checked={guestbookEnabled} onChange={(e) => setGuestbookEnabled(e.target.checked)} />}
        label={t('welcomeGuide.fields.guestbookEnabled', "Livre d'or")}
      />
      <FormControlLabel
        control={<Switch checked={activitiesEnabled} onChange={(e) => setActivitiesEnabled(e.target.checked)} />}
        label={t('welcomeGuide.fields.activitiesEnabled', 'Activités')}
      />
    </Stack>
  );

  return (
    <Box>
      {toolbar}
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
