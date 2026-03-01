package com.clenzy.integration.direct.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Reponse de reservation directe retournee au widget.
 */
public record DirectBookingResponse(
        String bookingId,
        String status,
        String propertyName,
        LocalDate checkIn,
        LocalDate checkOut,
        BigDecimal totalPrice,
        String currency,
        String stripePaymentIntentId,
        String stripeClientSecret,
        String message
) {

    /**
     * Statuts possibles de la reservation directe.
     */
    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_CONFIRMED = "CONFIRMED";
    public static final String STATUS_PAYMENT_REQUIRED = "PAYMENT_REQUIRED";

    public static DirectBookingResponse confirmed(String bookingId, String propertyName,
                                                    LocalDate checkIn, LocalDate checkOut,
                                                    BigDecimal totalPrice, String currency,
                                                    String message) {
        return new DirectBookingResponse(bookingId, STATUS_CONFIRMED, propertyName,
                checkIn, checkOut, totalPrice, currency, null, null, message);
    }

    public static DirectBookingResponse paymentRequired(String bookingId, String propertyName,
                                                          LocalDate checkIn, LocalDate checkOut,
                                                          BigDecimal totalPrice, String currency,
                                                          String paymentIntentId, String clientSecret,
                                                          String message) {
        return new DirectBookingResponse(bookingId, STATUS_PAYMENT_REQUIRED, propertyName,
                checkIn, checkOut, totalPrice, currency, paymentIntentId, clientSecret, message);
    }

    public static DirectBookingResponse pending(String bookingId, String propertyName,
                                                  LocalDate checkIn, LocalDate checkOut,
                                                  BigDecimal totalPrice, String currency,
                                                  String message) {
        return new DirectBookingResponse(bookingId, STATUS_PENDING, propertyName,
                checkIn, checkOut, totalPrice, currency, null, null, message);
    }
}
