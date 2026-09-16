import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuoteReplacement } from '../../hooks/useQuoteReplacement';
import { useTranslation } from '../../hooks/useTranslation';
import { useUserPreference } from '../../hooks/useUserPreference';
import { useMarketplaceProperties } from '../../hooks/useMarketplaceProperties';
import ProviderDirectoryResults, { PROVIDERS_PAGE_SIZE as PAGE_SIZE } from '../marketplace/ProviderDirectoryResults';
import { Button, Skeleton } from '../../components/ui';
import { Refresh } from '../../icons';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import ProviderDirectoryLayout from '../marketplace/ProviderDirectoryLayout';
import ProviderCatalogFilters from './ProviderCatalogFilters';
import { useScreenSearch } from '../../components/ScreenChrome';
import ProviderCatalogCard from './ProviderCatalogCard';
import { useCatalogCategories, useProviderCatalog } from '../../hooks/useProviderCatalog';
import type { CatalogSearchParams } from '../../services/api/providerCatalogApi';

const DEFAULT_FILTERS = { category: '', city: '', verifiedOnly: false, propertyId: '' };

/** Adaptateur du catalogue organisation : filtres métier et contexte de devis. */
export default function ProviderCatalogPage() {
  const [searchParams] = useSearchParams();
  const replacementId = searchParams.get('replaceQuoteId');
  const replacement = useQuoteReplacement(replacementId);
  const [query, setQuery] = useState('');
  const { t } = useTranslation();
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

  const { data, isLoading, isError, isFetching, refetch } = useProviderCatalog(params);

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

  const headerActions = usePageHeaderActions(<>
    <Button size="sm" variant="outline" disabled={isFetching} onClick={() => refetch()}>
      <Refresh />{t('marketplaceAdmin.refresh')}
    </Button>
  </>);

  return (
    <>
      {headerActions}
      {replacementId && <div className="py-2 text-sm">
        {replacement.isError ? <p role="alert">{t('quoteReplacement.loadFailed')}</p>
          : replacement.isPending ? <Skeleton className="h-12 w-full" />
          : <p role="status">{t(replacement.data?.activeRequestId ? 'quoteReplacement.existing' : 'quoteReplacement.help',
              { id: replacement.data?.activeRequestId ?? replacementId })}</p>}
        <a href="/devis" className="cursor-pointer underline focus-visible:outline-2">{t('quoteReplacement.viewRequests')}</a>
      </div>}

      <ProviderDirectoryLayout
        filters={<ProviderCatalogFilters categories={orderedCategories} category={category} setCategory={setCategory}
          city={city} setCity={setCity} verifiedOnly={verifiedOnly} setVerifiedOnly={value => changeFilter({ verifiedOnly: value })}
          propertyId={propertyId} setPropertyId={value => changeFilter({ propertyId: value })}
          properties={properties} propertyError={propertyError} locked={!!replacementId} />}>
        <ProviderDirectoryResults items={data?.items ?? []} loading={isLoading} fetching={isFetching} error={isError}
          errorLabel={t('marketplaceWorkflow.loadFailed')} emptyTitle={t('marketplaceWorkflow.empty')}
          emptyDescription={t('marketplaceWorkflow.emptyHelp')}
          emptyAction={hasFilters ? <Button size="sm" variant="outline" onClick={resetFilters}>{t('marketplaceWorkflow.clear')}</Button> : undefined}
          page={data?.page ?? page} total={data?.totalElements ?? 0} onPageChange={setPage}
          renderItem={provider => <ProviderCatalogCard key={provider.id} provider={provider} categoryLabels={categoryLabels} propertyId={propertyId} />} />
      </ProviderDirectoryLayout>
    </>
  );
}
