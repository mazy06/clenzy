package com.clenzy.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.cache.RedisCache;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TwoLayerCacheTest {

    @Mock private RedisCache redisCache;
    private Cache<Object, Object> caffeineCache;
    private TwoLayerCache twoLayerCache;

    @BeforeEach
    void setUp() {
        caffeineCache = Caffeine.newBuilder().maximumSize(100).build();
        twoLayerCache = new TwoLayerCache("test-cache", caffeineCache, redisCache);
    }

    @Test void getName() {
        assertThat(twoLayerCache.getName()).isEqualTo("test-cache");
    }

    @Test void getNativeCache() {
        assertThat(twoLayerCache.getNativeCache()).isEqualTo(caffeineCache);
    }

    @Test void put_writesToBothLayers() {
        twoLayerCache.put("key1", "value1");
        assertThat(caffeineCache.getIfPresent("key1")).isEqualTo("value1");
        verify(redisCache).put("key1", "value1");
    }

    @Test void get_hitsL1First() {
        caffeineCache.put("key1", "value1");
        // Should return from L1 without hitting Redis
        org.springframework.cache.Cache.ValueWrapper result = twoLayerCache.get("key1");
        assertThat(result).isNotNull();
        assertThat(result.get()).isEqualTo("value1");
        verifyNoInteractions(redisCache);
    }

    @Test void get_missL1_hitsL2() {
        org.springframework.cache.Cache.ValueWrapper redisWrapper = mock(org.springframework.cache.Cache.ValueWrapper.class);
        when(redisWrapper.get()).thenReturn("value-from-redis");
        when(redisCache.get("key2")).thenReturn(redisWrapper);

        org.springframework.cache.Cache.ValueWrapper result = twoLayerCache.get("key2");
        assertThat(result).isNotNull();
        assertThat(result.get()).isEqualTo("value-from-redis");
        // Should populate L1
        assertThat(caffeineCache.getIfPresent("key2")).isEqualTo("value-from-redis");
    }

    @Test void get_missesAll() {
        when(redisCache.get("key3")).thenReturn(null);

        org.springframework.cache.Cache.ValueWrapper result = twoLayerCache.get("key3");
        assertThat(result).isNull();
    }

    @Test void evict_invalidatesBoth() {
        caffeineCache.put("key1", "value1");
        twoLayerCache.evict("key1");
        assertThat(caffeineCache.getIfPresent("key1")).isNull();
        verify(redisCache).evict("key1");
    }

    @Test void clear_invalidatesBoth() {
        caffeineCache.put("key1", "value1");
        caffeineCache.put("key2", "value2");
        twoLayerCache.clear();
        assertThat(caffeineCache.estimatedSize()).isZero();
        verify(redisCache).clear();
    }
}
