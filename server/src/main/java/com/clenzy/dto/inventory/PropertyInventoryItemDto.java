package com.clenzy.dto.inventory;

public record PropertyInventoryItemDto(
        Long id,
        Long propertyId,
        String name,
        String category,
        Integer quantity,
        String notes,
        String catalogKey,
        String photoUrl,
        Boolean clearPhoto
) {
    public PropertyInventoryItemDto(Long id, Long propertyId, String name, String category, Integer quantity, String notes) {
        this(id, propertyId, name, category, quantity, notes, null, null, null);
    }
}
