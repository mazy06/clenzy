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
        ScoreDto score,
        String currency,
        boolean needsReview,
        com.clenzy.marketplace.model.PricingModel pricingModel,
        BigDecimal amount,
        String unitLabel) {
    public HousekeeperRatesDto(BigDecimal reference, BigDecimal hourly, List<PropertyRateDto> properties, ScoreDto score) {
        this(reference, hourly, properties, score, "EUR", false, com.clenzy.marketplace.model.PricingModel.HOURLY, hourly, null);
    }

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

    /** Tarif unique. hourlyAmount est conservé comme nom de transport pour compatibilité. */
    public record UpdateRequest(
            /** null = supprimer le taux horaire général. */
            BigDecimal hourlyAmount,
            /** État complet des forfaits par logement (absents = supprimés). */
            List<FlatRateEntry> flatRates,
            String currency,
            com.clenzy.marketplace.model.PricingModel pricingModel,
            String unitLabel) {
        public UpdateRequest(BigDecimal hourlyAmount, List<FlatRateEntry> flatRates) {
            this(hourlyAmount, flatRates, null, null, null);
        }

        public record FlatRateEntry(Long propertyId, BigDecimal amount) {
        }
    }
}
