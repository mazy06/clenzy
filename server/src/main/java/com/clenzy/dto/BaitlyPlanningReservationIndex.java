package com.clenzy.dto;

import com.clenzy.model.PaymentStatus;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Index Baitly sans fiche voyageur, notes, avatar ni calcul de commission. */
public record BaitlyPlanningReservationIndex(
        Long id, Long propertyId, String guestName, Integer guestCount,
        LocalDate checkIn, LocalDate checkOut, String checkInTime, String checkOutTime,
        String status, String source, String sourceName, BigDecimal totalPrice,
        PaymentStatus paymentStatus, boolean collectedByChannel) {}
