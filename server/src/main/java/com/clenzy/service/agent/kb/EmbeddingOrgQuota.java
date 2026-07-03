package com.clenzy.service.agent.kb;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Quota mensuel d'appels d'embeddings par organisation (reliquat X10).
 *
 * <p>Le modele EMBEDDINGS est platform-global (pas de BYOK) : chaque recherche
 * RAG coute a la plateforme. L'auto-RAG etant appele a CHAQUE tour utilisateur,
 * une org tres bavarde (ou un abus) genererait un cout non borne — ce quota
 * borne le nombre d'appels par org et par mois calendaire (bucket UTC, aligne
 * sur les dotations credits).</p>
 *
 * <p>Compteur Redis atomique (script Lua INCR+EXPIRE+DECR-si-depassement,
 * pattern {@link com.clenzy.service.agent.supervision.SupervisionScanQuota} —
 * pas de check-then-act). <b>Fail-open</b> sur panne Redis : contrairement aux
 * scans LLM (fail-closed), un embedding coute ~10⁻⁶ $ — couper le RAG sur une
 * panne d'infra serait pire que de laisser passer quelques appels.</p>
 *
 * <p>{@code clenzy.ai.embeddings.org-monthly-quota} : 0 ou negatif = quota
 * desactive (illimite). Defaut 20 000 appels/org/mois (~600/jour, tres au-dela
 * d'un usage normal, ~0,4 $ de cout provider si consomme en entier).</p>
 */
@Service
public class EmbeddingOrgQuota {

    private static final String KEY_PREFIX = "embeddings:quota:monthly:";
    /** TTL > 1 mois : le bucket du mois expire de lui-meme apres rollover. */
    private static final long TTL_SECONDS = 40L * 86_400L;

    /** Retourne 1 si une unite a ete consommee (sous quota), 0 sinon. */
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
    private final long monthlyQuota;

    public EmbeddingOrgQuota(StringRedisTemplate redisTemplate,
                             @Value("${clenzy.ai.embeddings.org-monthly-quota:20000}") long monthlyQuota) {
        this.redisTemplate = redisTemplate;
        this.monthlyQuota = monthlyQuota;
    }

    /**
     * Tente de consommer un appel d'embedding pour l'org. {@code true} si accorde.
     * Org null (contexte plateforme : ingestion admin, probes) ou quota desactive
     * → toujours accorde. Panne Redis → accorde (fail-open, voir javadoc classe).
     */
    public boolean tryConsume(Long organizationId) {
        if (organizationId == null || monthlyQuota <= 0) {
            return true;
        }
        try {
            Long granted = redisTemplate.execute(CONSUME_SCRIPT, List.of(key(organizationId)),
                    String.valueOf(monthlyQuota), String.valueOf(TTL_SECONDS));
            return granted == null || granted == 1L;
        } catch (Exception e) {
            return true; // fail-open : le RAG continue, le quota reprendra avec Redis
        }
    }

    private static String key(Long organizationId) {
        return KEY_PREFIX + YearMonth.now(ZoneOffset.UTC) + ":org:" + organizationId;
    }
}
