package com.clenzy.dto.yield;

import java.util.List;

/** Page du journal yield (pagination simple, triée du plus récent au plus ancien). */
public record YieldJournalPageDto(
    List<YieldAdjustmentDto> content,
    int page,
    int size,
    long totalElements
) {}
