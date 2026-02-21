package com.clenzy.config;

/**
 * Types de DataSource pour le routing read/write.
 * PRIMARY : toutes les ecritures + lectures par defaut.
 * REPLICA : lectures @Transactional(readOnly = true).
 *
 * Niveau 8 — Scalabilite.
 */
public enum DataSourceType {
    PRIMARY,
    REPLICA
}
