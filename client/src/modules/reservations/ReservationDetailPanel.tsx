import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, SquarePen, UserRound, CircleX } from '../../icons/glyphs';
import { Button } from '../../components/ui';
import GuestAvatar from '../../components/GuestAvatar';
import PropertyThumb from '../../components/PropertyThumb';
import { Money } from '../../components/Money';
import IllustratedHeading from '../../components/IllustratedHeading';
import { RESERVATION_ART, reservationStatusArt } from '../../components/reservations/reservationArtwork';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import type { Reservation } from '../../services/api/reservationsApi';
import { ReservationSourceBadge, ReservationStatusChip } from './ReservationStatusChip';
import ReservationPaymentSection from './ReservationPaymentSection';
import { formatStayDay, nightsBetween } from './reservationFormat';

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
        <img src={RESERVATION_ART.arrival} alt="" width={40} height={40} />
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
        <img src={RESERVATION_ART.departure} alt="" width={40} height={40} />
        <div>
          <span className="rsv-stay__label">{t('reservations.fields.checkOut')}</span>
          <strong>{formatStayDay(r.checkOut)}</strong>
          {r.checkOutTime && <span className="rsv-stay__time">{t('reservationsWorkspace.departureBy', { time: r.checkOutTime })}</span>}
        </div>
      </div>
    </div>
  );
}

function Facts({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="rsv-facts">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
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
  const address = property ? [property.address, [property.postalCode, property.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
  const hasBreakdown = r.adultsCount != null || r.childrenCount != null;

  return (
    <article className="rsv-detail">
      <header className="rsv-detail__header">
        <img src={reservationStatusArt(r.status)} alt="" width={56} height={56} />
        <div className="rsv-detail__identity">
          <h2 ref={headingRef} tabIndex={-1} dir="auto">{r.guestName}</h2>
          <div className="rsv-detail__tags">
            <ReservationStatusChip status={r.status} />
            <ReservationSourceBadge source={r.source} />
            {r.confirmationCode && <span className="rsv-detail__code" dir="ltr">{r.confirmationCode}</span>}
          </div>
        </div>
        <div className="rsv-detail__actions">
          <Button variant="outline" size="sm" onClick={onEdit}>
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
      </header>

      <StayBand reservation={r} />

      <div className="rsv-amount">
        <span className="rsv-amount__label">{t('reservationsWorkspace.amount')}</span>
        <strong className="rsv-amount__value">
          {r.totalPrice > 0 ? <Money value={r.totalPrice} from="EUR" symbolSize={22} /> : t('planning.panel.fin.notDisclosed')}
        </strong>
        {r.totalPrice > 0 && nights > 0 && (
          <span className="rsv-amount__average">
            <Money value={r.totalPrice / nights} from="EUR" /> {t('reservationsWorkspace.perNight')}
          </span>
        )}
      </div>

      <section className="rsv-section">
        <IllustratedHeading
          art={RESERVATION_ART.guest}
          title={t('reservationsWorkspace.guest.title')}
          hint={t('reservationsWorkspace.guest.hint')}
          action={onOpenGuest && (
            <Button variant="ghost" size="sm" onClick={onOpenGuest}>
              <UserRound size={15} />
              {t('reservationsWorkspace.guest.profile')}
            </Button>
          )}
        />
        <div className="rsv-contact">
          <GuestAvatar
            name={r.guestName}
            photoUrl={guestPhotoSrc(r.guestAvatarUrl)}
            size={40}
            sx={{ background: 'var(--bui-muted)', color: 'var(--bui-muted-foreground)', fontSize: 13 }}
          />
          <div className="rsv-contact__lines">
            <span className="rsv-contact__name" dir="auto">{r.guestName}</span>
            {r.guestEmail && <a href={`mailto:${r.guestEmail}`} dir="ltr"><Mail size={13} aria-hidden="true" />{r.guestEmail}</a>}
            {r.guestPhone && <a href={`tel:${r.guestPhone}`} dir="ltr"><Phone size={13} aria-hidden="true" />{r.guestPhone}</a>}
            {!r.guestEmail && !r.guestPhone && <span className="rsv-contact__missing">{t('reservationsWorkspace.guest.noContact')}</span>}
          </div>
        </div>
        <Facts items={hasBreakdown
          ? [
              { label: t('reservationsWorkspace.guest.adults'), value: r.adultsCount ?? 0 },
              { label: t('reservationsWorkspace.guest.children'), value: r.childrenCount ?? 0 },
            ]
          : [{ label: t('reservationsWorkspace.guest.travellers'), value: r.guestCount }]}
        />
      </section>

      <section className="rsv-section">
        <IllustratedHeading
          art={RESERVATION_ART.property}
          title={t('reservationsWorkspace.property.title')}
          hint={property?.city || undefined}
          action={r.propertyId ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/properties/${r.propertyId}`}>{t('reservationsWorkspace.property.open')}</Link>
            </Button>
          ) : undefined}
        />
        <div className="rsv-property">
          <PropertyThumb seed={String(r.propertyId ?? r.propertyName)} photo={property?.imageUrl ?? property?.photoUrls?.[0]} className="h-[84px] w-[126px] rounded-xl" />
          <div className="rsv-property__text">
            <span className="rsv-property__name" dir="auto">{r.propertyName}</span>
            {address && <span className="rsv-property__address" dir="auto">{address}</span>}
            {property && (
              <span className="rsv-property__capacity">
                {t('reservationsWorkspace.property.capacity', { guests: property.guests, bedrooms: property.bedrooms })}
              </span>
            )}
          </div>
        </div>
      </section>

      <ReservationPaymentSection reservation={r} />

      {r.notes && (
        <section className="rsv-section">
          <IllustratedHeading art={RESERVATION_ART.notes} title={t('reservationsWorkspace.notes.title')} hint={t('reservationsWorkspace.notes.hint')} />
          <p className="rsv-notes" dir="auto">{r.notes}</p>
        </section>
      )}
    </article>
  );
}
