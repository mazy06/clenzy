import { useMarketplaceFilterState } from './useMarketplaceFilterState';
import { useUserUiPreferences } from '../../providers/UserUiPreferencesProvider';
import { useMarketplacePresentation } from './useMarketplacePresentation';
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import PagePagination from '../../components/PagePagination';
import { useScreenSearch } from '../../components/ScreenChrome';
import {
  Button,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '../../components/ui';
import { Close, FilterList, PersonSearch, Refresh } from '../../icons';
import { cn } from '../../utils/cn';
import {
  useImportExistingProviders,
  useMarketplaceCategories,
  useMarketplaceFacets,
  useMarketplaceProviders,
  useMarketplaceStats,
} from '../../hooks/useMarketplaceProviders';
import type {
  EngagementMode,
  ProviderSearchParams,
} from '../../services/api/marketplaceProvidersApi';
import MarketplaceProviderCard from './MarketplaceProviderCard';
import { MarketplaceFilterPanel, MarketplaceFilterSheet } from './MarketplaceFilters';

const PAGE_SIZE = 24;

/**
 * Vues de travail.
 *
 * <p>Un modérateur ne pense pas « état = à examiner » : il pense « qu'est-ce qui
 * m'attend ce matin ». Ces trois vues nomment ses routines et les servent en un
 * clic, là où il fallait composer des filtres. Les filtres fins restent dans le
 * tiroir pour tout le reste.</p>
 */
type ViewKey = 'all' | 'pending' | 'compliance';

export default function MarketplaceProvidersPage() {
  const { t, catalogLabel, DAY_NAMES, ENGAGEMENT_LABELS } = useMarketplacePresentation();
const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: 'all', label: t('marketplaceAdmin.all') },
  { key: 'pending', label: t('marketplaceAdmin.pending') },
  { key: 'compliance', label: t('marketplaceAdmin.renewals') },
];

  const navigate = useNavigate();
  const preferences = useUserUiPreferences();

  const [search, setSearch] = useState('');
  useScreenSearch(search, setSearch, t('marketplaceAdmin.search'));

  const [view, setView] = useMarketplaceFilterState<ViewKey>('view', 'all');
  const [engagements, setEngagements] = useMarketplaceFilterState<EngagementMode[]>('engagements', []);
  const [categories, setCategories] = useMarketplaceFilterState<string[]>('categories', []);
  const [services, setServices] = useMarketplaceFilterState<string[]>('services', []);
  const [city, setCity] = useMarketplaceFilterState('city', '');
  const [availableOnDay, setAvailableOnDay] = useMarketplaceFilterState('day', '');
  const [sort, setSort] = useMarketplaceFilterState<ProviderSearchParams['sort']>('sort', 'recent');
  const [verifiedOnly, setVerifiedOnly] = useMarketplaceFilterState('verified', false);
  const [acceptsUrgent, setAcceptsUrgent] = useMarketplaceFilterState('urgent', false);
  const [page, setPage] = useState(0);

  // Volontairement NON persisté, contrairement à l'ancien panneau en ligne : un
  // tiroir se rouvrirait par-dessus le contenu à chaque visite. Ce qui doit
  // survivre, ce sont les filtres eux-mêmes — et ils se lisent dans les
  // pastilles, panneau fermé.
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: categoryList = [] } = useMarketplaceCategories();
  const { data: facets } = useMarketplaceFacets();
  const { data: stats } = useMarketplaceStats();
  const importProviders = useImportExistingProviders();

  /** La vue se traduit en critères serveur ; elle n'ajoute aucune dimension. */
  const viewParams = useMemo<Partial<ProviderSearchParams>>(() => {
    if (view === 'pending') return { status: ['PENDING_REVIEW'] };
    if (view === 'compliance') return { complianceAlert: true };
    return {};
  }, [view]);

  const params = useMemo<ProviderSearchParams>(() => ({
    query: search || undefined,
    engagement: engagements.length ? engagements : undefined,
    category: categories.length ? categories : undefined,
    service: services.length ? services : undefined,
    city: city || undefined,
    availableOnDay: availableOnDay ? Number(availableOnDay) : undefined,
    verifiedOnly: verifiedOnly || undefined,
    acceptsUrgent: acceptsUrgent || undefined,
    sort,
    page,
    size: PAGE_SIZE,
    ...viewParams,
  }), [search, engagements, categories, services, city, availableOnDay,
       verifiedOnly, acceptsUrgent, sort, page, viewParams]);

  const { data, isLoading, isFetching, isError, refetch } = useMarketplaceProviders(params);

  const categoriesByCode = useMemo(
    () => new Map(categoryList.map((c) => [c.code, c])),
    [categoryList],
  );

  /**
   * Bascule une valeur et revient en première page.
   *
   * Sans ce retour, filtrer depuis la page trois affiche une page vide alors que
   * des résultats existent — on croit le filtre cassé.
   */
  const toggleIn = useCallback(<T,>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    value: T,
  ) => {
    setPage(0);
    setter((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }, []);

  const resetFilters = useCallback(() => {
    setEngagements([]);
    setCategories([]);
    setServices([]);
    setCity('');
    setAvailableOnDay('');
    setVerifiedOnly(false);
    setAcceptsUrgent(false);
    setPage(0);
  }, [setEngagements, setCategories, setServices, setCity, setAvailableOnDay, setVerifiedOnly, setAcceptsUrgent]);

  const activeFilterCount =
    engagements.length + categories.length + services.length +
    (city ? 1 : 0) + (availableOnDay ? 1 : 0) +
    (verifiedOnly ? 1 : 0) + (acceptsUrgent ? 1 : 0);

  /**
   * Filtres actifs, retirables un à un.
   *
   * <p>Panneau fermé, c'est la seule trace de ce qui restreint la liste. Sans
   * elle, une grille vide n'aurait aucune explication visible.</p>
   */
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; remove: () => void }> = [];

    categories.forEach((code) => chips.push({
      key: `cat:${code}`,
      label: categoriesByCode.has(code) ? catalogLabel(categoriesByCode.get(code)!) : code,
      remove: () => { setPage(0); setCategories((c) => c.filter((v) => v !== code)); },
    }));

    services.forEach((code) => {
      const item = categoryList.flatMap((c) => c.items).find((i) => i.code === code);
      chips.push({
        key: `svc:${code}`,
        label: item ? catalogLabel(item) : code,
        remove: () => { setPage(0); setServices((s) => s.filter((v) => v !== code)); },
      });
    });

    engagements.forEach((mode) => chips.push({
      key: `eng:${mode}`,
      label: ENGAGEMENT_LABELS[mode],
      remove: () => { setPage(0); setEngagements((e) => e.filter((v) => v !== mode)); },
    }));

    if (city) {
      chips.push({ key: 'city', label: city, remove: () => { setPage(0); setCity(''); } });
    }
    if (availableOnDay) {
      chips.push({
        key: 'day',
        label: DAY_NAMES[Number(availableOnDay) - 1] ?? availableOnDay,
        remove: () => { setPage(0); setAvailableOnDay(''); },
      });
    }
    if (verifiedOnly) {
      chips.push({
        key: 'verified', label: t('marketplaceAdmin.verifiedPlural'),
        remove: () => { setPage(0); setVerifiedOnly(false); },
      });
    }
    if (acceptsUrgent) {
      chips.push({
        key: 'urgent', label: t('marketplaceAdmin.urgent'),
        remove: () => { setPage(0); setAcceptsUrgent(false); },
      });
    }
    return chips;
  }, [categories, services, engagements, city, availableOnDay, verifiedOnly,
      acceptsUrgent, categoriesByCode, categoryList, t, catalogLabel, DAY_NAMES, ENGAGEMENT_LABELS]);

  const viewCount = useCallback((key: ViewKey) => {
    if (!stats) return undefined;
    if (key === 'all') return stats.total;
    if (key === 'pending') return stats.pendingReview;
    return stats.complianceAlerts;
  }, [stats]);

  /**
   * Réglages du panneau, partagés par les deux montages.
   *
   * Extraits pour que la colonne fixe et le tiroir mobile restent deux VUES du
   * même état : deux jeux de props auraient fini par diverger.
   */
  const filterPanelProps = {
    categories: categoryList,
    facets,
    selectedCategories: categories,
    // Changer de métier vide les prestations : celles du métier précédent
    // n'ont plus de sens et rendraient la grille vide sans raison lisible.
    onToggleCategory: (code: string) => { setServices([]); toggleIn(setCategories, code); },
    selectedServices: services,
    onToggleService: (code: string) => toggleIn(setServices, code),
    city,
    onCityChange: (next: string) => { setPage(0); setCity(next); },
    engagements,
    onToggleEngagement: (mode: EngagementMode) => toggleIn(setEngagements, mode),
    availableOnDay,
    onAvailableOnDayChange: (next: string) => { setPage(0); setAvailableOnDay(next); },
    verifiedOnly,
    onVerifiedOnlyChange: (next: boolean) => { setPage(0); setVerifiedOnly(next); },
    acceptsUrgent,
    onAcceptsUrgentChange: (next: boolean) => { setPage(0); setAcceptsUrgent(next); },
    activeCount: activeFilterCount,
    onReset: resetFilters,
  };

  const providers = data?.items ?? [];
  const showSkeletons = isLoading && providers.length === 0;
  const hasRestriction = activeFilterCount > 0 || search !== '' || view !== 'all';

  if (preferences.isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <>
      {!preferences.isLoaded && <p role="status">{t('marketplaceAdmin.preferencesUnavailable')}</p>}
      <PageHeader
        title={t('marketplaceAdmin.title')}
        subtitle={t('marketplaceAdmin.subtitle')}
        actions={
          <>
            {/* Le déclencheur n'existe qu'en mobile : au-dessus de `lg`, le
                panneau est monté en colonne et n'a rien à ouvrir. */}
            <Button
              variant={activeFilterCount > 0 ? 'secondary' : 'outline'}
              size="sm"
              className="lg:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              <FilterList className="size-4" />{t('marketplaceAdmin.filters')}{activeFilterCount > 0 && (
                <span className="ms-1 rounded-sm bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <Refresh className={cn('size-4', isFetching && 'animate-spin')} />{t('marketplaceAdmin.refresh')}</Button>
          </>
        }
      />

      {/* ─── Reprise des comptes existants ───────────────────────────── */}
      {(stats?.importableUsers ?? 0) > 0 && (
        <Card className="mb-3 shrink-0 flex-row flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="m-0 text-sm font-semibold text-foreground">
              {t("marketplaceAdmin.importable", { count: stats!.importableUsers })}
            </p>
            <p className="m-0 mt-0.5 max-w-[80ch] text-xs text-muted-foreground">
              {t("marketplaceAdmin.importHint")}
            </p>
          </div>
          <Button
            size="sm"
            disabled={importProviders.isPending}
            onClick={() => importProviders.mutate(undefined)}
          >
            {importProviders.isPending ? t('marketplaceAdmin.importing') : t('marketplaceAdmin.import')}
          </Button>
        </Card>
      )}

      {importProviders.isError && <p role="alert">{t("marketplaceAdmin.failed")}</p>}
      {importProviders.isSuccess && importProviders.data && (
        <Card className="mb-3 shrink-0 px-4 py-3">
          <p className="m-0 text-sm text-foreground">
            {t("marketplaceAdmin.importResult", { ...importProviders.data })}
          </p>
          {importProviders.data.skippedReasons.length > 0 && (
            <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0">
              {importProviders.data.skippedReasons.slice(0, 5).map((reason) => (
                <li key={reason} className="text-xs text-muted-foreground">{reason}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ─── Barre d'action ──────────────────────────────────────────── */}
      {/*
        Une seule ligne, et les professionnels commencent tout de suite. La barre
        précédente alignait quarante-six contrôles de poids identique sur sept
        cents pixels de haut, poussant la grille sous la ligne de flottaison.
      */}
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          {VIEWS.map((entry, index) => {
            const count = viewCount(entry.key);
            const active = view === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                aria-pressed={active}
                onClick={() => { setPage(0); setView(entry.key); }}
                className={cn(
                  'inline-flex cursor-pointer items-baseline gap-1.5 px-3 py-1.5 text-xs font-medium',
                  'transition-colors duration-150 outline-none focus-visible:ring-[2px] focus-visible:ring-ring/50',
                  index > 0 && 'border-s border-border',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {entry.label}
                {/* Une vue à zéro reste affichée mais s'éteint : c'est une
                    réponse, pas un manque. */}
                <span className={cn('text-[11px] tabular-nums', count === 0 && 'opacity-50')}>
                  {count ?? '—'}
                </span>
              </button>
            );
          })}
        </div>

        <Select value={sort} onValueChange={(value) => setSort(value as ProviderSearchParams['sort'])}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder={t('marketplaceAdmin.sort')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">{t('marketplaceAdmin.recent')}</SelectItem>
            <SelectItem value="name">{t('marketplaceAdmin.name')}</SelectItem>
            {/*
              « Mieux notés » est RETIRÉ tant que rien ne calcule les notes.
              `ratingAvg` est stocké, affiché et triable côté serveur, mais aucun
              code ne l'alimente : le tri ordonnait des valeurs vides et donnait
              une confiance fausse. Le critère reste accepté par l'API — il
              reviendra ici quand la phase 5 lui donnera de la matière.
            */}
            <SelectItem value="missions">{t('marketplaceAdmin.mostMissions')}</SelectItem>
          </SelectContent>
        </Select>

        {data && (
          <span className="ms-auto text-xs tabular-nums text-muted-foreground">
            {t("marketplaceAdmin.results", { count: data.total })}
          </span>
        )}
      </div>

      {/* ─── Filtres actifs ──────────────────────────────────────────── */}
      {activeChips.length > 0 && (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.remove}
              aria-label={t("marketplaceAdmin.removeFilter", { label: chip.label })}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary-soft px-2 py-1 text-xs font-semibold text-primary outline-none transition-opacity duration-150 hover:opacity-80 focus-visible:ring-[2px] focus-visible:ring-ring/50"
            >
              {chip.label}
              <Close className="size-3 opacity-60" />
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={resetFilters}>{t('marketplaceAdmin.clear')}</Button>
        </div>
      )}

      {/* ─── Filtres et résultats ────────────────────────────────────── */}
      <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
        {/*
          Colonne permanente à partir de `lg`. `sticky` avec sa propre zone de
          défilement : les filtres restent sous les yeux pendant qu'on parcourt
          une longue liste, sans quoi il faudrait remonter à chaque affinage.
        */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 max-h-[calc(100svh-9rem)] overflow-hidden">
            <MarketplaceFilterPanel {...filterPanelProps} />
          </div>
        </aside>

        <div className="min-w-0">
        {isError ? (<p role="alert">{t("marketplaceAdmin.failed")}</p>) : showSkeletons ? (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-56 w-full rounded-lg" />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <EmptyState
            icon={<PersonSearch />}
            title={hasRestriction ? t('marketplaceAdmin.noMatches') : t('marketplaceAdmin.empty')}
            description={hasRestriction
              ? t('marketplaceAdmin.widenSearch')
              : t('marketplaceAdmin.emptyHint')}
            action={hasRestriction ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { resetFilters(); setSearch(''); setView('all'); }}
              >{t('marketplaceAdmin.clearFilters')}</Button>
            ) : undefined}
          />
        ) : (
          <>
            <div
              className={cn(
                'grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
                // La page précédente reste affichée pendant le chargement ;
                // l'atténuer dit qu'elle n'est plus à jour sans faire sauter la grille.
                isFetching && 'opacity-60 transition-opacity',
              )}
            >
              {providers.map((provider) => (
                <MarketplaceProviderCard
                  key={provider.id}
                  provider={provider}
                  categoriesByCode={categoriesByCode}
                  onOpen={(id) => navigate(`/marketplace/providers/${id}`)}
                />
              ))}
            </div>

            <PagePagination
              className="mt-4"
              page={data?.page ?? 0}
              onPageChange={setPage}
              count={data?.total}
              rowsPerPage={PAGE_SIZE}
              totalPages={data?.totalPages}
            />
          </>
        )}
        </div>
      </div>

      {/* Tiroir mobile uniquement : au-dessus de `lg` la colonne le remplace. */}
      <div className="lg:hidden">
        <MarketplaceFilterSheet
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          {...filterPanelProps}
        />
      </div>
    </>
  );
}
