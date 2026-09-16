import ProviderDirectoryCard from './ProviderDirectoryCard';
import StatusChip from '../../components/baitly/StatusChip';
import { Business, LocationOn, Timer, WarningAmber } from '../../icons';
import { useMarketplacePresentation } from './useMarketplacePresentation';
import { ENGAGEMENT_TONES, STATUS_TONES } from './providerPresentation';
import type { ProviderSummaryDto, ServiceCategoryDto } from '../../services/api/marketplaceProvidersApi';

export default function MarketplaceProviderCard({ provider, categoriesByCode }: {
  provider: ProviderSummaryDto; categoriesByCode: Map<string, ServiceCategoryDto>;
}) {
  const { t, availabilitySummary, STATUS_LABELS, ENGAGEMENT_LABELS } = useMarketplacePresentation();
  const location = [provider.baseCity, provider.basePostalCode].filter(Boolean).join(' ');
  const extraCities = provider.coverageCities.filter(city => city !== provider.baseCity);
  return <ProviderDirectoryCard provider={{ ...provider, headline: provider.headline || provider.legalName }}
    categoriesByCode={categoriesByCode} to={'/marketplace/providers/' + provider.id}
    metadata={<>
      <span className="flex items-center gap-1"><LocationOn className="size-3.5 shrink-0" />
        {location || t('marketplaceAdmin.unknownLocation')}{provider.travelRadiusKm ? ' · ' + provider.travelRadiusKm + ' km' : ''}
        {extraCities.length > 0 ? ' · ' + t('marketplaceAdmin.extraZones', { count: extraCities.length }) : ''}</span>
      <span className="flex items-center gap-1"><Timer className="size-3.5 shrink-0" />{availabilitySummary(provider.availableDays, provider.weeklyRestricted)}</span>
      {provider.homeOrganizationName && <span className="flex items-center gap-1"><Business className="size-3.5 shrink-0" />{provider.homeOrganizationName}</span>}
    </>}
    badges={<>
      <StatusChip size="sm" dot tone={STATUS_TONES[provider.status]} label={STATUS_LABELS[provider.status]} />
      <StatusChip size="sm" tone={ENGAGEMENT_TONES[provider.engagementMode]} label={ENGAGEMENT_LABELS[provider.engagementMode]} />
      {provider.complianceAlert && <StatusChip size="sm" tone="err" icon={<WarningAmber />} label={t('marketplaceAdmin.renew')} />}
    </>} />;
}
