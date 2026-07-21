package com.clenzy.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Requête d'exécution ad-hoc du Report Builder : mêmes codes whitelistés que les
 * vues sauvegardées ({@code ReportFieldCatalog}) + période [from, to] incluse.
 */
public record ReportExecutionRequest(
        List<String> dimensions,
        List<String> metrics,
        String granularity,
        LocalDate from,
        LocalDate to) {
}
