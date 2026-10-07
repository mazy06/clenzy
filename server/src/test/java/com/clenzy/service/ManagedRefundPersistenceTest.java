package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.PaymentTransactionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.Map;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Verrous et rollback réels : le même remboursement n'est jamais réservé deux fois. */
class ManagedRefundPersistenceTest {
    static SessionFactory factory;
    OutboxPublisher outbox = mock(OutboxPublisher.class);
    @BeforeAll static void mapping() {
        factory = new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:managedrefund;MODE=PostgreSQL;LOCK_TIMEOUT=5000")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop").buildSessionFactory();
    }
    @AfterAll static void close() { if (factory != null) factory.close(); }
    @BeforeEach void seed() {
        tx(em -> { em.createQuery("delete from PaymentTransaction").executeUpdate();
            var p = new PaymentTransaction(); p.setOrganizationId(7L); p.setTransactionRef("TX-original");
            p.setProviderType(PaymentProviderType.STRIPE); p.setProviderTxId("cs_original");
            p.setSourceType("INTERVENTION"); p.setSourceId(15L); p.setPaymentType(TransactionType.CHECKOUT);
            p.setStatus(TransactionStatus.COMPLETED); p.setAmount(new BigDecimal("35")); p.setCurrency("EUR"); em.persist(p); return null; });
    }
    PaymentPersistence service(EntityManager em) {
        return new PaymentPersistence(new JpaRepositoryFactory(em).getRepository(PaymentTransactionRepository.class),
                outbox, new ObjectMapper(), mock(DepositReconciler.class), mock(InterventionPaymentCoordination.class), mock(InvoicePaymentCoordination.class), org.mockito.Mockito.mock(com.clenzy.service.payout.BaitlyTransferRecoveryStore.class));
    }
    <T> T tx(Function<EntityManager,T> action) {
        try (var em = factory.createEntityManager()) { em.getTransaction().begin();
            try { T result=action.apply(em); em.getTransaction().commit(); return result; }
            catch (RuntimeException failure) { em.getTransaction().rollback(); throw failure; }
        }
    }
    PaymentPersistence.RefundInit start(EntityManager em) { return service(em).createRefundPending(7L, "TX-original", null); }
    PaymentTransaction read(String ref) { return tx(em -> em.createQuery("from PaymentTransaction where transactionRef=:ref", PaymentTransaction.class).setParameter("ref",ref).getSingleResult()); }

    @Test void concurrentClicksShareOneDurableDecision() throws Exception {
        var executor=Executors.newFixedThreadPool(2); var ready=new CountDownLatch(1); var release=new CountDownLatch(1);
        try {
            var first=executor.submit(() -> tx(em -> { var init=start(em); em.flush(); ready.countDown();
                try { if (!release.await(4,TimeUnit.SECONDS)) throw new IllegalStateException("timeout"); }
                catch(InterruptedException e) { throw new RuntimeException(e); } return init; }));
            assertThat(ready.await(4,TimeUnit.SECONDS)).isTrue();
            var second=executor.submit(() -> tx(this::start));
            assertThatThrownBy(() -> second.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            release.countDown();
            assertThat(first.get(4,TimeUnit.SECONDS).refundTransactionRef()).isEqualTo(second.get(4,TimeUnit.SECONDS).refundTransactionRef());
            Long count = tx(em -> em.createQuery("select count(p) from PaymentTransaction p where p.paymentType=:type",Long.class)
                    .setParameter("type",TransactionType.REFUND).getSingleResult());
            assertThat(count).isEqualTo(1L);
        } finally { release.countDown(); executor.shutdownNow(); }
    }
    @Test void ambiguousFailureRemainsReservedAndReplaysSameDecision() {
        var init=tx(this::start);
        tx(em -> service(em).markRefundFailed(init.refundTransactionRef(), "timeout"));
        assertThat(read(init.refundTransactionRef()).getStatus()).isEqualTo(TransactionStatus.PROCESSING);
        assertThat(tx(this::start).refundTransactionRef()).isEqualTo(init.refundTransactionRef());
        verifyNoInteractions(outbox);
    }
    @Test void pendingPersistsProviderIdWithoutSuccessEvent() {
        var init=tx(this::start);
        var pending=new PaymentResult(false,"re_test",null,null,null,"REFUND_PENDING","En attente");
        tx(em -> service(em).finalizeRefund(init.refundTransactionRef(),pending,7L));
        var state=read(init.refundTransactionRef());
        assertThat(state.getStatus()).isEqualTo(TransactionStatus.PROCESSING); assertThat(state.getProviderTxId()).isEqualTo("re_test");
        verifyNoInteractions(outbox);
    }
    @Test void successReplayAndLateLocalFailureNeverDuplicateOrDowngrade() {
        var init=tx(this::start); var result=PaymentResult.success("re_test",null,"REFUNDED");
        tx(em -> service(em).finalizeRefund(init.refundTransactionRef(),result,7L));
        tx(em -> service(em).finalizeRefund(init.refundTransactionRef(),result,7L));
        tx(em -> service(em).markRefundFailed(init.refundTransactionRef(),"stale timeout"));
        assertThat(read(init.refundTransactionRef()).getStatus()).isEqualTo(TransactionStatus.COMPLETED);
        verify(outbox,times(1)).publish(any(),any(),eq("PAYMENT_REFUNDED"),any(),any(),any(),eq(7L));
    }
    @Test void outboxFailureRollsBackConfirmationAndCanBeRetried() {
        var init=tx(this::start);
        doThrow(new IllegalStateException("outbox unavailable")).when(outbox).publish(any(),any(),any(),any(),any(),any(),any());
        assertThatThrownBy(() -> tx(em -> service(em).finalizeRefund(init.refundTransactionRef(),PaymentResult.success("re_test",null,"REFUNDED"),7L)))
                .hasMessageContaining("outbox");
        assertThat(read(init.refundTransactionRef()).getStatus()).isEqualTo(TransactionStatus.PROCESSING);
        reset(outbox);
        tx(em -> service(em).finalizeRefund(init.refundTransactionRef(),PaymentResult.success("re_test",null,"REFUNDED"),7L));
        assertThat(read(init.refundTransactionRef()).getStatus()).isEqualTo(TransactionStatus.COMPLETED);
    }
    @Test void canonicalRefusalNeverPublishesSuccessAndKeepsSameDecision() {
        var init=tx(this::start);
        tx(em -> service(em).finalizeRefund(init.refundTransactionRef(),new PaymentResult(false,"re_test",null,null,null,"REFUND_REJECTED","failed"),7L));
        assertThat(read(init.refundTransactionRef()).getStatus()).isEqualTo(TransactionStatus.FAILED);
        assertThat(tx(this::start).refundTransactionRef()).isEqualTo(init.refundTransactionRef()); verifyNoInteractions(outbox);
    }
    @Test void overRefundAndPartialRefundAreRefusedBeforeExternalEmission() {
        for (String amount : new String[]{"0","-1","36"})
            assertThatThrownBy(() -> tx(em -> service(em).createRefundPending(7L,"TX-original",new BigDecimal(amount)))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> tx(em -> service(em).createRefundPending(7L,"TX-original",new BigDecimal("10"))))
                .isInstanceOf(IllegalStateException.class);
    }
    @Test void crossTenantCannotReserveOrConfirm() {
        assertThatThrownBy(() -> tx(em -> service(em).createRefundPending(8L,"TX-original",null))).hasMessageContaining("not found");
        var init=tx(this::start);
        assertThatThrownBy(() -> tx(em -> service(em).finalizeRefund(init.refundTransactionRef(),PaymentResult.success("re_test",null,"REFUNDED"),8L))).isInstanceOf(java.util.NoSuchElementException.class);
        assertThat(read(init.refundTransactionRef()).getStatus()).isEqualTo(TransactionStatus.PROCESSING);
    }
}
