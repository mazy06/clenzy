package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Rapport de taxe de séjour sur une période : réservations confirmées dont le
 * <b>check-out</b> tombe dans {@code [from, to]}, une ligne par réservation
 * couverte par un barème, plus le total collecté.
 *
 * <p>{@code missingConfigCount} = réservations de la période SANS barème
 * applicable (ni override par bien, ni défaut org) — signal à l'utilisateur
 * que le rapport est incomplet.</p>
 */
public record TouristTaxReportDto(
    LocalDate from,
    LocalDate to,
    List<TouristTaxReportLineDto> lines,
    BigDecimal totalTax,
    int reservationCount,
    int missingConfigCount
) {}
