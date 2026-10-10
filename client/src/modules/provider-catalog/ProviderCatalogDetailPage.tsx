import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/baitly/StatusChip';
import { Button, Skeleton } from '../../components/ui';
import { ArrowBack, LocationOn, PersonSearch, RequestQuote } from '../../icons';
import QuoteRequestDialog from '../quotes/QuoteRequestDialog';
import { useCatalogProvider } from '../../hooks/useProviderCatalog';
import { useQuoteReplacement } from '../../hooks/useQuoteReplacement';
import { useTranslation } from '../../hooks/useTranslation';
import { BaitlyProviderIdentity, BaitlyProviderOffers, BaitlyProfileSection } from '../marketplace/BaitlyProviderProfile';

/** Fiche catalogue Baitly : seules les données publiques autorisées sont présentées. */
export default function ProviderCatalogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const replacementId = searchParams.get('replaceQuoteId');
  const replacement = useQuoteReplacement(replacementId);
  const back = replacementId ? `/prestataires?replaceQuoteId=${encodeURIComponent(replacementId)}` : '/prestataires?view=catalog';
  const { data: provider, isLoading, isError } = useCatalogProvider(id ? Number(id) : undefined);
  const [requestOpen, setRequestOpen] = useState(false);
  const requestDisabled = !!replacementId && (replacement.isError || !replacement.data || !!replacement.data.activeRequestId);

  if (isLoading) return <div className="flex flex-col gap-5"><Skeleton className="h-52 w-full shrink-0" /><Skeleton className="h-80 w-full shrink-0" /></div>;
  if (isError || !provider) return <EmptyState icon={<PersonSearch />} title={t('marketplaceAdmin.notFound')}
    description={t('marketplaceAdmin.notFoundHint')}
    action={<Button variant="outline" onClick={() => navigate(back)}>{t('providerCatalog.back')}</Button>} />;
  const cities = provider.coverageCities.length ? provider.coverageCities : provider.baseCity ? [provider.baseCity] : [];
  return <>
    <PageHeader title={provider.displayName} subtitle={provider.headline} actions={<>
      <Button size="sm" variant="outline" onClick={() => navigate(back)}><ArrowBack />{t('providerCatalog.back')}</Button>
      {!provider.own && <Button size="sm" disabled={requestDisabled} onClick={() => setRequestOpen(true)}><RequestQuote />{t('providerCatalog.requestQuote')}</Button>}
    </>} />
    <div className="baitly-provider-profile">
      <BaitlyProviderIdentity name={provider.displayName} headline={provider.headline} bio={provider.bio}
        url={provider.avatarUrl} categoryCodes={provider.categoryCodes} location={provider.baseCity}
        languages={provider.languages} rating={provider.ratingAvg} ratingCount={provider.ratingCount}
        badges={<>
          {provider.verified && <StatusChip size="sm" tone="ok" label={t('providerCatalog.verified')} />}
          {provider.acceptsUrgent && <StatusChip size="sm" tone="warn" label={t('marketplaceAdmin.urgent')} />}
          {provider.own && <StatusChip size="sm" tone="accent" label={t('providerCatalog.yourProfile')} />}
        </>} />
      <div className="baitly-profile-layout">
        <div>
          <BaitlyProfileSection title={t('marketplaceAdmin.services')}
            aside={<span className="text-xs text-muted-foreground tabular-nums">{t('marketplaceAdmin.serviceCount', { count: provider.offers.length })}</span>}>
            <BaitlyProviderOffers offers={provider.offers} />
          </BaitlyProfileSection>
          <BaitlyProfileSection title={t('marketplaceAdmin.coverageAvailability')}>
            <h3 className="m-0 mb-3 text-sm font-medium">{t('marketplaceAdmin.zones')}</h3>
            {cities.length ? <ul className="m-0 flex list-none flex-wrap gap-2 p-0">{cities.map(city => <li key={city} className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm"><LocationOn size={16} />{city}</li>)}</ul>
              : <p className="text-sm text-muted-foreground">{t('providerCatalog.noZone')}</p>}
            {provider.travelRadiusKm != null && <p className="text-sm text-muted-foreground tabular-nums">{t('marketplaceAdmin.radius', { count: provider.travelRadiusKm })}</p>}
            <div className="mt-5 border-t border-border pt-4"><h3 className="m-0 mb-2 text-sm font-medium">{t('marketplaceAdmin.availability')}</h3>
              <p className="baitly-profile-contact-help">{t('providerProfile.availabilityHelp')}</p>
            </div>
          </BaitlyProfileSection>
        </div>
        <aside>
          <BaitlyProfileSection title={t('providerProfile.contactTitle')}>
            <p className="baitly-profile-contact-help">{t(provider.own ? 'providerCatalog.ownProfileHint' : 'providerCatalog.contactHidden')}</p>
            {!provider.own && <Button className="w-full" disabled={requestDisabled} onClick={() => setRequestOpen(true)}><RequestQuote />{t('providerCatalog.requestQuote')}</Button>}
            {replacementId && <p role={replacement.isError ? 'alert' : 'status'} className="mt-3 text-sm text-muted-foreground">
              {t(replacement.isError ? 'quoteReplacement.loadFailed' : replacement.data?.activeRequestId ? 'quoteReplacement.existing' : 'quoteReplacement.help', { id: replacement.data?.activeRequestId ?? replacementId })}
            </p>}
            {replacement.data?.activeRequestId && <a href="/devis" className="cursor-pointer text-sm underline focus-visible:outline-2">{t('quoteReplacement.viewRequests')}</a>}
          </BaitlyProfileSection>
        </aside>
      </div>
    </div>
    {(!replacementId || (!replacement.isError && replacement.data)) && <QuoteRequestDialog
      key={`${provider.id}:${replacementId ?? 'new'}`} replacement={replacementId ? replacement.data : undefined}
      provider={provider} initialPropertyId={searchParams.get('propertyId') ?? ''} open={requestOpen} onOpenChange={setRequestOpen} />}
  </>;
}
