package com.clenzy.dto;

import com.clenzy.model.Reservation;

/** Détails Baitly sans coordonnées ni hydratation des relations. */
public record BaitlyPlanningReservationRow(
        Reservation reservation, Long propertyId, String propertyName,
        Long guestId, Long interventionId) {}
