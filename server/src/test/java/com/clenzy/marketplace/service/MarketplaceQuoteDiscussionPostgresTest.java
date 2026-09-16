package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.model.QuoteRequestStatus;
import com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

/** Validation des vraies requêtes sur une base jetable migrée. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class MarketplaceQuoteDiscussionPostgresTest {
    @Test
    void pendingPublicationIsDurableAndFailureBackoffDoesNotBlockOtherRequests() {
        try (var sessions = new Configuration().addAnnotatedClass(MarketplaceQuoteRequest.class)
                .setProperty("hibernate.connection.url", System.getProperty("baitly.test.jdbc"))
                .setProperty("hibernate.connection.username", System.getProperty("baitly.test.user", "postgres"))
                .setProperty("hibernate.hbm2ddl.auto", "validate").buildSessionFactory();
             var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            Long providerId = ((Number) em.createNativeQuery("INSERT INTO marketplace_providers (public_ref, display_name, email) VALUES (:ref, 'Baitly test', 'test@example.invalid') RETURNING id")
                    .setParameter("ref", UUID.randomUUID()).getSingleResult()).longValue();
            var first = request(providerId); var second = request(providerId);
            em.persist(first); em.persist(second); em.flush();
            Long firstId = first.getId(), secondId = second.getId();
            em.getTransaction().commit();
            var repository = new JpaRepositoryFactory(em).getRepository(MarketplaceQuoteRequestRepository.class);
            try {
                assertThat(repository.findPendingDiscussions()).contains(firstId, secondId);
                em.getTransaction().begin();
                repository.deferDiscussion(firstId);
                var locked = repository.findForDiscussion(secondId).orElseThrow();
                locked.setDiscussionPublishedStatus(QuoteRequestStatus.SENT);
                em.getTransaction().commit();
                assertThat(repository.findPendingDiscussions()).doesNotContain(firstId, secondId);
                em.getTransaction().begin();
                locked = repository.findForDiscussion(secondId).orElseThrow();
                locked.setStatus(QuoteRequestStatus.QUOTED);
                em.getTransaction().commit();
                assertThat(repository.findPendingDiscussions()).contains(secondId).doesNotContain(firstId);
            } finally {
                if (em.getTransaction().isActive()) em.getTransaction().rollback();
                em.getTransaction().begin();
                em.createNativeQuery("DELETE FROM marketplace_quote_requests WHERE id IN (:first, :second)")
                        .setParameter("first", firstId).setParameter("second", secondId).executeUpdate();
                em.createNativeQuery("DELETE FROM marketplace_providers WHERE id = :id").setParameter("id", providerId).executeUpdate();
                em.getTransaction().commit();
            }
        }
    }

    private MarketplaceQuoteRequest request(Long providerId) {
        var request = new MarketplaceQuoteRequest(); request.setProviderId(providerId);
        request.setRequesterOrganizationId(7L); request.setTitle("Test publication");
        request.setStatus(QuoteRequestStatus.SENT);
        request.setCreatedAt(java.time.LocalDateTime.now()); request.setUpdatedAt(java.time.LocalDateTime.now());
        return request;
    }
}
