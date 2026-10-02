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
    /** Total À REVERSER par l'hôte (hors séjours dont la plateforme a collecté la taxe). */
    BigDecimal totalTax,
    int reservationCount,
    int missingConfigCount,
    /** Taxe collectée et reversée directement par les plateformes (information, pas à déclarer). */
    BigDecimal platformCollectedTax
) {
    public TouristTaxReportDto(LocalDate from, LocalDate to, List<TouristTaxReportLineDto> lines,
                               BigDecimal totalTax, int reservationCount, int missingConfigCount) {
        this(from, to, lines, totalTax, reservationCount, missingConfigCount, BigDecimal.ZERO);
    }
}
