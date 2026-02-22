package com.clenzy.integration.channel;

/**
 * Statut de sante d'une connexion channel.
 */
public enum HealthStatus {
    /** Connexion active et operationnelle */
    HEALTHY,
    /** Connexion degradee (latence elevee, erreurs intermittentes) */
    DEGRADED,
    /** Connexion hors service */
    UNHEALTHY,
    /** Statut inconnu (pas de health check supporte) */
    UNKNOWN
}
