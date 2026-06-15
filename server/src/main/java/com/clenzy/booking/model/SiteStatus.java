package com.clenzy.booking.model;

/** Statut de publication d'un site hébergé, d'une page ou d'un article. */
public enum SiteStatus {
    DRAFT,
    /** En attente de validation/relecture manuelle avant publication (articles de blog, 2.13). */
    PENDING_REVIEW,
    PUBLISHED,
    ARCHIVED
}
