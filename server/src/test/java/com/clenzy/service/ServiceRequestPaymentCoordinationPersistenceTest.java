package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Baitly : relecture JPA réelle et sérialisation de deux tentatives sur la même dette. */
class ServiceRequestPaymentCoordinationPersistenceTest {
    static SessionFactory factory;

    @BeforeAll static void mappings() {
        String xml = "<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">"
                + entity(ServiceRequest.class, Set.of("organizationId", "status", "estimatedCost", "paymentStatus",
                        "paidAt", "stripeSessionId", "convertedInterventionId"), "")
                + entity(Intervention.class, Set.of("organizationId", "estimatedCost", "paymentStatus", "currency", "status"),
                        "<many-to-one name=\"serviceRequest\" target-entity=\"com.clenzy.model.ServiceRequest\"/>")
                + "</entity-mappings>";
        factory = new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .addInputStream(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:requestcoord;MODE=PostgreSQL;LOCK_TIMEOUT=5000")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("jakarta.persistence.validation.mode", "none").buildSessionFactory();
    }

    private static String entity(Class<?> type, Set<String> fields, String relationship) {
        var xml = new StringBuilder("<entity class=\"").append(type.getName())
                .append("\" access=\"FIELD\" metadata-complete=\"true\"><attributes><id name=\"id\"/>");
        for (var field : type.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers()) || field.getName().equals("id")) continue;
            if (!relationship.isEmpty() && field.getName().equals("serviceRequest")) continue;
            if (fields.contains(field.getName())) {
                xml.append("<basic name=\"").append(field.getName()).append("\">");
                if (field.getType().isEnum()) xml.append("<enumerated>STRING</enumerated>");
                xml.append("</basic>");
            } else xml.append("<transient name=\"").append(field.getName()).append("\"/>");
        }
        return xml.append(relationship).append("</attributes></entity>").toString();
    }

    @AfterAll static void closeFactory() { if (factory != null) factory.close(); }

    @BeforeEach void seed() {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin();
            em.createQuery("delete from PaymentTransaction").executeUpdate();
            em.createQuery("delete from Intervention").executeUpdate();
            em.createQuery("delete from ServiceRequest").executeUpdate();
            var request = new ServiceRequest(); request.setId(5L); request.setOrganizationId(7L);
            request.setStatus(RequestStatus.AWAITING_PAYMENT); request.setEstimatedCost(BigDecimal.TEN);
            request.setPaymentStatus(PaymentStatus.PENDING); em.persist(request);
            em.getTransaction().commit();
        }
    }

    InterventionPaymentCoordination coordination(EntityManager em) {
        return new InterventionPaymentCoordination(em, new JpaRepositoryFactory(em).getRepository(PaymentTransactionRepository.class),
                mock(ServiceQuoteRepository.class), mock(CurrencyConverterService.class));
    }

    PaymentOrchestrationRequest checkout(String type, Long id) {
        return new PaymentOrchestrationRequest(BigDecimal.TEN, "EUR", type, id, "Prestation Baitly", "test@example.test",
                null, null, null, Map.of(), "request-5");
    }

    void addMission(EntityManager em) {
        var mission = new Intervention(); mission.setId(1L); mission.setOrganizationId(7L);
        mission.setServiceRequest(em.find(ServiceRequest.class, 5L)); mission.setEstimatedCost(BigDecimal.TEN);
        mission.setCurrency("EUR"); mission.setPaymentStatus(PaymentStatus.PENDING); em.persist(mission);
    }

    PaymentTransaction intent() {
        var tx = new PaymentTransaction(); tx.setOrganizationId(7L); tx.setTransactionRef("TX-request");
        tx.setSourceType("SERVICE_REQUEST"); tx.setSourceId(5L); tx.setPaymentType(TransactionType.CHECKOUT);
        tx.setProviderType(PaymentProviderType.STRIPE); tx.setStatus(TransactionStatus.PENDING);
        tx.setAmount(BigDecimal.TEN); tx.setCurrency("EUR"); return tx;
    }

    @Test void legacyLinkedMissionBlocksRequestEvenWithoutConvertedId() {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin(); addMission(em); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin();
            assertThatThrownBy(() -> coordination(em).lockPaymentMissions(7L, checkout("SERVICE_REQUEST", 5L)))
                    .hasMessageContaining("déjà convertie");
            em.getTransaction().rollback();
        }
    }

    @Test void refreshRejectsConversionCommittedAfterInitialRead() {
        try (var stale = factory.createEntityManager(); var converter = factory.createEntityManager()) {
            stale.find(ServiceRequest.class, 5L);
            converter.getTransaction().begin();
            converter.find(ServiceRequest.class, 5L).setConvertedInterventionId(1L);
            converter.getTransaction().commit();
            stale.getTransaction().begin();
            assertThatThrownBy(() -> coordination(stale).lockPaymentMissions(7L, checkout("SERVICE_REQUEST", 5L)))
                    .hasMessageContaining("déjà convertie");
            stale.getTransaction().rollback();
        }
    }

    @Test void missionCannotCollectAnExistingRequestIntentEvenBeforeProcessingMarker() {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin(); addMission(em); em.persist(intent()); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin();
            assertThatThrownBy(() -> coordination(em).lockPaymentMissions(7L, checkout("INTERVENTION", 1L)))
                    .hasMessageContaining("paiement existe déjà pour la demande liée");
            em.getTransaction().rollback();
        }
    }

    @Test void concurrentInitiationWaitsForIntentCommitAndCannotCreateASecondDebt() throws Exception {
        var attempting = new CountDownLatch(1);
        try (var winner = factory.createEntityManager(); var pool = Executors.newSingleThreadExecutor()) {
            winner.getTransaction().begin();
            coordination(winner).lockPaymentMissions(7L, checkout("SERVICE_REQUEST", 5L));
            winner.persist(intent()); winner.flush();
            var loser = pool.submit(() -> {
                try (var em = factory.createEntityManager()) {
                    em.getTransaction().begin(); attempting.countDown();
                    try {
                        coordination(em).lockPaymentMissions(7L, checkout("SERVICE_REQUEST", 5L));
                        return "unexpected admission";
                    } catch (com.clenzy.exception.PaymentValidationException expected) {
                        return expected.getMessage();
                    } finally { em.getTransaction().rollback(); }
                }
            });
            try {
                assertThat(attempting.await(2, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> loser.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            } finally { winner.getTransaction().commit(); }
            assertThat(loser.get(5, TimeUnit.SECONDS)).contains("paiement existe déjà");
            assertThat(winner.createQuery("select count(t) from PaymentTransaction t", Long.class).getSingleResult()).isEqualTo(1L);
        }
    }
}
