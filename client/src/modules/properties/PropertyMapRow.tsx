import { Link } from 'react-router-dom';
import { Bath, BedDouble, ChevronRight, Users } from '../../icons/glyphs';
import StatusChip from '../../components/StatusChip';
import { Money } from '../../components/Money';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import ChannexHealthBadge from '../settings/components/ChannexHealthBadge';
import MissingContractChip from './MissingContractChip';
import { PropertyThumb } from '../notifications/NotificationPropertyPanel';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { ChannexMappingDto } from '../../services/api/channexApi';
import {
  getPropertyStatusLabel,
  getPropertyTypeLabel,
  getPropertyTypeHex,
} from '../../utils/statusUtils';
import { propertyStatusTokens } from './propertiesListConstants';
import './baitlyPropertyMap.css';

/**
 * Une ligne de la vue carte des logements, dans la langue des deux autres
 * cartes de l'application (demandes de service, interventions) : la ligne
 * ENTIERE est cliquable, la vignette ancre le logement, et le pied de ligne
 * porte capacite a gauche / statut a droite.
 *
 * <h2>Pourquoi le lien est etire et non enveloppant</h2>
 * <p>La sante Channex et le contrat manquant sont des actions indépendantes.
 * Or ce sont de vrais `<button>` — `StatusChip onClick` et
 * `ChannexHealthBadge` en rendent un — et un bouton imbrique dans une ancre
 * est invalide : le navigateur y reagit de facon imprevisible.</p>
 *
 * <p>Le lien ne porte donc que le NOM, et couvre la ligne entiere par un
 * pseudo-element absolu. Les puces se replacent au-dessus de ce calque
 * (`relative z-10`) et redeviennent cliquables. Contrepartie assumee du
 * procede : le texte recouvert n'est plus selectionnable et ne porte plus
 * d'infobulle native — d'ou les libelles en `sr-only` sur la capacite.</p>
 */
export default function PropertyMapRow({
  property,
  channexMapping,
  onDiagnose,
  showMissingContract,
  onMissingContractClick,
}: {
  property: PropertyListItem;
  channexMapping?: ChannexMappingDto;
  onDiagnose: (propertyId: number, propertyName: string) => void;
  showMissingContract: boolean;
  onMissingContractClick: (propertyId: number) => void;
}) {
  const { t } = useTranslation();
  const id = Number(property.id);

  const capacity = [
    { Icon: Users, value: property.guests, label: t('properties.guests') },
    { Icon: BedDouble, value: property.bedrooms, label: t('properties.bedrooms') },
    { Icon: Bath, value: property.bathrooms, label: t('properties.bathrooms') },
  ].filter((item) => item.value > 0);

  return (
    <article
      className={cn(
        'baitly-property-map-row group relative text-foreground',
        'transition-colors duration-150 motion-reduce:transition-none hover:bg-muted',
        'focus-within:outline-2 focus-within:outline-primary focus-within:-outline-offset-2',
      )}
    >
      <PropertyThumb
        property={{ id: property.id, coverPhotoUrl: property.imageUrl, photoUrls: property.photoUrls }}
        name={property.name}
        className="baitly-property-map-photo"
      />
      <div className="baitly-property-map-identity">
        <span className="baitly-property-map-type">
          <span aria-hidden className="size-2 shrink-0 rounded-[2.5px]"
            style={{ backgroundColor: getPropertyTypeHex(property.type) }} />
          {getPropertyTypeLabel(property.type, t)}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {channexMapping && (
            <span className="relative z-10 inline-flex">
              <ChannexHealthBadge
                mapping={channexMapping}
                size={9}
                variant="dot"
                onClick={() => onDiagnose(id, property.name)}
              />
            </span>
          )}
          <Link
            to={`/properties/${property.id}`}
            dir="auto"
            className={cn(
              'baitly-property-map-name min-w-0 text-foreground no-underline',
              "cursor-pointer outline-none after:absolute after:inset-0 after:content-['']",
            )}
          >
            {property.name}
          </Link>
        </div>
        <div className="baitly-property-map-address">
          <span className="baitly-property-map-street">{property.address}</span>
          <span className="baitly-property-map-place">
            {[property.postalCode, property.city].filter(Boolean).join(' ')}
          </span>
        </div>
      </div>
      <div className="baitly-property-map-price">
        <span className="baitly-property-map-price-label">{t('properties.nightlyPrice')}</span>
        {property.nightlyPrice > 0 ? (
          <span className="baitly-property-map-amount tabular-nums">
            <Money value={property.nightlyPrice} from="EUR" decimals={0} />
            <span className="baitly-property-map-unit">
              {t('properties.perNight')}
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
      <ChevronRight className="baitly-property-map-chevron size-4 text-muted-foreground" aria-hidden />

      <div
        className={cn(
          'baitly-property-map-footer flex flex-wrap items-center gap-2',
          capacity.length > 0 ? 'justify-between' : 'justify-end',
        )}
      >
        {capacity.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
            {capacity.map(({ Icon, value, label }) => (
              <span key={label} className="flex items-center gap-1">
                <Icon className="size-3.5" aria-hidden />
                {value}
                <span className="sr-only"> {label}</span>
              </span>
            ))}
          </div>
        )}
        <div className="baitly-property-map-states">
          {showMissingContract && (
            <span className="baitly-property-map-contract relative z-10 inline-flex">
              <MissingContractChip onClick={() => onMissingContractClick(id)} />
            </span>
          )}
          <StatusChip pill tokens={propertyStatusTokens(property.status)}
            label={getPropertyStatusLabel(property.status, t)} />
        </div>
      </div>
    </article>
  );
}
