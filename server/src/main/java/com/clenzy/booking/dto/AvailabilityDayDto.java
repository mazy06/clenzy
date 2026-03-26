package com.clenzy.booking.dto;

/**
 * Un jour dans le calendrier de disponibilite du Booking Engine.
 * Contient le prix le plus bas parmi les logements disponibles
 * et le nombre de logements disponibles ce jour-la.
 *
 * @param date            date au format ISO (yyyy-MM-dd)
 * @param available       true si au moins un logement est disponible
 * @param minPrice        prix le plus bas parmi les logements disponibles (null si aucun)
 * @param availableCount  nombre de logements disponibles ce jour
 * @param availableTypes  types de logement disponibles ce jour (ex: ["APARTMENT", "HOUSE"])
 */
public record AvailabilityDayDto(
        String date,
        boolean available,
        Double minPrice,
        int availableCount,
        java.util.List<String> availableTypes
) {}
