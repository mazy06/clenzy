import React from 'react';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { Money } from '../../components/Money';
import IllustratedHeading from '../../components/IllustratedHeading';
import { RESERVATION_ART } from '../../components/reservations/reservationArtwork';
import { useTranslation } from '../../hooks/useTranslation';
import type { Reservation } from '../../services/api/reservationsApi';
import { formatMoment } from './reservationFormat';

/** Les statuts de `PaymentStatus` (serveur) ; un code absent d'ici se lit « à vérifier ». */
const PAYMENT_TONE: Record<string, StatusTone> = {
  UNKNOWN: 'neutral',
  PENDING: 'warn',
  PROCESSING: 'info',
  PARTIALLY_PAID: 'warn',
  PAID: 'ok',
  FAILED: 'err',
  REFUNDED: 'neutral',
  PARTIALLY_REFUNDED: 'neutral',
  CANCELLED: 'neutral',
  NOT_REQUIRED: 'neutral',
};

/**
 * Ce que dit la réservation de son paiement, sans rien recalculer : le suivi
 * détaillé (acomptes, frais annexes, remboursements) reste dans le panneau
 * financier du planning et dans Finances.
 *
 * <p>L'encaissement vient de `collectedByChannel`, figé côté serveur ; il n'est
 * jamais redéduit du canal. La commission dit si le canal l'a remontée ou si
 * elle est estimée.</p>
 */
export default function ReservationPaymentSection({ reservation: r }: { reservation: Reservation }) {
  const { t } = useTranslation();
  const channel = r.sourceName || t(`reservations.source.${r.source}`);
  const byChannel = r.collectedByChannel === true;

  const state = byChannel
    ? { label: t('planning.panel.fin.paidOn', { channel }), tone: 'ok' as StatusTone }
    : r.paymentStatus
      ? {
          label: t(`reservationsWorkspace.payment.statuses.${r.paymentStatus in PAYMENT_TONE ? r.paymentStatus : 'UNKNOWN'}`),
          tone: PAYMENT_TONE[r.paymentStatus] ?? 'neutral',
        }
      : { label: t('reservationsWorkspace.payment.none'), tone: 'neutral' as StatusTone };

  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: t('reservationsWorkspace.payment.collection'),
      value: byChannel ? t('reservationsWorkspace.payment.byChannel', { channel }) : t('reservationsWorkspace.payment.byYou'),
    },
  ];
  if (r.otaFeeAmount != null && r.otaFeeAmount > 0) {
    facts.push({
      label: r.otaFeeEstimated
        ? t('planning.panel.fin.commissionEstimated', { channel })
        : t('planning.panel.fin.commission', { channel }),
      value: <span className="rsv-facts__negative">−<Money value={r.otaFeeAmount} from="EUR" /></span>,
    });
  }
  if (r.paidAt) facts.push({ label: t('reservationsWorkspace.payment.paidAt'), value: formatMoment(r.paidAt) });
  if (r.paymentLinkSentAt) {
    facts.push({
      label: t('reservationsWorkspace.payment.link'),
      value: [
        t('planning.panel.fin.linkSentOn', { date: formatMoment(r.paymentLinkSentAt) }),
        r.paymentLinkEmail ? t('planning.panel.fin.linkSentTo', { email: r.paymentLinkEmail }) : '',
      ].filter(Boolean).join(' '),
    });
  }

  return (
    <section className="rsv-section">
      <IllustratedHeading
        art={RESERVATION_ART.payment}
        title={t('reservationsWorkspace.payment.title')}
        hint={t('reservationsWorkspace.payment.hint')}
        action={<StatusChip pill tone={state.tone} label={state.label} />}
      />
      <dl className="rsv-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
