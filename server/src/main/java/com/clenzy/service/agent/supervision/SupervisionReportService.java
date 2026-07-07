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
                Math.round(acceptance * 100.0) / 100.0, minutes, humanDuration(minutes));
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
