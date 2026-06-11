package com.clenzy.config;

/**
 * Publie une invalidation L1 cross-instance.
 *
 * <p>Quand un {@link TwoLayerCache} evince/vide son L1 Caffeine local, il notifie
 * les autres noeuds via cette abstraction (implementation par defaut : Redis
 * pub/sub, {@link RedisCacheInvalidationPublisher}). Chaque noeud qui recoit la
 * notification evince son propre L1 — sinon, en multi-instance, le L1 des autres
 * noeuds servirait la valeur perimee jusqu'au TTL Caffeine (30s).</p>
 *
 * <p>Abstraction (DIP) plutot que dependance directe a Redis dans
 * {@link TwoLayerCache} : garde le cache testable sans broker et permet une
 * implementation no-op en mono-instance / en test.</p>
 */
public interface CacheInvalidationPublisher {

    /**
     * Diffuse aux autres noeuds que le L1 du cache {@code cacheName} doit etre
     * evince. {@code key == null} signifie un clear complet du cache.
     *
     * <p>L'implementation NE DOIT JAMAIS propager d'exception : un echec de
     * diffusion ne doit pas casser l'evict local (degraderait le comportement
     * mono-instance actuel). Au pire, on retombe sur la tolerance TTL L1.</p>
     */
    void publishEviction(String cacheName, Object key);
}
