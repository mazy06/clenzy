package com.clenzy.integration.channel;

/**
 * Voie de synchronisation retenue pour une propriété (CLZ Domaine 1 / CM natif).
 *
 * <p>Clenzy est un channel manager <b>hybride</b> : il privilégie ses connecteurs OTA
 * <b>directs natifs</b> et n'utilise Channex (revendeur) qu'en repli. Ce routage évite aussi le
 * double-push (les deux consumers Kafka écoutaient le même topic).</p>
 */
public enum ChannelRoute {
    /** Connecteurs directs natifs (un ChannelMapping actif existe). */
    DIRECT,
    /** Channel manager Channex (repli : pas de mapping direct mais un mapping Channex). */
    CHANNEX,
    /** Aucun canal mappé. */
    NONE
}
