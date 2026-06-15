package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Requête d'édition groupée du calendrier sur plusieurs propriétés (CLZ-P0-10).
 * Une même opération + plage [from, to) est appliquée à chaque propriété de {@code propertyIds}.
 *
 * @param price prix par nuit (requis pour {@link BulkCalendarOperation#PRICE})
 * @param notes note de blocage (optionnel pour {@link BulkCalendarOperation#BLOCK})
 */
public record BulkCalendarRequest(
    BulkCalendarOperation operation,
    List<Long> propertyIds,
    LocalDate from,
    LocalDate to,
    BigDecimal price,
    String notes
) {}
