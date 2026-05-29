/**
 * Settings → Commodités OTA
 *
 * Page de gestion du mapping entre les amenities OTA brutes (detectees a
 * l'import depuis Channex) et le referentiel Baitly + custom amenities.
 *
 * 5 onglets :
 *   - "À mapper" : amenities OTA detectees sans alias ni ignored (focus principal)
 *   - "Mes mappings" : aliases rawName → code Baitly deja crees
 *   - "Commodites custom" : commodites Baitly custom definies par l'org
 *   - "Ignores" : amenities marquees comme a masquer definitivement
 *   - "Referentiel Baitly" : commodites built-in disponibles (lecture seule)
 *     -> permet de savoir quelles commodites existent deja avant de creer un custom
 *
 * Header avec 4 KPI tuiles (À mapper / Aliases / Custom / Properties affectees).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Stack,
  TextField,
  InputAdornment,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Skeleton,
  Alert,
  Select,
  MenuItem,
  FormControl,
  Checkbox,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search,
  Plus,
  Ban,
  Trash2,
  RotateCcw,
  Wand2,
  AlertCircle,
  Sparkles,
  Pencil,
} from 'lucide-react';
import AmenityIconPicker from './AmenityIconPicker';
import { resolveAmenityIcon, getCurrentIconName, DEFAULT_AMENITY_ICONS } from './amenityIcons';
import { useAmenityIconOverrides } from './useAmenityIconOverrides';
import { useAuth } from '../../../hooks/useAuth';
import { useSettingsHeaderActions } from '../SettingsHeaderContext';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  amenitiesManagementApi,
  type AmenityAliasDto,
  type CustomAmenityDto,
  type IgnoredAmenityDto,
  type ReprocessResult,
  type UnmappedAmenityDto,
} from '../../../services/api/amenitiesManagementApi';
import { channexApi } from '../../../services/api/channexApi';
import {
  BUILT_IN_AMENITIES,
  AMENITY_CATEGORY_LABELS,
  type AmenityCategory,
} from '../../../utils/amenities';
import CreateCustomAmenityModal from './CreateCustomAmenityModal';

// Tokens design (cf. CLAUDE.md primary palette)
const ACCENT = '#0F766E';
const PRIMARY = '#6B8A9A';
const SUCCESS = '#10B981';
const WARN = '#F59E0B';
const SURFACE = '#FAFAFA';

type TabKey = 'unmapped' | 'aliases' | 'custom' | 'ignored' | 'reference';

export default function AmenityMappingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const orgId = user?.organizationId ?? null;
  const { overrides: iconOverrides, setIcon: setIconOverride, resetIcon: resetIconOverride } =
    useAmenityIconOverrides(orgId);
  const [iconPicker, setIconPicker] = useState<{ open: boolean; code: string; label: string } | null>(null);
  const [tab, setTab] = useState<TabKey>('unmapped');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [unmapped, setUnmapped] = useState<UnmappedAmenityDto[]>([]);
  const [aliases, setAliases] = useState<AmenityAliasDto[]>([]);
  const [customs, setCustoms] = useState<CustomAmenityDto[]>([]);
  const [ignored, setIgnored] = useState<IgnoredAmenityDto[]>([]);

  const [search, setSearch] = useState('');
  const [selectedRaw, setSelectedRaw] = useState<Set<string>>(new Set());
  const [bulkCode, setBulkCode] = useState<string>('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const [createModal, setCreateModal] = useState<{
    open: boolean;
    prefillRawName: string | null;
    prefillAffectedCount: number;
  }>({ open: false, prefillRawName: null, prefillAffectedCount: 0 });

  const [confirmReprocess, setConfirmReprocess] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [confirmRescrape, setConfirmRescrape] = useState(false);
  const [rescraping, setRescraping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ─── Data loading ─────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, a, c, i] = await Promise.all([
        amenitiesManagementApi.listUnmapped(),
        amenitiesManagementApi.listAliases(),
        amenitiesManagementApi.listCustom(),
        amenitiesManagementApi.listIgnored(),
      ]);
      setUnmapped(u);
      setAliases(a);
      setCustoms(c);
      setIgnored(i);
      setSelectedRaw(new Set());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors du chargement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // ─── Derived ──────────────────────────────────────────────────────────
  const totalAffectedProperties = useMemo(() => {
    const ids = new Set<number>();
    for (const u of unmapped) for (const p of u.affectedProperties) ids.add(p.id);
    return ids.size;
  }, [unmapped]);

  const filteredUnmapped = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return unmapped;
    return unmapped.filter((u) => u.rawOtaName.toLowerCase().includes(q));
  }, [unmapped, search]);

  /** Toutes les options pour les dropdowns "Mapper sur" : built-in + custom. */
  const allCodeOptions = useMemo(() => {
    const builtIn = BUILT_IN_AMENITIES.map((a) => ({
      value: a.code,
      label: t(`properties.amenities.items.${a.i18nKey}`),
      category: a.category as AmenityCategory,
      isCustom: false,
    }));
    const custom = customs.map((c) => ({
      value: c.code,
      label: c.labelFr,
      category: (c.category as AmenityCategory) ?? 'custom',
      isCustom: true,
    }));
    return [...builtIn, ...custom].sort((a, b) => a.label.localeCompare(b.label));
  }, [customs, t]);

  /** Pour afficher un code Baitly (built-in ou custom) en label humain. */
  const codeLabelOf = useCallback(
    (code: string) => allCodeOptions.find((o) => o.value === code)?.label ?? code,
    [allCodeOptions],
  );

  // ─── Actions ──────────────────────────────────────────────────────────
  const handleMapSingle = async (raw: UnmappedAmenityDto, code: string) => {
    try {
      await amenitiesManagementApi.createAlias({
        rawOtaName: raw.rawOtaName,
        clenzyCode: code,
        otaSource: raw.otaSources[0] ?? undefined,
        applyToProperties: true,
      });
      setToast(`«${raw.rawOtaName}» mappé sur ${codeLabelOf(code)} et appliqué aux ${raw.occurrences} propriété(s)`);
      await loadAll();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : 'Erreur lors du mapping.');
    }
  };

  const handleIgnore = async (raw: UnmappedAmenityDto) => {
    try {
      await amenitiesManagementApi.createIgnored({
        rawOtaName: raw.rawOtaName,
        otaSource: raw.otaSources[0] ?? undefined,
        applyToProperties: true,
      });
      setToast(`«${raw.rawOtaName}» ignoré`);
      await loadAll();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : 'Erreur lors de l\'ignore.');
    }
  };

  const handleBulkMap = async () => {
    if (!bulkCode || selectedRaw.size === 0) return;
    setBulkBusy(true);
    try {
      const sample = unmapped.find((u) => selectedRaw.has(u.rawOtaName));
      const result = await amenitiesManagementApi.bulkCreateAliases({
        clenzyCode: bulkCode,
        rawOtaNames: Array.from(selectedRaw),
        otaSource: sample?.otaSources[0] ?? undefined,
        applyToProperties: true,
      });
      setToast(`${selectedRaw.size} aliases créés → ${result.totalMappedAdded} amenities ajoutées sur ${result.propertiesUpdated} propriété(s)`);
      setSelectedRaw(new Set());
      setBulkCode('');
      await loadAll();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : 'Erreur lors du bulk mapping.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDeleteAlias = async (id: number) => {
    try {
      await amenitiesManagementApi.deleteAlias(id);
      setToast('Alias supprimé');
      await loadAll();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    }
  };

  const handleDeleteCustom = async (id: number) => {
    try {
      await amenitiesManagementApi.deleteCustom(id);
      setToast('Commodité custom supprimée (et ses aliases associés)');
      await loadAll();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    }
  };

  const handleDeleteIgnored = async (id: number) => {
    try {
      await amenitiesManagementApi.deleteIgnored(id);
      setToast('Retiré de la liste des ignorés');
      await loadAll();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    }
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    setConfirmReprocess(false);
    try {
      const r: ReprocessResult = await amenitiesManagementApi.reprocess();
      setToast(
        `Re-traitement terminé : ${r.propertiesUpdated}/${r.propertiesScanned} propriétés mises à jour `
        + `(${r.totalMappedAdded} mappées, ${r.totalIgnoredRemoved} ignorées, ${r.totalLeftUnmapped} restantes)`,
      );
      await loadAll();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : 'Erreur lors du re-traitement.');
    } finally {
      setReprocessing(false);
    }
  };

  const handleRescrape = async () => {
    setRescraping(true);
    setConfirmRescrape(false);
    try {
      const results = await channexApi.resyncAllContent();
      const totalMapped = results.reduce((sum, r) => sum + r.mappedAmenities.length, 0);
      const totalRaw = results.reduce((sum, r) => sum + r.rawAmenitiesRemaining.length, 0);
      setToast(
        `Re-scrape terminé sur ${results.length} propriété(s) : `
        + `${totalMapped} commodités mappées, ${totalRaw} brutes restent à mapper.`,
      );
      await loadAll();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : 'Erreur lors du re-scrape.');
    } finally {
      setRescraping(false);
    }
  };

  // Boutons d'action portales dans le PageHeader de Settings (titre +
  // description sont aussi fournis par Settings via SETTINGS_TAB_META).
  // Voir SettingsHeaderContext.tsx pour le pattern.
  const headerActionsPortal = useSettingsHeaderActions(
    <>
      <Tooltip title="Re-scrape Airbnb pour TOUTES vos propriétés importées (récupère nom + commodités fraîches)" arrow>
        <span>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Sparkles size={14} />}
            onClick={() => setConfirmRescrape(true)}
            disabled={rescraping}
            sx={{
              textTransform: 'none',
              borderColor: '#8B5CF6',
              color: '#8B5CF6',
              '&:hover': { borderColor: '#7C3AED', backgroundColor: 'rgba(139, 92, 246, 0.04)' },
            }}
          >
            {rescraping ? 'Re-scrape en cours…' : 'Re-scrape OTA'}
          </Button>
        </span>
      </Tooltip>
      <Tooltip title="Applique tous vos aliases + ignored sur les propriétés existantes (utile après modifications)" arrow>
        <span>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RotateCcw size={14} />}
            onClick={() => setConfirmReprocess(true)}
            disabled={reprocessing || (aliases.length === 0 && ignored.length === 0)}
            sx={{
              textTransform: 'none',
              borderColor: ACCENT,
              color: ACCENT,
              '&:hover': { borderColor: '#0d645e', backgroundColor: 'rgba(15, 118, 110, 0.04)' },
            }}
          >
            Re-traiter
          </Button>
        </span>
      </Tooltip>
    </>
  );

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 0, md: 1 }, maxWidth: 1280, mx: 'auto' }}>
      {/* Header (titre + actions) deporte dans le PageHeader Settings via portal */}
      {headerActionsPortal}

      {/* KPIs */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ mb: 3, flexWrap: 'wrap', gap: 1.5 }}
      >
        <KpiTile label="À mapper"        value={unmapped.length}                color={WARN}    loading={loading} />
        <KpiTile label="Mappings actifs" value={aliases.length}                  color={SUCCESS} loading={loading} />
        <KpiTile label="Custom"          value={customs.length}                  color={PRIMARY} loading={loading} />
        <KpiTile label="Propriétés concernées" value={totalAffectedProperties}  color={ACCENT}  loading={loading} />
      </Stack>

      {/* Tabs */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_e, v) => setTab(v as TabKey)}
          textColor="primary"
          sx={{
            minHeight: 38,
            '& .MuiTab-root': { minHeight: 38, textTransform: 'none', fontSize: '0.85rem' },
            '& .Mui-selected': { color: ACCENT },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 2 },
          }}
        >
          <Tab label={`À mapper (${unmapped.length})`} value="unmapped" />
          <Tab label={`Mes mappings (${aliases.length})`} value="aliases" />
          <Tab label={`Commodités custom (${customs.length})`} value="custom" />
          <Tab label={`Ignorés (${ignored.length})`} value="ignored" />
          <Tab label={`${t('settings.amenities.tabs.reference', 'Référentiel Baitly')} (${BUILT_IN_AMENITIES.length})`} value="reference" />
        </Tabs>
      </Box>

      {error && (
        <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* TAB : À mapper ─────────────────────────────────────────────── */}
      {tab === 'unmapped' && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 240 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={14} />
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ flex: 1 }} />
            {selectedRaw.size > 0 && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{
                px: 1.5, py: 0.75,
                borderRadius: 1,
                bgcolor: 'rgba(15, 118, 110, 0.06)',
                border: '1px solid', borderColor: 'rgba(15, 118, 110, 0.2)',
              }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: ACCENT }}>
                  {selectedRaw.size} sélectionné{selectedRaw.size > 1 ? 's' : ''}
                </Typography>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <Select
                    value={bulkCode}
                    onChange={(e) => setBulkCode(e.target.value)}
                    displayEmpty
                    sx={{ fontSize: '0.8rem' }}
                    renderValue={(v) => v ? codeLabelOf(v) : 'Mapper la sélection sur…'}
                  >
                    <MenuItem value="" disabled sx={{ fontSize: '0.85rem' }}>
                      Mapper sur…
                    </MenuItem>
                    {allCodeOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.85rem' }}>
                        {opt.label}
                        {opt.isCustom && (
                          <Chip size="small" label="custom"
                                sx={{ ml: 0.75, height: 16, fontSize: '0.6rem',
                                      bgcolor: 'rgba(107, 138, 154, 0.15)', color: PRIMARY }} />
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleBulkMap}
                  disabled={!bulkCode || bulkBusy}
                  startIcon={<Wand2 size={14} />}
                  sx={{
                    backgroundColor: ACCENT,
                    '&:hover': { backgroundColor: '#0d645e' },
                    textTransform: 'none',
                  }}
                >
                  Appliquer
                </Button>
              </Stack>
            )}
          </Stack>

          {loading ? (
            <Stack spacing={1}>
              <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
              <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
              <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
            </Stack>
          ) : filteredUnmapped.length === 0 ? (
            <EmptyState
              title={search.trim() ? 'Aucun résultat' : 'Toutes vos commodités sont mappées'}
              subtitle={search.trim()
                ? 'Aucune amenity OTA ne correspond à votre recherche.'
                : 'Les commodités détectées sur vos listings OTA ont toutes un mapping. Bien joué.'}
            />
          ) : (
            <Stack spacing={1}>
              {filteredUnmapped.map((u) => (
                <UnmappedRow
                  key={u.rawOtaName}
                  item={u}
                  selected={selectedRaw.has(u.rawOtaName)}
                  onToggleSelect={(v) => {
                    setSelectedRaw((prev) => {
                      const n = new Set(prev);
                      if (v) n.add(u.rawOtaName); else n.delete(u.rawOtaName);
                      return n;
                    });
                  }}
                  allCodeOptions={allCodeOptions}
                  onMap={(code) => handleMapSingle(u, code)}
                  onCreateCustom={() => setCreateModal({
                    open: true,
                    prefillRawName: u.rawOtaName,
                    prefillAffectedCount: u.occurrences,
                  })}
                  onIgnore={() => handleIgnore(u)}
                />
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {/* TAB : Mes mappings ─────────────────────────────────────────── */}
      {tab === 'aliases' && (
        <Stack spacing={1}>
          {loading ? (
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
          ) : aliases.length === 0 ? (
            <EmptyState
              title="Aucun mapping créé"
              subtitle="Quand vous mappez une amenity OTA, elle apparaît ici."
            />
          ) : (
            aliases.map((a) => (
              <Box key={a.id} sx={SX_LIST_ROW}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 500 }}>
                      {a.rawOtaName}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">→</Typography>
                    <Chip
                      size="small"
                      label={codeLabelOf(a.clenzyCode)}
                      sx={{ height: 22, fontSize: '0.7rem', bgcolor: 'rgba(16, 185, 129, 0.1)', color: SUCCESS }}
                    />
                    {a.otaSource && (
                      <Chip size="small" label={a.otaSource}
                            sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(0,0,0,0.05)', color: 'text.secondary' }} />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                    Créé le {new Date(a.createdAt).toLocaleDateString('fr-FR')}
                    {a.createdByEmail && ` · par ${a.createdByEmail}`}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => handleDeleteAlias(a.id)} sx={{ color: '#EF4444' }}>
                  <Trash2 size={14} />
                </IconButton>
              </Box>
            ))
          )}
        </Stack>
      )}

      {/* TAB : Custom ────────────────────────────────────────────────── */}
      {tab === 'custom' && (
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={14} />}
              onClick={() => setCreateModal({ open: true, prefillRawName: null, prefillAffectedCount: 0 })}
              sx={{
                backgroundColor: ACCENT,
                '&:hover': { backgroundColor: '#0d645e' },
                textTransform: 'none',
              }}
            >
              Nouvelle commodité
            </Button>
          </Stack>
          {loading ? (
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
          ) : customs.length === 0 ? (
            <EmptyState
              title={t('settings.amenities.custom.emptyTitle', 'Aucune commodité custom')}
              subtitle={t('settings.amenities.custom.emptySubtitle', 'Créez vos propres commodités quand le référentiel Baitly ne couvre pas un équipement.')}
            />
          ) : (
            customs.map((c) => {
              const Icon = resolveAmenityIcon(c.code, iconOverrides);
              const isOverridden = c.code in iconOverrides;
              return (
                <Box key={c.id} sx={SX_LIST_ROW}>
                  {/* Icone (cliquable = ouvre le picker) — meme pattern que tab Reference */}
                  <Tooltip title={t('settings.amenities.changeIcon', "Changer l'icône")} arrow>
                    <Box
                      onClick={() => setIconPicker({ open: true, code: c.code, label: c.labelFr })}
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: isOverridden ? `${PRIMARY}14` : `${ACCENT}14`,
                        color: isOverridden ? PRIMARY : ACCENT,
                        flexShrink: 0,
                        cursor: 'pointer',
                        transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                        '&:hover': {
                          bgcolor: isOverridden ? `${PRIMARY}24` : `${ACCENT}24`,
                        },
                      }}
                    >
                      <Icon size={18} strokeWidth={1.75} />
                    </Box>
                  </Tooltip>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{c.labelFr}</Typography>
                      {c.labelEn && (
                        <Typography variant="caption" color="text.secondary">/ {c.labelEn}</Typography>
                      )}
                      <Chip size="small"
                            label={AMENITY_CATEGORY_LABELS[c.category as AmenityCategory] ?? c.category}
                            sx={{ height: 18, fontSize: '0.65rem',
                                  bgcolor: 'rgba(107, 138, 154, 0.15)', color: PRIMARY }} />
                    </Stack>
                    <Typography variant="caption" sx={{
                      display: 'block', fontFamily: 'monospace', color: 'text.disabled', mt: 0.25,
                    }}>
                      {c.code}
                    </Typography>
                  </Box>

                  {/* Reset icon (uniquement si override actif) */}
                  {isOverridden && (
                    <Tooltip title={t('settings.amenities.iconPicker.resetToDefault', "Revenir à l'icône par défaut")} arrow>
                      <IconButton
                        size="small"
                        onClick={() => resetIconOverride(c.code)}
                        aria-label={t('settings.amenities.resetIcon', "Réinitialiser l'icône")}
                        sx={{
                          width: 22, height: 22, cursor: 'pointer', color: 'text.secondary',
                          '&:hover': { color: PRIMARY, backgroundColor: `${PRIMARY}0F` },
                        }}
                      >
                        <RotateCcw size={12} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                  )}

                  <IconButton
                    size="small"
                    onClick={() => handleDeleteCustom(c.id)}
                    aria-label={t('common.delete', 'Supprimer')}
                    sx={{ cursor: 'pointer', color: '#EF4444' }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </Box>
              );
            })
          )}
        </Stack>
      )}

      {/* TAB : Ignored ───────────────────────────────────────────────── */}
      {tab === 'ignored' && (
        <Stack spacing={1}>
          {loading ? (
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
          ) : ignored.length === 0 ? (
            <EmptyState
              title={t('settings.amenities.ignored.emptyTitle', 'Aucune amenity ignorée')}
              subtitle={t('settings.amenities.ignored.emptySubtitle', 'Marquez « Ignorer » sur une amenity OTA pour la masquer définitivement.')}
            />
          ) : (
            ignored.map((i) => (
              <Box key={i.id} sx={SX_LIST_ROW}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Ban size={14} color="#9CA3AF" />
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{i.rawOtaName}</Typography>
                    {i.otaSource && (
                      <Chip size="small" label={i.otaSource}
                            sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(0,0,0,0.05)', color: 'text.secondary' }} />
                    )}
                  </Stack>
                </Box>
                <Tooltip title={t('settings.amenities.ignored.reintroduce', 'Réintroduire dans la liste à mapper')}>
                  <IconButton size="small" onClick={() => handleDeleteIgnored(i.id)} sx={{ color: ACCENT }}>
                    <RotateCcw size={14} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))
          )}
        </Stack>
      )}

      {/* TAB : Référentiel Baitly (grille compacte avec icones editables) ─── */}
      {tab === 'reference' && (
        <Stack spacing={2}>
          <Alert severity="info" variant="outlined" sx={{ borderRadius: 1, fontSize: '0.78rem', py: 0.5 }}>
            {t(
              'settings.amenities.reference.intro',
              "Référentiel Baitly : {{count}} commodités prêtes à l'emploi. Cliquez sur une icône pour la personnaliser (catalogue lucide-react, ~80 icônes). Le code de la commodité reste invariant — seule l'icône change.",
              { count: BUILT_IN_AMENITIES.length },
            )}
          </Alert>

          {(['comfort', 'kitchen', 'appliances', 'outdoor', 'safetyFamily'] as AmenityCategory[]).map((cat) => {
            const items = BUILT_IN_AMENITIES.filter((a) => a.category === cat);
            if (items.length === 0) return null;
            return (
              <Box key={cat}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.875 }}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.primary' }}>
                    {AMENITY_CATEGORY_LABELS[cat]}
                  </Typography>
                  <Chip
                    size="small"
                    label={items.length}
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      bgcolor: 'rgba(107,138,154,0.12)',
                      color: PRIMARY,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: 1,
                  }}
                >
                  {items.map((a) => {
                    const Icon = resolveAmenityIcon(a.code, iconOverrides);
                    const isOverridden = a.code in iconOverrides && iconOverrides[a.code] !== DEFAULT_AMENITY_ICONS[a.code];
                    const label = t(`properties.amenities.items.${a.i18nKey}`);
                    return (
                      <Box
                        key={a.code}
                        sx={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          px: 1.25,
                          py: 0.875,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          backgroundColor: 'background.paper',
                          transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                          '&:hover': {
                            borderColor: ACCENT,
                            '& .icon-edit-btn': { opacity: 1 },
                          },
                        }}
                      >
                        {/* Icone (cliquable = ouvre le picker) */}
                        <Tooltip title={t('settings.amenities.changeIcon', "Changer l'icône")} arrow>
                          <Box
                            onClick={() => setIconPicker({ open: true, code: a.code, label })}
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: isOverridden ? `${PRIMARY}14` : `${ACCENT}14`,
                              color: isOverridden ? PRIMARY : ACCENT,
                              flexShrink: 0,
                              cursor: 'pointer',
                              transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                              '&:hover': {
                                bgcolor: isOverridden ? `${PRIMARY}24` : `${ACCENT}24`,
                              },
                            }}
                          >
                            <Icon size={18} strokeWidth={1.75} />
                          </Box>
                        </Tooltip>

                        {/* Label + code */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontSize: '0.82rem',
                              fontWeight: 500,
                              color: 'text.primary',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {label}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              fontFamily: '"SF Mono", Menlo, Consolas, monospace',
                              fontSize: '0.65rem',
                              color: 'text.disabled',
                              lineHeight: 1.3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {a.code}
                          </Typography>
                        </Box>

                        {/* Edit pencil (visible au hover) + badge override si actif */}
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                          {isOverridden && (
                            <Tooltip title={t('settings.amenities.reference.customizedTooltip', "Icône personnalisée — revenir à l'icône par défaut")} arrow>
                              <IconButton
                                size="small"
                                onClick={() => resetIconOverride(a.code)}
                                aria-label={t('settings.amenities.resetIcon', "Réinitialiser l'icône")}
                                sx={{
                                  width: 22,
                                  height: 22,
                                  cursor: 'pointer',
                                  color: 'text.secondary',
                                  '&:hover': { color: PRIMARY, backgroundColor: `${PRIMARY}0F` },
                                }}
                              >
                                <RotateCcw size={12} strokeWidth={1.75} />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title={t('settings.amenities.changeIcon', "Changer l'icône")} arrow>
                            <IconButton
                              className="icon-edit-btn"
                              size="small"
                              onClick={() => setIconPicker({ open: true, code: a.code, label })}
                              aria-label={t('settings.amenities.changeIcon', "Changer l'icône")}
                              sx={{
                                width: 22,
                                height: 22,
                                opacity: 0,
                                cursor: 'pointer',
                                color: 'text.secondary',
                                transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                                '&:hover': { color: ACCENT, backgroundColor: `${ACCENT}0F` },
                              }}
                            >
                              <Pencil size={12} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}

      {/* Dialog : icon picker (catalogue lucide groupé par theme + recherche) */}
      {iconPicker && (
        <AmenityIconPicker
          open={iconPicker.open}
          amenityLabel={iconPicker.label}
          amenityCode={iconPicker.code}
          currentIcon={getCurrentIconName(iconPicker.code, iconOverrides)}
          isOverridden={iconPicker.code in iconOverrides && iconOverrides[iconPicker.code] !== DEFAULT_AMENITY_ICONS[iconPicker.code]}
          onClose={() => setIconPicker(null)}
          onSelect={(iconName) => setIconOverride(iconPicker.code, iconName)}
          onReset={() => resetIconOverride(iconPicker.code)}
        />
      )}

      {/* Modales */}
      <CreateCustomAmenityModal
        open={createModal.open}
        prefillRawName={createModal.prefillRawName}
        prefillAffectedCount={createModal.prefillAffectedCount}
        onClose={() => setCreateModal({ open: false, prefillRawName: null, prefillAffectedCount: 0 })}
        onCreated={() => { void loadAll(); setToast('Commodité créée'); }}
      />

      <Dialog open={confirmReprocess} onClose={() => setConfirmReprocess(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5 }}>
          <AlertCircle size={18} color={WARN} />
          <Typography variant="subtitle1" fontWeight={600}>Re-traiter les propriétés ?</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Cette action applique <strong>{aliases.length}</strong> alias et <strong>{ignored.length}</strong> ignored à
            toutes les propriétés de votre organisation. Les commodités OTA brutes seront soit converties en codes
            Baitly, soit retirées si ignorées. Sans effet sur les amenities déjà mappées manuellement.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setConfirmReprocess(false)} size="small"
                  sx={{ textTransform: 'none', color: 'text.secondary' }}>Annuler</Button>
          <Button variant="contained" size="small" onClick={handleReprocess}
                  sx={{ backgroundColor: ACCENT, '&:hover': { backgroundColor: '#0d645e' }, textTransform: 'none' }}>
            Re-traiter
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmRescrape} onClose={() => setConfirmRescrape(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5 }}>
          <Sparkles size={18} color="#8B5CF6" />
          <Typography variant="subtitle1" fontWeight={600}>Re-scrape les pages Airbnb ?</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Cette action <strong>re-télécharge la page publique Airbnb</strong> de chaque propriété
            de votre organisation pour récupérer le nom à jour + les commodités JSON-LD,
            puis applique automatiquement vos {aliases.length} alias et {ignored.length} ignored.
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
            Peut prendre quelques secondes par propriété (1 HTTP GET vers airbnb.com).
            Les amenities déjà cochées manuellement sont préservées.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setConfirmRescrape(false)} size="small"
                  sx={{ textTransform: 'none', color: 'text.secondary' }}>Annuler</Button>
          <Button variant="contained" size="small" onClick={handleRescrape}
                  sx={{ backgroundColor: '#8B5CF6', '&:hover': { backgroundColor: '#7C3AED' }, textTransform: 'none' }}>
            Lancer le re-scrape
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={4500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const SX_LIST_ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  px: 2, py: 1.25,
  borderRadius: 1.5,
  border: '1px solid', borderColor: 'divider',
  bgcolor: SURFACE,
  transition: 'all 180ms ease-out',
  '&:hover': { borderColor: 'rgba(15, 118, 110, 0.25)' },
};

function KpiTile({ label, value, color, loading }: {
  label: string; value: number; color: string; loading: boolean;
}) {
  return (
    <Box sx={{
      flex: '1 1 180px', minWidth: 140,
      px: 2, py: 1.5,
      borderRadius: 1.5,
      border: '1px solid', borderColor: 'divider',
      bgcolor: '#FFFFFF',
    }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {loading ? (
        <Skeleton width={40} height={32} />
      ) : (
        <Typography sx={{
          fontSize: '1.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color,
        }}>
          {value}
        </Typography>
      )}
    </Box>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Box sx={{
      textAlign: 'center', py: 6, px: 3,
      borderRadius: 1.5,
      border: '1px dashed', borderColor: 'divider',
      bgcolor: SURFACE,
    }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
    </Box>
  );
}

function UnmappedRow({ item, selected, onToggleSelect, allCodeOptions, onMap, onCreateCustom, onIgnore }: {
  item: UnmappedAmenityDto;
  selected: boolean;
  onToggleSelect: (v: boolean) => void;
  allCodeOptions: { value: string; label: string; isCustom: boolean }[];
  onMap: (code: string) => void;
  onCreateCustom: () => void;
  onIgnore: () => void;
}) {
  const [pendingCode, setPendingCode] = useState<string>('');

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      px: 1.5, py: 1.5,
      borderRadius: 1.5,
      border: '1px solid', borderColor: selected ? 'rgba(15, 118, 110, 0.4)' : 'divider',
      bgcolor: selected ? 'rgba(15, 118, 110, 0.04)' : '#FFFFFF',
      transition: 'all 180ms ease-out',
      '&:hover': { borderColor: 'rgba(15, 118, 110, 0.25)' },
    }}>
      <Checkbox
        size="small"
        checked={selected}
        onChange={(e) => onToggleSelect(e.target.checked)}
        sx={{ p: 0.5, color: ACCENT, '&.Mui-checked': { color: ACCENT } }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
          <Typography sx={{
            fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 500, mr: 0.5,
          }}>
            {item.rawOtaName}
          </Typography>
          {item.otaSources[0] && item.otaSources[0] !== 'OTA' && (
            <Chip size="small" label={item.otaSources[0]}
                  sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(0,0,0,0.05)', color: 'text.secondary' }} />
          )}
          <Chip size="small" label={`${item.occurrences} propriété${item.occurrences > 1 ? 's' : ''}`}
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(245, 158, 11, 0.12)', color: '#B45309' }} />
        </Stack>
        {item.affectedProperties.length > 0 && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {item.affectedProperties.slice(0, 3).map((p) => p.name).join(' · ')}
            {item.affectedProperties.length < item.occurrences
              && `, +${item.occurrences - item.affectedProperties.length} autre${item.occurrences - item.affectedProperties.length > 1 ? 's' : ''}`}
          </Typography>
        )}
      </Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select
            value={pendingCode}
            onChange={(e) => {
              const code = e.target.value;
              setPendingCode(code);
              if (code) onMap(code);
            }}
            displayEmpty
            sx={{ fontSize: '0.8rem' }}
            renderValue={() => 'Mapper sur…'}
          >
            <MenuItem value="" disabled sx={{ fontSize: '0.85rem' }}>Mapper sur…</MenuItem>
            {allCodeOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.85rem' }}>
                {opt.label}
                {opt.isCustom && (
                  <Chip size="small" label="custom"
                        sx={{ ml: 0.75, height: 16, fontSize: '0.6rem',
                              bgcolor: 'rgba(107, 138, 154, 0.15)', color: PRIMARY }} />
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="Créer une nouvelle commodité Baitly à partir de ce nom">
          <IconButton size="small" onClick={onCreateCustom}
                      sx={{ color: ACCENT, border: '1px solid', borderColor: 'rgba(15, 118, 110, 0.25)' }}>
            <Plus size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Ignorer définitivement (sera masqué et retiré des propriétés)">
          <IconButton size="small" onClick={onIgnore} sx={{ color: 'text.secondary' }}>
            <Ban size={14} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}
