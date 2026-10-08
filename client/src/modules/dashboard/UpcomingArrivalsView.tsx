import { ChevronRightIcon } from '../../icons/glyphs';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import ChannelTag from '../../components/baitly/ChannelTag';
import { channelLogo } from '../../components/channelLogos';
import { WidgetPanel } from '../../components/baitly/WidgetPanel';
import { PropertyThumbnail } from '../../components/baitly/PropertyThumbnail';
import { Money } from '../../components/baitly/Money';
import StatusChip from '../../components/baitly/StatusChip';
import { useTranslation } from '../../hooks/useTranslation';
import { activeIntlLocale } from '../../utils/activeLocale';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import type { DashboardUpcomingArrival } from '../../services/api/dashboardOperationsApi';
import './upcomingArrivals.css';

export function UpcomingArrivalsView({ rows, days, photos, onOpen }: {
  rows: DashboardUpcomingArrival[];
  days: number;
  photos: ReadonlyMap<number, string | undefined>;
  onOpen: (row: DashboardUpcomingArrival) => void;
}) {
  const { t } = useTranslation();
  const title = t('dashboard.upcomingArrivals.title', 'Prochaines arrivées');
  const number = (value: number) => value.toLocaleString(activeIntlLocale());
  const date = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(activeIntlLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
  const guest = (row: DashboardUpcomingArrival) => row.guestName || t('dashboard.today.unknownGuest', 'Voyageur');
  const property = (row: DashboardUpcomingArrival) => row.propertyName || t('dashboard.today.unknownProperty', 'Logement');
  const payment = (row: DashboardUpcomingArrival) => row.amountDue != null && row.amountDue > 0
    ? { tone: 'warn' as const, label: t('dashboard.upcomingArrivals.balanceDue', 'Solde dû') }
    : row.paymentStatus === 'PAID'
      ? { tone: 'ok' as const, label: t('dashboard.upcomingArrivals.paid', 'Payée') }
      : { tone: 'neutral' as const, label: t('dashboard.upcomingArrivals.confirmed', 'Confirmée') };
  return <WidgetPanel title={title} count={rows.length} className="db-upcoming"
    caption={t('dashboard.upcomingArrivals.periodCaption', 'Les {{count}} prochains jours', { count: days })}
    footer={<Link className="bui-widget-panel__link" to="/planning">{t('dashboard.upcomingArrivals.seePlanning', 'Tout le planning')}<ChevronRightIcon className="cn-rtl-flip" aria-hidden="true" /></Link>}>
    {rows.length === 0 ? <p className="bui-widget-panel__empty">{t('dashboard.upcomingArrivals.empty', 'Aucune arrivée sur la période.')}</p>
      : <div className="db-widget-body db-upcoming__body" tabIndex={0} role="region" aria-label={title}>
        <div className="db-upcoming-table">
          <Table>
            <colgroup><col className="db-upcoming-col-guest" /><col /><col className="db-upcoming-col-date" /><col className="db-upcoming-col-nights" /><col className="db-upcoming-col-channel" /><col className="db-upcoming-col-status" /><col className="db-upcoming-col-total" /></colgroup>
            <TableHeader><TableRow>
              {['guest', 'property', 'checkIn', 'nights', 'channel', 'status', 'total'].map((key) => <TableHead key={key}>{t(`dashboard.upcomingArrivals.${key}`)}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>{rows.map((row) => <TableRow key={row.reservationId} onClick={() => onOpen(row)}>
              <TableCell><span className="db-upcoming-identity">
                <GuestAvatar name={guest(row)} photoUrl={guestPhotoSrc(row.guestAvatarUrl)} size={28} />
                <button type="button" className="db-upcoming-guest" onClick={(event) => { event.stopPropagation(); onOpen(row); }}>{guest(row)}</button>
              </span></TableCell>
              <TableCell><span className="db-upcoming-identity"><PropertyThumbnail name={property(row)} src={photos.get(row.propertyId ?? -1)} /><span dir="auto">{property(row)}</span></span></TableCell>
              <TableCell>{date(row.checkIn)}</TableCell>
              <TableCell>{number(row.nights)}</TableCell>
              <TableCell><ChannelTag channel={row.source ?? 'other'} label={row.sourceName ?? undefined} iconOnly /></TableCell>
              <TableCell><StatusChip {...payment(row)} dot size="sm" /></TableCell>
              <TableCell><Money value={row.totalPrice} decimals={0} /></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>
        <ul className="db-upcoming-list">{rows.map((row) => {
          const source = (row.source ?? 'other').toLowerCase().replace('booking.com', 'booking');
          const logo = channelLogo(source);
          return <li key={row.reservationId}><button type="button" className="db-upcoming-mobile-row" onClick={() => onOpen(row)}>
            <span className="db-upcoming-mobile-row__stay">
              <PropertyThumbnail name={property(row)} src={photos.get(row.propertyId ?? -1)} />
              <span className="db-upcoming-mobile-row__identity"><strong dir="auto">{property(row)}</strong>
                <span><GuestAvatar name={guest(row)} photoUrl={guestPhotoSrc(row.guestAvatarUrl)} size={20} />{guest(row)}</span>
              </span>
              {logo ? <img className="db-upcoming-mobile-row__channel" src={logo} alt={row.sourceName || row.source || ''} width={24} height={24} />
                : <span className="db-upcoming-mobile-row__source">{row.sourceName || row.source || t('reservations.source.other', 'Autre')}</span>}
            </span>
            <span className="db-upcoming-mobile-row__details">
              <span>{date(row.checkIn)} · {t('dashboard.upcomingArrivals.stayNights', '{{count}} nuits', { count: row.nights, formatted: number(row.nights) })}</span>
              <strong><Money value={row.totalPrice} decimals={0} /></strong>
            </span>
            <span className="db-upcoming-mobile-row__bottom"><StatusChip {...payment(row)} dot size="sm" /><span>{t('dashboard.today.viewStay', 'Voir le séjour')}<ChevronRightIcon aria-hidden="true" className="cn-rtl-flip" /></span></span>
          </button></li>;
        })}</ul>
      </div>}
  </WidgetPanel>;
}
