package com.clenzy.dto;

import com.clenzy.model.UpsellOrder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Commande d'upsell côté admin hôte (suivi des ventes + revenus). */
public record UpsellOrderDto(
        Long id,
        Long reservationId,
        String title,
        BigDecimal amount,
        String currency,
        BigDecimal platformFeeAmount,
        BigDecimal hostAmount,
        String status,
        String guestEmail,
        LocalDateTime createdAt,
        LocalDateTime paidAt) {

    public static UpsellOrderDto from(UpsellOrder o) {
        return new UpsellOrderDto(
                o.getId(), o.getReservationId(), o.getTitle(), o.getAmount(), o.getCurrency(),
                o.getPlatformFeeAmount(), o.getHostAmount(), o.getStatus().name(),
                o.getGuestEmail(), o.getCreatedAt(), o.getPaidAt());
    }
}
