package com.clenzy.service;

import com.clenzy.model.ServiceQuote;
import com.clenzy.repository.ServiceQuoteRepository;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Exécuter uniquement sur une base jetable dont les migrations sont appliquées. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class ServiceQuotePostgresTest {
    private static SessionFactory sessions;

    @BeforeAll
    static void connect() {
        sessions = new Configuration().addAnnotatedClass(ServiceQuote.class)
                .addPackage("com.clenzy.model")
                .setProperty("hibernate.connection.url", System.getProperty("baitly.test.jdbc"))
                .setProperty("hibernate.connection.username", System.getProperty("baitly.test.user", "postgres"))
                .setProperty("hibernate.hbm2ddl.auto", "validate")
                .buildSessionFactory();
    }

    @AfterAll
    static void disconnect() { if (sessions != null) sessions.close(); }

    @Test
    void simultaneousApprovalAndRejectionHaveOnlyOneWinner() throws Exception {
        Long id = insertQuote();
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<Integer> approval = executor.submit(() -> decide(id, true, ready, start));
            Future<Integer> rejection = executor.submit(() -> decide(id, false, ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(approval.get(15, TimeUnit.SECONDS) + rejection.get(15, TimeUnit.SECONDS)).isEqualTo(1);
        } finally { removeQuote(id); }
    }

    @Test
    void databaseRejectsTwoApprovedQuotesForTheSameIntervention() {
        Long first = insertQuote();
        Long second = insertQuote();
        try (var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            // Identifiant réservé à ce test dans la base jetable.
            em.find(ServiceQuote.class, first).setInterventionId(-first);
            em.find(ServiceQuote.class, second).setInterventionId(-first);
            var repository = repository(em);
            repository.markApproved(first, 7L, "reviewer", Instant.now());
            em.getTransaction().commit();
            em.getTransaction().begin();
            assertThatThrownBy(() -> repository.markApproved(second, 7L, "reviewer", Instant.now()))
                    .isInstanceOf(RuntimeException.class);
            em.getTransaction().rollback();
            em.clear();
            assertThat(repository.findById(second).orElseThrow().getStatus()).isEqualTo(ServiceQuote.Status.RECEIVED);
        } finally { removeQuote(first); removeQuote(second); }
    }

    @Test
    void documentAttachmentDoesNotUndoApprovalAndApprovedQuoteCannotBeDeleted() {
        Long id = insertQuote();
        try (var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            var repository = repository(em);
            assertThat(repository.markApproved(id, 7L, "reviewer", Instant.now())).isEqualTo(1);
            repository.attachDocument(id, "12345");
            assertThat(repository.deleteUnapproved(id, 7L)).isZero();
            em.getTransaction().commit();
            em.clear();
            ServiceQuote result = repository.findByIdAndOrganizationId(id, 7L).orElseThrow();
            assertThat(result.getStatus()).isEqualTo(ServiceQuote.Status.APPROVED);
            assertThat(result.getDocumentRef()).isEqualTo("12345");
        } finally { removeQuote(id); }
    }

    private int decide(Long id, boolean approve, CountDownLatch ready, CountDownLatch start) throws Exception {
        try (var em = sessions.createEntityManager()) {
            var repository = repository(em);
            em.getTransaction().begin();
            ready.countDown();
            if (!start.await(10, TimeUnit.SECONDS)) throw new TimeoutException();
            int changed = approve ? repository.markApproved(id, 7L, "reviewer", Instant.now())
                    : repository.markRejected(id, 7L);
            em.getTransaction().commit();
            return changed;
        }
    }

    private Long insertQuote() {
        try (var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            var quote = new ServiceQuote();
            quote.setOrganizationId(7L);
            quote.setPropertyId(42L);
            quote.setProviderName("Baitly test");
            quote.setAmount(new BigDecimal("120.00"));
            em.persist(quote);
            em.getTransaction().commit();
            return quote.getId();
        }
    }

    private void removeQuote(Long id) {
        try (var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            em.remove(em.find(ServiceQuote.class, id));
            em.getTransaction().commit();
        }
    }

    private ServiceQuoteRepository repository(EntityManager em) {
        return new JpaRepositoryFactory(em).getRepository(ServiceQuoteRepository.class);
    }
}
