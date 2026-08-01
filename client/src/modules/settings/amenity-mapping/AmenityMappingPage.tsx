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
import StatusChip from '../../../components/StatusChip';
import { cn } from '../../../utils/cn';
import { Badge } from '../../../components/ui';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert, Info } from 'lucide-react';
import { Box, Stack, TextField, InputAdornment, Button, IconButton, Tooltip, Skeleton, Select, MenuItem, FormControl, Checkbox, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
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
import PageTabs from '../../../components/PageTabs';

// Tokens design (cf. CLAUDE.md primary palette)
const ACCENT = 'var(--accent)';
const PRIMARY = 'var(--info)';
const SUCCESS = 'var(--ok)';
const WARN = 'var(--warn)';

// Pastille d'icone cliquable (tabs Custom + Referentiel). Les variantes sont
// deux chaines constantes et non une interpolation : une classe Tailwind est
// emise a la compilation, elle ne peut pas naitre d'une variable.
const CLASS_ICON_BADGE =
  'w-[32px] h-[32px] rounded-[8px] inline-flex items-center justify-center shrink-0 cursor-pointer ' +
  'transition-all duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]';
const CLASS_ICON_BADGE_OVERRIDDEN =
  'bg-[var(--info-soft)] text-[var(--info)] hover:bg-[color-mix(in_srgb,var(--info)_14%,transparent)]';
const CLASS_ICON_BADGE_DEFAULT =
  'bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]';

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
              '&:hover': { borderColor: 'var(--accent-deep)', backgroundColor: 'var(--accent-soft)' },
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
    <div className="p-0 min-[900px]:p-1.5 max-w-[1280px] mx-auto">
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
      <div className="border-b border-[var(--line)] mb-3">
        <PageTabs
          options={[
            { value: 'unmapped' as TabKey, label: 'À mapper', badge: unmapped.length, badgeColor: 'warning' },
            { value: 'aliases' as TabKey, label: 'Mes mappings', badge: aliases.length, badgeColor: 'primary' },
            { value: 'custom' as TabKey, label: 'Commodités custom', badge: customs.length, badgeColor: 'primary' },
            { value: 'ignored' as TabKey, label: 'Ignorés', badge: ignored.length, badgeColor: 'primary' },
            {
              value: 'reference' as TabKey,
              label: t('settings.amenities.tabs.reference', 'Référentiel Baitly'),
              badge: BUILT_IN_AMENITIES.length,
              badgeColor: 'primary',
            },
          ]}
          value={tab}
          onChange={setTab}
          mb={0}
          trail={false}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
            <div className="flex-1" />
            {selectedRaw.size > 0 && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{
                px: 1.5, py: 0.75,
                borderRadius: 1,
                bgcolor: 'var(--accent-soft)',
                border: '1px solid', borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
              }}>
                <span className="cn-text-caption font-semibold" style={{ color: ACCENT }}>
                  {selectedRaw.size} sélectionné{selectedRaw.size > 1 ? 's' : ''}
                </span>
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
                          <StatusChip tokens={{ color: PRIMARY, bg: 'var(--info-soft)' }} label="custom" className="ms-1 h-[16px] text-[0.6rem]" />
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
                  sx={{ textTransform: 'none' }}
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
              <div key={a.id} className={CLASS_LIST_ROW}>
                <div className="flex-1 min-w-0">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <p className="cn-text-body1 font-mono text-[0.85rem] font-medium">
                      {a.rawOtaName}
                    </p>
                    <span className="cn-text-caption text-muted-foreground opacity-60">→</span>
                    <StatusChip tokens={{ color: SUCCESS, bg: 'var(--ok-soft)' }} label={codeLabelOf(a.clenzyCode)} className="text-[0.7rem]" />
                    {a.otaSource && (
                      <Badge variant="secondary" className="h-[18px] text-[0.65rem] bg-[var(--hover)] text-[var(--muted)]">{a.otaSource}</Badge>
                    )}
                  </Stack>
                  <span className="cn-text-caption text-muted-foreground opacity-60 block mt-0.5">
                    Créé le {new Date(a.createdAt).toLocaleDateString('fr-FR')}
                    {a.createdByEmail && ` · par ${a.createdByEmail}`}
                  </span>
                </div>
                <IconButton size="small" onClick={() => handleDeleteAlias(a.id)} sx={{ color: 'var(--err)' }}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
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
              sx={{ textTransform: 'none' }}
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
                <div key={c.id} className={CLASS_LIST_ROW}>
                  {/* Icone (cliquable = ouvre le picker) — meme pattern que tab Reference */}
                  <Tooltip title={t('settings.amenities.changeIcon', "Changer l'icône")} arrow>
                    <div
                      onClick={() => setIconPicker({ open: true, code: c.code, label: c.labelFr })}
                      className={cn(CLASS_ICON_BADGE, isOverridden ? CLASS_ICON_BADGE_OVERRIDDEN : CLASS_ICON_BADGE_DEFAULT)}
                    >
                      <Icon size={18} strokeWidth={1.75} />
                    </div>
                  </Tooltip>

                  <div className="flex-1 min-w-0">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <p className="cn-text-body1 text-[0.9rem] font-semibold">{c.labelFr}</p>
                      {c.labelEn && (
                        <span className="cn-text-caption text-muted-foreground">/ {c.labelEn}</span>
                      )}
                      <StatusChip size="sm" tokens={{ color: PRIMARY, bg: 'var(--info-soft)' }} label={AMENITY_CATEGORY_LABELS[c.category as AmenityCategory] ?? c.category} className="text-[0.65rem]" />
                    </Stack>
                    <span className="cn-text-caption block font-mono text-muted-foreground opacity-60 mt-0.5">
                      {c.code}
                    </span>
                  </div>

                  {/* Reset icon (uniquement si override actif) */}
                  {isOverridden && (
                    <Tooltip title={t('settings.amenities.iconPicker.resetToDefault', "Revenir à l'icône par défaut")} arrow>
                      <IconButton
                        size="small"
                        onClick={() => resetIconOverride(c.code)}
                        aria-label={t('settings.amenities.resetIcon', "Réinitialiser l'icône")}
                        sx={{
                          width: 22, height: 22, cursor: 'pointer', color: 'text.secondary',
                          '&:hover': { color: PRIMARY, backgroundColor: 'var(--info-soft)' },
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
                    sx={{ cursor: 'pointer', color: 'var(--err)' }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
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
              <div key={i.id} className={CLASS_LIST_ROW}>
                <div className="flex-1 min-w-0">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Ban size={14} color="var(--faint)" />
                    <p className="cn-text-body1 font-mono text-[0.85rem]">{i.rawOtaName}</p>
                    {i.otaSource && (
                      <Badge variant="secondary" className="h-[18px] text-[0.65rem] bg-[var(--hover)] text-[var(--muted)]">{i.otaSource}</Badge>
                    )}
                  </Stack>
                </div>
                <Tooltip title={t('settings.amenities.ignored.reintroduce', 'Réintroduire dans la liste à mapper')}>
                  <IconButton size="small" onClick={() => handleDeleteIgnored(i.id)} sx={{ color: ACCENT }}>
                    <RotateCcw size={14} />
                  </IconButton>
                </Tooltip>
              </div>
            ))
          )}
        </Stack>
      )}

      {/* TAB : Référentiel Baitly (grille compacte avec icones editables) ─── */}
      {tab === 'reference' && (
        <Stack spacing={2}>
          <Alert variant="info" className="text-[0.78rem] py-0.5">
            <Info />
            <AlertDescription>{t(
              'settings.amenities.reference.intro',
              "Référentiel Baitly : {{count}} commodités prêtes à l'emploi. Cliquez sur une icône pour la personnaliser (catalogue lucide-react, ~80 icônes). Le code de la commodité reste invariant — seule l'icône change.",
              { count: BUILT_IN_AMENITIES.length },
            )}</AlertDescription>
          </Alert>

          {(['comfort', 'kitchen', 'appliances', 'outdoor', 'safetyFamily'] as AmenityCategory[]).map((cat) => {
            const items = BUILT_IN_AMENITIES.filter((a) => a.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.875 }}>
                  <p className="cn-text-body1 text-[0.78rem] font-semibold text-foreground">
                    {AMENITY_CATEGORY_LABELS[cat]}
                  </p>
                  <StatusChip size="sm" tokens={{ color: PRIMARY, bg: 'var(--info-soft)' }} label={items.length} className="text-[0.65rem]" />
                </Stack>
                <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[repeat(2,_1fr)] min-[900px]:grid-cols-[repeat(3,_1fr)] min-[1200px]:grid-cols-[repeat(4,_1fr)] gap-1.5">
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
                          <div
                            onClick={() => setIconPicker({ open: true, code: a.code, label })}
                            className={cn(CLASS_ICON_BADGE, isOverridden ? CLASS_ICON_BADGE_OVERRIDDEN : CLASS_ICON_BADGE_DEFAULT)}
                          >
                            <Icon size={18} strokeWidth={1.75} />
                          </div>
                        </Tooltip>

                        {/* Label + code */}
                        <div className="flex-1 min-w-0">
                          <p className="cn-text-body1 text-[0.82rem] font-medium text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                            {label}
                          </p>
                          <span
                            className="cn-text-caption block text-[0.65rem] text-[var(--faint)] leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap"
                            style={{ fontFamily: '"SF Mono", Menlo, Consolas, monospace' }}
                          >
                            {a.code}
                          </span>
                        </div>

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
                                  '&:hover': { color: PRIMARY, backgroundColor: 'var(--info-soft)' },
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
                                '&:hover': { color: ACCENT, backgroundColor: 'var(--accent-soft)' },
                              }}
                            >
                              <Pencil size={12} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    );
                  })}
                </div>
              </div>
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
          <h6 className="cn-text-subtitle1 font-semibold">Re-traiter les propriétés ?</h6>
        </DialogTitle>
        <DialogContent>
          <p className="cn-text-body2 text-muted-foreground">
            Cette action applique <strong>{aliases.length}</strong> alias et <strong>{ignored.length}</strong> ignored à
            toutes les propriétés de votre organisation. Les commodités OTA brutes seront soit converties en codes
            Baitly, soit retirées si ignorées. Sans effet sur les amenities déjà mappées manuellement.
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setConfirmReprocess(false)} size="small"
                  sx={{ textTransform: 'none', color: 'text.secondary' }}>Annuler</Button>
          <Button variant="contained" size="small" onClick={handleReprocess}
                  sx={{ textTransform: 'none' }}>
            Re-traiter
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmRescrape} onClose={() => setConfirmRescrape(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5 }}>
          <Sparkles size={18} color="#8B5CF6" />
          <h6 className="cn-text-subtitle1 font-semibold">Re-scrape les pages Airbnb ?</h6>
        </DialogTitle>
        <DialogContent>
          <p className="cn-text-body2 text-muted-foreground">
            Cette action <strong>re-télécharge la page publique Airbnb</strong> de chaque propriété
            de votre organisation pour récupérer le nom à jour + les commodités JSON-LD,
            puis applique automatiquement vos {aliases.length} alias et {ignored.length} ignored.
          </p>
          <span className="cn-text-caption text-muted-foreground opacity-60 block mt-2">
            Peut prendre quelques secondes par propriété (1 HTTP GET vers airbnb.com).
            Les amenities déjà cochées manuellement sont préservées.
          </span>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setConfirmRescrape(false)} size="small"
                  sx={{ textTransform: 'none', color: 'text.secondary' }}>Annuler</Button>
          <Button variant="contained" size="small" onClick={handleRescrape}
                  sx={{ textTransform: 'none' }}>
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
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const CLASS_LIST_ROW =
  'flex items-center gap-[9px] px-3 py-[7.5px] rounded-[12px] ' +
  'border border-solid border-[var(--line)] bg-[var(--surface-2)] ' +
  'transition-all duration-[180ms] ease-out ' +
  'hover:border-[color-mix(in_srgb,var(--accent)_25%,transparent)]';

function KpiTile({ label, value, color, loading }: {
  label: string; value: number; color: string; loading: boolean;
}) {
  return (
    <div className="flex-[1_1_180px] min-w-[140px] px-3 py-[9px] rounded-[12px] border border-solid border-[var(--line)] bg-[var(--card)]">
      <span className="cn-text-caption text-muted-foreground block mb-0.5">
        {label}
      </span>
      {loading ? (
        <Skeleton width={40} height={32} />
      ) : (
        // `color` vient des props : une classe Tailwind ne peut pas naitre
        // d'une variable, la teinte passe donc par le style inline.
        <p className="cn-text-body1 text-[1.5rem] font-bold tabular-nums" style={{ color }}>
          {value}
        </p>
      )}
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center py-9 px-[18px] rounded-[12px] border border-dashed border-[var(--line)] bg-[var(--surface-2)]">
      <h6 className="cn-text-subtitle1 font-semibold mb-0.5">{title}</h6>
      <p className="cn-text-body2 text-muted-foreground">{subtitle}</p>
    </div>
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
    <div className={cn(
      'flex items-center gap-[9px] px-[9px] py-[9px] rounded-[12px] border border-solid',
      'transition-all duration-[180ms] ease-out',
      'hover:border-[color-mix(in_srgb,var(--accent)_25%,transparent)]',
      selected
        ? 'border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[var(--accent-soft)]'
        : 'border-[var(--line)] bg-[var(--card)]',
    )}>
      <Checkbox
        size="small"
        checked={selected}
        onChange={(e) => onToggleSelect(e.target.checked)}
        sx={{ p: 0.5, color: ACCENT, '&.Mui-checked': { color: ACCENT } }}
      />
      <div className="flex-1 min-w-0">
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
          <p className="cn-text-body1 font-mono text-[0.9rem] font-medium me-0.5">
            {item.rawOtaName}
          </p>
          {item.otaSources[0] && item.otaSources[0] !== 'OTA' && (
            <Badge variant="secondary" className="h-[18px] text-[0.65rem] bg-[var(--hover)] text-[var(--muted)]">{item.otaSources[0]}</Badge>
          )}
          <Badge variant="secondary" className="h-[18px] text-[0.65rem] bg-[var(--warn-soft)] text-[var(--warn)]">{`${item.occurrences} propriété${item.occurrences > 1 ? 's' : ''}`}</Badge>
        </Stack>
        {item.affectedProperties.length > 0 && (
          <span className="cn-text-caption text-muted-foreground truncate">
            {item.affectedProperties.slice(0, 3).map((p) => p.name).join(' · ')}
            {item.affectedProperties.length < item.occurrences
              && `, +${item.occurrences - item.affectedProperties.length} autre${item.occurrences - item.affectedProperties.length > 1 ? 's' : ''}`}
          </span>
        )}
      </div>
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
                  <StatusChip tokens={{ color: PRIMARY, bg: 'var(--info-soft)' }} label="custom" className="ms-1 h-[16px] text-[0.6rem]" />
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="Créer une nouvelle commodité Baitly à partir de ce nom">
          <IconButton size="small" onClick={onCreateCustom}
                      sx={{ color: ACCENT, border: '1px solid', borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)' }}>
            <Plus size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Ignorer définitivement (sera masqué et retiré des propriétés)">
          <IconButton size="small" onClick={onIgnore} sx={{ color: 'text.secondary' }}>
            <Ban size={14} />
          </IconButton>
        </Tooltip>
      </Stack>
    </div>
  );
}
