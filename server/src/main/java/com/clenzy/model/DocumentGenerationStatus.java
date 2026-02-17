package com.clenzy.model;

/**
 * Statuts du cycle de vie d'une generation de document.
 */
public enum DocumentGenerationStatus {
    PENDING,
    GENERATING,
    COMPLETED,
    FAILED,
    SENT,
    LOCKED,
    ARCHIVED
}
