package com.clenzy.config;

import com.github.benmanes.caffeine.cache.Cache;
import org.springframework.cache.support.AbstractValueAdaptingCache;
import org.springframework.data.redis.cache.RedisCache;

import java.util.concurrent.Callable;

/**
 * Cache a deux niveaux : Caffeine L1 (local, 30s) devant Redis L2.
 * - get : L1 d'abord, si miss → L2, si hit en L2 → populate L1
 * - put : ecrit dans les deux
 * - evict : invalide les deux
 *
 * Niveau 8 — Scalabilite : cache local pour reduire les appels Redis.
 */
public class TwoLayerCache extends AbstractValueAdaptingCache {

    private final String name;
    private final Cache<Object, Object> caffeineCache;
    private final RedisCache redisCache;

    public TwoLayerCache(String name, Cache<Object, Object> caffeineCache,
                         RedisCache redisCache) {
        super(true); // allowNullValues
        this.name = name;
        this.caffeineCache = caffeineCache;
        this.redisCache = redisCache;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public Object getNativeCache() {
        return caffeineCache;
    }

    @Override
    protected Object lookup(Object key) {
        // L1 d'abord
        Object value = caffeineCache.getIfPresent(key);
        if (value != null) {
            return value;
        }
        // L2 Redis
        ValueWrapper wrapper = redisCache.get(key);
        if (wrapper != null) {
            Object redisValue = wrapper.get();
            if (redisValue != null) {
                caffeineCache.put(key, redisValue); // populate L1
            }
            return redisValue;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    @Override
    public <T> T get(Object key, Callable<T> valueLoader) {
        Object value = lookup(key);
        if (value != null) {
            return (T) value;
        }
        // Les deux miss → charger et mettre dans les deux
        T loaded = redisCache.get(key, valueLoader);
        if (loaded != null) {
            caffeineCache.put(key, loaded);
        }
        return loaded;
    }

    @Override
    public void put(Object key, Object value) {
        caffeineCache.put(key, value);
        redisCache.put(key, value);
    }

    @Override
    public void evict(Object key) {
        caffeineCache.invalidate(key);
        redisCache.evict(key);
    }

    @Override
    public void clear() {
        caffeineCache.invalidateAll();
        redisCache.clear();
    }
}
