import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button, Skeleton } from '../../../components/ui';
import { MapPin, Star, BadgeCheck, ArrowRight } from '../../../icons/glyphs';
import { useTranslation } from '../../../hooks/useTranslation';
import { usePropertiesList } from '../../../hooks/usePropertiesList';
import { providerCatalogApi } from '../../../services/api/providerCatalogApi';
import type { ProviderSectors, SectorProperty } from '../../../services/api/sectorMapApi';
import { PropertyThumb } from '../../notifications/NotificationPropertyPanel';
import ProviderAvatar from '../ProviderAvatar';
import { providerSectorImage } from '../providerSectorImages';
import { formatOfferPrice } from '../providerPresentation';

/** Données du catalogue autorisé, chargées uniquement à l'ouverture de l'aperçu. */
export default function ProviderMapPreview({ provider, properties }: {
  provider: ProviderSectors; properties: SectorProperty[];
}) {
  const { t, currentLanguage } = useTranslation();
  const detail = useQuery({
    queryKey: ['provider-catalog', 'map-preview', provider.providerId],
    queryFn: () => providerCatalogApi.getById(provider.providerId!),
    enabled: provider.providerId != null,
    staleTime: 60_000,
  });
  const { properties: homes } = usePropertiesList();
  const profile = detail.data;
  const offers = profile?.offers.filter(offer => offer.active) ?? [];
  const zones = [...new Set([...provider.zones.map(zone => zone.name), ...(profile?.coverageCities ?? [])])];
  return <div className="text-foreground">
    <header data-provider-preview-header className="flex items-center gap-3 px-4 pb-2 pt-4 pe-10">
      <ProviderAvatar url={profile?.avatarUrl ?? provider.avatarUrl} name={provider.name ?? ''} className="size-12 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="m-0 text-sm font-semibold">{profile?.displayName ?? provider.name}</h3>
        {profile?.headline && !offers.some(offer => offer.label.trim().toLocaleLowerCase() === profile.headline!.trim().toLocaleLowerCase()) && <p className="m-0 text-xs text-muted-foreground">{profile.headline}</p>}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {profile?.verified && <span className="inline-flex items-center gap-1 text-success-ink"><BadgeCheck className="size-3.5" />{t('marketplaceAdmin.verifiedProvider', 'Prestataire vérifié')}</span>}
          {profile?.ratingAvg != null && (profile.ratingCount ?? 0) > 0 && <span className="inline-flex items-center gap-1 tabular-nums"><Star className="size-3.5 text-warning-ink" />{profile.ratingAvg.toFixed(1)} <span className="text-muted-foreground">({profile.ratingCount})</span></span>}
        </div>
      </div>
    </header>
    <div className="space-y-4 px-4 pb-3 pt-2">
    <section aria-label={t('navigation.prestations', 'Prestations')}>
      {detail.isLoading ? <Skeleton className="h-16 w-full" /> : detail.isError ? <div className="space-y-2">
        <p role="alert" className="m-0 text-xs text-muted-foreground">{t('baitlyMap.card.loadError', 'Impossible de charger le détail.')}</p>
        <Button variant="outline" size="sm" onClick={() => void detail.refetch()}>{t('common.retry', 'Réessayer')}</Button>
      </div> : <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3">
        <img src={providerSectorImage(offers[0] ? [offers[0].categoryCode] : profile?.categoryCodes ?? [])} alt="" className="size-16 self-start object-contain" />
        <div className="space-y-3">
        {offers.slice(0, 3).map((offer, index) => <div key={offer.id} className="flex items-start gap-2">
          {index > 0 && <img src={providerSectorImage([offer.categoryCode])} alt="" className="size-7 shrink-0 object-contain" />}
          <div className="min-w-0 space-y-0.5">
            <p className={`m-0 ${index === 0 ? 'text-sm font-semibold' : 'text-xs font-medium'}`}>{offer.label}</p>
            <p className="m-0 text-xs tabular-nums text-muted-foreground">{formatOfferPrice(offer.amount, offer.currency, offer.pricingModel, offer.unitLabel, currentLanguage ?? 'fr', t('marketplaceAdmin.onQuote', 'Sur devis'))}</p>
          </div>
        </div>)}
        {!offers.length && <p className="m-0 text-xs text-muted-foreground">{t('marketplaceAdmin.noServices', 'Aucune prestation renseignée')}</p>}
        </div>
      </div>}
    </section>
    <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-xs">
      <MapPin className="mt-px size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 space-y-1">
        <h4 className="sr-only">{t('sectorMap.previewZones', 'Zones d’intervention')}</h4>
        <p className="m-0 leading-relaxed">{zones.join(' · ') || t('sectorMap.noZone', 'Aucune zone déclarée')}</p>
        {profile?.baseCity && (!zones.includes(profile.baseCity) || profile.travelRadiusKm != null) && <p className="m-0 text-muted-foreground">
          {!zones.includes(profile.baseCity) ? profile.baseCity : ''}{profile.travelRadiusKm != null ? `${!zones.includes(profile.baseCity) ? ' · ' : ''}${profile.travelRadiusKm} km` : ''}
        </p>}
      </div>
    </div>
    <section className="min-w-0">
      <h4 className="m-0 mb-2 text-xs font-medium tabular-nums text-muted-foreground">{t('sectorMap.coversProperties', { count: properties.length, defaultValue: '{{count}} logement(s) couvert(s)' })}</h4>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {properties.map(property => {
          const home = homes.find(home => Number(home.id) === property.id);
          return <div key={property.id} className="min-w-0 space-y-1.5">
            <PropertyThumb property={{ id: property.id, coverPhotoUrl: home?.imageUrl, photoUrls: home?.photoUrls }} name={property.name} className="h-24 w-full rounded-lg border-0 object-cover" />
            <div className="min-w-0"><p className="m-0 text-xs font-medium leading-snug">{property.name}</p>
              {home && <p className="m-0 mt-0.5 text-2xs text-muted-foreground">{[home.postalCode, home.city].filter(Boolean).join(' ')}</p>}
            </div>
          </div>;
        })}
      </div>
    </section>
    </div>
    {provider.providerId != null && <footer className="sticky bottom-0 flex justify-end bg-card px-4 pb-3 pt-1">
      <Button asChild variant="secondary"><Link to={`/prestataires/${provider.providerId}`}>
        {t('properties.viewDetails', 'Voir les détails')}<ArrowRight className="size-3.5" aria-hidden />
      </Link></Button>
    </footer>}
  </div>;
}
