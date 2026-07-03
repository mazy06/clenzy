package com.clenzy;

import com.clenzy.integration.channel.DeterministicFlowListener;
import com.clenzy.service.agent.AgentRunRecorder;
import com.clenzy.service.agent.PendingToolStore;
import com.clenzy.service.automation.AutomationActionRegistry;
import com.clenzy.service.automation.AutomationEngine;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Boot smoke-test du contexte Spring COMPLET (strategie de tests, vague T1).
 *
 * <p>{@code mvn package} compile mais ne monte JAMAIS le contexte applicatif :
 * un bean a plusieurs constructeurs sans {@code @Autowired} (bug reel du
 * 2026-07-02 sur {@link AgentRunRecorder} / {@link PendingToolStore}), une
 * dependance circulaire ou un {@code @ConditionalOnProperty} mal cable ne se
 * voient qu'au premier boot reel. Ce test charge le contexte entier
 * (@SpringBootTest via {@link AbstractIntegrationTest} : Postgres + Redis
 * Testcontainers, KafkaTemplate mocke, Keycloak mocke) et echoue si un seul
 * bean ne se construit pas.</p>
 *
 * <p>Mocks minimaux herites du socle (documentes) :
 * <ul>
 *   <li>{@code KafkaTemplate} — mocke, et {@code clenzy.kafka.enabled=false} :
 *       pas de broker dans le socle partage (KafkaFlowIT en remonte un vrai) ;</li>
 *   <li>{@code JwtDecoder} — {@code TestSecurityConfig} (pas de Keycloak) ;</li>
 *   <li>schema — Hibernate {@code create-drop} (la conformite Liquibase/entites
 *       est couverte par {@code LiquibaseMigrationIT}).</li>
 * </ul>
 * Tout le reste (services, executeurs, schedulers, listeners, repositories)
 * est REELLEMENT construit.</p>
 */
class ApplicationBootIT extends AbstractIntegrationTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void fullContextBoots_allBeansConstructed() {
        // Le simple chargement du contexte est l'assertion principale ; on fige
        // en plus un ordre de grandeur pour detecter un contexte "vide" (mauvaise
        // config de scan) qui passerait silencieusement.
        assertTrue(context.getBeanDefinitionCount() > 500,
            "Contexte anormalement petit : " + context.getBeanDefinitionCount() + " beans");
    }

    @Test
    void multiConstructorBeans_resolve() {
        // Regression du crash de boot du 2026-07-02 : classes a plusieurs
        // constructeurs dont Spring doit choisir celui annote @Autowired.
        assertNotNull(context.getBean(AgentRunRecorder.class));
        assertNotNull(context.getBean(PendingToolStore.class));
    }

    @Test
    void automationRegistry_isWired() {
        // Le registre central des flux deterministes et sa source Kafka existent.
        assertNotNull(context.getBean(AutomationEngine.class));
        assertNotNull(context.getBean(AutomationActionRegistry.class));
        assertNotNull(context.getBean(DeterministicFlowListener.class));
    }
}
