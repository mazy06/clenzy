package com.clenzy.integration.channex.service;

import com.clenzy.model.PaymentCollection;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import java.time.LocalDateTime;
import java.util.Locale;

/** Applique l'information OTA sans transformer un import ou une annulation en paiement. */
final class ChannexBookingPayment {
    private ChannexBookingPayment() {}

    static void apply(Reservation reservation, String rawCollect) {
        // Le retour de nos propres réservations CRS ne remplace jamais les événements PSP.
        if (reservation.getChannexCrsBookingId() != null) return;
        String collect = rawCollect == null ? "" : rawCollect.trim().toLowerCase(Locale.ROOT);
        boolean known = collect.equals("ota") || collect.equals("property");
        boolean keepLocalPayment = reservation.getPaymentCollection() == PaymentCollection.PMS
                && ("property".equals(reservation.getChannelPaymentCollect())
                    || (reservation.getStripeSessionId() != null && !reservation.getStripeSessionId().isBlank()));
        PaymentStatus previous = reservation.getPaymentStatus();
        reservation.setChannelPaymentCollect(known ? collect : null);
        reservation.setChannelPaymentObservedAt(LocalDateTime.now());
        reservation.setPaymentCollection(collect.equals("ota") ? PaymentCollection.CHANNEL
                : collect.equals("property") ? PaymentCollection.PMS : PaymentCollection.UNKNOWN);
        if (previous == PaymentStatus.REFUNDED || previous == PaymentStatus.CANCELLED
                || previous == PaymentStatus.NOT_REQUIRED) return;
        if (collect.equals("property") && keepLocalPayment && previous != null) return;
        reservation.setPaymentStatus(collect.equals("ota") ? PaymentStatus.PAID
                : collect.equals("property") ? PaymentStatus.PENDING : PaymentStatus.UNKNOWN);
        // payment_collect n'expose pas la date réelle de paiement.
        reservation.setPaidAt(null);
    }
}
