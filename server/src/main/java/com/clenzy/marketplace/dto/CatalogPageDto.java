package com.clenzy.marketplace.dto;

import java.util.List;

/** Une page du catalogue, vue par une organisation. */
public record CatalogPageDto(
    List<CatalogProviderDto> items,
    int page,
    int size,
    long totalElements,
    int totalPages
) {}
