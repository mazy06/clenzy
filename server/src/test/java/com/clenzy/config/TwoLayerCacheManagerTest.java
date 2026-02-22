package com.clenzy.config;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.data.redis.cache.RedisCache;
import org.springframework.data.redis.cache.RedisCacheManager;

import java.time.Duration;
import java.util.Collection;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TwoLayerCacheManagerTest {

    @Mock private RedisCacheManager redisCacheManager;
    @Mock private RedisCache redisCache;
    private TwoLayerCacheManager cacheManager;

    @BeforeEach
    void setUp() {
        cacheManager = new TwoLayerCacheManager(redisCacheManager, Duration.ofSeconds(30), 1000);
    }

    @Test void getCache_returnsWrappedCache() {
        when(redisCacheManager.getCache("test")).thenReturn(redisCache);

        Cache cache = cacheManager.getCache("test");
        assertThat(cache).isInstanceOf(TwoLayerCache.class);
        assertThat(cache.getName()).isEqualTo("test");
    }

    @Test void getCache_cachesResult() {
        when(redisCacheManager.getCache("test")).thenReturn(redisCache);

        Cache first = cacheManager.getCache("test");
        Cache second = cacheManager.getCache("test");
        assertThat(first).isSameAs(second);
        verify(redisCacheManager, times(1)).getCache("test");
    }

    @Test void getCache_whenRedisReturnsNull_thenReturnsNull() {
        when(redisCacheManager.getCache("unknown")).thenReturn(null);
        Cache cache = cacheManager.getCache("unknown");
        assertThat(cache).isNull();
    }

    @Test void getCacheNames_delegatesToRedis() {
        when(redisCacheManager.getCacheNames()).thenReturn(Set.of("cache1", "cache2"));
        Collection<String> names = cacheManager.getCacheNames();
        assertThat(names).containsExactlyInAnyOrder("cache1", "cache2");
    }
}
