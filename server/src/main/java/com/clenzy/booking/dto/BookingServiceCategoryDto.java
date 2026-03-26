package com.clenzy.booking.dto;

import com.clenzy.booking.model.BookingServiceCategory;

import java.util.List;

/**
 * DTO pour une categorie de services optionnels, avec ses items imbriques.
 * Utilise pour l'admin CRUD et l'API publique.
 */
public record BookingServiceCategoryDto(
    Long id,
    Long organizationId,
    String name,
    String description,
    Integer sortOrder,
    boolean active,
    List<BookingServiceItemDto> items
) {

    /**
     * Convertit l'entite en DTO avec tous les items.
     */
    public static BookingServiceCategoryDto from(BookingServiceCategory category) {
        List<BookingServiceItemDto> itemDtos = category.getItems().stream()
            .map(BookingServiceItemDto::from)
            .toList();

        return new BookingServiceCategoryDto(
            category.getId(),
            category.getOrganizationId(),
            category.getName(),
            category.getDescription(),
            category.getSortOrder(),
            category.isActive(),
            itemDtos
        );
    }

    /**
     * Convertit l'entite en DTO avec uniquement les items actifs (pour l'API publique).
     */
    public static BookingServiceCategoryDto fromActiveOnly(BookingServiceCategory category) {
        List<BookingServiceItemDto> itemDtos = category.getItems().stream()
            .filter(item -> item.isActive())
            .map(BookingServiceItemDto::from)
            .toList();

        return new BookingServiceCategoryDto(
            category.getId(),
            category.getOrganizationId(),
            category.getName(),
            category.getDescription(),
            category.getSortOrder(),
            category.isActive(),
            itemDtos
        );
    }
}
