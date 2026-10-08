import React from 'react';
import { ChevronRight } from '../../icons/glyphs';
import PropertyThumb from '../../components/PropertyThumb';
import { Money } from '../../components/Money';
import { useTranslation } from '../../hooks/useTranslation';
import type { Reservation } from '../../services/api/reservationsApi';
import { getSourceLogo } from '../planning/utils/sourceLogos';
import { getChannelChipTokens } from '../../utils/channelChipTokens';
import { ReservationStatusChip } from './ReservationStatusChip';
import { formatStayRange, nightsBetween } from './reservationFormat';

interface ReservationListItemProps {
  reservation: Reservation;
  photo?: string;
  active: boolean;
  detailId: string;
  onSelect: (reservation: Reservation, trigger: HTMLButtonElement) => void;
}

/** Logo du canal, ou sa pastille quand il n'en a pas (vente directe). Le nom suit en texte masqué. */
function SourceMark({ reservation }: { reservation: Reservation }) {
  const { t } = useTranslation();
  const logo = getSourceLogo(reservation.source);
  const label = reservation.sourceName || t(`reservations.source.${reservation.source}`);
  return (
    <span className="rsv-row__source" title={label}>
      {logo
        ? <img src={logo} alt="" width={14} height={14} />
        : <span className="rsv-row__source-dot" style={{ backgroundColor: getChannelChipTokens(reservation.source).color }} />}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Une réservation dans la liste : qui, où, quand, combien, et où en est le séjour. */
export default function ReservationListItem({ reservation: r, photo, active, detailId, onSelect }: ReservationListItemProps) {
  const { t } = useTranslation();
  const nights = nightsBetween(r.checkIn, r.checkOut);
  const nightsLabel = `${nights} ${t(nights > 1 ? 'reservations.dialog.nights' : 'reservations.dialog.night')}`;
  const range = formatStayRange(r.checkIn, r.checkOut);

  return (
    <li data-highlight-id={String(r.id)} data-active={active}>
      <button
        type="button"
        className="rsv-row"
        aria-pressed={active}
        aria-controls={detailId}
        onClick={(event) => onSelect(r, event.currentTarget)}
      >
        <PropertyThumb seed={String(r.propertyId ?? r.propertyName)} photo={photo} className="h-[42px] w-[60px] rounded-[9px]" />
        <span className="rsv-row__main">
          <span className="rsv-row__guest" dir="auto">{r.guestName}</span>
          <span className="rsv-row__property">
            <SourceMark reservation={r} />
            <span dir="auto">{r.propertyName}</span>
          </span>
          <span className="rsv-row__inline-stay">{range} · {nightsLabel}</span>
        </span>
        <span className="rsv-row__stay">
          <span className="rsv-row__dates">{range}</span>
          <span className="rsv-row__nights">{nightsLabel}</span>
        </span>
        <span className="rsv-row__side">
          <span className="rsv-row__amount">
            {r.totalPrice > 0 ? <Money value={r.totalPrice} from="EUR" /> : '—'}
          </span>
          <ReservationStatusChip status={r.status} />
        </span>
        <ChevronRight size={15} className="rsv-row__chevron" aria-hidden="true" />
      </button>
    </li>
  );
}
