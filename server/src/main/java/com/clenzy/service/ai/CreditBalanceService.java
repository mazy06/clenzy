package com.clenzy.service.ai;

import com.clenzy.model.AiCreditGrant;
import com.clenzy.repository.AiCreditGrantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Solde de credits IA par organisation (campagne T-06b, ADR-005).
 *
 * <p><b>Architecture</b> : le solde chaud vit dans Redis (compteur atomique,
 * scripts Lua — pattern {@code SupervisionScanQuota}, jamais de check-then-act) ;
 * la verite froide est la somme des poches {@code ai_credit_grant} (Postgres),
 * rechargee au cache-miss. Le ledger (T-06) corrige les deux, jamais l'inverse.</p>
 *
 * <p><b>Fail-closed</b> : Redis indisponible → toute reservation est REFUSEE
 * (le PMS classique continue, seul le multi-agent facturable se coupe — D-101).</p>
 */
@Service
public class CreditBalanceService {

    private static final Logger log = LoggerFactory.getLogger(CreditBalanceService.class);

    private static final String KEY_PREFIX = "ai:credits:balance:";
    private static final long KEY_TTL_SECONDS = 3600L;

    /**
     * Reserve atomique : -1 = solde inconnu (a recharger depuis Postgres),
     * 1 = reserve (decremente), 0 = solde insuffisant.
     */
    private static final RedisScript<Long> RESERVE_SCRIPT = new DefaultRedisScript<>(
            """
            local bal = redis.call('GET', KEYS[1])
            if not bal then return -1 end
            if tonumber(bal) >= tonumber(ARGV[1]) then
                redis.call('DECRBY', KEYS[1], ARGV[1])
                redis.call('EXPIRE', KEYS[1], ARGV[2])
                return 1
            end
            return 0
            """, Long.class);

    /** Credit (release de reservation / regularisation) — seulement si le compteur existe. */
    private static final RedisScript<Long> CREDIT_SCRIPT = new DefaultRedisScript<>(
            """
            if redis.call('EXISTS', KEYS[1]) == 1 then
                redis.call('INCRBY', KEYS[1], ARGV[1])
                redis.call('EXPIRE', KEYS[1], ARGV[2])
                return 1
            end
            return 0
            """, Long.class);

    /** Debit force (overshoot en fin de run) : peut passer sous zero — bloque le pre-vol suivant. */
    private static final RedisScript<Long> FORCE_DEBIT_SCRIPT = new DefaultRedisScript<>(
            """
            if redis.call('EXISTS', KEYS[1]) == 1 then
                redis.call('DECRBY', KEYS[1], ARGV[1])
                redis.call('EXPIRE', KEYS[1], ARGV[2])
                return 1
            end
            return 0
            """, Long.class);

    private final StringRedisTemplate redisTemplate;
    private final AiCreditGrantRepository grantRepository;

    public CreditBalanceService(StringRedisTemplate redisTemplate,
                                AiCreditGrantRepository grantRepository) {
        this.redisTemplate = redisTemplate;
        this.grantRepository = grantRepository;
    }

    /**
     * Tente de reserver {@code millicredits} sur le solde de l'org (atomique).
     * Cache-miss → recharge le compteur depuis Postgres (SETNX : ne clobber
     * jamais un compteur concurrent) puis retente UNE fois.
     * Panne Redis → {@code false} (fail-closed).
     */
    public boolean tryReserve(Long orgId, long millicredits) {
        if (orgId == null || millicredits <= 0) {
            return false;
        }
        try {
            Long result = executeReserve(orgId, millicredits);
            if (result != null && result == -1L) {
                seedFromDatabase(orgId);
                result = executeReserve(orgId, millicredits);
            }
            return result != null && result == 1L;
        } catch (Exception e) {
            log.warn("[CREDITS] Reservation refusee (Redis indisponible, fail-closed) : {}",
                    e.getMessage());
            return false;
        }
    }

    /** Rend {@code millicredits} au solde (release de reservation non consommee). Best-effort. */
    public void release(Long orgId, long millicredits) {
        if (orgId == null || millicredits <= 0) {
            return;
        }
        try {
            redisTemplate.execute(CREDIT_SCRIPT, List.of(key(orgId)),
                    String.valueOf(millicredits), String.valueOf(KEY_TTL_SECONDS));
        } catch (Exception e) {
            log.debug("[CREDITS] Release ignore (Redis) : {}", e.getMessage());
        }
    }

    /**
     * Debit force au-dela des reservations (overshoot de fin de run) : le solde
     * Redis peut passer negatif — le pre-vol suivant refusera. Best-effort.
     */
    public void forceDebit(Long orgId, long millicredits) {
        if (orgId == null || millicredits <= 0) {
            return;
        }
        try {
            redisTemplate.execute(FORCE_DEBIT_SCRIPT, List.of(key(orgId)),
                    String.valueOf(millicredits), String.valueOf(KEY_TTL_SECONDS));
        } catch (Exception e) {
            log.debug("[CREDITS] Debit force ignore (Redis) : {}", e.getMessage());
        }
    }

    /**
     * Applique une consommation reelle aux poches Postgres : SUBSCRIPTION
     * d'abord, puis TOPUP/PROMO par expiration croissante (D-102). Verrou
     * pessimiste : serialise les runs concurrents du meme tenant, y compris
     * multi-instances.
     *
     * @return millicredits effectivement absorbes par les poches (le surplus
     *         eventuel — poches vides — est journalise, le ledger reste la verite)
     */
    @Transactional
    public long applyConsumptionToGrants(Long orgId, long millicredits) {
        if (orgId == null || millicredits <= 0) {
            return 0;
        }
        long remaining = millicredits;
        List<AiCreditGrant> grants = grantRepository.lockActiveGrants(orgId, Instant.now());
        for (AiCreditGrant grant : grants) {
            if (remaining <= 0) {
                break;
            }
            remaining -= grant.applyConsumption(remaining);
        }
        grantRepository.saveAll(grants);
        long applied = millicredits - remaining;
        if (remaining > 0) {
            log.warn("[CREDITS] Consommation partiellement hors poche : org={} surplus={}mc "
                    + "(poches epuisees — le ledger reste la verite)", orgId, remaining);
        }
        return applied;
    }

    /** Invalide le compteur Redis (apres GRANT/EXPIRY — T-07) pour forcer une recharge DB. */
    public void invalidate(Long orgId) {
        if (orgId == null) {
            return;
        }
        try {
            redisTemplate.delete(key(orgId));
        } catch (Exception e) {
            log.debug("[CREDITS] Invalidation ignoree (Redis) : {}", e.getMessage());
        }
    }

    private Long executeReserve(Long orgId, long millicredits) {
        return redisTemplate.execute(RESERVE_SCRIPT, List.of(key(orgId)),
                String.valueOf(millicredits), String.valueOf(KEY_TTL_SECONDS));
    }

    /** Recharge le compteur depuis les poches (SETNX — ne clobber jamais un compteur vivant). */
    private void seedFromDatabase(Long orgId) {
        long available = grantRepository.availableMillicredits(orgId, Instant.now());
        redisTemplate.opsForValue().setIfAbsent(key(orgId), String.valueOf(available),
                Duration.ofSeconds(KEY_TTL_SECONDS));
    }

    private static String key(Long orgId) {
        return KEY_PREFIX + orgId;
    }
}
