import { guestPhotoSrc } from '../../services/api/guestsApi';
import React from 'react';
import {
  Button,
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '../../components/ui';
import { useTranslation } from 'react-i18next';
import {
  Home,
  CalendarMonth,
  Login,
  CleaningServices,
  CreditCard,
  ChatBubbleOutline,
  Visibility,
} from '../../icons';
import { RESERVATION_SOURCE_LABELS } from '../../services/api/reservationsApi';
import type { ReservationStatus } from '../../services/api';
import GuestAvatar from '../../components/GuestAvatar';
import type { PlanningEvent } from './types';
import { RESERVATION_STATUS_TOKEN_COLORS } from './constants';
import { getSourceLogo } from './utils/sourceLogos';
import { toDate, daysBetween } from './utils/dateUtils';
import { useDateFormat, type DateFormatApi } from '../../hooks/useDateFormat';

// ─── Popover réservation (maquette Signature) ────────────────────────────────
//
// Carte blanche radius 14, hairline var(--bui-border), shadow-pop, ~290px, ouverte
// au clic sur une brique. Entête avatar + nom + canal ; lignes icône+libellé/
// valeur séparées hairline ; pied : « Message » (messagerie existante) +
// « Détail » (panneau de détail existant). N'affiche QUE des données déjà
// présentes sur l'objet réservation — une ligne sans donnée est omise.

/**
 * Format séjour maquette : « 10 → 13 févr. · 3n » (mois porté par le départ,
 * répété sur l'arrivée seulement s'il diffère).
 *
 * <p>« Même mois » se juge dans le calendrier AFFICHÉ : en arabe, deux dates du
 * même mois grégorien peuvent tomber dans deux mois hégiriens — le mois doit
 * alors être rappelé sur l'arrivée, sans quoi le séjour se lirait
 * « 28 → 2 Chaabane ».</p>
 */
function formatStay(
  startStr: string,
  endStr: string,
  fmt: DateFormatApi,
  nightsSuffix: string,
): string {
  const start = toDate(startStr);
  const end = toDate(endStr);
  const nights = Math.max(1, daysBetween(start, end));
  const startParts = fmt.toDisplayParts(start);
  const endParts = fmt.toDisplayParts(end);
  const sameMonth = startParts.month === endParts.month && startParts.year === endParts.year;
  const startLabel = sameMonth ? fmt.formatDayNumber(start) : fmt.formatDayMonth(start);
  const endLabel = fmt.formatDayMonth(end);
  return `${startLabel} → ${endLabel} · ${nights}${nightsSuffix}`;
}

const ROW_LABEL_FS = '0.6875rem';
const ROW_VALUE_FS = '0.75rem';
const ICON_SIZE = 13;

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-3.5 py-[7px]">
      <div className="inline-flex items-center text-[var(--muted)] shrink-0">
        {icon}
      </div>
      <span className="text-[var(--muted)] shrink-0" style={{ fontSize: ROW_LABEL_FS }}>
        {label}
      </span>
      {/* `ms-auto` (logique) et non `ml-auto` : le `ml` du sx passait par le plugin
          RTL d'Emotion, pas les classes Tailwind. */}
      <span
        className="ms-auto font-semibold tabular-nums min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ fontSize: ROW_VALUE_FS, color: valueColor ?? 'var(--ink)' }}
      >
        {value}
      </span>
    </div>
  );
}

interface ReservationPopoverProps {
  anchorEl: HTMLElement;
  event: PlanningEvent;
  /** Interventions absorbées dans la brique (pour la ligne « Ménage »). */
  linkedInterventions?: PlanningEvent[];
  onClose: () => void;
  /** Ouvre le détail réservation existant (drawer/panel actuel). */
  onDetail: () => void;
  /** Ouvre la messagerie existante pour cette réservation. */
  onMessage: () => void;
}

const ReservationPopover: React.FC<ReservationPopoverProps> = ({
  anchorEl,
  event,
  linkedInterventions,
  onClose,
  onDetail,
  onMessage,
}) => {
  const { t } = useTranslation();
  const fmt = useDateFormat();
  const reservation = event.reservation;
  if (!reservation) return null;

  const statusLabel = t(`planning.legend.status.${event.status}`, event.status);
  const statusColor = RESERVATION_STATUS_TOKEN_COLORS[event.status] ?? 'var(--ink)';
  const channelLabel =
    reservation.sourceName
    || RESERVATION_SOURCE_LABELS[reservation.source]
    || reservation.source;
  const sourceLogo = getSourceLogo(reservation.source);
  const checkInTime = reservation.checkInTime?.slice(0, 5);
  const hasLinkedCleaning = (linkedInterventions ?? []).some((e) => e.type === 'cleaning');
  // Paiement : uniquement depuis les flags déjà calculés sur l'évènement —
  // PAID explicite → Réglé ; pastille paiement active → En attente ; sinon omis.
  const payment = reservation.paymentStatus === 'PAID'
    ? { label: t('planning.popover.paid', 'Réglé'), color: 'var(--ok)' }
    : event.needsPaymentBadge
      ? { label: t('planning.popover.paymentPending', 'En attente'), color: 'var(--warn)' }
      : null;

  return (
    // L'ancre est une brique de la grille de planning, qui vit HORS de cet arbre :
    // elle est fournie a Radix en `virtualRef`, ce qui evite d'avoir a deplacer le
    // declencheur dans ce composant. `PopoverAnchor` ne rend alors aucun noeud.
    <Popover open onOpenChange={(next) => { if (!next) onClose(); }}>
      <PopoverAnchor virtualRef={{ current: anchorEl }} />
      <PopoverContent
        side="bottom"
        align="center"
        aria-label={t('planning.popover.reservationSummary', 'Récapitulatif de la réservation')}
        collisionPadding={8}
        className="w-[290px] max-w-[calc(100vw-16px)] gap-0 p-0 rounded-[14px] border border-solid border-[var(--bui-border)] bg-[var(--bui-card)] shadow-[var(--shadow-pop)] ring-0 overflow-hidden motion-reduce:animate-none"
      >
      {/* Entête : avatar 40 + nom + canal (logo + label) */}
      {/* `p-[12px 14px]` (espace = classe invalide, silencieusement ignoree)
          remplace par les deux axes. */}
      <div className="flex items-center gap-[7.5px] px-3.5 py-3">
        <GuestAvatar
          name={event.label}
          photoUrl={guestPhotoSrc(reservation.guestAvatarUrl)}
          size={40}
          sx={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '0.8125rem' }}
        />
        <div className="min-w-0 flex-1">
          <span dir="auto" className="block text-[0.8125rem] font-bold text-[var(--ink)] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
            {event.label}
          </span>
          <div className="flex items-center gap-[3px] mt-0.5">
            {sourceLogo && (
              <img className="w-[12px] h-[12px] object-contain block" src={sourceLogo} alt="" />
            )}
            <span className="text-[0.65625rem] text-[var(--muted)]">
              {channelLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Lignes séparées hairline (la 1ère est séparée de l'entête) */}
      <div className="[&>*]:border-t [&>*]:border-solid [&>*]:border-t-[var(--bui-border)]">
        <InfoRow
          icon={
            <div className="w-[8px] h-[8px] rounded-[50%]" style={{ backgroundColor: statusColor }} />
          }
          label={t('planning.popover.status', 'Statut')}
          value={statusLabel}
          valueColor={statusColor}
        />
        <InfoRow
          icon={<Home size={ICON_SIZE} strokeWidth={1.75} />}
          label={t('planning.popover.property', 'Logement')}
          value={reservation.propertyName}
        />
        <InfoRow
          icon={<CalendarMonth size={ICON_SIZE} strokeWidth={1.75} />}
          label={t('planning.popover.stay', 'Séjour')}
          value={formatStay(event.startDate, event.endDate, fmt, t('planning.popover.nightsSuffix', 'n'))}
        />
        {checkInTime && (
          <InfoRow
            icon={<Login size={ICON_SIZE} strokeWidth={1.75} />}
            label={t('planning.popover.checkIn', 'Check-in')}
            value={checkInTime}
          />
        )}
        {hasLinkedCleaning && (
          <InfoRow
            icon={<CleaningServices size={ICON_SIZE} strokeWidth={1.75} />}
            label={t('planning.popover.cleaning', 'Ménage')}
            value={t('planning.popover.afterCheckout', 'après départ')}
            valueColor="var(--info)"
          />
        )}
        {payment && (
          <InfoRow
            icon={<CreditCard size={ICON_SIZE} strokeWidth={1.75} />}
            label={t('planning.popover.payment', 'Paiement')}
            value={payment.label}
            valueColor={payment.color}
          />
        )}
      </div>

      {/* Pied : Message (secondaire) + Détail (action principale du popover) */}
      {/* `p-[10px 14px]` (espace = classe invalide, silencieusement ignoree)
          remplace par les deux axes. */}
      <div className="flex gap-1.5 px-3.5 py-2.5" style={{ borderTop: '1px solid var(--bui-border)' }}>
        <Button variant="outline" size="sm" className="w-full shrink" onClick={onMessage}>
          <ChatBubbleOutline size={ICON_SIZE} strokeWidth={1.75} />
          {t('planning.popover.message', 'Message')}
        </Button>
        {/* L'ancien sx teintait ce bouton en accent : c'est l'action attendue au clic
            sur une brique — donc `default` et non un second `outline`. */}
        <Button size="sm" className="w-full shrink" onClick={onDetail}>
          <Visibility size={ICON_SIZE} strokeWidth={1.75} />
          {t('planning.popover.detail', 'Détail')}
        </Button>
      </div>
      </PopoverContent>
    </Popover>
  );
};

export default ReservationPopover;
