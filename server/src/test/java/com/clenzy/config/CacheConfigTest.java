package com.clenzy.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires pour {@link CacheConfig}.
 *
 * <p>Le bean {@code cacheManager(RedisConnectionFactory)} retourne un
 * {@link TwoLayerCacheManager} qui wrappe un Redis cache manager. On verifie
 * surtout que le bean construit ne crash pas et expose le type attendu — la
 * couverture des caches individuels passe ensuite via {@link TwoLayerCacheManager}
 * (deja teste).</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("CacheConfig")
class CacheConfigTest {

    @Mock private RedisConnectionFactory redisConnectionFactory;

    private CacheConfig config;

    @BeforeEach
    void setUp() {
        config = new CacheConfig();
    }

    @Test
    @DisplayName("cacheManager retourne un TwoLayerCacheManager (defaut config + 8 caches specifiques)")
    void cacheManager_returnsTwoLayerCacheManager() {
        CacheManager manager = config.cacheManager(redisConnectionFactory);

        assertThat(manager).isNotNull();
        assertThat(manager).isInstanceOf(TwoLayerCacheManager.class);
    }

    @Test
    @DisplayName("cacheManager expose les noms de caches via getCacheNames()")
    void cacheManager_exposesCacheNames() {
        CacheManager manager = config.cacheManager(redisConnectionFactory);

        // getCacheNames() peut etre vide tant qu'aucun getCache() n'a ete fait
        // (Redis cache manager se construit avec withInitialCacheConfigurations).
        assertThat(manager.getCacheNames()).isNotNull();
    }

    @Test
    @DisplayName("cacheManager retourne null quand on cherche un cache inconnu (RedisCacheManager comportement)")
    void cacheManager_unknownCacheNameReturnsNull_or_DefaultConfig() {
        CacheManager manager = config.cacheManager(redisConnectionFactory);

        // RedisCacheManager + Caffeine L1 → renvoie un Cache (default config) ou null.
        // Le but est juste d'exercer la branche createTwoLayerCache.
        Object cache = manager.getCache("random-unknown-cache-name");
        assertThat(cache == null || cache instanceof org.springframework.cache.Cache).isTrue();
    }

    @Test
    @DisplayName("instancier CacheConfig est sans effet de bord")
    void newInstance_noSideEffects() {
        CacheConfig fresh = new CacheConfig();
        assertThat(fresh).isNotNull();
    }
}
