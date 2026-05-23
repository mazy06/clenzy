package com.clenzy.integration.oauth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

/**
 * Gestion du parametre {@code state} OAuth2 (RFC 6749 section 10.12) :
 * token CSRF aleatoire genere lors de l'init du flow, valide single-use au
 * callback.
 *
 * <h2>Stockage</h2>
 * Redis avec TTL 10 minutes. La cle inclut le providerKey pour eviter les
 * collisions entre providers.
 *
 * <h2>Securite</h2>
 * Conforme aux Security Rules Clenzy : state = UUID.randomUUID(), single-use,
 * jamais un identifiant predictible. Voir
 * {@code AirbnbOAuthService.validateAndConsumeState()} pour le pattern.
 *
 * <h2>Format de la valeur</h2>
 * {@code "<userId>:<orgId>"} — encode les 2 IDs necessaires au callback. Le
 * service ne parse pas le contenu, c'est le code appelant qui interprete.
 */
@Service
public class OAuthStateService {

    private static final Logger log = LoggerFactory.getLogger(OAuthStateService.class);
    private static final String KEY_PREFIX = "oauth:";
    private static final Duration TTL = Duration.ofMinutes(10);

    private final StringRedisTemplate redisTemplate;

    public OAuthStateService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * Genere un state aleatoire pour un provider donne et le stocke en Redis
     * avec une charge utile {@code userId:orgId}.
     *
     * @return le state genere (a passer dans l'URL d'autorisation OAuth)
     */
    public String generate(String providerKey, Long userId, Long orgId) {
        String state = UUID.randomUUID().toString();
        String payload = userId + ":" + orgId;
        redisTemplate.opsForValue().set(buildKey(providerKey, state), payload, TTL);
        return state;
    }

    /**
     * Valide un state au callback, le consomme (single-use), et retourne la
     * paire (userId, orgId) extraite. {@link Optional#empty()} si le state
     * est inconnu, expire ou mal forme.
     */
    public Optional<StatePayload> validateAndConsume(String providerKey, String state) {
        if (state == null || state.isBlank()) {
            return Optional.empty();
        }

        String key = buildKey(providerKey, state);
        String value = redisTemplate.opsForValue().get(key);

        if (value == null) {
            log.warn("OAuth state invalide ou expire — provider={}, state={}", providerKey, state);
            return Optional.empty();
        }

        // Single-use : supprimer immediatement
        redisTemplate.delete(key);

        String[] parts = value.split(":");
        if (parts.length != 2) {
            log.error("OAuth state format invalide — provider={}, payload={}", providerKey, value);
            return Optional.empty();
        }

        try {
            return Optional.of(new StatePayload(
                Long.parseLong(parts[0]),
                Long.parseLong(parts[1])
            ));
        } catch (NumberFormatException e) {
            log.error("OAuth state — IDs non numeriques — provider={}, payload={}", providerKey, value);
            return Optional.empty();
        }
    }

    private String buildKey(String providerKey, String state) {
        return KEY_PREFIX + providerKey.toLowerCase() + ":state:" + state;
    }

    /** Charge utile encodee dans le state Redis. */
    public record StatePayload(Long userId, Long orgId) {}
}
