import { useMemo, type ReactNode } from 'react';
import { CalendarDays, ClipboardList } from '../../../icons/glyphs';
import { ChevronNext } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { activeIntlLocale } from '../../../utils/activeLocale';
import type { Reservation } from '../../../services/api/reservationsApi';
import { isoDay, upcomingPrestations } from '../prestations/prestationTimeline';
import { usePropertyPrestationList } from '../prestations/usePropertyPrestationList';
import { useReservationWindow } from './mapViewData';
import type { PropertyMapView } from './propertyMapView';

/** Séjour en cours (arrivé, pas encore parti) sinon le prochain. */
export function currentOrNextStay(reservations: Reservation[], today: string): Reservation | undefined {
  return reservations.find((r) => r.checkIn <= today && r.checkOut > today)
    ?? reservations.find((r) => r.checkIn >= today);
}

/**
 * Bas de fiche de la vue Logements : la prochaine prestation et le séjour en cours (ou le
 * prochain), chacun menant à sa vue.
 */
export default function PropertyDaySummary({ propertyId, onShowView }: {
  propertyId: number; onShowView: (view: PropertyMapView) => void;
}) {
  const { t } = useTranslation();
  const today = useMemo(() => new Date(), []);
  const { prestations, loading } = usePropertyPrestationList(propertyId, today);
  const stays = useReservationWindow(true, [propertyId]);
  const next = upcomingPrestations(prestations, today)[0];
  const stay = currentOrNextStay(stays.data ?? [], isoDay(today));
  const locale = activeIntlLocale();
  const when = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
  const inHouse = stay && stay.checkIn <= isoDay(today);

  return (
    <section className="flex flex-col gap-1 border-t border-border pt-2" aria-label={t('propertyMap.summary', 'Aujourd’hui')}>
      <SummaryRow icon={<ClipboardList size={15} aria-hidden />} label={t('propertyMap.nextPrestation', 'Prochaine prestation')}
        value={loading ? '…' : next ? `${next.title} · ${when.format(next.date)}` : t('propertyPrestations.noneUpcoming', 'Aucune prestation à venir.')}
        onClick={() => onShowView('prestations')} />
      <SummaryRow icon={<CalendarDays size={15} aria-hidden />}
        label={inHouse ? t('propertyMap.currentStay', 'Séjour en cours') : t('propertyMap.nextStay', 'Prochaine arrivée')}
        value={stays.isLoading ? '…' : stay ? `${stay.guestName} · ${day(stay.checkIn)} → ${day(stay.checkOut)}` : t('propertyMap.noStay', 'Aucun séjour dans les 30 prochains jours.')}
        onClick={() => onShowView('reservations')} />
    </section>
  );
}

function SummaryRow({ icon, label, value, onClick }: { icon: ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-start transition-colors duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--bui-navy-soft)] text-[var(--bui-navy)]">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-2xs text-muted-foreground">{label}</span>
        <span className="truncate text-xs font-medium tabular-nums text-foreground">{value}</span>
      </span>
      <ChevronNext size={14} className="shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}
