package com.clenzy.dto;

import java.util.List;

/**
 * Résultat agrégé d'une édition groupée du calendrier, tolérant aux échecs partiels (CLZ-P0-10).
 */
public record BulkCalendarResult(int total, int succeeded, int failed, List<ItemResult> items) {

    /** Résultat par propriété. */
    public record ItemResult(Long propertyId, boolean success, String message) {}
}
