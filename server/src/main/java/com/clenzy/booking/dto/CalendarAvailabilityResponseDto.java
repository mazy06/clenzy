package com.clenzy.booking.dto;

import java.util.List;

/**
 * Reponse du calendrier de disponibilite agrege du Booking Engine.
 * Contient pour chaque jour le prix le plus bas et la disponibilite,
 * ainsi que la liste des types de logement disponibles dans l'organisation.
 *
 * @param days            liste des jours avec prix min et disponibilite
 * @param propertyTypes   types de logement disponibles (pour le filtre hebergement)
 */
public record CalendarAvailabilityResponseDto(
        List<AvailabilityDayDto> days,
        List<PropertyTypeInfoDto> propertyTypes
) {}
