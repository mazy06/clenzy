package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.math.BigDecimal;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

/** Exécute la requête du repository avec des encaissements seuls, groupés et ambigus. */
class BaitlyRefundCapabilityPersistenceTest {
    static SessionFactory factory;
    EntityManager em;

    @BeforeAll static void start() {
        factory = new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:refundcapability;MODE=PostgreSQL")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop").buildSessionFactory();
        try (var session = factory.createEntityManager()) {
            session.getTransaction().begin();
            session.createNativeQuery("CREATE TABLE interventions (id bigint primary key, organization_id bigint, payment_status varchar, currency varchar, estimated_cost decimal(10,2), stripe_session_id varchar)").executeUpdate();
            session.createNativeQuery("CREATE TABLE intervention_payment_allocations (organization_id bigint, transaction_id bigint, intervention_id bigint, amount decimal(10,2), currency varchar, confirmed_at timestamp)").executeUpdate();
            session.createNativeQuery("CREATE TABLE service_quote_cancellations (organization_id bigint, intervention_id bigint)").executeUpdate();
            session.getTransaction().commit();
        }
    }
    @AfterAll static void stop() { factory.close(); }
    @BeforeEach void seed() {
        em = factory.createEntityManager(); em.getTransaction().begin();
        em.createNativeQuery("INSERT INTO interventions VALUES (15,7,'PAID','EUR',35,'cs_original')").executeUpdate();
        var payment = new PaymentTransaction(); payment.setOrganizationId(7L); payment.setSourceType("INTERVENTION");
        payment.setSourceId(15L); payment.setTransactionRef("TX-capability"); payment.setPaymentType(TransactionType.CHECKOUT);
        payment.setProviderType(PaymentProviderType.STRIPE); payment.setProviderTxId("cs_original");
        payment.setStatus(TransactionStatus.COMPLETED); payment.setAmount(new BigDecimal("35")); payment.setCurrency("EUR");
        em.persist(payment); em.flush();
    }
    @AfterEach void rollback() { em.getTransaction().rollback(); em.close(); }
    List<Long> eligible(Long org) {
        return new JpaRepositoryFactory(em).getRepository(PaymentTransactionRepository.class)
                .findStandaloneRefundableMissionIds(org, List.of(15L));
    }
    @Test void standaloneAndItsResidualRemainEditableWithinTheirOrganization() {
        assertThat(eligible(7L)).containsExactly(15L); assertThat(eligible(8L)).isEmpty();
        em.createNativeQuery("UPDATE interventions SET payment_status='PARTIALLY_REFUNDED'").executeUpdate();
        assertThat(eligible(7L)).containsExactly(15L);
    }
    @ParameterizedTest @ValueSource(strings = {
            "UPDATE payment_transactions SET source_type='INTERVENTION_BATCH'",
            "UPDATE payment_transactions SET status='PROCESSING'",
            "UPDATE payment_transactions SET disputed_amount=5",
            "UPDATE interventions SET estimated_cost=36",
            "UPDATE interventions SET currency='MAD'",
            "UPDATE interventions SET stripe_session_id='cs_other'",
            "INSERT INTO interventions VALUES (16,7,'PAID','EUR',35,'cs_original')",
            "INSERT INTO intervention_payment_allocations (organization_id,transaction_id) SELECT 7,id FROM payment_transactions",
            "INSERT INTO service_quote_cancellations VALUES (7,15)"
    }) void hidesUnsupportedAmounts(String mutation) {
        em.createNativeQuery(mutation).executeUpdate(); assertThat(eligible(7L)).isEmpty();
    }

    void batch() {
        em.createNativeQuery("UPDATE payment_transactions SET source_type='INTERVENTION_BATCH', amount=80").executeUpdate();
        em.createNativeQuery("INSERT INTO intervention_payment_allocations SELECT 7,id,15,35,'EUR',CURRENT_TIMESTAMP FROM payment_transactions").executeUpdate();
        em.createNativeQuery("INSERT INTO intervention_payment_allocations SELECT 7,id,16,45,'EUR',CURRENT_TIMESTAMP FROM payment_transactions").executeUpdate();
    }
    List<Long> batchEligible(Long org) {
        return new JpaRepositoryFactory(em).getRepository(PaymentTransactionRepository.class).findAllocatedRefundableMissionIds(org,List.of(15L));
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void provenExpiredAttemptDoesNotHideTheLaterReceipt(boolean allocated) {
        if (allocated) batch();
        var expired = new PaymentTransaction(); expired.setOrganizationId(7L); expired.setSourceType("INTERVENTION");
        expired.setSourceId(15L); expired.setTransactionRef("TX-expired"); expired.setPaymentType(TransactionType.CHECKOUT);
        expired.setProviderType(PaymentProviderType.STRIPE); expired.setProviderTxId("cs_expired");
        expired.setStatus(TransactionStatus.FAILED); expired.setAmount(new BigDecimal("35")); expired.setCurrency("EUR");
        em.persist(expired); em.flush();
        assertThat(allocated ? batchEligible(7L) : eligible(7L)).isEmpty();
        expired.setMetadata(java.util.Map.of("standaloneRetryAllowed",true,"expiredSessionId","cs_wrong")); em.flush();
        assertThat(allocated ? batchEligible(7L) : eligible(7L)).isEmpty();
        expired.setMetadata(java.util.Map.of("standaloneRetryAllowed",true,"expiredSessionId","cs_expired")); em.flush();
        assertThat(allocated ? batchEligible(7L) : eligible(7L)).containsExactly(15L);
        assertThat(allocated ? batchEligible(8L) : eligible(8L)).isEmpty();
        expired.setStatus(TransactionStatus.PROCESSING); em.flush();
        assertThat(allocated ? batchEligible(7L) : eligible(7L)).isEmpty();
    }
    @Test void confirmedBatchPartHasItsOwnCapabilityAndTenantScope() {
        batch(); assertThat(batchEligible(7L)).containsExactly(15L); assertThat(batchEligible(8L)).isEmpty();
        em.createNativeQuery("UPDATE interventions SET payment_status='PARTIALLY_REFUNDED'").executeUpdate();
        assertThat(batchEligible(7L)).containsExactly(15L);
    }
    @ParameterizedTest @ValueSource(strings={
            "UPDATE payment_transactions SET disputed_amount=5",
            "UPDATE intervention_payment_allocations SET confirmed_at=null",
            "UPDATE interventions SET estimated_cost=80",
            "INSERT INTO service_quote_cancellations VALUES (7,16)",
            "INSERT INTO intervention_payment_allocations SELECT * FROM intervention_payment_allocations WHERE intervention_id=15"
    }) void unsafeBatchPartDoesNotExposePartialRefund(String mutation) {
        batch(); em.createNativeQuery(mutation).executeUpdate(); assertThat(batchEligible(7L)).isEmpty();
    }
}
