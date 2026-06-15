package com.clenzy.booking.dto;

import java.util.List;

/**
 * Réponse publique des avis d'un booking engine : statistiques agrégées (org) + avis récents.
 */
public record PublicReviewsResponse(
        ReviewStatsDto stats,
        List<PublicReviewDto> reviews
) {}
