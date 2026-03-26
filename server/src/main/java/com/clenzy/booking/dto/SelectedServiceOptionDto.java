package com.clenzy.booking.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * DTO representant un service optionnel selectionne par le voyageur au checkout.
 * Le prix est recalcule cote serveur (jamais confiance au client).
 */
public record SelectedServiceOptionDto(
    @NotNull Long serviceItemId,
    @NotNull @Min(1) Integer quantity
) {}
