package com.clenzy.integration.channex.model;

/**
 * Etat de synchronisation d'un mapping Channex.
 *
 * <ul>
 *   <li>{@code PENDING} — mapping cree mais sync initiale pas encore reussie</li>
 *   <li>{@code ACTIVE} — sync normale en cours, pas d'erreur recente</li>
 *   <li>{@code ERROR} — derniere sync a echoue, voir {@code last_sync_error}</li>
 *   <li>{@code DISABLED} — sync desactivee manuellement (sans suppression)</li>
 * </ul>
 */
public enum ChannexSyncStatus {
    PENDING,
    ACTIVE,
    ERROR,
    DISABLED;

    /** Conversion depuis le champ varchar de la DB (lowercase historique). */
    public static ChannexSyncStatus fromDb(String value) {
        if (value == null) return PENDING;
        return ChannexSyncStatus.valueOf(value.toUpperCase());
    }

    /** Valeur a stocker en DB (lowercase pour matcher le CHECK constraint). */
    public String toDb() {
        return this.name().toLowerCase();
    }
}
