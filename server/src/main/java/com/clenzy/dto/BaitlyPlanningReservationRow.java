package com.clenzy.dto;

import com.clenzy.model.Reservation;

/** Détails Baitly : coordonnées déchiffrées par JPA, sans hydrater les relations. */
public record BaitlyPlanningReservationRow(
        Reservation reservation, Long propertyId, String propertyName,
        Long guestId, String guestEmail, String guestPhone, String guestAvatarKey,
        Long interventionId) {}
