import { Link } from 'react-router-dom';
import { ArrowRight, Bath, BedDouble, MapPin, Ruler, Users } from '../../icons/glyphs';
import { Button } from '../../components/ui';
import { Money } from '../../components/Money';
import StatusChip from '../../components/StatusChip';
import { PropertyImageCarousel } from '../../components/PropertyImageCarousel';
import { MapCardPerson } from '../../components/map/MapCard';
import { PropertyThumb } from '../notifications/NotificationPropertyPanel';
import { useTranslation } from '../../hooks/useTranslation';
import type { Property } from '../../services/api/propertiesApi';
import { getPropertyStatusLabel, getPropertyTypeLabel } from '../../utils/statusUtils';
import { propertyStatusTokens } from './propertiesListConstants';

/** Aperçu d'un logement : galerie et caractéristiques côte à côte, sans sous-cartes. */
export default function PropertyMapPreview({ property }: { property: Property }) {
  const { t } = useTranslation();
  const photos = property.photoUrls?.length ? property.photoUrls : property.coverPhotoUrl ? [property.coverPhotoUrl] : [];
  const facts = [
    { Icon: Users, value: property.maxGuests, label: t('properties.guests') },
    { Icon: BedDouble, value: property.bedroomCount, label: t('properties.bedrooms') },
    { Icon: Bath, value: property.bathroomCount, label: t('properties.bathrooms') },
    { Icon: Ruler, value: property.squareMeters, label: 'm²' },
  ].filter(fact => fact.value != null && fact.value > 0);
  return <article className="space-y-4 p-4 text-foreground">
    <header className="space-y-1.5 pe-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{getPropertyTypeLabel(property.type, t)}</span>
        <StatusChip pill tokens={propertyStatusTokens(property.status)} label={getPropertyStatusLabel(property.status, t)} />
      </div>
      <h3 className="m-0 text-base font-semibold leading-snug text-balance">{property.name}</h3>
    </header>
    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-3">
      <div className="h-44 min-w-0 overflow-hidden rounded-xl bg-muted">
        {photos.length ? <PropertyImageCarousel photoUrls={photos} alt={property.name} width="100%" height="100%" enableFullscreen
          sx={{ width: '100%', height: '100%', borderRadius: 0 }} />
          : <PropertyThumb property={property} name={property.name} className="h-full w-full rounded-none border-0" />}
      </div>
      <div className="min-w-0 space-y-3">
        <p className="m-0 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{property.address}<br />{[property.postalCode, property.city].filter(Boolean).join(' ')}</span>
        </p>
        <dl className="m-0 grid grid-cols-2 gap-x-2 gap-y-2.5">
          {facts.map(({ Icon, value, label }) => <div key={label} className="min-w-0">
            <dd className="m-0 flex items-center gap-1.5 text-sm font-medium tabular-nums"><Icon className="size-3.5 text-muted-foreground" aria-hidden />{value}</dd>
            <dt className="mt-0.5 text-2xs text-muted-foreground">{label}</dt>
          </div>)}
        </dl>
        {property.nightlyPrice > 0 && <p className="m-0 flex flex-wrap items-baseline gap-1 tabular-nums">
          <span className="text-base font-semibold"><Money value={property.nightlyPrice} from="EUR" decimals={0} /></span>
          <span className="text-xs text-muted-foreground">{t('properties.perNight')}</span>
        </p>}
      </div>
    </div>
    {property.description && <p className="m-0 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{property.description}</p>}
    <footer className="flex flex-wrap items-center justify-between gap-2">
      {property.ownerName ? <MapCardPerson name={property.ownerName} role={t('properties.owner')} /> : <span />}
      <Button asChild variant="secondary" size="sm"><Link to={`/properties/${property.id}`}>
        {t('properties.viewDetails', 'Voir les détails')}<ArrowRight className="size-3.5" aria-hidden />
      </Link></Button>
    </footer>
  </article>;
}
