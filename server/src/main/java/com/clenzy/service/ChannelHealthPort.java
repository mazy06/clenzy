package com.clenzy.service;

/**
 * Port d'inversion de dependance vers les connecteurs channel (T-ARCH-06).
 *
 * <p>Casse le cycle de paquets service ↔ integration pour les health checks :
 * le paquet service/ (application) ne depend plus de
 * {@code com.clenzy.integration.channel.ChannelConnectorRegistry} ; c'est
 * l'infrastructure ({@code integration.channel.ChannelHealthAdapter}) qui
 * implemente ce contrat declare cote application, conformement a la
 * Dependency Rule (Infrastructure → Application).</p>
 */
public interface ChannelHealthPort {

    /** Statut de sante : connexion active et operationnelle. */
    String HEALTHY = "HEALTHY";

    /** Statut de sante : inconnu (pas de connecteur ou health check non supporte). */
    String UNKNOWN = "UNKNOWN";

    /**
     * Verifie la sante d'une connexion channel.
     *
     * @param channelName  nom du canal (valeur de {@code ChannelName.name()})
     * @param connectionId id de la connexion channel
     * @return nom du statut de sante (HEALTHY, DEGRADED, UNHEALTHY, UNKNOWN) ;
     *         {@link #UNKNOWN} si aucun connecteur n'est enregistre pour ce canal.
     *         Les exceptions du connecteur sous-jacent sont propagees (l'appelant
     *         decide de la tolerance aux pannes).
     */
    String checkHealth(String channelName, Long connectionId);
}
