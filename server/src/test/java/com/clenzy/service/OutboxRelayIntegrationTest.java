package com.clenzy.service;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.OutboxEvent;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.OutboxEventRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.support.SendResult;

import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests d'integration du OutboxRelay avec une vraie base PostgreSQL.
 *
 * Verifie le cycle de vie des events outbox : PENDING -> SENT ou FAILED,
 * retry des FAILED, et nettoyage des SENT anciens.
 *
 * Le KafkaTemplate est mocke (herite de AbstractIntegrationTest).
 *
 * IMPORTANT : PAS de @Transactional ici — OutboxRelay.relayPendingEvents()
 * est lui-meme @Transactional. Les @Modifying queries (markAsSent, markAsFailed)
 * ne sont pas visibles si on est dans la meme transaction (L1 cache JPA).
 * On laisse le relay gerer ses propres transactions et on nettoie manuellement.
 */
class OutboxRelayIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private OutboxRelay outboxRelay;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private EntityManager entityManager;

    private Long orgId;

    @BeforeEach
    void createTestData() {
        // Nettoyer les events precedents
        outboxEventRepository.deleteAll();

        // Utiliser un slug unique pour eviter les conflits entre tests
        String uniqueSlug = "outbox-org-" + System.nanoTime();
        Organization org = new Organization("Outbox Org", OrganizationType.INDIVIDUAL, uniqueSlug);
        organizationRepository.save(org);
        orgId = org.getId();

        setupTenantContext(orgId, true);

        // Reset le mock kafka entre chaque test
        reset(kafkaTemplate);
    }

    /**
     * Cree un OutboxEvent PENDING dans la base.
     */
    private OutboxEvent createPendingEvent(String eventType) {
        OutboxEvent event = new OutboxEvent(
                "CALENDAR",
                "42",
                eventType,
                "calendar.updates",
                "42",
                "{\"action\":\"" + eventType + "\"}",
                orgId
        );
        return outboxEventRepository.saveAndFlush(event);
    }

    /**
     * Cree un OutboxEvent FAILED avec un retryCount donne.
     */
    private OutboxEvent createFailedEvent(String eventType, int retryCount) {
        OutboxEvent event = createPendingEvent(eventType);
        event.setStatus("FAILED");
        event.setRetryCount(retryCount);
        event.setErrorMessage("Previous failure");
        return outboxEventRepository.saveAndFlush(event);
    }

    /**
     * Cree un OutboxEvent SENT avec une date d'envoi donnee.
     */
    private OutboxEvent createSentEvent(String eventType, LocalDateTime sentAt) {
        OutboxEvent event = createPendingEvent(eventType);
        event.setStatus("SENT");
        event.setSentAt(sentAt);
        return outboxEventRepository.saveAndFlush(event);
    }

    // ----------------------------------------------------------------
    // 1. relayPendingEvents() marque l'event SENT apres envoi reussi
    // ----------------------------------------------------------------

    @Test
    @SuppressWarnings("unchecked")
    void relayPendingEvents_marksAsSent() {
        OutboxEvent event = createPendingEvent("CALENDAR_BOOKED");

        // Configurer le mock pour reussir
        CompletableFuture<SendResult<String, Object>> future =
                CompletableFuture.completedFuture(mock(SendResult.class));
        when(kafkaTemplate.send(anyString(), anyString(), any())).thenReturn(future);

        // Relayer (dans sa propre transaction)
        outboxRelay.relayPendingEvents();

        // Vider le cache L1 JPA pour relire depuis la DB
        entityManager.clear();

        // Verifier que l'event est maintenant SENT
        OutboxEvent updated = outboxEventRepository.findById(event.getId()).orElseThrow();
        assertEquals("SENT", updated.getStatus());
        assertNotNull(updated.getSentAt());

        // Verifier l'appel Kafka (atLeastOnce car le @Scheduled peut aussi relayer l'event)
        verify(kafkaTemplate, atLeastOnce()).send(eq("calendar.updates"), eq("42"), any());
    }

    // ----------------------------------------------------------------
    // 2. relayPendingEvents() marque FAILED quand Kafka echoue
    // ----------------------------------------------------------------

    @Test
    void relayPendingEvents_kafkaFailure_marksFailed() {
        OutboxEvent event = createPendingEvent("CALENDAR_BLOCKED");

        // Configurer le mock pour echouer
        CompletableFuture<SendResult<String, Object>> failedFuture = new CompletableFuture<>();
        failedFuture.completeExceptionally(new RuntimeException("Kafka down"));
        when(kafkaTemplate.send(anyString(), anyString(), any())).thenReturn(failedFuture);

        // Relayer
        outboxRelay.relayPendingEvents();

        // Vider le cache L1 JPA
        entityManager.clear();

        // Verifier que l'event est FAILED
        OutboxEvent updated = outboxEventRepository.findById(event.getId()).orElseThrow();
        assertEquals("FAILED", updated.getStatus());
        assertEquals(1, updated.getRetryCount());
        assertNotNull(updated.getErrorMessage());
        assertTrue(updated.getErrorMessage().contains("Kafka down"));
    }

    // ----------------------------------------------------------------
    // 3. retryFailedEvents() re-tente les events FAILED sous le seuil
    // ----------------------------------------------------------------

    @Test
    @SuppressWarnings("unchecked")
    void retryFailedEvents_underMaxRetries() {
        // Creer un event FAILED avec 2 retries (sous le max de 5)
        OutboxEvent event = createFailedEvent("CALENDAR_CANCELLED", 2);

        // Configurer le mock pour reussir cette fois
        CompletableFuture<SendResult<String, Object>> future =
                CompletableFuture.completedFuture(mock(SendResult.class));
        when(kafkaTemplate.send(anyString(), anyString(), any())).thenReturn(future);

        // Retry
        outboxRelay.retryFailedEvents();

        // Vider le cache L1 JPA
        entityManager.clear();

        // L'event doit etre SENT maintenant
        OutboxEvent updated = outboxEventRepository.findById(event.getId()).orElseThrow();
        assertEquals("SENT", updated.getStatus());
        assertNotNull(updated.getSentAt());
    }

    // ----------------------------------------------------------------
    // 4. cleanupSentEvents() supprime les events SENT > 7 jours
    // ----------------------------------------------------------------

    @Test
    void cleanupSentEvents_deletesOld() {
        // Event SENT il y a 10 jours (doit etre supprime)
        OutboxEvent oldEvent = createSentEvent("OLD_EVENT", LocalDateTime.now().minusDays(10));

        // Event SENT il y a 1 jour (doit etre conserve)
        OutboxEvent recentEvent = createSentEvent("RECENT_EVENT", LocalDateTime.now().minusDays(1));

        Long oldId = oldEvent.getId();
        Long recentId = recentEvent.getId();

        // Nettoyage
        outboxRelay.cleanupSentEvents();

        // Vider le cache L1 JPA
        entityManager.clear();

        // L'ancien event doit avoir ete supprime
        assertFalse(outboxEventRepository.findById(oldId).isPresent(),
                "L'event SENT > 7 jours doit etre supprime");

        // Le recent doit toujours exister
        assertTrue(outboxEventRepository.findById(recentId).isPresent(),
                "L'event SENT < 7 jours doit etre conserve");
    }
}
