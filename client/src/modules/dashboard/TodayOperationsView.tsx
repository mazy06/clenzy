import * as React from 'react';
import { LockOpenIcon } from '../../icons/glyphs';
import { Button } from '../../components/ui';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import StatusChip from '../../components/baitly/StatusChip';
import { Money } from '../../components/baitly/Money';
import { channelLogo } from '../../components/channelLogos';
import { resolveMediaUrl } from '../../config/api';
import { useTranslation } from '../../hooks/useTranslation';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import type { DashboardArrival, DashboardDeparture, DashboardOperations } from '../../services/api/dashboardOperationsApi';
import { getInterventionStatusLabel } from '../../utils/statusUtils';
import { DashboardQueue, DashboardQueueGroup, DashboardQueueRow, DashboardQueueToggle } from './DashboardQueue';
import './todayOperations.css';

const PREVIEW_ROWS = 3;
type Section = 'arrivals' | 'departures' | 'cleanings';
export type TodayReservation = Pick<DashboardArrival | DashboardDeparture, 'reservationId' | 'guestName' | 'propertyName'>;
type TranslateFn = ReturnType<typeof useTranslation>['t'];

/** Uses the same disclosures, rows and fixed footer as “À traiter”. */
export function TodayOperationsView({ data, onOpenReservation, onOpenCleaning, onOpenDeposits }: {
  data?: DashboardOperations;
  onOpenReservation: (reservation: TodayReservation) => void;
  onOpenCleaning: (id: number) => void;
  onOpenDeposits: () => void;
}) {
  const { t } = useTranslation();
  const id = React.useId();
  const [selected, setSelected] = React.useState<Section | null | undefined>(undefined);
  const [expandedSection, setExpandedSection] = React.useState<Section | null>(null);
  const arrivals = data?.arrivals ?? [];
  const departures = data?.departures ?? [];
  const cleanings = data?.cleanings ?? [];
  const groups = [
    { key: 'arrivals' as const, count: arrivals.length, label: t('dashboard.today.arrivals', 'Arrivées aujourd’hui'), hint: t('dashboard.today.arrivalsHint', 'Voyageurs attendus'), empty: t('dashboard.today.noArrivals', 'Aucune arrivée aujourd’hui.'), image: '/images/dashboard-kpis/adr.webp' },
    { key: 'departures' as const, count: departures.length, label: t('dashboard.today.departures', 'Départs aujourd’hui'), hint: t('dashboard.today.departuresHint', 'Séjours qui se terminent'), empty: t('dashboard.today.noDepartures', 'Aucun départ aujourd’hui.'), image: '/images/dashboard-operations/departures.webp' },
    { key: 'cleanings' as const, count: cleanings.length, label: t('dashboard.today.cleanings', 'Ménages du jour'), hint: t('dashboard.today.cleaningsHint', 'Équipes et préparation'), empty: t('dashboard.today.noCleanings', 'Aucun ménage planifié aujourd’hui.'), image: '/images/dashboard-operations/cleanings.webp' },
  ];
  // On the first render (or after the selected section becomes empty), open the
  // first populated section. An explicit collapse remains collapsed.
  const selectedGroup = groups.find((group) => group.key === selected);
  const open = selected === null ? null : selectedGroup?.count ? selected : groups.find((group) => group.count > 0)?.key;
  const showAll = open != null && expandedSection === open;
  const openCount = groups.find((group) => group.key === open)?.count ?? 0;
  const total = arrivals.length + departures.length + cleanings.length;
  const moreLabels = {
    arrivals: t('dashboard.today.moreArrivals', 'Voir les {{count}} autres arrivées', { count: Math.max(0, arrivals.length - PREVIEW_ROWS) }),
    departures: t('dashboard.today.moreDepartures', 'Voir les {{count}} autres départs', { count: Math.max(0, departures.length - PREVIEW_ROWS) }),
    cleanings: t('dashboard.today.moreCleanings', 'Voir les {{count}} autres ménages', { count: Math.max(0, cleanings.length - PREVIEW_ROWS) }),
  };
  const visible = <T,>(rows: T[]) => showAll ? rows : rows.slice(0, PREVIEW_ROWS);
  const unknownGuest = t('dashboard.today.unknownGuest', 'Voyageur non renseigné');
  const unknownProperty = t('dashboard.today.unknownProperty', 'Logement non renseigné');
  const stayAction = t('dashboard.today.viewStay', 'Voir le séjour');
  const time = (value: string | null) => <span className="db-today__time">{value ? <bdi>{value}</bdi> : t('dashboard.today.timeUnknown', 'Horaire à préciser')}</span>;

  return <DashboardQueue title={t('dashboard.widgets.todayOperations', 'Opérations du jour')} count={total}
    className="db-today" caption={t('dashboard.today.summary', 'Séjours et préparation des logements')}
    footer={open && openCount > PREVIEW_ROWS ? <DashboardQueueToggle expanded={showAll}
      onToggle={() => setExpandedSection(showAll ? null : open)} controls={`${id}-${open}-panel`}
      moreLabel={moreLabels[open]} lessLabel={t('dashboard.actionItems.showLess', 'Réduire')} /> : undefined}>
    <div className="db-queue__list">
      {groups.map((group) => <DashboardQueueGroup key={group.key} id={`${id}-${group.key}`} label={group.label}
        count={group.count} open={open === group.key}
        onToggle={() => { setSelected(open === group.key ? null : group.key); setExpandedSection(null); }}
        artwork={<img src={group.image} alt="" width={192} height={192} loading="lazy" decoding="async" />}
        meta={<span className="db-today__section-hint">{group.count ? group.hint : group.empty}</span>}>
        <div className="db-queue-group__rows">
          {group.key === 'arrivals' && visible(arrivals).map((arrival) => {
            const source = arrival.source?.toLowerCase();
            const channel = arrival.sourceName || (source ? t(`reservations.source.${source}`, source) : '');
            const logo = source ? channelLogo(source) : undefined;
            return <DashboardQueueRow key={arrival.reservationId}
              leading={<GuestAvatar name={arrival.guestName ?? '?'} photoUrl={guestPhotoSrc(arrival.guestAvatarUrl)} size={30} />}
              primary={<span className="db-today__identity"><bdi>{arrival.guestName || unknownGuest}</bdi>
                {logo ? <img className="db-today__channel" src={logo} alt={channel} title={channel} width={18} height={18} />
                  : channel && <span className="db-today__section-hint">{channel}</span>}</span>}
              secondary={<><span>{arrival.propertyName || unknownProperty}</span>
                {arrival.note && <span className="db-today__note">{arrival.note}</span>}</>}
              value={time(arrival.checkInTime)} actionLabel={stayAction} onClick={() => onOpenReservation(arrival)} />;
          })}
          {group.key === 'departures' && visible(departures).map((departure) => <DashboardQueueRow key={departure.reservationId}
            leading={<GuestAvatar name={departure.guestName ?? '?'} photoUrl={guestPhotoSrc(departure.guestAvatarUrl)} size={30} />}
            primary={<bdi>{departure.guestName || unknownGuest}</bdi>}
            secondary={<><span>{departure.propertyName || unknownProperty}</span>
              {departure.securityDepositId != null && <span className="db-today__deposit">
                {t('dashboard.today.depositToRelease', 'caution à libérer')}
                {departure.depositToRelease != null && <> · <Money value={departure.depositToRelease} decimals={0} /></>}
              </span>}</>}
            value={time(departure.checkOutTime)} actionLabel={stayAction} onClick={() => onOpenReservation(departure)} />)}
          {group.key === 'cleanings' && visible(cleanings).map((cleaning) => <DashboardQueueRow key={cleaning.interventionId}
            leading={<GuestAvatar name={cleaning.assigneeName ?? '?'} photoUrl={resolveMediaUrl(cleaning.assigneeAvatarUrl)} size={30} />}
            primary={<bdi>{cleaning.propertyName || unknownProperty}</bdi>}
            secondary={<><span>{cleaning.assigneeName || t('dashboard.today.unassigned', 'Intervenant à assigner')}</span>
              <span className="db-today__cleaning-status"><StatusChip size="sm" dot
                tone={cleaning.status === 'IN_PROGRESS' ? 'warn' : cleaning.status === 'COMPLETED' ? 'ok' : cleaning.status === 'CANCELLED' ? 'err' : 'neutral'}
                label={cleaning.status ? getInterventionStatusLabel(cleaning.status, t) : t('dashboard.today.statusUnknown', 'Statut non renseigné')} /></span></>}
            value={time(cleaningWindow(cleaning.windowStart, cleaning.windowEnd, t))}
            actionLabel={t('dashboard.today.viewCleaning', 'Voir la mission')} onClick={() => onOpenCleaning(cleaning.interventionId)} />)}
        </div>
        {group.key === 'departures' && departures.some((departure) => departure.securityDepositId != null) && <div className="db-queue-group__footer db-today__deposit-footer">
          <Button size="sm" className="db-queue__bulk" onClick={onOpenDeposits}><LockOpenIcon aria-hidden="true" />
            {t('dashboard.today.manageDeposits', 'Voir les cautions')}
          </Button>
        </div>}
      </DashboardQueueGroup>)}
    </div>
  </DashboardQueue>;
}

function cleaningWindow(start: string | null, end: string | null, t: TranslateFn): string | null {
  if (start && end) return `${start} – ${end}`;
  if (end) return t('dashboard.today.windowBefore', 'Avant {{end}}', { end });
  if (start) return t('dashboard.today.windowAfter', 'À partir de {{start}}', { start });
  return null;
}
