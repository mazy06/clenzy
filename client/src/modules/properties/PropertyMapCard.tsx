import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import StatusChip from '../../components/StatusChip';
import {
  MapCard,
  MapCardAction,
  MapCardError,
  MapCardFacts,
  MapCardFooter,
  MapCardHeader,
  MapCardPerson,
  MapCardSkeleton,
} from '../../components/map/MapCard';
import { KingBed, LocationOn, People } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { propertiesApi } from '../../services/api/propertiesApi';
import { getPropertyStatusLabel, getPropertyTypeLabel } from '../../utils/statusUtils';
import { propertyStatusTokens } from './propertiesListConstants';

/**
 * Fiche d'un logement dans la bulle de carte : photos, adresse, propriétaire,
 * capacité. Chargée au clic sur le marqueur (une seule requête, mise en cache).
 */
export default function PropertyMapCard({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['properties', 'map-card', propertyId],
    queryFn: () => propertiesApi.getById(propertyId),
    staleTime: 60_000,
  });

  if (query.isError) return <MapCardError onRetry={() => void query.refetch()} />;
  if (!query.data) return <MapCardSkeleton />;
  const property = query.data;
  const address = [property.address, [property.postalCode, property.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  return (
    <MapCard photos={property.photoUrls} alt={property.name}>
      <MapCardHeader
        eyebrow={getPropertyTypeLabel(property.type, t)}
        title={property.name}
        status={
          <StatusChip pill tokens={propertyStatusTokens(property.status)} label={getPropertyStatusLabel(property.status, t)} />
        }
      />
      <MapCardFacts
        facts={[
          { icon: <LocationOn size={14} />, label: t('properties.address'), value: address },
          property.bedroomCount != null && {
            icon: <KingBed size={14} />,
            label: t('properties.bedrooms'),
            value: (
              <span className="tabular-nums">
                {property.bedroomCount} {t('properties.bedrooms').toLowerCase()}
              </span>
            ),
          },
          property.maxGuests != null && {
            icon: <People size={14} />,
            label: t('properties.guests'),
            value: (
              <span className="tabular-nums">
                {property.maxGuests} {t('properties.guests').toLowerCase()}
              </span>
            ),
          },
        ]}
      />
      <MapCardFooter>
        {property.ownerName ? <MapCardPerson name={property.ownerName} role={t('properties.owner')} /> : <span />}
        <MapCardAction label={t('properties.viewDetails')} onClick={() => navigate(`/properties/${property.id}`)} />
      </MapCardFooter>
    </MapCard>
  );
}
