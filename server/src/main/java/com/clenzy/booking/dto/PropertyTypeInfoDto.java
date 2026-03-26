package com.clenzy.booking.dto;

/**
 * Information sur un type de logement disponible dans une organisation.
 *
 * @param type          code du type (ex: APARTMENT, HOUSE)
 * @param label         libelle affichable (ex: Appartement, Maison)
 * @param count         nombre de logements de ce type
 * @param minPrice      prix le plus bas parmi les logements de ce type (fallback nightlyPrice)
 * @param minCleaningFee frais de menage les plus bas parmi les logements de ce type
 */
public record PropertyTypeInfoDto(
        String type,
        String label,
        int count,
        Double minPrice,
        Double minCleaningFee
) {}
