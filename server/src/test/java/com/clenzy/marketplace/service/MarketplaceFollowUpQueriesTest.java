package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceRecurrence;
import com.clenzy.marketplace.model.MarketplaceReview;
import com.clenzy.marketplace.repository.MarketplaceRecurrenceRepository;
import com.clenzy.marketplace.repository.MarketplaceReviewRepository;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class MarketplaceFollowUpQueriesTest {
    @Test void realRepositoriesDiscoverDueRequestsAggregateReviewsAndDetectStaleEdits() throws Exception {
        String url = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String schema = "followup_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = DriverManager.getConnection(url, user, ""); var sql = connection.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            try (var sessions = new Configuration().addAnnotatedClass(MarketplaceRecurrence.class)
                    .addAnnotatedClass(MarketplaceReview.class).setProperty("hibernate.connection.url", url)
                    .setProperty("hibernate.connection.username", user).setProperty("hibernate.default_schema", schema)
                    .setProperty("hibernate.connection.init_sql", "SET search_path TO " + schema)
                    .setProperty("hibernate.hbm2ddl.auto", "create-drop").buildSessionFactory();
                 var em = sessions.createEntityManager(); var other = sessions.createEntityManager()) {
                em.getTransaction().begin();
                var plan = new MarketplaceRecurrence(); plan.setQuoteRequestId(9L); plan.setOrganizationId(7L);
                plan.setConsentOwnerId(1L); plan.setEnabled(true);
                plan.configure(LocalDate.of(2026, 10, 1), "MONTHS", 12, 14);
                em.persist(plan);
                em.persist(new MarketplaceReview(1L, 2L, 1L, 7L, 1L, 5, null, LocalDateTime.now()));
                em.persist(new MarketplaceReview(2L, 2L, 2L, 8L, 2L, 3, null, LocalDateTime.now()));
                em.persist(new MarketplaceReview(3L, 3L, 3L, 8L, 2L, 1, null, LocalDateTime.now()));
                em.getTransaction().commit(); em.clear();
                var factory = new JpaRepositoryFactory(em);
                var plans = factory.getRepository(MarketplaceRecurrenceRepository.class);
                var reviews = factory.getRepository(MarketplaceReviewRepository.class);
                em.getTransaction().begin();
                em.createNativeQuery("SET search_path TO " + schema).executeUpdate();
                var due = plans.findDue(LocalDate.of(2026, 9, 17));
                assertThat(due).hasSize(1); assertThat(due.getFirst().getQuoteRequestId()).isEqualTo(9L);
                assertThat(due.getFirst().getOrganizationId()).isEqualTo(7L);
                assertThat(plans.findDue(LocalDate.of(2026, 9, 16))).isEmpty();
                assertThat(reviews.summarize(2L).getAverage()).isEqualTo(4.0);
                assertThat(reviews.summarize(2L).getTotal()).isEqualTo(2L);
                var first = em.find(MarketplaceRecurrence.class, 9L);
                other.getTransaction().begin();
                var stale = other.find(MarketplaceRecurrence.class, 9L);
                first.generated(42L); em.getTransaction().commit();
                stale.setEnabled(false);
                assertThatThrownBy(() -> other.getTransaction().commit()).isInstanceOf(jakarta.persistence.OptimisticLockException.class);
                if (other.getTransaction().isActive()) other.getTransaction().rollback();
            } finally { sql.execute("DROP SCHEMA " + schema + " CASCADE"); }
        }
    }
}
