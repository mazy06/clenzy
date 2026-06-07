import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
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
import { MessageSquare, Star, Plug } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import { usePropertiesList } from '../../hooks/usePropertiesList';
import { softChipSx, semanticToHex } from '../../utils/statusUtils';
import {
  welcomeGuideApi,
  parseSections,
  serializeSections,
  type WelcomeGuide,
  type GuideSection,
  type GuestbookEntry,
} from '../../services/api/welcomeGuideApi';
import { activitiesApi, type ActivityProvider } from '../../services/api/activitiesApi';

type View = 'list' | 'form';

const LANGUAGES = ['fr', 'en', 'ar'] as const;
const DEFAULT_COLOR = '#6B8A9A';

const newSection = (): GuideSection => ({ id: `s-${Date.now()}`, title: '', body: '' });

type ActRow = { apiKey: string; affiliateId: string; enabled: boolean; hasKey: boolean };
const ACT_PROVIDERS: { id: ActivityProvider; name: string }[] = [
  { id: 'VIATOR', name: 'Viator' },
  { id: 'GETYOURGUIDE', name: 'GetYourGuide' },
  { id: 'KLOOK', name: 'Klook' },
];

const WelcomeGuideAdmin: React.FC = () => {
  const { t } = useTranslation();
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
  const [sections, setSections] = useState<GuideSection[]>([]);

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
  const [actDialog, setActDialog] = useState<{ open: boolean; loading: boolean; rows: Record<string, ActRow> }>({
    open: false,
    loading: false,
    rows: {},
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
    setSections([]);
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
    setSections(parseSections(g.sections));
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
        brandingColor,
        logoUrl: logoUrl.trim() || null,
        published,
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

  const openActivities = async () => {
    setActDialog({ open: true, loading: true, rows: {} });
    try {
      const configs = await activitiesApi.listConfigs();
      const byProvider = new Map(configs.map((c) => [c.provider, c]));
      const rows: Record<string, ActRow> = {};
      for (const p of ACT_PROVIDERS) {
        const c = byProvider.get(p.id);
        rows[p.id] = {
          apiKey: '',
          affiliateId: c?.affiliateId ?? '',
          enabled: c?.enabled ?? false,
          hasKey: c?.hasKey ?? false,
        };
      }
      setActDialog({ open: true, loading: false, rows });
    } catch {
      setActDialog({ open: true, loading: false, rows: {} });
      notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
    }
  };

  const updateActRow = (provider: string, patch: Partial<ActRow>) =>
    setActDialog((s) => ({ ...s, rows: { ...s.rows, [provider]: { ...s.rows[provider], ...patch } } }));

  const saveActProvider = async (provider: ActivityProvider) => {
    const row = actDialog.rows[provider];
    if (!row) return;
    try {
      const saved = await activitiesApi.upsertConfig(provider, {
        apiKey: row.apiKey.trim() || null,
        affiliateId: row.affiliateId.trim() || null,
        enabled: row.enabled,
      });
      updateActRow(provider, {
        apiKey: '',
        hasKey: saved.hasKey,
        enabled: saved.enabled,
        affiliateId: saved.affiliateId ?? '',
      });
      notify(t('welcomeGuide.messages.updated', 'Livret mis à jour'));
    } catch {
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

  // ─── Render: toolbar ───────────────────────────────────────────────────────
  const toolbar = (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
      {view === 'list' ? (
        <>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Plug size={14} strokeWidth={1.75} />}
            onClick={openActivities}
          >
            {t('welcomeGuide.actions.activities', 'Activités')}
          </Button>
          <Button variant="contained" size="small" startIcon={<Add size={14} strokeWidth={1.75} />} onClick={openCreate}>
            {t('welcomeGuide.actions.new', 'Nouveau livret')}
          </Button>
        </>
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

      <FormControlLabel
        control={<Switch checked={published} onChange={(e) => setPublished(e.target.checked)} />}
        label={t('welcomeGuide.fields.published', 'Publier le livret (accessible aux voyageurs)')}
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

      <Dialog open={actDialog.open} onClose={() => setActDialog((s) => ({ ...s, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle>{t('welcomeGuide.activities.title', 'Activités (affiliation)')}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'welcomeGuide.activities.note',
              "Connectez un service d'activités pour proposer des excursions à vos voyageurs (et toucher une commission). Renseignez votre clé API partenaire.",
            )}
          </Typography>
          {actDialog.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={2.5}>
              {ACT_PROVIDERS.map((p) => {
                const row = actDialog.rows[p.id];
                if (!row) return null;
                return (
                  <Box key={p.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {p.name}
                      </Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={row.enabled}
                            onChange={(e) => updateActRow(p.id, { enabled: e.target.checked })}
                          />
                        }
                        label={t('welcomeGuide.activities.enabled', 'Actif')}
                      />
                    </Box>
                    <TextField
                      label={
                        row.hasKey
                          ? t('welcomeGuide.activities.apiKeySet', 'Clé API (déjà configurée)')
                          : t('welcomeGuide.activities.apiKey', 'Clé API')
                      }
                      type="password"
                      value={row.apiKey}
                      onChange={(e) => updateActRow(p.id, { apiKey: e.target.value })}
                      size="small"
                      fullWidth
                      placeholder={row.hasKey ? '••••••••' : ''}
                      sx={{ mb: 1 }}
                    />
                    <TextField
                      label={t('welcomeGuide.activities.affiliateId', 'ID affilié')}
                      value={row.affiliateId}
                      onChange={(e) => updateActRow(p.id, { affiliateId: e.target.value })}
                      size="small"
                      fullWidth
                      sx={{ mb: 1 }}
                    />
                    <Button size="small" variant="contained" onClick={() => saveActProvider(p.id)}>
                      {t('welcomeGuide.actions.save', 'Enregistrer')}
                    </Button>
                  </Box>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActDialog((s) => ({ ...s, open: false }))}>
            {t('welcomeGuide.actions.close', 'Fermer')}
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
