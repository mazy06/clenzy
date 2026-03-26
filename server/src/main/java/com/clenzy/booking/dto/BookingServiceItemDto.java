package com.clenzy.booking.dto;

import com.clenzy.booking.model.BookingServiceInputType;
import com.clenzy.booking.model.BookingServiceItem;
import com.clenzy.booking.model.BookingServicePricingMode;

import java.math.BigDecimal;

/**
 * DTO pour un service optionnel du booking engine.
 * Utilise pour l'admin CRUD et l'API publique.
 */
public record BookingServiceItemDto(
    Long id,
    Long categoryId,
    String name,
    String description,
    BigDecimal price,
    BookingServicePricingMode pricingMode,
    BookingServiceInputType inputType,
    Integer maxQuantity,
    boolean mandatory,
    Integer sortOrder,
    boolean active
) {

    public static BookingServiceItemDto from(BookingServiceItem item) {
        return new BookingServiceItemDto(
            item.getId(),
            item.getCategory() != null ? item.getCategory().getId() : null,
            item.getName(),
            item.getDescription(),
            item.getPrice(),
            item.getPricingMode(),
            item.getInputType(),
            item.getMaxQuantity(),
            item.isMandatory(),
            item.getSortOrder(),
            item.isActive()
        );
    }
}
