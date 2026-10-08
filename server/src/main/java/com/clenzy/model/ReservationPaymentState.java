package com.clenzy.model;

import java.util.Set;

/** Lecture prudente du paiement Baitly : le canal de vente ne prouve pas un encaissement. */
public final class ReservationPaymentState {
    private ReservationPaymentState() {}

    public static PaymentStatus effectiveStatus(Reservation reservation) {
        PaymentStatus status = reservation.getPaymentStatus();
        if (status == PaymentStatus.REFUNDED || status == PaymentStatus.PARTIALLY_REFUNDED || status == PaymentStatus.CANCELLED
                || status == PaymentStatus.NOT_REQUIRED) return status;
        if (reservation.getPaymentCollection() == PaymentCollection.UNKNOWN) return PaymentStatus.UNKNOWN;
        if (reservation.isCollectedByChannel()) {
            return "ota".equals(reservation.getChannelPaymentCollect())
                    ? PaymentStatus.PAID : PaymentStatus.UNKNOWN;
        }
        if (isLegacyChannelImport(reservation)) return PaymentStatus.UNKNOWN;
        return status == null ? PaymentStatus.PENDING : status;
    }

    public static boolean canCollect(Reservation reservation) {
        return reservation.getPaymentCollection() == PaymentCollection.PMS
                && reservation.getCancelledAt() == null
                && !"cancelled".equalsIgnoreCase(reservation.getStatus())
                && Set.of(PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.FAILED)
                    .contains(effectiveStatus(reservation));
    }

    private static boolean isLegacyChannelImport(Reservation reservation) {
        return reservation.getExternalUid() != null && reservation.getExternalUid().startsWith("channex:")
                && reservation.getChannexCrsBookingId() == null
                && reservation.getChannelPaymentCollect() == null
                && (reservation.getStripeSessionId() == null || reservation.getStripeSessionId().isBlank());
    }
}
