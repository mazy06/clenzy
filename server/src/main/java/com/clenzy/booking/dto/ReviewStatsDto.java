package com.clenzy.booking.dto;

import java.util.Map;

/**
 * Statistiques agregees des avis pour une propriete ou une organisation.
 */
public record ReviewStatsDto(
        double averageRating,
        long totalCount,
        Map<Integer, Long> distribution
) {}
