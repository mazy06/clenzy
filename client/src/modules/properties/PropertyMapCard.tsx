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
import PropertyPrestations from './prestations/PropertyPrestations';
import PropertyReservations from './map-views/PropertyReservations';
import PropertyIssues from './map-views/PropertyIssues';
import PropertyDaySummary from './map-views/PropertyDaySummary';
import type { PropertyMapView } from './map-views/propertyMapView';
import PropertyMapPreview from './PropertyMapPreview';

/**
 * Fiche d'un logement dans la bulle de carte : photos, adresse, propriétaire,
 * capacité, puis ses prestations (interventions et demandes réunies). Chargée au clic
 * sur le marqueur, mise en cache.
 */
/**
 * `view` choisit le bas de la fiche (résumé du jour, prestations ou séjours) ; le haut —
 * photos, détails, propriétaire — ne change pas. `onDayAssignee` : intervenant du jour choisi
 * dans les prestations, pour montrer son secteur.
 */
export default function PropertyMapCard({ propertyId, view = 'prestations', onShowView, onDayAssignee, previewOnly = false }: {
  previewOnly?: boolean;
  propertyId: number;
  view?: PropertyMapView;
  onShowView?: (view: PropertyMapView) => void;
  onDayAssignee?: (userId: number | null) => void;
}) {
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
  if (previewOnly) return <PropertyMapPreview property={property} />;
  const address = [property.address, [property.postalCode, property.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  const footer = (
    <MapCardFooter>
      {property.ownerName ? <MapCardPerson name={property.ownerName} role={t('properties.owner')} /> : <span />}
      <MapCardAction label={t('properties.viewDetails')} onClick={() => navigate(`/properties/${property.id}`)} />
    </MapCardFooter>
  );

  return (
    <MapCard footer={footer} photos={property.photoUrls} alt={property.name} extra={view === 'reservations' ? <PropertyReservations propertyId={property.id} />
      : view === 'issues' ? <PropertyIssues propertyId={property.id} />
      : view === 'properties' && onShowView ? <PropertyDaySummary propertyId={property.id} onShowView={onShowView} />
      : <PropertyPrestations propertyId={property.id} onDayAssignee={onDayAssignee} />}>
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
    </MapCard>
  );
}
