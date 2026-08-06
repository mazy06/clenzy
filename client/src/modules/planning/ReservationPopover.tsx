import React from 'react';
import {
  Button,
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '../../components/ui';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Home,
  CalendarMonth,
  Login,
  CleaningServices,
  CreditCard,
  ChatBubbleOutline,
  Visibility,
} from '../../icons';
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_SOURCE_LABELS,
} from '../../services/api/reservationsApi';
import type { ReservationStatus } from '../../services/api';
import GuestAvatar from '../../components/GuestAvatar';
import type { PlanningEvent } from './types';
import { RESERVATION_STATUS_TOKEN_COLORS } from './constants';
import { getSourceLogo } from './utils/sourceLogos';
import { toDate, daysBetween } from './utils/dateUtils';

// ─── Popover réservation (maquette Signature) ────────────────────────────────
//
// Carte blanche radius 14, hairline var(--line), shadow-pop, ~290px, ouverte
// au clic sur une brique. Entête avatar + nom + canal ; lignes icône+libellé/
// valeur séparées hairline ; pied : « Message » (messagerie existante) +
// « Détail » (panneau de détail existant). N'affiche QUE des données déjà
// présentes sur l'objet réservation — une ligne sans donnée est omise.

/** Format séjour maquette : « 10 → 13 févr. · 3n » (mois sur le départ,
 *  répété sur l'arrivée uniquement si différent). */
function formatStay(startStr: string, endStr: string): string {
  const start = toDate(startStr);
  const end = toDate(endStr);
  const nights = Math.max(1, daysBetween(start, end));
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = sameMonth ? format(start, 'd') : format(start, 'd MMM', { locale: fr });
  const endLabel = format(end, 'd MMM', { locale: fr });
  return `${startLabel} → ${endLabel} · ${nights}n`;
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
  const reservation = event.reservation;
  if (!reservation) return null;

  const statusLabel =
    RESERVATION_STATUS_LABELS[event.status as ReservationStatus] ?? event.status;
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
    ? { label: 'Réglé', color: 'var(--ok)' }
    : event.needsPaymentBadge
      ? { label: 'En attente', color: 'var(--warn)' }
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
        aria-label="Récapitulatif de la réservation"
        collisionPadding={8}
        className="w-[290px] max-w-[calc(100vw-16px)] gap-0 p-0 rounded-[14px] border border-solid border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow-pop)] ring-0 overflow-hidden motion-reduce:animate-none"
      >
      {/* Entête : avatar 40 + nom + canal (logo + label) */}
      {/* `p-[12px 14px]` (espace = classe invalide, silencieusement ignoree)
          remplace par les deux axes. */}
      <div className="flex items-center gap-[7.5px] px-3.5 py-3">
        <GuestAvatar
          name={event.label}
          photoUrl={reservation.guestAvatarUrl}
          size={40}
          sx={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '0.8125rem' }}
        />
        <div className="min-w-0 flex-1">
          <span className="block text-[0.8125rem] font-bold text-[var(--ink)] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
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
      <div className="[&>*]:border-t [&>*]:border-solid [&>*]:border-t-[var(--line)]">
        <InfoRow
          icon={
            <div className="w-[8px] h-[8px] rounded-[50%]" style={{ backgroundColor: statusColor }} />
          }
          label="Statut"
          value={statusLabel}
          valueColor={statusColor}
        />
        <InfoRow
          icon={<Home size={ICON_SIZE} strokeWidth={1.75} />}
          label="Logement"
          value={reservation.propertyName}
        />
        <InfoRow
          icon={<CalendarMonth size={ICON_SIZE} strokeWidth={1.75} />}
          label="Séjour"
          value={formatStay(event.startDate, event.endDate)}
        />
        {checkInTime && (
          <InfoRow
            icon={<Login size={ICON_SIZE} strokeWidth={1.75} />}
            label="Check-in"
            value={checkInTime}
          />
        )}
        {hasLinkedCleaning && (
          <InfoRow
            icon={<CleaningServices size={ICON_SIZE} strokeWidth={1.75} />}
            label="Ménage"
            value="après départ"
            valueColor="var(--info)"
          />
        )}
        {payment && (
          <InfoRow
            icon={<CreditCard size={ICON_SIZE} strokeWidth={1.75} />}
            label="Paiement"
            value={payment.label}
            valueColor={payment.color}
          />
        )}
      </div>

      {/* Pied : Message (secondaire) + Détail (action principale du popover) */}
      {/* `p-[10px 14px]` (espace = classe invalide, silencieusement ignoree)
          remplace par les deux axes. */}
      <div className="flex gap-1.5 px-3.5 py-2.5" style={{ borderTop: '1px solid var(--line)' }}>
        <Button variant="outline" size="sm" className="w-full shrink" onClick={onMessage}>
          <ChatBubbleOutline size={ICON_SIZE} strokeWidth={1.75} />
          Message
        </Button>
        {/* L'ancien sx teintait ce bouton en accent : c'est l'action attendue au clic
            sur une brique — donc `default` et non un second `outline`. */}
        <Button size="sm" className="w-full shrink" onClick={onDetail}>
          <Visibility size={ICON_SIZE} strokeWidth={1.75} />
          Détail
        </Button>
      </div>
      </PopoverContent>
    </Popover>
  );
};

export default ReservationPopover;
