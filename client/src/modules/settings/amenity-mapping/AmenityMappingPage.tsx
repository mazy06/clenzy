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
import EmptyState from '../../../components/EmptyState';
import StatTile from '../../../components/baitly/StatTile';
import { cn } from '../../../utils/cn';
import { Badge, Button, InputGroup, InputGroupAddon, InputGroupInput } from '../../../components/ui';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert, Info } from 'lucide-react';
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Item,
  ItemActions,
  ItemContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
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
  Link2,
  Building2,
  CheckCheck,
} from 'lucide-react';
import AmenityIconPicker from './AmenityIconPicker';
import { resolveAmenityIcon, getCurrentIconName, DEFAULT_AMENITY_ICONS } from './amenityIcons';
import { useAmenityIconOverrides } from './useAmenityIconOverrides';
import { useAuth } from '../../../hooks/useAuth';
import { useNotification } from '../../../hooks/useNotification';
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

// Pastille d'icone cliquable (tabs Custom + Referentiel). Les variantes sont
// deux chaines constantes et non une interpolation : une classe Tailwind est
// emise a la compilation, elle ne peut pas naitre d'une variable.
const CLASS_ICON_BADGE =
  'size-8 rounded-md inline-flex items-center justify-center shrink-0 cursor-pointer ' +
  'transition-colors duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1';
const CLASS_ICON_BADGE_OVERRIDDEN = 'bg-info-soft text-info hover:bg-info/15';
const CLASS_ICON_BADGE_DEFAULT = 'bg-primary-soft text-primary hover:bg-primary/15';

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
  const { notify } = useNotification();

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
      notify.success(`«${raw.rawOtaName}» mappé sur ${codeLabelOf(code)} et appliqué aux ${raw.occurrences} propriété(s)`);
      await loadAll();
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Erreur lors du mapping.');
    }
  };

  const handleIgnore = async (raw: UnmappedAmenityDto) => {
    try {
      await amenitiesManagementApi.createIgnored({
        rawOtaName: raw.rawOtaName,
        otaSource: raw.otaSources[0] ?? undefined,
        applyToProperties: true,
      });
      notify.success(`«${raw.rawOtaName}» ignoré`);
      await loadAll();
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Erreur lors de l\'ignore.');
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
      notify.success(`${selectedRaw.size} aliases créés → ${result.totalMappedAdded} amenities ajoutées sur ${result.propertiesUpdated} propriété(s)`);
      setSelectedRaw(new Set());
      setBulkCode('');
      await loadAll();
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Erreur lors du bulk mapping.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDeleteAlias = async (id: number) => {
    try {
      await amenitiesManagementApi.deleteAlias(id);
      notify.success('Alias supprimé');
      await loadAll();
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    }
  };

  const handleDeleteCustom = async (id: number) => {
    try {
      await amenitiesManagementApi.deleteCustom(id);
      notify.success('Commodité custom supprimée (et ses aliases associés)');
      await loadAll();
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    }
  };

  const handleDeleteIgnored = async (id: number) => {
    try {
      await amenitiesManagementApi.deleteIgnored(id);
      notify.success('Retiré de la liste des ignorés');
      await loadAll();
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    }
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    setConfirmReprocess(false);
    try {
      const r: ReprocessResult = await amenitiesManagementApi.reprocess();
      notify.success(
        `Re-traitement terminé : ${r.propertiesUpdated}/${r.propertiesScanned} propriétés mises à jour `
        + `(${r.totalMappedAdded} mappées, ${r.totalIgnoredRemoved} ignorées, ${r.totalLeftUnmapped} restantes)`,
      );
      await loadAll();
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Erreur lors du re-traitement.');
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
      notify.success(
        `Re-scrape terminé sur ${results.length} propriété(s) : `
        + `${totalMapped} commodités mappées, ${totalRaw} brutes restent à mapper.`,
      );
      await loadAll();
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Erreur lors du re-scrape.');
    } finally {
      setRescraping(false);
    }
  };

  // Boutons d'action portales dans le PageHeader de Settings (titre +
  // description sont aussi fournis par Settings via SETTINGS_TAB_META).
  // Voir SettingsHeaderContext.tsx pour le pattern.
  const headerActionsPortal = useSettingsHeaderActions(
    <>
      <Tooltip>
        {/* Le <span> reste le declencheur : les primitives du kit sont des fonctions
            sans forwardRef (React 18), le tooltip n'aurait pas d'ancre. */}
        <TooltipTrigger asChild>
          <span className="inline-flex">
            {/* Teinte violette conservee : elle distingue le re-scrape (appel sortant
                vers airbnb.com, couteux) du simple re-traitement local juste a cote. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRescrape(true)}
              disabled={rescraping}
              className="border-[#8B5CF6] text-[#8B5CF6] hover:border-[#7C3AED] hover:bg-[color-mix(in_srgb,#8B5CF6_10%,transparent)] hover:text-[#7C3AED]"
            >
              <Sparkles size={14} />
              {rescraping ? 'Re-scrape en cours…' : 'Re-scrape OTA'}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Re-scrape Airbnb pour TOUTES vos propriétés importées (récupère nom + commodités fraîches)
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmReprocess(true)}
              disabled={reprocessing || (aliases.length === 0 && ignored.length === 0)}
            >
              <RotateCcw size={14} />
              Re-traiter
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Applique tous vos aliases + ignored sur les propriétés existantes (utile après modifications)
        </TooltipContent>
      </Tooltip>
    </>
  );

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="p-0 min-[900px]:p-1.5 max-w-[1280px] mx-auto">
      {/* Header (titre + actions) deporte dans le PageHeader Settings via portal */}
      {headerActionsPortal}

      {/* KPIs */}
      <div className="grid grid-cols-2 min-[900px]:grid-cols-4 gap-[9px] mb-[18px]">
        <StatTile icon={<AlertCircle />} label="À mapper" value={unmapped.length} iconClassName="text-warning" loading={loading} />
        <StatTile icon={<Link2 />} label="Mappings actifs" value={aliases.length} iconClassName="text-success" loading={loading} />
        <StatTile icon={<Sparkles />} label="Custom" value={customs.length} iconClassName="text-info" loading={loading} />
        <StatTile icon={<Building2 />} label="Propriétés concernées" value={totalAffectedProperties} iconClassName="text-primary" loading={loading} />
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-3">
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
        <div className="flex flex-col gap-3">
          <div className="flex flex-row flex-wrap items-center gap-1.5">
            {/* Champ sans libelle visible : aria-label sinon le champ n'a plus
                de nom accessible (le placeholder n'en fait pas office). */}
            <InputGroup className="w-auto min-w-[240px]">
              <InputGroupAddon>
                <Search size={14} />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Rechercher une commodité OTA"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
            <div className="flex-1" />
            {selectedRaw.size > 0 && (
              <div className="flex flex-row items-center gap-1.5 px-[9px] py-[4.5px] rounded-md bg-primary-soft border border-solid border-primary/20">
                <span className="text-xs font-semibold text-foreground">
                  {selectedRaw.size} sélectionné{selectedRaw.size > 1 ? 's' : ''}
                </span>
                <Select value={bulkCode} onValueChange={setBulkCode}>
                  <SelectTrigger size="sm" className="min-w-[200px] text-[0.8rem]" aria-label="Mapper la sélection sur">
                    <SelectValue placeholder="Mapper la sélection sur…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCodeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-[0.85rem]">
                        <span className="inline-flex items-center">
                          {opt.label}
                          {opt.isCustom && (
                            <Badge variant="info" className="ms-1 h-[16px] px-1.5 text-[0.6rem]">custom</Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkMap}
                  disabled={!bulkCode || bulkBusy}
                >
                  <Wand2 size={14} />
                  Appliquer
                </Button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          ) : filteredUnmapped.length === 0 ? (
            <EmptyState
              icon={search.trim() ? <Search /> : <CheckCheck />}
              title={search.trim() ? 'Aucun résultat' : 'Toutes vos commodités sont mappées'}
              description={search.trim()
                ? 'Aucune amenity OTA ne correspond à votre recherche.'
                : 'Les commodités détectées sur vos listings OTA ont toutes un mapping. Bien joué.'}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
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
            </div>
          )}
        </div>
      )}

      {/* TAB : Mes mappings ─────────────────────────────────────────── */}
      {tab === 'aliases' && (
        <div className="flex flex-col gap-1.5">
          {loading ? (
            <Skeleton className="h-[300px] rounded-lg" />
          ) : aliases.length === 0 ? (
            <EmptyState
              icon={<Link2 />}
              title="Aucun mapping créé"
              description="Quand vous mappez une amenity OTA, elle apparaît ici."
            />
          ) : (
            aliases.map((a) => (
              <Item key={a.id} variant="outline" size="sm" className={CLASS_LIST_ROW}>
                <ItemContent className="min-w-0 gap-0.5">
                  <div className="flex flex-row items-center gap-1.5">
                    <p className="font-mono text-[0.85rem] font-medium">
                      {a.rawOtaName}
                    </p>
                    <span className="text-xs text-faint">→</span>
                    <Badge variant="success" className="text-[0.7rem]">{codeLabelOf(a.clenzyCode)}</Badge>
                    {a.otaSource && (
                      <Badge variant="secondary" className="h-[18px] text-[0.65rem]">{a.otaSource}</Badge>
                    )}
                  </div>
                  <span className="block text-xs text-faint">
                    Créé le {new Date(a.createdAt).toLocaleDateString('fr-FR')}
                    {a.createdByEmail && ` · par ${a.createdByEmail}`}
                  </span>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteAlias(a.id)}
                    aria-label={t('common.delete', 'Supprimer')}
                    className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </Button>
                </ItemActions>
              </Item>
            ))
          )}
        </div>
      )}

      {/* TAB : Custom ────────────────────────────────────────────────── */}
      {tab === 'custom' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-row justify-end mb-1.5">
            <Button
              variant="default"
              size="sm"
              onClick={() => setCreateModal({ open: true, prefillRawName: null, prefillAffectedCount: 0 })}
            >
              <Plus size={14} />
              Nouvelle commodité
            </Button>
          </div>
          {loading ? (
            <Skeleton className="h-[300px] rounded-lg" />
          ) : customs.length === 0 ? (
            <EmptyState
              icon={<Sparkles />}
              title={t('settings.amenities.custom.emptyTitle', 'Aucune commodité custom')}
              description={t('settings.amenities.custom.emptySubtitle', 'Créez vos propres commodités quand le référentiel Baitly ne couvre pas un équipement.')}
            />
          ) : (
            customs.map((c) => {
              const Icon = resolveAmenityIcon(c.code, iconOverrides);
              const isOverridden = c.code in iconOverrides;
              return (
                <Item key={c.id} variant="outline" size="sm" className={CLASS_LIST_ROW}>
                  {/* Icone (cliquable = ouvre le picker) — meme pattern que tab Reference */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Vrai <button> : un div cliquable ne recoit ni le focus
                          clavier ni Entree/Espace. */}
                      <button
                        type="button"
                        onClick={() => setIconPicker({ open: true, code: c.code, label: c.labelFr })}
                        aria-label={t('settings.amenities.changeIcon', "Changer l'icône")}
                        className={cn(CLASS_ICON_BADGE, isOverridden ? CLASS_ICON_BADGE_OVERRIDDEN : CLASS_ICON_BADGE_DEFAULT)}
                      >
                        <Icon size={18} strokeWidth={1.75} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('settings.amenities.changeIcon', "Changer l'icône")}</TooltipContent>
                  </Tooltip>

                  <ItemContent className="min-w-0 gap-0.5">
                    <div className="flex flex-row items-center gap-1.5">
                      <p className="text-[0.9rem] font-semibold">{c.labelFr}</p>
                      {c.labelEn && (
                        <span className="text-xs text-muted-foreground">/ {c.labelEn}</span>
                      )}
                      <Badge variant="info" className="h-[18px] text-[0.65rem]">
                        {AMENITY_CATEGORY_LABELS[c.category as AmenityCategory] ?? c.category}
                      </Badge>
                    </div>
                    <span className="block font-mono text-xs text-faint">
                      {c.code}
                    </span>
                  </ItemContent>

                  <ItemActions>
                    {/* Reset icon (uniquement si override actif) */}
                    {isOverridden && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => resetIconOverride(c.code)}
                              aria-label={t('settings.amenities.resetIcon', "Réinitialiser l'icône")}
                              className="size-[22px] cursor-pointer text-muted-foreground hover:bg-info-soft hover:text-info"
                            >
                              <RotateCcw size={12} strokeWidth={1.75} />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('settings.amenities.iconPicker.resetToDefault', "Revenir à l'icône par défaut")}
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteCustom(c.id)}
                      aria-label={t('common.delete', 'Supprimer')}
                      className="cursor-pointer text-destructive hover:bg-destructive-soft hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </ItemActions>
                </Item>
              );
            })
          )}
        </div>
      )}

      {/* TAB : Ignored ───────────────────────────────────────────────── */}
      {tab === 'ignored' && (
        <div className="flex flex-col gap-1.5">
          {loading ? (
            <Skeleton className="h-[300px] rounded-lg" />
          ) : ignored.length === 0 ? (
            <EmptyState
              icon={<Ban />}
              title={t('settings.amenities.ignored.emptyTitle', 'Aucune amenity ignorée')}
              description={t('settings.amenities.ignored.emptySubtitle', 'Marquez « Ignorer » sur une amenity OTA pour la masquer définitivement.')}
            />
          ) : (
            ignored.map((i) => (
              <Item key={i.id} variant="outline" size="sm" className={CLASS_LIST_ROW}>
                <ItemContent className="min-w-0">
                  <div className="flex flex-row items-center gap-1.5">
                    <Ban size={14} className="text-faint shrink-0" />
                    <p className="font-mono text-[0.85rem]">{i.rawOtaName}</p>
                    {i.otaSource && (
                      <Badge variant="secondary" className="h-[18px] text-[0.65rem]">{i.otaSource}</Badge>
                    )}
                  </div>
                </ItemContent>
                <ItemActions>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteIgnored(i.id)}
                          aria-label={t('settings.amenities.ignored.reintroduce', 'Réintroduire dans la liste à mapper')}
                          className="text-primary hover:bg-primary-soft hover:text-primary"
                        >
                          <RotateCcw size={14} />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('settings.amenities.ignored.reintroduce', 'Réintroduire dans la liste à mapper')}
                    </TooltipContent>
                  </Tooltip>
                </ItemActions>
              </Item>
            ))
          )}
        </div>
      )}

      {/* TAB : Référentiel Baitly (grille compacte avec icones editables) ─── */}
      {tab === 'reference' && (
        <div className="flex flex-col gap-3">
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
                <div className="flex flex-row items-center gap-1.5 mb-[5.25px]">
                  <p className="text-[0.78rem] font-semibold text-foreground">
                    {AMENITY_CATEGORY_LABELS[cat]}
                  </p>
                  <Badge variant="info" className="h-[18px] text-[0.65rem] tabular-nums">{items.length}</Badge>
                </div>
                <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[repeat(2,_1fr)] min-[900px]:grid-cols-[repeat(3,_1fr)] min-[1200px]:grid-cols-[repeat(4,_1fr)] gap-1.5">
                  {items.map((a) => {
                    const Icon = resolveAmenityIcon(a.code, iconOverrides);
                    const isOverridden = a.code in iconOverrides && iconOverrides[a.code] !== DEFAULT_AMENITY_ICONS[a.code];
                    const label = t(`properties.amenities.items.${a.i18nKey}`);
                    return (
                      // `group` remplace le selecteur descendant du sx : le crayon
                      // n'apparait qu'au survol de la carte.
                      <div
                        key={a.code}
                        className={cn(
                          'group relative flex items-center gap-1.5 px-[7.5px] py-[5.25px] rounded-md',
                          'border border-solid border-border bg-card',
                          'transition-colors duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                          'hover:border-primary',
                        )}
                      >
                        {/* Icone (cliquable = ouvre le picker) */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => setIconPicker({ open: true, code: a.code, label })}
                              aria-label={t('settings.amenities.changeIcon', "Changer l'icône")}
                              className={cn(CLASS_ICON_BADGE, isOverridden ? CLASS_ICON_BADGE_OVERRIDDEN : CLASS_ICON_BADGE_DEFAULT)}
                            >
                              <Icon size={18} strokeWidth={1.75} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t('settings.amenities.changeIcon', "Changer l'icône")}</TooltipContent>
                        </Tooltip>

                        {/* Label + code */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[0.82rem] font-medium text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                            {label}
                          </p>
                          <span className="block font-mono text-2xs text-faint leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap">
                            {a.code}
                          </span>
                        </div>

                        {/* Edit pencil (visible au hover) + badge override si actif */}
                        <div className="flex flex-row items-center gap-[3px] shrink-0">
                          {isOverridden && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => resetIconOverride(a.code)}
                                    aria-label={t('settings.amenities.resetIcon', "Réinitialiser l'icône")}
                                    className="size-[22px] cursor-pointer text-muted-foreground hover:bg-info-soft hover:text-info"
                                  >
                                    <RotateCcw size={12} strokeWidth={1.75} />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t('settings.amenities.reference.customizedTooltip', "Icône personnalisée — revenir à l'icône par défaut")}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => setIconPicker({ open: true, code: a.code, label })}
                                  aria-label={t('settings.amenities.changeIcon', "Changer l'icône")}
                                  className={cn(
                                    'size-[22px] cursor-pointer text-muted-foreground opacity-0',
                                    'transition-opacity duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                                    'group-hover:opacity-100 focus-visible:opacity-100',
                                    'hover:bg-primary-soft hover:text-primary',
                                  )}
                                >
                                  <Pencil size={12} strokeWidth={1.75} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{t('settings.amenities.changeIcon', "Changer l'icône")}</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
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
        onCreated={() => { void loadAll(); notify.success('Commodité créée'); }}
      />

      <Dialog open={confirmReprocess} onOpenChange={(next) => !next && setConfirmReprocess(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <AlertCircle size={18} className="text-warning" />
              Re-traiter les propriétés ?
            </DialogTitle>
            <DialogDescription>
              Cette action applique <strong>{aliases.length}</strong> alias et <strong>{ignored.length}</strong> ignored à
              toutes les propriétés de votre organisation. Les commodités OTA brutes seront soit converties en codes
              Baitly, soit retirées si ignorées. Sans effet sur les amenities déjà mappées manuellement.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReprocess(false)}>Annuler</Button>
            <Button variant="default" size="sm" onClick={handleReprocess}>
              Re-traiter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRescrape} onOpenChange={(next) => !next && setConfirmRescrape(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Sparkles size={18} color="#8B5CF6" />
              Re-scrape les pages Airbnb ?
            </DialogTitle>
            <DialogDescription>
              Cette action <strong>re-télécharge la page publique Airbnb</strong> de chaque propriété
              de votre organisation pour récupérer le nom à jour + les commodités JSON-LD,
              puis applique automatiquement vos {aliases.length} alias et {ignored.length} ignored.
            </DialogDescription>
          </DialogHeader>
          <span className="block text-xs text-faint">
            Peut prendre quelques secondes par propriété (1 HTTP GET vers airbnb.com).
            Les amenities déjà cochées manuellement sont préservées.
          </span>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmRescrape(false)}>Annuler</Button>
            <Button variant="default" size="sm" onClick={handleRescrape}>
              Lancer le re-scrape
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Gabarit commun des lignes de liste, pose sur la primitive `Item`. */
const CLASS_LIST_ROW =
  'items-center gap-[9px] bg-card ' +
  'transition-colors duration-[180ms] ease-out motion-reduce:transition-none ' +
  'hover:border-primary/25';

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
    <Item
      variant="outline"
      size="sm"
      className={cn(
        'items-center gap-[9px]',
        'transition-colors duration-[180ms] ease-out motion-reduce:transition-none',
        'hover:border-primary/25',
        // Un etat actif se dit par le FOND, jamais par un liseré lateral.
        selected ? 'border-primary/40 bg-primary-soft' : 'bg-card',
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(checked) => onToggleSelect(checked === true)}
        aria-label={`Sélectionner ${item.rawOtaName}`}
      />
      <ItemContent className="min-w-0 gap-0">
        <div className="flex flex-row items-center gap-1.5 mb-[1.5px]">
          <p className="font-mono text-[0.9rem] font-medium me-0.5">
            {item.rawOtaName}
          </p>
          {item.otaSources[0] && item.otaSources[0] !== 'OTA' && (
            <Badge variant="secondary" className="h-[18px] text-[0.65rem]">{item.otaSources[0]}</Badge>
          )}
          <Badge variant="warning" className="h-[18px] text-[0.65rem] tabular-nums">{`${item.occurrences} propriété${item.occurrences > 1 ? 's' : ''}`}</Badge>
        </div>
        {item.affectedProperties.length > 0 && (
          <span className="text-xs text-muted-foreground truncate">
            {item.affectedProperties.slice(0, 3).map((p) => p.name).join(' · ')}
            {item.affectedProperties.length < item.occurrences
              && `, +${item.occurrences - item.affectedProperties.length} autre${item.occurrences - item.affectedProperties.length > 1 ? 's' : ''}`}
          </span>
        )}
      </ItemContent>
      <ItemActions className="gap-1.5 shrink-0">
        <Select
          value={pendingCode}
          onValueChange={(code) => {
            setPendingCode(code);
            if (code) onMap(code);
          }}
        >
          <SelectTrigger size="sm" className="min-w-[180px] text-[0.8rem]" aria-label="Mapper sur">
            <SelectValue placeholder="Mapper sur…" />
          </SelectTrigger>
          <SelectContent>
            {allCodeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-[0.85rem]">
                <span className="inline-flex items-center">
                  {opt.label}
                  {opt.isCustom && (
                    <Badge variant="info" className="ms-1 h-[16px] px-1.5 text-[0.6rem]">custom</Badge>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Creer une commodite est l'issue constructive de la ligne : variante
            `outline`, la seule a se distinguer des deux `ghost` voisins. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={onCreateCustom}
                aria-label="Créer une nouvelle commodité Baitly à partir de ce nom"
                className="text-primary border-primary/25 hover:bg-primary-soft hover:text-primary"
              >
                <Plus size={14} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Créer une nouvelle commodité Baitly à partir de ce nom</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onIgnore}
                aria-label="Ignorer définitivement (sera masqué et retiré des propriétés)"
                className="text-muted-foreground"
              >
                <Ban size={14} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Ignorer définitivement (sera masqué et retiré des propriétés)</TooltipContent>
        </Tooltip>
      </ItemActions>
    </Item>
  );
}
