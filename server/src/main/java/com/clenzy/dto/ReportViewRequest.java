package com.clenzy.dto;

import java.util.List;

/**
 * Requête de création/MAJ d'une vue de rapport (CLZ-P0-15). Les dimensions/métriques
 * doivent appartenir à la whitelist {@code ReportFieldCatalog}.
 */
public record ReportViewRequest(
    String name,
    List<String> dimensions,
    List<String> metrics,
    String filtersJson,
    String granularity
) {}
