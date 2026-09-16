package com.clenzy.marketplace.service;

import com.clenzy.util.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Limite de debit du formulaire public de candidature.
 *
 * <p>Sans elle, la surface non authentifiee permet de remplir le catalogue de
 * fausses fiches aussi vite que le reseau le permet, et la moderation devient
 * le goulot. INCR + EXPIRE Redis plutot qu'un compteur en memoire : le compteur
 * en memoire se reinitialise a chaque redemarrage et ne compte que sur une
 * instance, ce qui le rend inoperant des qu'il y en a deux.</p>
 *
 * <p><b>Defaillance ouverte assumee</b> : si Redis est indisponible, la
 * candidature passe. Bloquer les inscriptions parce que le cache est tombe
 * couterait plus qu'un afflux de spam, et le rate-limit Nginx reste actif en
 * amont.</p>
 *
 * <p>Troisieme occurrence de ce motif dans le produit (signature de contrats,
 * booking engine public, ici). Une extraction en composant partage se justifie
 * desormais ; elle toucherait deux chemins sensibles et sort du perimetre de ce
 * changement.</p>
 */
@Component
public class MarketplacePublicRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(MarketplacePublicRateLimiter.class);

    private static final String REDIS_PREFIX = "marketplace-rl:";

    /** Candidatures : 5 par heure et par adresse IP. */
    private static final int MAX_PER_WINDOW = 5;

    /**
     * Depots de pieces : plus permissif que les candidatures.
     *
     * <p>Un dossier complet fait quatre pieces, et un candidat s'y reprend —
     * mauvais fichier, mauvais sens de scan. Le plafond qui compte est ailleurs :
     * le nombre de pieces par dossier, borne cote service. Celui-ci n'est la que
     * contre le martelement.</p>
     */
    private static final int MAX_UPLOADS_PER_WINDOW = 30;

    private static final Duration WINDOW = Duration.ofHours(1);

    private final StringRedisTemplate redisTemplate;

    public MarketplacePublicRateLimiter(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /** @return {@code true} si la candidature est autorisee */
    public boolean tryAcquireApplication(HttpServletRequest request) {
        return tryAcquire("apply:" + clientIp(request), MAX_PER_WINDOW);
    }

    /** @return {@code true} si le depot de piece est autorise */
    public boolean tryAcquireUpload(HttpServletRequest request) {
        return tryAcquire("upload:" + clientIp(request), MAX_UPLOADS_PER_WINDOW);
    }

    private boolean tryAcquire(String suffix, int limit) {
        String key = REDIS_PREFIX + suffix;
        try {
            Long current = redisTemplate.opsForValue().increment(key);
            if (current != null && current == 1L) {
                redisTemplate.expire(key, WINDOW);
            }
            boolean allowed = current == null || current <= limit;
            if (!allowed) {
                log.warn("Acces place de marche limite pour {} ({}/{})", key, current, limit);
            }
            return allowed;
        } catch (Exception e) {
            log.warn("Limite de debit indisponible (Redis) : {}", e.getMessage());
            return true;
        }
    }

    /**
     * IP reelle du client.
     *
     * <p>Passe par {@link ClientIpResolver} et jamais par le premier element de
     * {@code X-Forwarded-For} : nginx ajoute l'IP reelle en FIN de chaine, donc
     * les entrees de gauche sont fournies par le client et permettraient de
     * faire tourner la clef de limite avec un simple en-tete.</p>
     */
    private String clientIp(HttpServletRequest request) {
        return ClientIpResolver.resolve(
            request.getRemoteAddr(),
            request.getHeader("X-Forwarded-For"),
            request.getHeader("X-Real-IP"));
    }
}
