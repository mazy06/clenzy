package com.clenzy.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Tarifs d'un prestataire ménage + contexte conseil (Moteur Ménage 2A).
 * Chaque logement porte la fourchette conseil (quote CLEANING) pour le nudge
 * front « dans le marché » — ancre = médiane, jamais de blocage.
 */
public record HousekeeperRatesDto(
        /** Taux horaire de référence de l'org (contexte du champ taux horaire). */
        BigDecimal referenceHourlyRate,
        /** Taux horaire général du pro — null si non défini. */
        BigDecimal hourlyAmount,
        List<PropertyRateDto> properties,
        /** Score qualité 30 j (MM-3D) : preuve photo pondérée par le volume. */
        ScoreDto score) {

    public record ScoreDto(int score, int completedCount, double proofRate) {
    }

    public record PropertyRateDto(
            Long propertyId,
            String propertyName,
            /** Forfait du pro pour ce logement — null si non défini. */
            BigDecimal flatAmount,
            /** Fourchette conseil du logement (quote CLEANING). */
            BigDecimal advisoryMin,
            BigDecimal advisoryRecommended,
            BigDecimal advisoryMax) {
    }

    /** Corps du PUT : état complet (upsert + suppression des absents). */
    public record UpdateRequest(
            /** null = supprimer le taux horaire général. */
            BigDecimal hourlyAmount,
            /** État complet des forfaits par logement (absents = supprimés). */
            List<FlatRateEntry> flatRates) {

        public record FlatRateEntry(Long propertyId, BigDecimal amount) {
        }
    }
}
