import { Link } from 'react-router-dom';
import { Home, MapPin, Navigation, ArrowUpRight, Ruler, BedDouble, Bath, Users } from '../icons/glyphs';
import { Avatar, AvatarImage, AvatarFallback, Button } from './ui';
import { DirectionsMenu } from './map/DirectionsMenu';
import { useTranslation } from '../hooks/useTranslation';
import { toApiMediaUrl } from '../utils/mediaUrl';
import './propertyPresentation.css';

interface PropertyPresentationProps {
  name: string;
  address?: string;
  photoUrl?: string;
  propertyHref?: string;
  squareMeters?: number;
  bedrooms?: number;
  bathrooms?: number;
  guests?: number;
  details?: string[];
}

/** Présentation commune du logement sur les fiches métier Baitly. */
export default function PropertyPresentation({ name, address, photoUrl, propertyHref, squareMeters, bedrooms, bathrooms, guests, details = [] }: PropertyPresentationProps) {
  const { t } = useTranslation();
  const facts = [
    { icon: Ruler, value: squareMeters != null ? `${squareMeters} m²` : null },
    { icon: BedDouble, value: bedrooms != null ? t('requestDetail.bedrooms', { count: bedrooms }) : null },
    { icon: Bath, value: bathrooms != null ? t('requestDetail.bathrooms', { count: bathrooms }) : null },
    { icon: Users, value: guests != null ? t('requestDetail.guests', { count: guests }) : null },
  ].filter(fact => fact.value != null);

  return <section aria-label={t('requestDetail.property')} className="baitly-request-property baitly-property-presentation">
    <div className="baitly-property-presentation__identity">
      <Avatar className="baitly-property-presentation__photo">
        <AvatarImage src={toApiMediaUrl(photoUrl)} alt={name} />
        <AvatarFallback><Home className="size-8" aria-hidden /></AvatarFallback>
      </Avatar>
      <div className="baitly-property-presentation__copy">
        <p className="baitly-property-presentation__label">{t('requestDetail.property')}</p>
        <h2 dir="auto">{name}</h2>
        {address && <p className="baitly-property-presentation__address"><MapPin className="size-4 shrink-0" aria-hidden /><span dir="auto">{address}</span></p>}
      </div>
      {facts.length > 0 && <ul className="baitly-property-presentation__facts">
        {facts.map(({ icon: Icon, value }, index) => <li key={index}><Icon className="size-4" aria-hidden /><span>{value}</span></li>)}
      </ul>}
      {details.length > 0 && <p className="baitly-property-presentation__details">{details.join(' · ')}</p>}
    </div>
    {(address || propertyHref) && <div className="baitly-property-presentation__actions">
      {address && <DirectionsMenu target={{ address, label: name || address }}><Button className="baitly-property-presentation__directions" variant="outline"><Navigation className="size-4" aria-hidden /><span>{t('requestDetail.directions')}</span></Button></DirectionsMenu>}
      {propertyHref && <Button className="baitly-property-presentation__link" variant="ghost" asChild><Link to={propertyHref}><span>{t('serviceRequests.details.viewProperty')}</span><ArrowUpRight className="size-4" aria-hidden /></Link></Button>}
    </div>}
  </section>;
}
