package com.clenzy.dto;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO pour les statistiques globales de conformite reglementaire.
 */
public record ComplianceStatsDto(
        long totalDocuments,
        long totalLocked,
        long totalFactures,
        long totalFacturesLocked,
        long totalDevis,
        long totalDevisLocked,
        Map<String, Long> documentsByType,
        LocalDateTime lastCheckAt,
        int averageComplianceScore,
        String countryCode,
        String complianceStandard
) {}
