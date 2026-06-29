package com.clenzy.service;

/**
 * Source de la clé/cible IA résolue par {@code AiTargetResolver}.
 *
 * <p>Sert notamment à exempter le BYOK de l'enforcement de budget
 * (cf. {@link AiTokenBudgetService#requireBudget}).</p>
 */
public enum KeySource {
    /** Clé propre de l'organisation (BYOK). */
    ORGANIZATION,
    /** Provider plateforme configuré en DB par le SUPER_ADMIN (source de vérité unique). */
    PLATFORM_DB
}
