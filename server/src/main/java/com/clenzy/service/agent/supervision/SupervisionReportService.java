package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionReportDto;
import com.clenzy.model.SupervisionActivity;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.SupervisionActivityRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Reporting & ROI de la constellation (T5 + T7/B3) : agrège, sur une fenêtre
 * glissante, ce que les agents ont fait et estime le temps opérateur épargné.
 *
 * <p>ROI = heuristique ASSUMÉE (pas une mesure) : chaque action autonome et chaque
 * suggestion appliquée épargnent un temps opérateur moyen — les constantes sont
 * volontairement conservatrices et documentées ({@link #MIN_PER_AUTO_ACTION},
 * {@link #MIN_PER_APPLIED_SUGGESTION}).</p>
 */
@Service
public class SupervisionReportService {

    /** Fenêtre du bilan (jours). */
    static final int WINDOW_DAYS = 30;
    /** Temps opérateur épargné estimé par action autonome (min). */
    static final int MIN_PER_AUTO_ACTION = 8;
    /** Temps opérateur épargné estimé par suggestion appliquée (min). */
    static final int MIN_PER_APPLIED_SUGGESTION = 12;

    private final SupervisionActivityRepository activityRepository;
    private final SupervisionSuggestionRepository suggestionRepository;
    private final java.time.Clock clock;

    public SupervisionReportService(SupervisionActivityRepository activityRepository,
                                    SupervisionSuggestionRepository suggestionRepository,
                                    java.time.Clock clock) {
        this.activityRepository = activityRepository;
        this.suggestionRepository = suggestionRepository;
        this.clock = clock;
    }

    /** Bilan sur la fenêtre par défaut (30 j). */
    @Transactional(readOnly = true)
    public SupervisionReportDto getReport(Long organizationId) {
        return getReport(organizationId, WINDOW_DAYS);
    }

    /**
     * Bilan sur une fenêtre glissante paramétrable (jours) — la constellation
     * l'aligne sur le zoom du planning (Semaine 7 / Quinzaine 15 / Mois 30).
     * {@code windowDays} est borné à [1, 366].
     */
    @Transactional(readOnly = true)
    public SupervisionReportDto getReport(Long organizationId, int windowDays) {
        final int days = Math.max(1, Math.min(windowDays, 366));
        final Instant now = clock.instant();
        final Instant since = now.minus(Duration.ofDays(days));

        final long autoActions = activityRepository.countByOrganizationIdAndKindAndCreatedAtAfter(
                organizationId, SupervisionActivity.KIND_ACT, since);
        final long applied = suggestionRepository.countByOrganizationIdAndStatusAndAppliedAtAfter(
                organizationId, SupervisionSuggestion.STATUS_APPLIED, since);
        final long dismissed = suggestionRepository.countByOrganizationIdAndStatusAndCreatedAtAfter(
                organizationId, SupervisionSuggestion.STATUS_DISMISSED, since);
        final long pending = suggestionRepository.countByOrganizationIdAndStatusAndExpiresAtAfter(
                organizationId, SupervisionSuggestion.STATUS_PENDING, now);

        final long decided = applied + dismissed;
        final double acceptance = decided > 0 ? (double) applied / decided : 0.0;
        final long minutes = autoActions * MIN_PER_AUTO_ACTION + applied * MIN_PER_APPLIED_SUGGESTION;

        return new SupervisionReportDto(
                days, autoActions, applied, dismissed, pending,
                Math.round(acceptance * 100.0) / 100.0, minutes, humanDuration(minutes),
                acceptanceByType(organizationId, since));
    }

    /**
     * Acceptation PAR TYPE d'action (Vague 1 autonomie) : agrège les cartes
     * actionnables créées dans la fenêtre par (module, actionType, statut) puis
     * calcule le taux applied / (applied + dismissed). Trié par volume de
     * décisions décroissant (les types les plus « mûrs » d'abord — aide à la
     * décision d'activation des toggles d'auto-application).
     */
    private java.util.List<com.clenzy.dto.SupervisionTypeAcceptanceDto> acceptanceByType(
            Long organizationId, Instant since) {
        record Key(String moduleKey, String actionType) {}
        final java.util.Map<Key, long[]> byType = new java.util.LinkedHashMap<>();
        for (Object[] row : suggestionRepository.countActionableByTypeAndStatusSince(organizationId, since)) {
            final Key key = new Key((String) row[0], (String) row[1]);
            final long[] counts = byType.computeIfAbsent(key, k -> new long[3]);
            final long count = (Long) row[3];
            switch ((String) row[2]) {
                case SupervisionSuggestion.STATUS_APPLIED -> counts[0] += count;
                case SupervisionSuggestion.STATUS_DISMISSED -> counts[1] += count;
                case SupervisionSuggestion.STATUS_PENDING -> counts[2] += count;
                default -> { /* statut inconnu : ignoré */ }
            }
        }
        return byType.entrySet().stream()
                .map(e -> {
                    final long applied = e.getValue()[0];
                    final long dismissed = e.getValue()[1];
                    final long decided = applied + dismissed;
                    final double rate = decided > 0
                            ? Math.round((double) applied / decided * 100.0) / 100.0 : 0.0;
                    return new com.clenzy.dto.SupervisionTypeAcceptanceDto(
                            e.getKey().moduleKey(), e.getKey().actionType(),
                            applied, dismissed, e.getValue()[2], rate);
                })
                .sorted(java.util.Comparator.comparingLong(
                        (com.clenzy.dto.SupervisionTypeAcceptanceDto d) -> d.applied() + d.dismissed())
                        .reversed())
                .toList();
    }

    private String humanDuration(long minutes) {
        if (minutes <= 0) {
            return "≈ 0 min";
        }
        if (minutes < 60) {
            return "≈ " + minutes + " min";
        }
        final long h = minutes / 60;
        final long m = minutes % 60;
        return m == 0 ? "≈ " + h + " h" : "≈ " + h + " h " + m;
    }
}
