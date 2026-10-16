import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage, Popover, PopoverAnchor, PopoverTrigger } from '../../../components/ui';
import MapRowPreview from '../../../components/map/MapRowPreview';
import { Link } from 'react-router-dom';
import { ReservationStatusChip } from '../../reservations/ReservationStatusChip';
import { RESERVATION_SOURCE_LABELS, type Reservation } from '../../../services/api/reservationsApi';
import { activeIntlLocale } from '../../../utils/activeLocale';
import { toApiMediaUrl } from '../../../utils/mediaUrl';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
import { ChevronRight } from '../../../icons/glyphs';
import { useMapRowFocus } from './MapRowInteractions';

/** Nuits entre deux dates aaaa-mm-jj (sans fuseau : ce sont des dates de séjour). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.max(0, Math.round((day(checkOut) - day(checkIn)) / 86_400_000));
}

const stayDate = (iso: string) => new Intl.DateTimeFormat(activeIntlLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' })
  .format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

/** Un séjour : voyageur, logement (sauf dans sa propre fiche), dates, canal, statut. Ouvre la réservation. */
export default function ReservationMapRow({ reservation, showProperty = true, compact = false }: {
  reservation: Reservation; showProperty?: boolean; compact?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const locate = useMapRowFocus();
  const open = () => navigate(`/reservations?highlight=${reservation.id}`);
  const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
  const initials = reservation.guestName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  const source = reservation.sourceName || RESERVATION_SOURCE_LABELS[reservation.source] || reservation.source;
  const content = <>
      <Avatar size="sm" className={compact ? 'size-6' : 'size-9'}>
        <AvatarImage src={toApiMediaUrl(reservation.guestAvatarUrl)} alt="" />
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('truncate font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>{reservation.guestName}</span>
        {showProperty && <span className="truncate text-xs text-muted-foreground">{reservation.propertyName}</span>}
        <span className={cn('truncate tabular-nums text-muted-foreground', compact ? 'text-2xs' : 'text-xs')}>
          {stayDate(reservation.checkIn)} → {stayDate(reservation.checkOut)}
          {' · '}{t('propertyMap.nights', { count: nights, defaultValue: '{{count}} nuit(s)' })}
          {source ? ` · ${source}` : ''}
        </span>
      </span>
      <span className="shrink-0 [&>*]:scale-90"><ReservationStatusChip status={reservation.status} /></span>
  </>;
  return (
    <Popover><PopoverAnchor asChild><div data-map-preview-anchor className="flex items-stretch"><button type="button" onClick={locate ?? open}
      className={cn('flex w-full cursor-pointer items-center gap-3 text-start transition-colors duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        compact ? 'rounded-md px-1.5 py-1.5' : 'px-4 py-3')}>
      {content}
    </button>
    {locate && <PopoverTrigger asChild><button type="button" aria-label={`${t('common.details', 'Détails')} · ${reservation.guestName}`}
      className="flex w-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
      <ChevronRight className="size-4" aria-hidden />
    </button></PopoverTrigger>}</div></PopoverAnchor>
    {locate && <MapRowPreview label={reservation.guestName} side="start">
      <div className="p-4 pt-9"><div className="flex items-center gap-3">{content}</div>
        <Link to={`/reservations?highlight=${reservation.id}`} className="mt-4 flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-muted px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          {t('common.viewDetails', 'Voir les détails')}<ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </MapRowPreview>}
    </Popover>
  );
}
