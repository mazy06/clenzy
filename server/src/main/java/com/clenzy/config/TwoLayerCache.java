package com.clenzy.config;

import com.github.benmanes.caffeine.cache.Cache;
import org.springframework.cache.support.AbstractValueAdaptingCache;
import org.springframework.data.redis.cache.RedisCache;

import java.util.concurrent.Callable;

/**
 * Cache a deux niveaux : Caffeine L1 (local, 30s) devant Redis L2.
 * - get : L1 d'abord, si miss → L2, si hit en L2 → populate L1
 * - put : ecrit dans les deux
 * - evict : invalide les deux, L2 PUIS L1 (voir contrat d'invalidation)
 *
 * <p><b>Contrat d'invalidation (Z1-BUGS-09)</b> : evict/clear invalident
 * Redis (L2) AVANT Caffeine (L1). Avec l'ordre inverse, un lookup concurrent
 * pouvait relire l'ancienne valeur dans Redis (pas encore evincee) et
 * repeupler L1 juste apres son invalidation — la donnee perimee survivait
 * alors tout un TTL L1 supplementaire. L2-puis-L1 borne la fenetre de
 * course a la duree de l'evict lui-meme.</p>
 *
 * <p><b>Invalidation cross-instance (Z1-BUGS-09, C3-AUDITIP-CACHE)</b> : sur
 * evict/clear, apres avoir evince L2 puis L1 localement, le cache publie la cle
 * (ou un marqueur de clear) via {@link CacheInvalidationPublisher} (Redis pub/sub).
 * Chaque autre noeud evince alors SON L1 local pour ce cache via
 * {@link #clearLocal()} (eviction coarse mais idempotente et sure : L1 borne a
 * ~500 entrees / 30s, re-warm negligeable). Le noeud emetteur ignore sa propre
 * publication grace a l'{@code originId} embarque dans le message — pas de boucle.
 * Si {@code publisher == null} (mono-instance / test), le comportement est
 * strictement celui d'avant : L1 invalide localement, aucune diffusion. La
 * publication est best-effort (un echec Redis ne casse jamais l'evict local).</p>
 *
 * <p><b>Contrat null (Z1-BUGS-04)</b> : {@code allowNullValues=true}, donc une
 * valeur {@code null} (methode {@code @Cacheable} retournant null) est stockee
 * en L1 sous la sentinelle {@code NullValue} via {@link #toStoreValue(Object)} —
 * Caffeine interdit les valeurs null brutes (NPE sinon). Le L2 Redis est
 * configure avec {@code disableCachingNullValues} (CacheConfig) : les nulls ne
 * sont PAS propages en L2 (sinon IllegalArgumentException), ils ne sont caches
 * que localement pendant le TTL L1.</p>
 *
 * Niveau 8 — Scalabilite : cache local pour reduire les appels Redis.
 */
public class TwoLayerCache extends AbstractValueAdaptingCache {

    private final String name;
    private final Cache<Object, Object> caffeineCache;
    private final RedisCache redisCache;
    /** Diffusion cross-instance des invalidations L1. {@code null} = mono-instance (pas de pub/sub). */
    private final CacheInvalidationPublisher invalidationPublisher;

    /** Constructeur mono-instance : aucune diffusion cross-instance (comportement historique). */
    public TwoLayerCache(String name, Cache<Object, Object> caffeineCache,
                         RedisCache redisCache) {
        this(name, caffeineCache, redisCache, null);
    }

    public TwoLayerCache(String name, Cache<Object, Object> caffeineCache,
                         RedisCache redisCache, CacheInvalidationPublisher invalidationPublisher) {
        super(true); // allowNullValues
        this.name = name;
        this.caffeineCache = caffeineCache;
        this.redisCache = redisCache;
        this.invalidationPublisher = invalidationPublisher;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public Object getNativeCache() {
        return caffeineCache;
    }

    /**
     * Retourne la valeur au format "store" (eventuellement {@code NullValue}) :
     * {@link AbstractValueAdaptingCache#get(Object)} applique fromStoreValue.
     */
    @Override
    protected Object lookup(Object key) {
        // L1 d'abord (contient des store values : NullValue possible)
        Object storeValue = caffeineCache.getIfPresent(key);
        if (storeValue != null) {
            return storeValue;
        }
        // L2 Redis (ne contient jamais de null : disableCachingNullValues)
        ValueWrapper wrapper = redisCache.get(key);
        if (wrapper == null) {
            return null;
        }
        Object redisValue = wrapper.get();
        if (redisValue == null) {
            return null;
        }
        caffeineCache.put(key, redisValue); // populate L1 (non-null : identite)
        return redisValue;
    }

    @SuppressWarnings("unchecked")
    @Override
    public <T> T get(Object key, Callable<T> valueLoader) {
        Object storeValue = lookup(key);
        if (storeValue != null) {
            return (T) fromStoreValue(storeValue);
        }
        // Les deux miss → charger puis ecrire dans les deux (put est null-safe :
        // un null est cache en L1 seulement, jamais pousse vers Redis).
        final T loaded;
        try {
            loaded = valueLoader.call();
        } catch (Exception e) {
            throw new ValueRetrievalException(key, valueLoader, e);
        }
        put(key, loaded);
        return loaded;
    }

    @Override
    public void put(Object key, Object value) {
        caffeineCache.put(key, toStoreValue(value));
        if (value != null) {
            redisCache.put(key, value);
        }
    }

    /**
     * Evince L2 avant L1 : si L1 etait evince en premier, un lookup concurrent
     * pouvait repeupler L1 depuis le Redis pas encore evince (Z1-BUGS-09).
     * Puis diffuse l'invalidation L1 aux autres noeuds (C3-AUDITIP-CACHE).
     */
    @Override
    public void evict(Object key) {
        redisCache.evict(key);
        caffeineCache.invalidate(key);
        publishInvalidation(key);
    }

    /** Meme ordre que {@link #evict(Object)} : L2 puis L1 (Z1-BUGS-09), puis diffusion. */
    @Override
    public void clear() {
        redisCache.clear();
        caffeineCache.invalidateAll();
        publishInvalidation(null); // null = clear complet du cache sur les autres noeuds
    }

    /**
     * Eviction L1 LOCALE uniquement (Caffeine), declenchee a la reception d'un
     * message d'invalidation d'un autre noeud. NE touche PAS L2 (deja evince par
     * l'emetteur) et NE re-publie PAS (pas de boucle). Implementation coarse et
     * sure : on vide tout le L1 de ce cache plutot que de tenter de reconstruire
     * la cle exacte (type-safe sans serialisation fragile ; L1 minuscule).
     */
    void clearLocal() {
        caffeineCache.invalidateAll();
    }

    /** Best-effort : un publisher absent (mono-instance) ou un echec de diffusion ne casse rien. */
    private void publishInvalidation(Object key) {
        if (invalidationPublisher == null) {
            return;
        }
        invalidationPublisher.publishEviction(name, key);
    }
}
