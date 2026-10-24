package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.service.agent.kb.EmbeddingOrgQuota;
import com.clenzy.service.agent.supervision.SupervisionScanQuota;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pannes Redis — les DEUX semantiques VOULUES et opposees (strategie de tests,
 * vague T3, principe n°6) :
 * <ul>
 *   <li>(a) {@link SupervisionScanQuota#tryConsume} → <b>FAIL-CLOSED</b> : sans
 *       Redis on ne lance PAS de scan autonome (le scan consomme des tokens sans
 *       operateur — jamais de budget non compte) ;</li>
 *   <li>(b) {@link EmbeddingOrgQuota#tryConsume} → <b>FAIL-OPEN</b> : sans Redis
 *       le RAG continue (fonctionnalite utilisateur, quota = garde-fou de cout) ;</li>
 * </ul>
 *
 * <p><b>Choix d'implementation documente</b> : on ne coupe PAS le container Redis
 * singleton du socle ({@link AbstractIntegrationTest}) — il est partage par tout
 * le contexte Spring (cache, autres tests de la JVM) et le stopper casserait des
 * classes voisines. A la place, un container Redis <b>DEDIE a cette classe</b> est
 * demarre, un {@link StringRedisTemplate} pointe dessus (timeouts courts), les
 * services testes sont instancies avec CE template (constructeurs publics — les
 * quotas sont autonomes). Le journal des avertissements est maintenant couvert
 * separement en PostgreSQL, sans Redis. La panne est
 * simulee en STOPPANT le container dedie — connexion refusee, exception rapide.</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
class RedisOutageSemanticsIT extends AbstractIntegrationTest {

    /** Container Redis dedie a la classe (jamais le singleton du socle). */
    @SuppressWarnings("resource")
    private static final GenericContainer<?> dedicatedRedis =
            IT_ENABLED ? new GenericContainer<>("redis:7-alpine").withExposedPorts(6379) : null;

    private static StringRedisTemplate dedicatedTemplate;
    private static LettuceConnectionFactory dedicatedFactory;

    @AfterAll
    static void tearDownDedicatedRedis() {
        if (dedicatedFactory != null) {
            dedicatedFactory.destroy();
        }
        if (dedicatedRedis != null && dedicatedRedis.isRunning()) {
            dedicatedRedis.stop();
        }
    }

    /**
     * Template pointe sur le container dedie, timeouts courts : une fois le
     * container stoppe, chaque commande echoue vite (connexion refusee) au lieu
     * d'attendre le timeout Lettuce par defaut (60 s).
     */
    private static synchronized StringRedisTemplate dedicatedRedisTemplate() {
        if (dedicatedTemplate != null) {
            return dedicatedTemplate;
        }
        if (!dedicatedRedis.isRunning()) {
            dedicatedRedis.start();
        }
        RedisStandaloneConfiguration standalone = new RedisStandaloneConfiguration(
                dedicatedRedis.getHost(), dedicatedRedis.getMappedPort(6379));
        LettuceClientConfiguration client = LettuceClientConfiguration.builder()
                .commandTimeout(Duration.ofSeconds(2))
                .shutdownTimeout(Duration.ZERO)
                .build();
        dedicatedFactory = new LettuceConnectionFactory(standalone, client);
        // Pas de connexion partagee : pas de file de reconnexion qui retiendrait
        // les commandes apres l'arret du container.
        dedicatedFactory.setShareNativeConnection(false);
        dedicatedFactory.afterPropertiesSet();
        dedicatedTemplate = new StringRedisTemplate(dedicatedFactory);
        dedicatedTemplate.afterPropertiesSet();
        return dedicatedTemplate;
    }

    private static void killDedicatedRedis() {
        if (dedicatedRedis.isRunning()) {
            dedicatedRedis.stop();
        }
    }

    // ─── (a) + (b) : quotas — fail-closed vs fail-open ──────────────────────

    @Test
    void redisOutage_scanQuotaFailsClosed_embeddingQuotaFailsOpen() {
        StringRedisTemplate template = dedicatedRedisTemplate();
        SupervisionScanQuota scanQuota = new SupervisionScanQuota(template);
        EmbeddingOrgQuota embeddingQuota = new EmbeddingOrgQuota(template, 100);

        long orgKeySalt = System.nanoTime();
        Long quotaOrgId = orgKeySalt; // cle Redis distincte par run

        // Redis SAIN : les deux quotas accordent (etat de reference du test —
        // prouve que le refus/octroi ci-dessous vient bien de la PANNE).
        assertThat(scanQuota.tryConsume(quotaOrgId, 5))
                .as("Redis sain : le quota scan accorde sous le budget").isTrue();
        assertThat(embeddingQuota.tryConsume(quotaOrgId))
                .as("Redis sain : le quota embeddings accorde sous le quota").isTrue();

        // ── PANNE : arret du container dedie. ──
        killDedicatedRedis();

        // (a) FAIL-CLOSED : plus de scan autonome sans quota verifiable.
        assertThat(scanQuota.tryConsume(quotaOrgId, 5))
                .as("Panne Redis : SupervisionScanQuota doit REFUSER (fail-closed)")
                .isFalse();

        // (b) FAIL-OPEN : le RAG continue, le quota reprendra avec Redis.
        assertThat(embeddingQuota.tryConsume(quotaOrgId))
                .as("Panne Redis : EmbeddingOrgQuota doit ACCORDER (fail-open)")
                .isTrue();

    }
}
