import React from 'react';
import PropertyPresentation from '../../components/PropertyPresentation';
import { SquarePen, UserRound, Users, Baby, CircleX, CalendarDays, StickyNote, LogIn, LogOut, Hash } from '../../icons/glyphs';
import { Button } from '../../components/ui';
import ContactPresentation from '../../components/ContactPresentation';
import { Money } from '../../components/Money';
import IllustratedHeading from '../../components/IllustratedHeading';
import { RESERVATION_ART } from '../../components/reservations/reservationArtwork';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import type { Reservation } from '../../services/api/reservationsApi';
import { ReservationSourceBadge, ReservationStatusChip } from './ReservationStatusChip';
import ReservationPaymentSection from './ReservationPaymentSection';
import BaitlyReservationDepositSection from './BaitlyReservationDepositSection';
import BaitlyReservationPaidServices from './BaitlyReservationPaidServices';
import { formatStayDay, nightsBetween } from './reservationFormat';
import '../service-requests/baitlyRequestDetail.css';
import './baitlyReservationDetail.css';

interface ReservationDetailPanelProps {
  reservation: Reservation;
  property?: PropertyListItem;
  headingRef: React.Ref<HTMLHeadingElement>;
  onEdit: () => void;
  onCancel: () => void;
  onOpenGuest?: () => void;
}

/** Arrivée et départ de part et d'autre de la durée : ce qu'on vient chercher en premier. */
function StayBand({ reservation: r }: { reservation: Reservation }) {
  const { t } = useTranslation();
  const nights = nightsBetween(r.checkIn, r.checkOut);
  return (
    <div className="rsv-stay">
      <div className="rsv-stay__point">
        <LogIn className="size-4 shrink-0" aria-hidden />
        <div>
          <span className="rsv-stay__label">{t('reservations.fields.checkIn')}</span>
          <strong>{formatStayDay(r.checkIn)}</strong>
          {r.checkInTime && <span className="rsv-stay__time">{t('reservationsWorkspace.arrivalFrom', { time: r.checkInTime })}</span>}
        </div>
      </div>
      <div className="rsv-stay__span">
        <span>{nights} {t(nights > 1 ? 'reservations.dialog.nights' : 'reservations.dialog.night')}</span>
      </div>
      <div className="rsv-stay__point">
        <LogOut className="size-4 shrink-0" aria-hidden />
        <div>
          <span className="rsv-stay__label">{t('reservations.fields.checkOut')}</span>
          <strong>{formatStayDay(r.checkOut)}</strong>
          {r.checkOutTime && <span className="rsv-stay__time">{t('reservationsWorkspace.departureBy', { time: r.checkOutTime })}</span>}
        </div>
      </div>
    </div>
  );
}

function Facts({ items }: { items: { label: string; value: React.ReactNode; icon?: React.ReactNode }[] }) {
  return (
    <dl className="rsv-facts">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.icon}{item.label}</dt>
          <dd>{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ReservationDetailPanel({ reservation: r, property, headingRef, onEdit, onCancel, onOpenGuest }: ReservationDetailPanelProps) {
  const { t } = useTranslation();
  const nights = nightsBetween(r.checkIn, r.checkOut);
  const cancellable = r.status !== 'cancelled' && r.status !== 'checked_out';
  const address = property ? [property.address, [property.postalCode, property.city].filter(Boolean).join(' '), property.country].filter(Boolean).join(', ') : '';
  const hasBreakdown = r.adultsCount != null || r.childrenCount != null;

  return (
    <article className="rsv-detail baitly-request-detail baitly-reservation-detail">
      <header className="rsv-detail__header baitly-request-tracking">
        <div className="rsv-detail__identity">
          <p className="baitly-request-eyebrow">{t('reservationsWorkspace.listTitle')} · #{r.id}</p>
          <h2 ref={headingRef} tabIndex={-1} dir="auto">{r.guestName}</h2>
        </div>
        <div className="rsv-detail__actions">
          <Button variant="default" size="sm" onClick={onEdit}>
            <SquarePen size={15} />
            {t('reservationsWorkspace.edit')}
          </Button>
          {cancellable && (
            <Button variant="ghost" size="sm" className="text-destructive-ink hover:text-destructive-ink" onClick={onCancel}>
              <CircleX size={15} />
              {t('reservationsWorkspace.cancel')}
            </Button>
          )}
        </div>
        <div className="rsv-detail__tags">
          <ReservationStatusChip status={r.status} />
          <ReservationSourceBadge source={r.source} />
          {r.confirmationCode && <span className="rsv-detail__reference" title={t('reservations.fields.confirmationCode')}>
            <Hash aria-hidden />
            <span className="sr-only">{t('reservations.fields.confirmationCode')} : </span>
            <span className="rsv-detail__code" dir="ltr">{r.confirmationCode}</span>
          </span>}
        </div>
      </header>
      <div className="baitly-request-layout">
        <div className="baitly-request-main rsv-detail-main">
      <PropertyPresentation name={r.propertyName} address={address}
        photoUrl={property?.imageUrl ?? property?.photoUrls?.[0]}
        propertyHref={r.propertyId ? `/properties/${r.propertyId}` : undefined}
        squareMeters={property?.squareMeters} bedrooms={property?.bedrooms}
        bathrooms={property?.bathrooms} guests={property?.guests} />

      <section className="rsv-section rsv-guest-section">
        <IllustratedHeading
          art={RESERVATION_ART.guest}
          icon={<UserRound className="size-4 shrink-0" aria-hidden />}
          title={t('reservationsWorkspace.guest.title')}
          action={onOpenGuest && (
            <Button variant="outline" size="sm" className="rsv-guest-profile" onClick={onOpenGuest}>
              <UserRound size={15} />
              {t('reservationsWorkspace.guest.profile')}
            </Button>
          )}
        />
        <ContactPresentation name={r.guestName} photoUrl={guestPhotoSrc(r.guestAvatarUrl)}
          email={r.guestEmail} phone={r.guestPhone}>
        <Facts items={hasBreakdown
          ? [
              { label: t('reservationsWorkspace.guest.adults'), value: r.adultsCount ?? 0, icon: <Users aria-hidden /> },
              { label: t('reservationsWorkspace.guest.children'), value: r.childrenCount ?? 0, icon: <Baby aria-hidden /> },
            ]
          : [{ label: t('reservationsWorkspace.guest.travellers'), value: r.guestCount, icon: <Users aria-hidden /> }]}
        />
        </ContactPresentation>
      </section>

      <BaitlyReservationPaidServices reservationId={r.id} />

      {r.notes && (
        <section className="rsv-section rsv-notes-section">
          <IllustratedHeading art={RESERVATION_ART.notes} icon={<StickyNote className="size-4 shrink-0" aria-hidden />} title={t('reservationsWorkspace.notes.title')} />
          <p className="rsv-notes" dir="auto">{r.notes}</p>
        </section>
      )}

        </div>
        <aside className="baitly-request-sidebar rsv-detail-sidebar">
          <section className="baitly-request-schedule rsv-dates-section">
            <h3 className="m-0 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4" aria-hidden />{t('reservations.dialog.stayDates')}</h3>
            <StayBand reservation={r} />
          </section>
          <section className="rsv-section rsv-pricing-section">
            <h3>{t('reservations.dialog.pricingSection')}</h3>
            <div className="rsv-amount">
              <span className="rsv-amount__label">{t('reservationsWorkspace.amount')}</span>
              <strong className="rsv-amount__value">{r.totalPrice > 0 ? <Money value={r.totalPrice} from="EUR" symbolSize={22} /> : t('planning.panel.fin.notDisclosed')}</strong>
              {r.totalPrice > 0 && nights > 0 && <span className="rsv-amount__average"><Money value={r.totalPrice / nights} from="EUR" /> {t('reservationsWorkspace.perNight')}</span>}
            </div>
            {(r.cleaningFee != null || r.touristTaxAmount != null) && <Facts items={[
              ...(r.cleaningFee != null ? [{ label: t('reservations.dialog.cleaningLine'), value: <Money value={r.cleaningFee} from="EUR" /> }] : []),
              ...(r.touristTaxAmount != null ? [{ label: t('reservations.dialog.touristTaxLine'), value: <Money value={r.touristTaxAmount} from="EUR" /> }] : []),
            ]} />}
          </section>
          <ReservationPaymentSection reservation={r} />
          <BaitlyReservationDepositSection reservationId={r.id} showMissing />
        </aside>
      </div>
    </article>
  );
}
