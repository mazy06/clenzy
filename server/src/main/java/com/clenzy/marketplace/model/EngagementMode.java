package com.clenzy.marketplace.model;

/**
 * Conditions dans lesquelles un professionnel travaille.
 *
 * <p>Le professionnel est TOUJOURS porte par une organisation : la sienne s'il
 * est independant, celle qui l'emploie s'il est rattache. Ce mode dit ce que la
 * place de marche a le droit d'en faire.</p>
 */
public enum EngagementMode {
    /** Sa propre organisation Baitly. Ouvert a toutes les autres. */
    INDEPENDENT,
    /** Membre d'une organisation tierce, mais toujours expose au catalogue. */
    AFFILIATED,
    /** Rattache exclusivement a une organisation : retire du catalogue. */
    EXCLUSIVE;

    /** true si ce mode autorise l'exposition aux autres organisations. */
    public boolean allowsCatalogExposure() {
        return this != EXCLUSIVE;
    }
}
