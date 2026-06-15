package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/** Création / mise à jour d'une offre d'upsell. {@code propertyId} null = toutes les propriétés. */
public record UpsellOfferRequest(
        Long propertyId,
        String type,
        @NotBlank String title,
        String description,
        @NotNull @Positive BigDecimal price,
        String currency,
        String imageUrl,
        Boolean active,
        Integer sortOrder,
        // Productisation (2.10) : conditionnel (séjour mini) + fenêtre horaire (délai mini avant arrivée)
        Integer minNights,
        Integer leadTimeHours) {}
