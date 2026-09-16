import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuoteReplacement } from '../../hooks/useQuoteReplacement';
import { useTranslation } from '../../hooks/useTranslation';
import { useUserPreference } from '../../hooks/useUserPreference';
import { useMarketplaceProperties } from '../../hooks/useMarketplaceProperties';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import PagePagination from '../../components/PagePagination';
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
import { PersonSearch, Verified } from '../../icons';
import { useScreenSearch } from '../../components/ScreenChrome';
import ProviderCatalogCard from './ProviderCatalogCard';
import { useCatalogCategories, useProviderCatalog } from '../../hooks/useProviderCatalog';
import type { CatalogSearchParams } from '../../services/api/providerCatalogApi';

const PAGE_SIZE = 24;
const DEFAULT_FILTERS = { category: '', city: '', verifiedOnly: false, propertyId: '' };

/**
 * Le catalogue des prestataires, côté organisation.
 *
 * <p>Volontairement plus simple que la console de la plateforme : une
 * conciergerie cherche quelqu'un pour un besoin précis — un métier, une ville —
 * pas à administrer un référentiel. Les dimensions de modération (état, mode
 * d'engagement, conformité) n'y figurent pas, et l'API les refuse de toute
 * façon.</p>
 */
export default function ProviderCatalogPage() {
  const [searchParams] = useSearchParams();
  const replacementId = searchParams.get('replaceQuoteId');
  const replacement = useQuoteReplacement(replacementId);
  const [query, setQuery] = useState('');
  const { t, currentLanguage } = useTranslation();
  const [filters, setFilters] = useUserPreference('marketplace.catalog.filters', DEFAULT_FILTERS);
  const { city, verifiedOnly } = filters;
  const propertyId = replacementId ? String(replacement.data?.propertyId ?? '') : filters.propertyId;
  const category = replacementId ? replacement.data?.categoryCode ?? '' : filters.category;
  const changeFilter = (next: Partial<typeof DEFAULT_FILTERS>) => { setFilters({ ...filters, ...next }); setPage(0); };
  const setCategory = (category: string) => changeFilter({ category });
  const setCity = (city: string) => changeFilter({ city });
  const { data: properties = [], isError: propertyError } = useMarketplaceProperties();
  const [page, setPage] = useState(0);

  // Monte le champ de recherche dans l'en-tête de l'écran : la recherche d'un
  // écran ne se dessine plus dans l'écran.
  useScreenSearch(query, (value) => { setQuery(value); setPage(0); },
    t('marketplaceWorkflow.search'));

  const { data: categories } = useCatalogCategories();

  const params = useMemo<CatalogSearchParams>(() => ({
    query: query.trim() || undefined,
    category: category ? [category] : undefined,
    city: city.trim() || undefined,
    verifiedOnly: verifiedOnly || undefined,
    propertyId: propertyId ? Number(propertyId) : undefined,
    page,
    size: PAGE_SIZE,
  }), [query, category, city, verifiedOnly, propertyId, page]);

  const { data, isLoading, isError } = useProviderCatalog(params);

  // Les métiers usuels d'abord : sur trente-deux entrées, une liste alphabétique
  // enterre le ménage entre la conciergerie et le déneigement.
  const orderedCategories = useMemo(() => {
    const all = categories ?? [];
    return [...all.filter((c) => c.common), ...all.filter((c) => !c.common)];
  }, [categories]);

  const categoryLabels = useMemo(
    () => new Map((categories ?? []).map((c) => [c.code, c])),
    [categories],
  );

  const hasFilters = Boolean(query.trim() || category || city.trim() || verifiedOnly || propertyId);

  const resetFilters = () => {
    setQuery(''); setFilters(DEFAULT_FILTERS); setPage(0);
  };

  return (
    <>
      <PageHeader
        title={t("marketplaceWorkflow.title")}
        subtitle={t("marketplaceWorkflow.subtitle")}
      />

      {replacementId && <div className="py-2 text-sm">
        {replacement.isError ? <p role="alert">{t('quoteReplacement.loadFailed')}</p>
          : replacement.isPending ? <Skeleton className="h-12 w-full" />
          : <p role="status">{t(replacement.data?.activeRequestId ? 'quoteReplacement.existing' : 'quoteReplacement.help',
              { id: replacement.data?.activeRequestId ?? replacementId })}</p>}
        <a href="/devis" className="cursor-pointer underline focus-visible:outline-2">{t('quoteReplacement.viewRequests')}</a>
      </div>}

      <Card className="shrink-0 gap-0 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            {t('marketplaceWorkflow.property')}
            <select value={propertyId} disabled={!!replacementId} onChange={(event) => changeFilter({ propertyId: event.target.value })}
              className="h-9 max-w-full cursor-pointer rounded-md border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary">
              <option value="">{t('marketplaceWorkflow.allProperties')}</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
          </label>
          {propertyError && <p role="alert" className="text-xs text-destructive-ink">{t('marketplaceWorkflow.propertiesFailed')}</p>}
          <Select
            disabled={!!replacementId}
            value={category || 'all'}
            onValueChange={(value) => { setCategory(value === 'all' ? '' : value); setPage(0); }}
          >
            <SelectTrigger size="sm" className="w-full sm:w-[220px]" aria-label={t("marketplaceWorkflow.allCategories")}>
              <SelectValue placeholder={t("marketplaceWorkflow.allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("marketplaceWorkflow.allCategories")}</SelectItem>
              {orderedCategories.map((c) => (
                <SelectItem key={c.code} value={c.code}>{currentLanguage.startsWith('en') ? c.labelEn : c.labelFr}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <input
            value={city}
            onChange={(event) => { setCity(event.target.value); setPage(0); }}
            placeholder={t("marketplaceWorkflow.city")}
            aria-label={t("marketplaceWorkflow.city")}
            className="h-8 w-[160px] rounded-md border border-border bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          <Button
            size="sm"
            variant={verifiedOnly ? 'default' : 'outline'}
            aria-pressed={verifiedOnly}
            onClick={() => { changeFilter({ verifiedOnly: !verifiedOnly }); setPage(0); }}
          >
            <Verified />
            {t("marketplaceWorkflow.verified")}
          </Button>

          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={resetFilters}>
              {t("marketplaceWorkflow.clear")}
            </Button>
          )}

          <span className="ms-auto text-xs tabular-nums text-muted-foreground">
            {data ? t('marketplaceWorkflow.count', { count: data.totalElements }) : ''}
          </span>
        </div>
      </Card>

      {isLoading && (
        <div className="mt-4 grid shrink-0 grid-cols-1 gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-[190px] w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <div className="mt-4 shrink-0">
          <EmptyState
            icon={<PersonSearch />}
            title={t("marketplaceWorkflow.unavailable")}
            description={t("marketplaceWorkflow.loadFailed")}
          />
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="mt-4 shrink-0">
          <EmptyState
            icon={<PersonSearch />}
            title={t("marketplaceWorkflow.empty")}
            description={t("marketplaceWorkflow.emptyHelp")}
            action={hasFilters
              ? <Button size="sm" variant="outline" onClick={resetFilters}>{t("marketplaceWorkflow.clear")}</Button>
              : undefined}
          />
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="mt-4 grid shrink-0 grid-cols-1 gap-3">
            {data.items.map((provider) => (
              <ProviderCatalogCard
                key={provider.id}
                provider={provider}
                categoryLabels={categoryLabels}
                propertyId={propertyId}
              />
            ))}
          </div>

          {data.totalPages > 1 && (
            <PagePagination
              className="mt-4 shrink-0"
              page={data.page}
              count={data.totalElements}
              rowsPerPage={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </>
  );
}
