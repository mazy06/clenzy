package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Transactions Spring et repositories commerciaux PostgreSQL ; identités et création de mission simulées. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class MarketplaceCommercialTransactionPostgresTest {
    SessionFactory sessions;
    jakarta.persistence.EntityManager em;
    TransactionTemplate tx;
    ServiceQuoteRepository quotes;
    MarketplaceQuoteRequestRepository requests;
    ServiceQuoteService service;
    Long providerId, requestId, quoteId;

    @BeforeEach
    void setup() {
        sessions = new Configuration().addAnnotatedClass(ServiceQuote.class).addAnnotatedClass(MarketplaceQuoteRequest.class)
                .addPackage("com.clenzy.model")
                .setProperty("hibernate.connection.url", System.getProperty("baitly.test.jdbc"))
                .setProperty("hibernate.connection.username", System.getProperty("baitly.test.user", "postgres"))
                .setProperty("hibernate.hbm2ddl.auto", "validate").buildSessionFactory();
        em = SharedEntityManagerCreator.createSharedEntityManager(sessions);
        tx = new TransactionTemplate(new JpaTransactionManager(sessions));
        var repositories = new JpaRepositoryFactory(em);
        quotes = repositories.getRepository(ServiceQuoteRepository.class);
        requests = repositories.getRepository(MarketplaceQuoteRequestRepository.class);
        var users = mock(UserRepository.class);
        var providers = mock(MarketplaceProviderRepository.class);
        var activeProvider = new com.clenzy.marketplace.model.MarketplaceProvider();
        activeProvider.setStatus(com.clenzy.marketplace.model.ProviderStatus.ACTIVE);
        activeProvider.setUserId(11L);
        when(providers.findById(any())).thenReturn(Optional.of(activeProvider));
        var providerUser = new User(); providerUser.setId(11L);
        when(users.findById(11L)).thenReturn(Optional.of(providerUser));
        var factory = new MarketplaceQuoteMissionFactory(mock(InterventionRepository.class), mock(PropertyRepository.class),
                providers, users, requests, Clock.systemUTC(), org.mockito.Mockito.mock(com.clenzy.service.InterventionAllocationGuard.class),
                new MarketplaceExposureService(mock(MarketplaceExposureRuleRepository.class), Clock.systemUTC(), org.mockito.Mockito.mock(com.clenzy.marketplace.service.MarketplaceDecisionJournal.class), documentary()), mock(MarketplaceGeographicEligibility.class));
        service = new ServiceQuoteService(quotes, mock(InterventionRepository.class), users,
                mock(ProviderAgreedRateRepository.class), mock(NotificationService.class), Clock.systemUTC(),
                mock(DocumentGeneratorService.class), mock(ContactThreadService.class), mock(ServiceQuotePublisher.class),
                mock(PlatformSettingsService.class), mock(PaymentTransactionRepository.class),
                mock(DocumentGenerationRepository.class), mock(OrganizationRepository.class),
                mock(com.clenzy.service.agent.supervision.SupervisionTriggerService.class), mock(QuoteDiscussionScope.class), factory, mock(InterventionAllocationGuard.class));
        tx.executeWithoutResult(status -> {
            providerId = ((Number) em.createNativeQuery("INSERT INTO marketplace_providers (public_ref, display_name, email) VALUES (:ref, 'Baitly test', 'test@example.invalid') RETURNING id")
                    .setParameter("ref", UUID.randomUUID()).getSingleResult()).longValue();
            var request = new MarketplaceQuoteRequest(); request.setProviderId(providerId);
            request.setRequesterOrganizationId(7L); request.setTitle("Accord"); request.setStatus(QuoteRequestStatus.QUOTED);
            request.setQuotedAmount(new BigDecimal("120.00")); request.setQuotedCurrency("MAD");
            em.persist(request); requestId = request.getId();
            var quote = new ServiceQuote(); quote.setMarketplaceRequestId(requestId);
            quote.setOrganizationId(7L); quote.setProviderName("Baitly test");
            quote.setProviderUserId(11L);
            quote.setAmount(request.getQuotedAmount()); quote.setCurrency("MAD");
            em.persist(quote); quoteId = quote.getId();
        });
    }

    @AfterEach
    void cleanup() {
        if (sessions == null) return;
        tx.executeWithoutResult(status -> {
            if (quoteId != null) em.createNativeQuery("DELETE FROM service_quotes WHERE id = :id").setParameter("id", quoteId).executeUpdate();
            if (requestId != null) em.createNativeQuery("DELETE FROM marketplace_quote_requests WHERE id = :id").setParameter("id", requestId).executeUpdate();
            if (providerId != null) em.createNativeQuery("DELETE FROM marketplace_providers WHERE id = :id").setParameter("id", providerId).executeUpdate();
        });
        sessions.close();
    }

    Jwt manager() {
        return Jwt.withTokenValue("test").header("alg", "none").subject("manager")
                .claim("realm_access", Map.of("roles", List.of("SUPER_MANAGER"))).build();
    }

    @Test
    void acceptingAGeneralQuoteUpdatesBothObjectsWithoutInventingAMission() {
        tx.executeWithoutResult(status -> service.approve(quoteId, 7L, "manager", manager()));
        assertThat(quotes.findById(quoteId).orElseThrow().getStatus()).isEqualTo(ServiceQuote.Status.APPROVED);
        var request = requests.findById(requestId).orElseThrow();
        assertThat(request.getStatus()).isEqualTo(QuoteRequestStatus.ACCEPTED);
        assertThat(request.getInterventionId()).isNull();
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> service.reject(quoteId, 7L, manager())))
                .isInstanceOf(RuntimeException.class);
        assertThat(requests.findById(requestId).orElseThrow().getStatus()).isEqualTo(QuoteRequestStatus.ACCEPTED);
    }

    @Test
    void failureToCreateTheMissionRollsBackTheMarketplaceDecision() {
        tx.executeWithoutResult(status -> {
            requests.findById(requestId).orElseThrow().setPropertyId(999L);
            quotes.findById(quoteId).orElseThrow().setPropertyId(999L);
        });
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> service.approve(quoteId, 7L, "manager", manager())))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThat(requests.findById(requestId).orElseThrow().getStatus()).isEqualTo(QuoteRequestStatus.QUOTED);
        assertThat(quotes.findById(quoteId).orElseThrow().getStatus()).isEqualTo(ServiceQuote.Status.RECEIVED);
        assertThat(quotes.findById(quoteId).orElseThrow().getInterventionId()).isNull();
    }

    @Test
    void refusalFromThePmsAlsoClosesTheMarketplaceRequest() {
        tx.executeWithoutResult(status -> service.rejectMarketplace(quoteId, 7L, manager(), "Délai incompatible"));
        assertThat(quotes.findById(quoteId).orElseThrow().getStatus()).isEqualTo(ServiceQuote.Status.REJECTED);
        var request = requests.findById(requestId).orElseThrow();
        assertThat(request.getStatus()).isEqualTo(QuoteRequestStatus.DECLINED);
        assertThat(request.getDecisionReason()).isEqualTo("Délai incompatible");
    }

    @Test
    void concurrentAcceptanceAndRefusalCommitExactlyOneConsistentDecision() throws Exception {
        var start = new java.util.concurrent.CountDownLatch(1);
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var accept = executor.submit(() -> {
                start.await();
                try {
                    tx.executeWithoutResult(status -> service.approve(quoteId, 7L, "manager", manager()));
                    return true;
                } catch (RuntimeException conflict) { return false; }
            });
            var reject = executor.submit(() -> {
                start.await();
                try {
                    tx.executeWithoutResult(status -> service.reject(quoteId, 7L, manager()));
                    return true;
                } catch (RuntimeException conflict) { return false; }
            });
            start.countDown();
            boolean accepted = accept.get(30, java.util.concurrent.TimeUnit.SECONDS);
            boolean rejected = reject.get(30, java.util.concurrent.TimeUnit.SECONDS);
            assertThat(accepted ^ rejected).isTrue();
            assertThat(quotes.findById(quoteId).orElseThrow().getStatus())
                    .isEqualTo(accepted ? ServiceQuote.Status.APPROVED : ServiceQuote.Status.REJECTED);
            assertThat(requests.findById(requestId).orElseThrow().getStatus())
                    .isEqualTo(accepted ? QuoteRequestStatus.ACCEPTED : QuoteRequestStatus.DECLINED);
        } finally {
            executor.shutdownNow();
        }
    }
    private static com.clenzy.marketplace.service.ProviderDocumentaryService documentary() {
        var service=org.mockito.Mockito.mock(com.clenzy.marketplace.service.ProviderDocumentaryService.class);
        org.mockito.Mockito.lenient().when(service.eligible(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any())).thenReturn(true);
        return service;
    }
}
