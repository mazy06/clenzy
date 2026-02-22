package com.clenzy;

import com.clenzy.config.TestSecurityConfig;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
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

/**
 * Classe de base pour les tests d'integration.
 *
 * Fournit :
 * - PostgreSQL 15 via Testcontainers (Hibernate ddl-auto: create-drop)
 * - Redis 7 via Testcontainers
 * - KafkaTemplate mocke (pas de broker en test)
 * - TenantContext injectable pour les tests sans HTTP
 *
 * Pattern "singleton containers" : les containers sont demarres une seule fois
 * et partages entre TOUS les tests (via static initializer).
 * Cela evite le probleme de ports qui changent entre les classes de test.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
public abstract class AbstractIntegrationTest {

    // ---- Singleton containers (demarres une seule fois pour toute la JVM) ----

    static final PostgreSQLContainer<?> postgres;
    @SuppressWarnings("resource")
    static final GenericContainer<?> redis;

    static {
        postgres = new PostgreSQLContainer<>("postgres:15-alpine")
                .withDatabaseName("clenzy_test")
                .withUsername("test")
                .withPassword("test");
        postgres.start();

        redis = new GenericContainer<>("redis:7-alpine")
                .withExposedPorts(6379);
        redis.start();
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
