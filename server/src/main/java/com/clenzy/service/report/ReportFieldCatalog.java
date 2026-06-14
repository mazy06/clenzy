package com.clenzy.service.report;

import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Whitelist des champs autorisés d'un rapport personnalisé (CLZ-P0-15).
 *
 * <p><b>Anti-injection SQL</b> : seuls les codes de cette whitelist peuvent composer une
 * {@code ReportView}. Toute dimension/métrique/granularité inconnue est rejetée AVANT
 * persistance — l'exécution (à venir) ne traduit que des codes connus en agrégation
 * paramétrée, jamais du texte utilisateur brut.</p>
 */
@Component
public class ReportFieldCatalog {

    /** Axes de regroupement autorisés (la dimension pays sert le multi-pays). */
    public enum Dimension { PROPERTY, CHANNEL, PERIOD, COUNTRY }

    /** Métriques autorisées. */
    public enum Metric { REVENUE, ADR, REVPAR, OCCUPANCY, FEES, MARGIN }

    /** Granularités temporelles autorisées. */
    public enum Granularity { DAY, WEEK, MONTH, YEAR }

    public void validate(Collection<String> dimensions, Collection<String> metrics, String granularity) {
        requireNonEmpty(dimensions, "dimensions");
        requireNonEmpty(metrics, "metriques");
        List<String> badDimensions = unknown(dimensions, Dimension.class);
        List<String> badMetrics = unknown(metrics, Metric.class);
        if (!badDimensions.isEmpty() || !badMetrics.isEmpty()) {
            throw new IllegalArgumentException(
                "Champs de rapport non autorises (whitelist) — dimensions: " + badDimensions
                + ", metriques: " + badMetrics);
        }
        if (granularity != null && !granularity.isBlank() && !isValid(granularity, Granularity.class)) {
            throw new IllegalArgumentException("Granularite non autorisee: " + granularity);
        }
    }

    private void requireNonEmpty(Collection<String> values, String label) {
        if (values == null || values.isEmpty()) {
            throw new IllegalArgumentException(label + " requis(es)");
        }
    }

    private <E extends Enum<E>> List<String> unknown(Collection<String> values, Class<E> type) {
        return values.stream().filter(v -> !isValid(v, type)).collect(Collectors.toList());
    }

    private <E extends Enum<E>> boolean isValid(String value, Class<E> type) {
        if (value == null) {
            return false;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return Arrays.stream(type.getEnumConstants()).anyMatch(e -> e.name().equals(normalized));
    }
}
