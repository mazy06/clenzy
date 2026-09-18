package com.clenzy.marketplace.dto;

import java.util.List;

/** Une page de demandes de devis. */
public record QuotePageDto(
    List<QuoteRequestDto> items,
    int page,
    int size,
    long totalElements,
    int totalPages
) {}
