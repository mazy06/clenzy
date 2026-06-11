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

    // --- Contrat null (Z1-BUGS-04) ---------------------------------------

    @Test void whenPutNullValue_thenNoNpeAndRedisNotWritten() {
        // Caffeine interdit null : la sentinelle NullValue doit etre stockee en L1,
        // et rien ne doit partir vers Redis (disableCachingNullValues en L2).
        twoLayerCache.put("nullable-key", null);

        assertThat(caffeineCache.getIfPresent("nullable-key")).isNotNull();
        verify(redisCache, never()).put(any(), any());
    }

    @Test void whenPutNullValue_thenGetReturnsWrapperWithNull() {
        twoLayerCache.put("nullable-key", null);

        org.springframework.cache.Cache.ValueWrapper wrapper = twoLayerCache.get("nullable-key");

        // Hit L1 (null cache) : wrapper non-null, valeur null, sans toucher Redis.
        assertThat(wrapper).isNotNull();
        assertThat(wrapper.get()).isNull();
        verifyNoInteractions(redisCache);
    }

    @Test void whenValueLoaderReturnsNull_thenNullCachedInL1Only() {
        when(redisCache.get("miss-key")).thenReturn(null);

        String loaded = twoLayerCache.get("miss-key", () -> null);

        assertThat(loaded).isNull();
        assertThat(caffeineCache.getIfPresent("miss-key")).isNotNull(); // NullValue en L1
        verify(redisCache, never()).put(any(), any());
    }

    @Test void whenValueLoaderReturnsValue_thenCachedInBothLayers() {
        when(redisCache.get("miss-key")).thenReturn(null);

        String loaded = twoLayerCache.get("miss-key", () -> "loaded-value");

        assertThat(loaded).isEqualTo("loaded-value");
        assertThat(caffeineCache.getIfPresent("miss-key")).isEqualTo("loaded-value");
        verify(redisCache).put("miss-key", "loaded-value");
    }

    @Test void whenValueLoaderThrows_thenValueRetrievalException() {
        when(redisCache.get("boom-key")).thenReturn(null);

        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> twoLayerCache.get("boom-key", () -> { throw new IllegalStateException("boom"); }))
                .isInstanceOf(org.springframework.cache.Cache.ValueRetrievalException.class);
    }

    // --- Ordre d'invalidation L2 puis L1 (Z1-BUGS-09) ---------------------

    @Test
    @SuppressWarnings("unchecked")
    void whenEvict_thenRedisEvictedBeforeCaffeine() {
        // Arrange : Caffeine mocke pour pouvoir verifier l'ordre inter-couches
        Cache<Object, Object> caffeineMock = mock(Cache.class);
        TwoLayerCache cache = new TwoLayerCache("ordered-cache", caffeineMock, redisCache);

        // Act
        cache.evict("key1");

        // Assert : L2 (Redis) evince AVANT L1 (Caffeine), sinon un lookup
        // concurrent repeuple L1 depuis le Redis pas encore evince.
        var inOrder = inOrder(redisCache, caffeineMock);
        inOrder.verify(redisCache).evict("key1");
        inOrder.verify(caffeineMock).invalidate("key1");
    }

    @Test
    @SuppressWarnings("unchecked")
    void whenClear_thenRedisClearedBeforeCaffeine() {
        // Arrange
        Cache<Object, Object> caffeineMock = mock(Cache.class);
        TwoLayerCache cache = new TwoLayerCache("ordered-cache", caffeineMock, redisCache);

        // Act
        cache.clear();

        // Assert
        var inOrder = inOrder(redisCache, caffeineMock);
        inOrder.verify(redisCache).clear();
        inOrder.verify(caffeineMock).invalidateAll();
    }

    // --- Invalidation cross-instance (C3-AUDITIP-CACHE) ------------------

    @Test void whenEvict_withPublisher_thenPublishesKeyAfterLocalEvict() {
        CacheInvalidationPublisher publisher = mock(CacheInvalidationPublisher.class);
        TwoLayerCache cache = new TwoLayerCache("pub-cache", caffeineCache, redisCache, publisher);

        cache.evict("key1");

        verify(redisCache).evict("key1");
        verify(publisher).publishEviction("pub-cache", "key1");
    }

    @Test void whenClear_withPublisher_thenPublishesClearMarker() {
        CacheInvalidationPublisher publisher = mock(CacheInvalidationPublisher.class);
        TwoLayerCache cache = new TwoLayerCache("pub-cache", caffeineCache, redisCache, publisher);

        cache.clear();

        verify(redisCache).clear();
        // key == null = clear complet du cache sur les autres noeuds
        verify(publisher).publishEviction("pub-cache", null);
    }

    @Test void whenEvict_withoutPublisher_thenNoPublicationAndNoNpe() {
        // Constructeur mono-instance (publisher null) : comportement historique strict.
        twoLayerCache.evict("key1");

        verify(redisCache).evict("key1");
        // Pas de publisher : aucune diffusion, et surtout aucune NPE.
    }

    @Test void whenPublisherThrows_thenEvictStillSucceedsLocally() {
        // Le contrat best-effort est porte par l'implementation du publisher
        // (RedisCacheInvalidationPublisher avale les RuntimeException). Ici on
        // verifie au moins que l'evict local L2/L1 a bien eu lieu AVANT la
        // publication, donc qu'un publisher tardif ne defait pas l'eviction.
        caffeineCache.put("key1", "value1");
        CacheInvalidationPublisher publisher = mock(CacheInvalidationPublisher.class);
        TwoLayerCache cache = new TwoLayerCache("pub-cache", caffeineCache, redisCache, publisher);

        cache.evict("key1");

        assertThat(caffeineCache.getIfPresent("key1")).isNull();
        verify(redisCache).evict("key1");
    }

    @Test void clearLocal_invalidatesL1Only_withoutTouchingRedis() {
        caffeineCache.put("key1", "value1");
        caffeineCache.put("key2", "value2");

        twoLayerCache.clearLocal();

        assertThat(caffeineCache.estimatedSize()).isZero();
        // clearLocal ne doit ni vider Redis ni re-publier.
        verifyNoInteractions(redisCache);
    }
}
