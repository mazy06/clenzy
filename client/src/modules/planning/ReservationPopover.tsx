import React from 'react';
import { Box, Button, Popover, useMediaQuery } from '@mui/material';
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

/** Initiales du voyageur (max 2 lettres) — même règle que la brique. */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: '14px', py: '7px' }}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', color: 'var(--muted)', flexShrink: 0 }}>
        {icon}
      </Box>
      <Box component="span" sx={{ fontSize: ROW_LABEL_FS, color: 'var(--muted)', flexShrink: 0 }}>
        {label}
      </Box>
      <Box
        component="span"
        sx={{
          ml: 'auto',
          fontSize: ROW_VALUE_FS,
          fontWeight: 600,
          color: valueColor ?? 'var(--ink)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </Box>
    </Box>
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
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
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
    <Popover
      open
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      transitionDuration={reduceMotion ? 0 : undefined}
      slotProps={{
        paper: {
          sx: {
            width: 290,
            borderRadius: '14px',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-pop)',
            backgroundColor: 'var(--card)',
            backgroundImage: 'none',
            overflow: 'hidden',
          },
        },
      }}
    >
      {/* Entête : avatar 40 + nom + canal (logo + label) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '12px 14px' }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            flexShrink: 0,
            backgroundColor: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8125rem',
            fontWeight: 700,
          }}
        >
          {getInitials(event.label)}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box
            component="span"
            sx={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: 'var(--ink)',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {event.label}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: '2px' }}>
            {sourceLogo && (
              <Box
                component="img"
                src={sourceLogo}
                alt=""
                sx={{ width: 12, height: 12, objectFit: 'contain', display: 'block' }}
              />
            )}
            <Box component="span" sx={{ fontSize: '0.65625rem', color: 'var(--muted)' }}>
              {channelLabel}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Lignes séparées hairline (la 1ère est séparée de l'entête) */}
      <Box sx={{ '& > *': { borderTop: '1px solid var(--line)' } }}>
        <InfoRow
          icon={
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor }} />
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
      </Box>

      {/* Pied : Message (outlined neutre) + Détail (outlined accent) */}
      <Box sx={{ display: 'flex', gap: 1, p: '10px 14px', borderTop: '1px solid var(--line)' }}>
        <Button
          size="small"
          variant="outlined"
          fullWidth
          startIcon={<ChatBubbleOutline size={ICON_SIZE} strokeWidth={1.75} />}
          onClick={onMessage}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '9px',
            color: 'var(--ink)',
            borderColor: 'var(--line-2)',
            '&:hover': { borderColor: 'var(--ink)', backgroundColor: 'var(--hover)' },
          }}
        >
          Message
        </Button>
        <Button
          size="small"
          variant="outlined"
          fullWidth
          startIcon={<Visibility size={ICON_SIZE} strokeWidth={1.75} />}
          onClick={onDetail}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '9px',
            color: 'var(--accent)',
            borderColor: 'var(--accent)',
            '&:hover': { borderColor: 'var(--accent-deep)', backgroundColor: 'var(--accent-soft)' },
          }}
        >
          Détail
        </Button>
      </Box>
    </Popover>
  );
};

export default ReservationPopover;
