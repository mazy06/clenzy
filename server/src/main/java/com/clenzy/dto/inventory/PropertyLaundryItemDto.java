package com.clenzy.dto.inventory;

public record PropertyLaundryItemDto(
        Long id,
        Long propertyId,
        String itemKey,
        String label,
        Integer quantityPerStay
) {}
