import { useTranslation } from '../../../hooks/useTranslation';
import ReservationMapRow from './ReservationMapRow';
import { useReservationWindow } from './mapViewData';

/** Bas de fiche de la vue Réservations : séjours en cours et à venir (30 jours) du logement. */
export default function PropertyReservations({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation();
  const query = useReservationWindow(true, [propertyId]);
  const reservations = query.data ?? [];
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-2.5" aria-label={t('propertyMap.views.reservations', 'Réservations')}>
      <h4 className="m-0 text-xs font-semibold text-foreground">{t('propertyMap.stays', 'Séjours en cours et à venir')}</h4>
      {query.isLoading && <p role="status" className="m-0 text-xs text-muted-foreground">{t('propertyMap.reservationsLoading', 'Chargement des séjours…')}</p>}
      {query.isError && <p role="alert" className="m-0 text-xs text-[var(--bui-destructive-ink)]">{t('propertyMap.reservationsLoadError', 'Les réservations n’ont pas pu être chargées.')}</p>}
      {query.data && reservations.length === 0 && (
        <p className="m-0 text-xs text-muted-foreground">{t('propertyMap.noStay', 'Aucun séjour dans les 30 prochains jours.')}</p>
      )}
      {reservations.length > 0 && (
        <ul className="m-0 flex max-h-52 list-none flex-col overflow-y-auto overscroll-contain p-0">
          {reservations.map((reservation) => (
            <li key={reservation.id}><ReservationMapRow reservation={reservation} showProperty={false} compact /></li>
          ))}
        </ul>
      )}
    </section>
  );
}
