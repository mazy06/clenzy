package com.clenzy.booking.security;

import java.util.List;

/**
 * Résultat du scoring de risque d'un checkout booking engine (P2).
 *
 * @param score   score agrégé borné à [0, 100] (0 = aucun signal, 100 = maximum)
 * @param level   niveau dérivé du score selon les seuils de {@link BookingFraudScoringProperties}
 * @param reasons libellés humains des signaux ayant contribué au score (jamais {@code null} ; vide si LOW)
 */
public record RiskAssessment(int score, RiskLevel level, List<String> reasons) {

    /** Assessment neutre (scoring désactivé ou aucun signal) : score 0, niveau LOW, aucune raison. */
    public static RiskAssessment none() {
        return new RiskAssessment(0, RiskLevel.LOW, List.of());
    }

    public boolean isMediumOrAbove() {
        return level == RiskLevel.MEDIUM || level == RiskLevel.HIGH;
    }

    public boolean isHigh() {
        return level == RiskLevel.HIGH;
    }
}
