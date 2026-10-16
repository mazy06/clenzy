import { Skeleton } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import type { Reservation } from '../../../services/api/reservationsApi';
import ReservationMapRow from './ReservationMapRow';
import { MapLinkedRow } from './MapRowInteractions';

/** Liste de la vue Réservations : les séjours des logements de la zone visible, par date d'arrivée. */
export default function ReservationsMapList({ reservations, loading, failed }: {
  reservations: Reservation[]; loading: boolean; failed: boolean;
}) {
  const { t } = useTranslation();
  if (loading) return <div className="space-y-2 p-3" role="status"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>;
  if (failed) return <p role="alert" className="m-0 p-3 text-sm text-[var(--bui-destructive-ink)]">{t('propertyMap.reservationsLoadError', 'Les réservations n’ont pas pu être chargées.')}</p>;
  if (reservations.length === 0) {
    return <p className="m-0 p-3 text-sm text-muted-foreground">{t('propertyMap.reservationsEmpty', 'Aucun séjour en cours ou à venir dans cette zone.')}</p>;
  }
  return <>{reservations.map((reservation) => <MapLinkedRow key={reservation.id} propertyId={reservation.propertyId}><ReservationMapRow reservation={reservation} /></MapLinkedRow>)}</>;
}
