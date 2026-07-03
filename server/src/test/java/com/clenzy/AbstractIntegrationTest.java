package com.clenzy;

import com.clenzy.config.TestSecurityConfig;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Classe de base pour les tests d'integration.
 *
 * Fournit :
 * - PostgreSQL 15 + pgvector via Testcontainers (Hibernate ddl-auto: create-drop —
 *   l'image pgvector est OBLIGATOIRE : les entites KbChunk/AssistantMemory declarent
 *   des colonnes {@code vector(1024)} que le create-drop doit pouvoir creer)
 * - Redis 7 via Testcontainers
 * - KafkaTemplate mocke (pas de broker en test ; {@code clenzy.kafka.enabled=false}
 *   pour que les containers @KafkaListener ne tentent pas de joindre un broker)
 * - TenantContext injectable pour les tests sans HTTP
 *
 * <p><b>Gate d'execution</b> (strategie de tests, vague T1) : les ITs ne sont plus
 * {@code @Disabled} en permanence — ils tournent des que la variable d'environnement
 * {@code CLENZY_IT=true} est posee (Docker requis) :
 * {@code CLENZY_IT=true mvn test}. Sans la variable, le build standard les skippe
 * proprement (aucun container demarre : le bloc statique est garde par le meme flag).
 * Le gate est un {@link ExtendWith} ({@link IntegrationTestGate}) et PAS un
 * {@code @EnabledIfEnvironmentVariable} : ce dernier n'est pas herite par les
 * sous-classes.</p>
 *
 * Pattern "singleton containers" : les containers sont demarres une seule fois
 * et partages entre TOUS les tests (via static initializer).
 * Cela evite le probleme de ports qui changent entre les classes de test.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
@ExtendWith(IntegrationTestGate.class)
public abstract class AbstractIntegrationTest {

    /** Vrai quand le gate IT est ouvert — protege le demarrage des containers. */
    public static final boolean IT_ENABLED = "true".equals(System.getenv("CLENZY_IT"));

    // ---- Singleton containers (demarres une seule fois pour toute la JVM) ----

    static final PostgreSQLContainer<?> postgres;
    @SuppressWarnings("resource")
    static final GenericContainer<?> redis;

    static {
        if (IT_ENABLED) {
            postgres = new PostgreSQLContainer<>(
                    DockerImageName.parse("pgvector/pgvector:pg15").asCompatibleSubstituteFor("postgres"))
                    .withDatabaseName("clenzy_test")
                    .withUsername("test")
                    .withPassword("test")
                    // CREATE EXTENSION vector — requis par les colonnes vector(1024) des entites RAG
                    .withInitScript("testcontainers/init-pgvector.sql");
            postgres.start();

            redis = new GenericContainer<>("redis:7-alpine")
                    .withExposedPorts(6379);
            redis.start();
        } else {
            // Gate ferme : classe potentiellement chargee par la decouverte JUnit,
            // mais aucun test ne s'executera — ne JAMAIS demarrer Docker ici.
            postgres = null;
            redis = null;
        }
    }

    /**
     * Mock le KafkaTemplate pour eviter d'avoir besoin d'un broker Kafka.
     * Les tests OutboxRelay configurent leur propre comportement sur ce mock.
     */
    @MockBean
    protected KafkaTemplate<String, Object> kafkaTemplate;

    @Autowired
    protected TenantContext tenantContext;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        // PostgreSQL (stringtype=unspecified : permet le cast implicite varchar -> jsonb)
        registry.add("spring.datasource.url",
                () -> postgres.getJdbcUrl() + "&stringtype=unspecified");
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);

        // Redis (RedisConfig.java utilise @Value("${spring.redis.host}") et @Value("${spring.redis.port}"))
        registry.add("spring.redis.host", redis::getHost);
        registry.add("spring.redis.port", () -> redis.getMappedPort(6379));

        // Pas de broker Kafka dans le socle partage (KafkaTemplate mocke) : desactive
        // KafkaConfig (@ConditionalOnProperty) pour que sa ConcurrentKafkaListenerContainerFactory
        // (autoStartup=true) ne demarre pas des consumers vers un broker inexistant.
        // KafkaFlowIT (classe standalone) remonte un vrai broker Testcontainers.
        registry.add("clenzy.kafka.enabled", () -> "false");
    }

    @BeforeEach
    void resetTenantContext() {
        // Reset le TenantContext entre chaque test
        // (request-scoped simule par SimpleThreadScope en test)
        try {
            tenantContext.setOrganizationId(null);
            tenantContext.setSuperAdmin(false);
        } catch (Exception ignored) {
            // TenantContext peut ne pas etre injecte dans certains tests
        }
    }

    /**
     * Configure le TenantContext pour un test (simule la resolution du TenantFilter).
     *
     * @param orgId      ID de l'organisation
     * @param superAdmin true pour les SUPER_ADMIN (bypass du filtre Hibernate)
     */
    protected void setupTenantContext(Long orgId, boolean superAdmin) {
        tenantContext.setOrganizationId(orgId);
        tenantContext.setSuperAdmin(superAdmin);
    }
}
