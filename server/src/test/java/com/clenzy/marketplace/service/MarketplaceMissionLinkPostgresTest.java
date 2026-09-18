package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.model.QuoteRequestStatus;
import com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.sql.DriverManager;
import java.time.LocalDateTime;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Requête réelle PostgreSQL, schéma Hibernate isolé ; ne valide pas les migrations Liquibase. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class MarketplaceMissionLinkPostgresTest {
    @Test void onlyAnAcceptedRequestCanAttachOneMission() throws Exception {
        String url = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String schema = "baitly_mission_link_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = DriverManager.getConnection(url, user, ""); var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
            try (var sessions = new Configuration().addAnnotatedClass(MarketplaceQuoteRequest.class)
                    .setProperty("hibernate.connection.url", url)
                    .setProperty("hibernate.connection.username", user)
                    .setProperty("hibernate.default_schema", schema)
                    .setProperty("hibernate.hbm2ddl.auto", "create-drop").buildSessionFactory();
                 var em = sessions.createEntityManager()) {
                var repository = new JpaRepositoryFactory(em).getRepository(MarketplaceQuoteRequestRepository.class);
                for (var status : QuoteRequestStatus.values()) {
                    em.getTransaction().begin();
                    try {
                        var request = new MarketplaceQuoteRequest();
                        request.setProviderId(1L); request.setRequesterOrganizationId(7L);
                        request.setTitle("Rattachement Baitly"); request.setStatus(status);
                        em.persist(request); em.flush();
                        Long id = request.getId();
                        int updated = repository.attachIntervention(id, 11L, LocalDateTime.now());
                        assertThat(updated).as("État %s", status).isEqualTo(status == QuoteRequestStatus.ACCEPTED ? 1 : 0);
                        assertThat(repository.attachIntervention(id, 22L, LocalDateTime.now())).isZero();
                        var stored = repository.findById(id).orElseThrow();
                        assertThat(stored.getStatus()).isEqualTo(status);
                        assertThat(stored.getInterventionId()).isEqualTo(status == QuoteRequestStatus.ACCEPTED ? 11L : null);
                        em.getTransaction().commit();
                    } finally {
                        if (em.getTransaction().isActive()) em.getTransaction().rollback();
                    }
                }
                verifyConcurrentAttachment(sessions);
                verifyRollbackAndRetry(sessions);
            } finally {
                statement.execute("DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }

    private void verifyRollbackAndRetry(org.hibernate.SessionFactory sessions) {
        Long requestId;
        try (var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            var request = new MarketplaceQuoteRequest();
            request.setProviderId(1L); request.setRequesterOrganizationId(7L);
            request.setTitle("Reprise du rattachement Baitly"); request.setStatus(QuoteRequestStatus.QUOTED);
            em.persist(request); em.getTransaction().commit();
            requestId = request.getId();
        }
        try (var em = sessions.createEntityManager()) {
            var repository = new JpaRepositoryFactory(em).getRepository(MarketplaceQuoteRequestRepository.class);
            em.getTransaction().begin();
            try {
                assertThat(repository.decideIfStillQuoted(requestId, 7L, QuoteRequestStatus.ACCEPTED, null, LocalDateTime.now())).isOne();
                assertThat(repository.attachIntervention(requestId, 301L, LocalDateTime.now())).isOne();
                assertThat(repository.findById(requestId).orElseThrow().getInterventionId()).isEqualTo(301L);
            } finally {
                em.getTransaction().rollback();
            }
        }
        // Une lecture avec un nouveau contexte JPA doit voir l'état antérieur, sans lien résiduel.
        try (var em = sessions.createEntityManager()) {
            var repository = new JpaRepositoryFactory(em).getRepository(MarketplaceQuoteRequestRepository.class);
            var restored = repository.findById(requestId).orElseThrow();
            assertThat(restored.getStatus()).isEqualTo(QuoteRequestStatus.QUOTED);
            assertThat(restored.getDecidedAt()).isNull();
            assertThat(restored.getInterventionId()).isNull();
            em.getTransaction().begin();
            try {
                assertThat(repository.decideIfStillQuoted(requestId, 7L, QuoteRequestStatus.ACCEPTED, null, LocalDateTime.now())).isOne();
                assertThat(repository.attachIntervention(requestId, 302L, LocalDateTime.now())).isOne();
                em.getTransaction().commit();
            } finally {
                if (em.getTransaction().isActive()) em.getTransaction().rollback();
            }
        }
        try (var em = sessions.createEntityManager()) {
            var retried = em.find(MarketplaceQuoteRequest.class, requestId);
            assertThat(retried.getStatus()).isEqualTo(QuoteRequestStatus.ACCEPTED);
            assertThat(retried.getInterventionId()).isEqualTo(302L);
            assertThat(retried.getDecidedAt()).isNotNull();
        }
    }

    private void verifyConcurrentAttachment(org.hibernate.SessionFactory sessions) throws Exception {
        Long requestId;
        try (var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            var request = new MarketplaceQuoteRequest();
            request.setProviderId(1L); request.setRequesterOrganizationId(7L);
            request.setTitle("Rattachement concurrent Baitly"); request.setStatus(QuoteRequestStatus.ACCEPTED);
            em.persist(request); em.getTransaction().commit();
            requestId = request.getId();
        }
        var ready = new java.util.concurrent.CountDownLatch(2);
        var start = new java.util.concurrent.CountDownLatch(1);
        var workers = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var first = workers.submit(() -> attachConcurrently(sessions, requestId, 101L, ready, start));
            var second = workers.submit(() -> attachConcurrently(sessions, requestId, 202L, ready, start));
            assertThat(ready.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            start.countDown();
            int firstResult = first.get(15, java.util.concurrent.TimeUnit.SECONDS);
            int secondResult = second.get(15, java.util.concurrent.TimeUnit.SECONDS);
            assertThat(java.util.List.of(firstResult, secondResult)).containsExactlyInAnyOrder(0, 1);
            try (var em = sessions.createEntityManager()) {
                var stored = em.find(MarketplaceQuoteRequest.class, requestId);
                assertThat(stored.getInterventionId()).isEqualTo(firstResult == 1 ? 101L : 202L);
                assertThat(stored.getStatus()).isEqualTo(QuoteRequestStatus.ACCEPTED);
            }
        } finally {
            start.countDown();
            workers.shutdownNow();
            assertThat(workers.awaitTermination(20, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
        }
    }

    private int attachConcurrently(org.hibernate.SessionFactory sessions, Long requestId, Long missionId,
            java.util.concurrent.CountDownLatch ready, java.util.concurrent.CountDownLatch start) throws Exception {
        try (var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            try {
                // Ouvre deux connexions avant de lancer les UPDATE concurrents.
                em.createNativeQuery("SET LOCAL statement_timeout = '10s'").executeUpdate();
                ready.countDown();
                if (!start.await(10, java.util.concurrent.TimeUnit.SECONDS)) throw new AssertionError("Départ concurrent absent");
                var repository = new JpaRepositoryFactory(em).getRepository(MarketplaceQuoteRequestRepository.class);
                int changed = repository.attachIntervention(requestId, missionId, LocalDateTime.now());
                em.getTransaction().commit();
                return changed;
            } finally {
                if (em.getTransaction().isActive()) em.getTransaction().rollback();
            }
        }
    }
}
