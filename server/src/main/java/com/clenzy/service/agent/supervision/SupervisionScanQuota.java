package com.clenzy.service.agent.supervision;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Garde-budget de la boucle autonome : nb max de scans automatiques / jour / org.
 *
 * <p>Compteur Redis journalier (bucket UTC, TTL 1 jour). La consommation est
 * <b>atomique</b> (script Lua INCR + EXPIRE + DECR-si-dépassement), comme le
 * rate-limiter — pas de check-then-act (cf. règle d'audit concurrence).</p>
 */
@Service
public class SupervisionScanQuota {

    private static final String KEY_PREFIX = "supervision:scan:daily:";
    private static final long ONE_DAY_SECONDS = 86_400L;

    /** Retourne 1 si une unité a été consommée (sous budget), 0 sinon. */
    private static final RedisScript<Long> CONSUME_SCRIPT = new DefaultRedisScript<>(
            """
            local count = redis.call('INCR', KEYS[1])
            if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
            if count > tonumber(ARGV[1]) then
                redis.call('DECR', KEYS[1])
                return 0
            end
            return 1
            """, Long.class);

    private final StringRedisTemplate redisTemplate;

    public SupervisionScanQuota(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * Tente de consommer une unité de budget pour l'org. {@code true} si accordé
     * (compteur du jour {@code < dailyBudget}), {@code false} si plafond atteint
     * ou budget nul. Best-effort : une panne Redis refuse (fail-closed) le scan.
     */
    public boolean tryConsume(Long orgId, int dailyBudget) {
        if (orgId == null || dailyBudget <= 0) {
            return false;
        }
        try {
            Long granted = redisTemplate.execute(CONSUME_SCRIPT, List.of(key(orgId)),
                    String.valueOf(dailyBudget), String.valueOf(ONE_DAY_SECONDS));
            return granted != null && granted == 1L;
        } catch (Exception e) {
            return false; // Redis indisponible → on ne lance pas de scan (fail-closed)
        }
    }

    /** Compteur de scans automatiques consommés aujourd'hui (0 si absent/erreur). */
    public long todayCount(Long orgId) {
        if (orgId == null) {
            return 0;
        }
        try {
            String value = redisTemplate.opsForValue().get(key(orgId));
            return value != null ? Long.parseLong(value) : 0L;
        } catch (Exception e) {
            return 0L;
        }
    }

    private static String key(Long orgId) {
        return KEY_PREFIX + LocalDate.now(ZoneOffset.UTC) + ":org:" + orgId;
    }
}
