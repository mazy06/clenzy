package com.clenzy.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Implementation Redis pub/sub de {@link CacheInvalidationPublisher} : publie le
 * message d'invalidation sur le canal {@link #CHANNEL}. Les autres noeuds
 * (via {@link CacheInvalidationListener}) evincent alors leur L1 local.
 *
 * <p>L'{@code originId} (UUID du noeud, partage avec le listener) est inclus dans
 * chaque message pour que l'emetteur ignore sa propre publication — pas de boucle
 * et pas de double eviction locale.</p>
 *
 * <p>Tolerance aux pannes : un echec de publication (Redis indisponible) est
 * journalise mais JAMAIS propage. L'evict local a deja eu lieu cote emetteur ;
 * au pire les autres noeuds retombent sur la tolerance TTL L1 (30s) — le
 * comportement mono-instance reste strictement inchange.</p>
 */
public class RedisCacheInvalidationPublisher implements CacheInvalidationPublisher {

    static final String CHANNEL = "clenzy:cache:invalidation";

    private static final Logger log = LoggerFactory.getLogger(RedisCacheInvalidationPublisher.class);

    private final StringRedisTemplate redisTemplate;
    private final String originId;

    public RedisCacheInvalidationPublisher(StringRedisTemplate redisTemplate, String originId) {
        this.redisTemplate = redisTemplate;
        this.originId = originId;
    }

    @Override
    public void publishEviction(String cacheName, Object key) {
        try {
            CacheInvalidationMessage message = (key == null)
                    ? CacheInvalidationMessage.clear(originId, cacheName)
                    : new CacheInvalidationMessage(originId, cacheName, String.valueOf(key));
            redisTemplate.convertAndSend(CHANNEL, message.serialize());
        } catch (RuntimeException e) {
            // Ne jamais casser l'evict local sur un incident de diffusion (cf. contrat).
            log.warn("Echec diffusion invalidation cache L1 (cache={}): {}", cacheName, e.getMessage());
        }
    }
}
