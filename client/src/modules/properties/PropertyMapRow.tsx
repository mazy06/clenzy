import { Link } from 'react-router-dom';
import { Bath, BedDouble, ChevronRight, Users } from 'lucide-react';
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

/**
 * Une ligne de la vue carte des logements, dans la langue des deux autres
 * cartes de l'application (demandes de service, interventions) : la ligne
 * ENTIERE est cliquable, la vignette ancre le logement, et le pied de ligne
 * porte capacite a gauche / statut a droite.
 *
 * <h2>Pourquoi le lien est etire et non enveloppant</h2>
 * <p>La sante Channex et le contrat manquant se lisent AVEC le nom : ce sont
 * des alertes sur l'identite du logement, pas des mentions de bas de fiche.
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
        'group relative p-4 text-foreground',
        'transition-colors duration-150 motion-reduce:transition-none hover:bg-muted',
        'focus-within:outline-2 focus-within:outline-primary focus-within:-outline-offset-2',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
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
            className={cn(
              'min-w-0 truncate text-sm font-semibold leading-snug text-foreground no-underline',
              "cursor-pointer outline-none after:absolute after:inset-0 after:content-['']",
            )}
          >
            {property.name}
          </Link>
          {showMissingContract && (
            <span className="relative z-10 inline-flex">
              <MissingContractChip onClick={() => onMissingContractClick(id)} />
            </span>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>

      <div className="mt-3 mb-3 grid grid-cols-[minmax(0,1fr)_minmax(90px,34%)] gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {/* Vignette : la primitive partagee, qui absolutise le chemin relatif
              rendu par l'API et retombe sur le degrade d'identite si l'image
              manque ou casse. */}
          <PropertyThumb
            property={{
              id: property.id,
              coverPhotoUrl: property.imageUrl,
              photoUrls: property.photoUrls,
            }}
            name={property.name}
            /* Trois lignes tiennent desormais a cote : adresse, lieu, type. La
               vignette monte d'autant pour que le bloc se lise d'un seul tenant. */
            className="h-14 w-16"
          />
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium">{property.address}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {[property.postalCode, property.city].filter(Boolean).join(' ')}
            </span>
            {/* Le TYPE se lit avec le LIEU, pas avec le nom : il qualifie le bien
                qu'on a sous les yeux. Il garde sa couleur d'identite sur la
                pastille, celle des autres vues. */}
            <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[2.5px]"
                style={{ backgroundColor: getPropertyTypeHex(property.type) }}
              />
              <span className="truncate">{getPropertyTypeLabel(property.type, t)}</span>
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-1.5 border-s border-border ps-3">
          <span className="text-xs text-muted-foreground">{t('properties.nightlyPrice')}</span>
          {property.nightlyPrice > 0 ? (
            <span className="font-[family-name:var(--font-display)] text-sm font-semibold tabular-nums">
              <Money value={property.nightlyPrice} from="EUR" decimals={0} />
              <span className="text-2xs font-normal text-muted-foreground">
                {t('properties.perNight')}
              </span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center gap-2 border-t border-border pt-2',
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
        <StatusChip
          pill
          tokens={propertyStatusTokens(property.status)}
          label={getPropertyStatusLabel(property.status, t)}
        />
      </div>
    </article>
  );
}
