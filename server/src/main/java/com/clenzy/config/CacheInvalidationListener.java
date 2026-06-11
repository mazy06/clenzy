package com.clenzy.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;

import java.nio.charset.StandardCharsets;

/**
 * Listener Redis pub/sub des invalidations L1 cross-instance (canal
 * {@link RedisCacheInvalidationPublisher#CHANNEL}). A chaque message emis par un
 * AUTRE noeud, evince le L1 local du cache concerne via
 * {@link TwoLayerCacheManager#evictLocal(String)}.
 *
 * <p>Suppression des messages emis par soi-meme : Redis livre la publication a
 * tous les abonnes y compris l'emetteur ; on compare l'{@code originId} du
 * message a celui du noeud courant et on ignore les siens (pas de boucle, pas de
 * double eviction locale).</p>
 *
 * <p>Defensif : un payload malforme ou une erreur de traitement est journalise
 * et ignore — un message empoisonne ne doit jamais perturber le cache.</p>
 */
public class CacheInvalidationListener implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(CacheInvalidationListener.class);

    private final TwoLayerCacheManager cacheManager;
    private final String originId;

    public CacheInvalidationListener(TwoLayerCacheManager cacheManager, String originId) {
        this.cacheManager = cacheManager;
        this.originId = originId;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String payload = new String(message.getBody(), StandardCharsets.UTF_8);
            CacheInvalidationMessage parsed = CacheInvalidationMessage.deserialize(payload);
            if (parsed == null) {
                log.warn("Message d'invalidation cache ignore (payload malforme): {}", payload);
                return;
            }
            // Ignore nos propres messages (Redis livre aussi a l'emetteur).
            if (originId.equals(parsed.originId())) {
                return;
            }
            // Eviction L1 locale coarse (le clear et l'evict par cle ont le meme
            // effet local : on vide le L1 du cache nomme). Idempotent.
            cacheManager.evictLocal(parsed.cacheName());
        } catch (RuntimeException e) {
            log.warn("Echec traitement message d'invalidation cache L1: {}", e.getMessage());
        }
    }
}
