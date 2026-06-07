package com.clenzy.dto;

import com.clenzy.model.ActivityCommission;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Ligne de commission d'activité (côté hôte). */
public record ActivityCommissionDto(
        Long id,
        Long reservationId,
        String provider,
        String externalBookingId,
        BigDecimal grossCommission,
        BigDecimal hostShare,
        BigDecimal platformShare,
        String currency,
        String status,
        LocalDateTime createdAt) {

    public static ActivityCommissionDto from(ActivityCommission c) {
        return new ActivityCommissionDto(
                c.getId(), c.getReservationId(), c.getProvider().name(), c.getExternalBookingId(),
                c.getGrossCommission(), c.getHostShare(), c.getPlatformShare(), c.getCurrency(),
                c.getStatus().name(), c.getCreatedAt());
    }
}
