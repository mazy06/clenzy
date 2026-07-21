package com.clenzy.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Résultat d'exécution du Report Builder (fondations RMS R1).
 *
 * @param currency devise dominante des réservations agrégées (montants sommés
 *                 sans conversion — même limitation assumée que le P&amp;L par bien)
 */
public record ReportResultDto(
        List<String> dimensions,
        List<String> metrics,
        String granularity,
        LocalDate from,
        LocalDate to,
        String currency,
        List<ReportResultRowDto> rows) {
}
