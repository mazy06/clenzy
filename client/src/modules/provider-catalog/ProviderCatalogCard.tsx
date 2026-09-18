import { useSearchParams } from 'react-router-dom';
import ProviderDirectoryCard from '../marketplace/ProviderDirectoryCard';
import StatusChip from '../../components/baitly/StatusChip';
import { LocationOn } from '../../icons';
import type { CatalogProviderDto } from '../../services/api/providerCatalogApi';
import type { ServiceCategoryDto } from '../../services/api/marketplaceProvidersApi';
import { useTranslation } from '../../hooks/useTranslation';

export default function ProviderCatalogCard({ provider, categoryLabels, propertyId }: {
  propertyId?: string; provider: CatalogProviderDto; categoryLabels: Map<string, ServiceCategoryDto>;
}) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const context = new URLSearchParams();
  if (propertyId) context.set('propertyId', propertyId);
  const replacement = searchParams.get('replaceQuoteId');
  if (replacement) context.set('replaceQuoteId', replacement);
  return <ProviderDirectoryCard provider={provider} categoriesByCode={categoryLabels}
    to={'/prestataires/' + provider.id + '?' + context.toString()}
    metadata={<span className="flex items-center gap-1"><LocationOn className="size-3.5 shrink-0" />
      {provider.coverageCities.join(' · ') || provider.baseCity || t('marketplaceAdmin.unknownLocation')}
    </span>}
    badges={<>
      {provider.own && <StatusChip size="sm" tone="accent" label={t('providerDirectory.organizationProfile')} />}
      {provider.offers.length > 0 && <span className="text-xs text-muted-foreground">{t('providerDirectory.offers', { count: provider.offers.length })}</span>}
    </>} />;
}
