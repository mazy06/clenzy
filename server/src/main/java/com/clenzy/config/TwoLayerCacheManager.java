package com.clenzy.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.cache.RedisCache;
import org.springframework.data.redis.cache.RedisCacheManager;

import java.time.Duration;
import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * CacheManager qui wrappe chaque Redis cache avec un Caffeine L1 local.
 * Chaque cache obtient une instance Caffeine avec TTL et max size configures.
 *
 * Niveau 8 — Scalabilite : reduit la latence cache de ~2ms (Redis) a ~0.01ms (local).
 */
public class TwoLayerCacheManager implements CacheManager {

    private final RedisCacheManager redisCacheManager;
    private final Duration caffeineTtl;
    private final long caffeineMaxSize;
    private final ConcurrentMap<String, Cache> cacheMap = new ConcurrentHashMap<>();

    public TwoLayerCacheManager(RedisCacheManager redisCacheManager,
                                 Duration caffeineTtl, long caffeineMaxSize) {
        this.redisCacheManager = redisCacheManager;
        this.caffeineTtl = caffeineTtl;
        this.caffeineMaxSize = caffeineMaxSize;
    }

    @Override
    public Cache getCache(String name) {
        return cacheMap.computeIfAbsent(name, this::createTwoLayerCache);
    }

    @Override
    public Collection<String> getCacheNames() {
        return redisCacheManager.getCacheNames();
    }

    private Cache createTwoLayerCache(String name) {
        org.springframework.cache.Cache springCache = redisCacheManager.getCache(name);
        if (springCache == null) {
            return null;
        }

        RedisCache redisCache = (RedisCache) springCache;

        com.github.benmanes.caffeine.cache.Cache<Object, Object> caffeineCache =
                Caffeine.newBuilder()
                        .expireAfterWrite(caffeineTtl)
                        .maximumSize(caffeineMaxSize)
                        .recordStats()
                        .build();

        return new TwoLayerCache(name, caffeineCache, redisCache);
    }
}
