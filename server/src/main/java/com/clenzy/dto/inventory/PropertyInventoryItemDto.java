package com.clenzy.dto.inventory;

public record PropertyInventoryItemDto(
        Long id,
        Long propertyId,
        String name,
        String category,
        Integer quantity,
        String notes
) {}
