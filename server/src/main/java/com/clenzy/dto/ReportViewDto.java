package com.clenzy.dto;

import java.util.List;

/**
 * Vue de rapport exposée à l'API (CLZ-P0-15) — record, jamais l'entité JPA (audit #5).
 */
public record ReportViewDto(
    Long id,
    String name,
    List<String> dimensions,
    List<String> metrics,
    String granularity,
    String filtersJson
) {}
