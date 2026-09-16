package com.clenzy.marketplace.model;

/** Cycle de vie d'une fiche professionnelle sur la place de marche. */
public enum ProviderStatus {
    /** Candidature recue, pas encore examinee par l'equipe plateforme. */
    PENDING_REVIEW,
    /** Fiche publiee : le professionnel peut etre propose aux organisations. */
    ACTIVE,
    /** Retiree temporairement (piece expiree, incident, demande du professionnel). */
    SUSPENDED,
    /** Candidature refusee. La raison vit dans {@code reviewNote}. */
    REJECTED,
    /** Sortie definitive du catalogue, conservee pour l'historique. */
    ARCHIVED;

    /** true si la fiche est visible des organisations. */
    public boolean isPubliclyVisible() {
        return this == ACTIVE;
    }
}
