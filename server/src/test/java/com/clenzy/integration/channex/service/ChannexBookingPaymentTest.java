package com.clenzy.integration.channex.service;

import com.clenzy.model.*;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.*;

class ChannexBookingPaymentTest {
    @Test void otaReportsGuestPaymentWithoutInventingBankReceiptOrPaidDate() {
        var reservation = new Reservation();
        ChannexBookingPayment.apply(reservation, " OTA ");
        assertThat(reservation.getPaymentCollection()).isEqualTo(PaymentCollection.CHANNEL);
        assertThat(reservation.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(reservation.getChannelPaymentCollect()).isEqualTo("ota");
        assertThat(reservation.getChannelPaymentObservedAt()).isNotNull();
        assertThat(reservation.getPaidAt()).isNull();
        assertThat(ReservationPaymentState.canCollect(reservation)).isFalse();
    }
    @Test void propertyCollectIsNotPaid() {
        var reservation = new Reservation();
        ChannexBookingPayment.apply(reservation, "property");
        assertThat(reservation.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(ReservationPaymentState.canCollect(reservation)).isTrue();
    }
    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {" ", "unexpected"})
    void missingOrInvalidCollectionRemainsUnknown(String collect) {
        var reservation = new Reservation(); reservation.setSource("airbnb");
        ChannexBookingPayment.apply(reservation, collect);
        assertThat(reservation.getPaymentCollection()).isEqualTo(PaymentCollection.UNKNOWN);
        assertThat(ReservationPaymentState.effectiveStatus(reservation)).isEqualTo(PaymentStatus.UNKNOWN);
        assertThat(ReservationPaymentState.canCollect(reservation)).isFalse();
    }
    @Test void modificationCorrectsOldUnconditionalPaidFlag() {
        var reservation = new Reservation(); reservation.setPaymentStatus(PaymentStatus.PAID);
        reservation.setPaymentCollection(PaymentCollection.PMS);
        reservation.setPaidAt(LocalDateTime.now());
        ChannexBookingPayment.apply(reservation, "property");
        assertThat(reservation.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(reservation.getPaidAt()).isNull();
    }
    @Test void propertyRevisionPreservesLocallyConfirmedPayment() {
        var reservation = new Reservation();
        ChannexBookingPayment.apply(reservation, "property");
        reservation.setPaymentStatus(PaymentStatus.PAID);
        var paidAt = LocalDateTime.now(); reservation.setPaidAt(paidAt);
        ChannexBookingPayment.apply(reservation, "property");
        assertThat(reservation.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(reservation.getPaidAt()).isEqualTo(paidAt);
    }
    @ParameterizedTest @ValueSource(strings = {"REFUNDED", "CANCELLED", "NOT_REQUIRED"})
    void neverReplacesTerminalPaymentState(String value) {
        var reservation = new Reservation(); reservation.setPaymentStatus(PaymentStatus.valueOf(value));
        ChannexBookingPayment.apply(reservation, "ota");
        assertThat(ReservationPaymentState.effectiveStatus(reservation)).isEqualTo(PaymentStatus.valueOf(value));
    }
    @Test void ownCrsRoundtripPreservesPspPayment() {
        var reservation = new Reservation(); reservation.setChannexCrsBookingId("own-booking");
        reservation.setPaymentCollection(PaymentCollection.PMS); reservation.setPaymentStatus(PaymentStatus.PARTIALLY_PAID);
        ChannexBookingPayment.apply(reservation, "ota");
        assertThat(reservation.getPaymentCollection()).isEqualTo(PaymentCollection.PMS);
        assertThat(reservation.getPaymentStatus()).isEqualTo(PaymentStatus.PARTIALLY_PAID);
    }
}
