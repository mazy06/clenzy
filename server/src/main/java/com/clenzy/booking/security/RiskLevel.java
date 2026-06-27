package com.clenzy.booking.security;

/**
 * Niveau de risque d'un checkout booking engine, dérivé du score 0-100 du
 * {@link BookingFraudScoringService}.
 *
 * <ul>
 *   <li>{@code LOW} — rien (checkout normal).</li>
 *   <li>{@code MEDIUM} — en enforcement : exiger une caution / pre-autorisation, ou marquer pour revue.</li>
 *   <li>{@code HIGH} — en enforcement : revue manuelle (ou refus si configuré).</li>
 * </ul>
 */
public enum RiskLevel {
    LOW,
    MEDIUM,
    HIGH
}
