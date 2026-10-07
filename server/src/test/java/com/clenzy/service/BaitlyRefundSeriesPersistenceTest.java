package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.payout.BaitlyTransferRecoveryStore;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyRefundSeriesPersistenceTest {
    static SessionFactory factory;
    InterventionPaymentCoordination coordination=mock(InterventionPaymentCoordination.class);
    BaitlyTransferRecoveryStore recoveries=mock(BaitlyTransferRecoveryStore.class);
    Intervention mission=new Intervention();
    @BeforeAll static void start() {
        factory=new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .setProperty("hibernate.connection.url","jdbc:h2:mem:refundseries;MODE=PostgreSQL;LOCK_TIMEOUT=5000")
                .setProperty("hibernate.hbm2ddl.auto","create-drop").buildSessionFactory();
    }
    @AfterAll static void stop() {factory.close();}
    @BeforeEach void seed() {
        mission.setPaymentStatus(PaymentStatus.PAID); when(coordination.lockMission(7L,15L)).thenReturn(mission);
        tx(em -> { em.createQuery("delete from PaymentTransaction").executeUpdate();
            var p=new PaymentTransaction(); p.setOrganizationId(7L);p.setTransactionRef("TX-original");
            p.setProviderType(PaymentProviderType.STRIPE);p.setProviderTxId("cs_original");
            p.setSourceType("INTERVENTION");p.setSourceId(15L);p.setPaymentType(TransactionType.CHECKOUT);
            p.setStatus(TransactionStatus.COMPLETED);p.setAmount(new BigDecimal("35"));p.setCurrency("EUR");em.persist(p);return null; });
    }
    <T>T tx(Function<EntityManager,T> action) {
        try(var em=factory.createEntityManager()) {em.getTransaction().begin();
            try {T value=action.apply(em);em.getTransaction().commit();return value;}
            catch(RuntimeException e){em.getTransaction().rollback();throw e;}
        }
    }
    BaitlyRefundSeriesStore service(EntityManager em) {
        var batch=mock(BaitlyBatchRefundPersistence.class);
        doThrow(new IllegalStateException("Part à rapproché")).when(batch).prepareInstallment(anyLong(),anyLong(),any(),any());
        return new BaitlyRefundSeriesStore(new JpaRepositoryFactory(em).getRepository(PaymentTransactionRepository.class),coordination,em,recoveries,batch);
    }
    String prepare(EntityManager em,String amount,UUID key) {return service(em).prepare(7L,15L,new BigDecimal(amount),key);}
    void complete(String ref) {
        tx(em -> {var p=em.createQuery("from PaymentTransaction where transactionRef=:ref",PaymentTransaction.class).setParameter("ref",ref).getSingleResult();
            p.setStatus(TransactionStatus.COMPLETED);p.setProviderTxId("re_"+p.getId());return null;});mission.setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);
    }
    @Test void sameIntentReplaysAfterSuccessButDifferentAmountIsRejected() {
        var key=UUID.randomUUID();String ref=tx(em->prepare(em,"5",key));complete(ref);
        String replay=tx(em->prepare(em,"5",key)); assertThat(replay).isEqualTo(ref);
        assertThatThrownBy(()->tx(em->prepare(em,"6",key))).hasMessageContaining("autre montant");
        verify(recoveries,times(1)).prepareSeriesInterventionRefund(any(),any());
    }
    @Test void successiveRefundsReserveOnlyTheRemainingBudget() {
        String first=tx(em->prepare(em,"5",UUID.randomUUID()));complete(first);
        assertThatThrownBy(()->tx(em->prepare(em,"30.01",UUID.randomUUID()))).hasMessageContaining("solde");
        String next=tx(em->prepare(em,"30",UUID.randomUUID()));
        tx(em->{var p=em.createQuery("from PaymentTransaction where transactionRef=:ref",PaymentTransaction.class).setParameter("ref",next).getSingleResult();
            assertThat(BaitlyRefundSeries.before(p)).isEqualByComparingTo("5");assertThat(BaitlyRefundSeries.after(p)).isEqualByComparingTo("35");return null;});
    }
    @Test void ambiguousDecisionBlocksAnotherIntent() {
        tx(em->prepare(em,"5",UUID.randomUUID()));
        assertThatThrownBy(()->tx(em->prepare(em,"5",UUID.randomUUID()))).hasMessageContaining("en cours");
    }
    @Test void expiredCheckoutDoesNotConsumeTheRefundBudgetOfItsReplacement() {
        tx(em -> {
            var expired=new PaymentTransaction(); expired.setOrganizationId(7L); expired.setSourceType("INTERVENTION");
            expired.setSourceId(15L); expired.setTransactionRef("TX-expired"); expired.setPaymentType(TransactionType.CHECKOUT);
            expired.setProviderType(PaymentProviderType.STRIPE); expired.setProviderTxId("cs_expired");
            expired.setStatus(TransactionStatus.FAILED); expired.setAmount(new BigDecimal("35")); expired.setCurrency("EUR");
            em.persist(expired); return null;
        });
        assertThatThrownBy(()->tx(em->prepare(em,"5",UUID.randomUUID()))).hasMessageContaining("unique");
        tx(em -> {
            var expired=new JpaRepositoryFactory(em).getRepository(PaymentTransactionRepository.class)
                    .findByTransactionRef("TX-expired").orElseThrow();
            expired.setMetadata(Map.of("standaloneRetryAllowed",true,"expiredSessionId","cs_expired")); return null;
        });
        String ref=tx(em->prepare(em,"5.01",UUID.randomUUID())); complete(ref);
        String next=tx(em->prepare(em,"29.99",UUID.randomUUID()));
        assertThat(next).isNotEqualTo(ref);
    }
    @Test void crossOrganizationAndDisputeNeverReserveMoney() {
        assertThatThrownBy(()->tx(em->service(em).prepare(8L,15L,BigDecimal.ONE,UUID.randomUUID()))).hasMessageContaining("rapproché");
        tx(em->{em.createQuery("update PaymentTransaction set disputedAmount=amount").executeUpdate();return null;});
        assertThatThrownBy(()->tx(em->prepare(em,"5",UUID.randomUUID()))).hasMessageContaining("contesté");
        verifyNoInteractions(recoveries);
    }
    @Test void recoveryFailureRollsBackTheWholeRefundDecision() {
        doThrow(new IllegalStateException("transfert incertain")).when(recoveries).prepareSeriesInterventionRefund(any(),any());
        assertThatThrownBy(()->tx(em->prepare(em,"5",UUID.randomUUID()))).hasMessageContaining("incertain");
        Long count=tx(em->em.createQuery("select count(p) from PaymentTransaction p",Long.class).getSingleResult());assertThat(count).isEqualTo(1L);
    }
    @Test void concurrentIntentReusesOneDecisionUnderTheReceiptLock() throws Exception {
        var key=UUID.randomUUID();var executor=Executors.newFixedThreadPool(2);var ready=new CountDownLatch(1);var release=new CountDownLatch(1);
        try {
            var first=executor.submit(()->tx(em->{String ref=prepare(em,"5",key);ready.countDown();
                try{if(!release.await(4,TimeUnit.SECONDS))throw new IllegalStateException("timeout");}catch(InterruptedException e){throw new RuntimeException(e);}return ref;}));
            assertThat(ready.await(4,TimeUnit.SECONDS)).isTrue();var second=executor.submit(()->tx(em->prepare(em,"5",key)));
            assertThatThrownBy(()->second.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);release.countDown();
            assertThat(first.get(4,TimeUnit.SECONDS)).isEqualTo(second.get(4,TimeUnit.SECONDS));
        } finally{release.countDown();executor.shutdownNow();}
    }
}
