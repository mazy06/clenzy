package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;

class BaitlyDisputePersistenceTest {
    static SessionFactory factory;
    final TenantContext tenant=new TenantContext();
    Long paymentId;
    @BeforeAll static void mapping() {
        var xml=new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml,Reservation.class,Set.of("organizationId"));
        xml.append("</entity-mappings>");
        factory=new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .addAnnotatedClass(PaymentDispute.class).addAnnotatedClass(BaitlyDisputeBalanceEntry.class)
                .addAnnotatedClass(InterventionPaymentAllocation.class)
                .addInputStream(new java.io.ByteArrayInputStream(xml.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url","jdbc:h2:mem:disputes;MODE=PostgreSQL;LOCK_TIMEOUT=5000")
                .setProperty("hibernate.hbm2ddl.auto","create-drop").setProperty("jakarta.persistence.validation.mode","none").buildSessionFactory();
    }
    @AfterAll static void close() { if(factory!=null) factory.close(); }
    <T>T tx(Function<EntityManager,T> fn) {
        try(var em=factory.createEntityManager()) { em.getTransaction().begin();
            try { T result=fn.apply(em); em.getTransaction().commit(); return result; }
            catch(RuntimeException e) { em.getTransaction().rollback(); throw e; }
        }
    }
    @BeforeEach void seed() {
        tenant.setOrganizationId(7L);
        paymentId=tx(em->{ for(String type:List.of("BaitlyDisputeBalanceEntry","PaymentDispute","InterventionPaymentAllocation","PaymentTransaction","Reservation"))
                em.createQuery("delete from "+type).executeUpdate();
            var stay=new Reservation(); stay.setId(22L); stay.setOrganizationId(7L); em.persist(stay);
            var payment=new PaymentTransaction(); payment.setOrganizationId(7L); payment.setSourceType("BOOKING_CHECKOUT"); payment.setSourceId(22L);
            payment.setTransactionRef("TX-test"); payment.setProviderType(PaymentProviderType.STRIPE); payment.setPaymentType(TransactionType.CHECKOUT);
            payment.setStatus(TransactionStatus.COMPLETED); payment.setProviderTxId("cs_test"); payment.setAmount(new BigDecimal("35")); em.persist(payment);
            return payment.getId(); });
    }
    @AfterEach void cleanup() { tenant.clear(); }
    BaitlyDisputeProof proof(String status,boolean reinstated) {
        var movements=new ArrayList<BaitlyDisputeProof.Movement>();
        movements.add(new BaitlyDisputeProof.Movement("txn_debit",new BigDecimal("-35"),new BigDecimal("15"),new BigDecimal("-50"),"EUR",Instant.EPOCH,Instant.EPOCH));
        if(reinstated) movements.add(new BaitlyDisputeProof.Movement("txn_credit",new BigDecimal("35"),BigDecimal.ZERO,new BigDecimal("35"),"EUR",Instant.EPOCH,Instant.EPOCH));
        return new BaitlyDisputeProof(paymentId,7L,"cs_test","dp_test","ch_test","pi_test",new BigDecimal("35"),"EUR",status,null,movements);
    }
    @Test void openThenWonReleasesOnlyPrincipalAndKeepsExactFeesAndHistory() {
        tx(em->{ var row=new BaitlyDisputeStore(em,tenant).observe(proof("needs_response",false));
            assertThat(row.getReservationId()).isEqualTo(22L); assertThat(em.find(PaymentTransaction.class,paymentId).getDisputedAmount()).isEqualByComparingTo("35"); return null; });
        tx(em->{ var store=new BaitlyDisputeStore(em,tenant); store.observe(proof("won",true)); store.observe(proof("won",true));
            store.observe(proof("needs_response",false)); // livraison ancienne après clôture
            assertThat(em.find(PaymentTransaction.class,paymentId).getDisputedAmount()).isZero();
            assertThat(em.createQuery("select count(e) from BaitlyDisputeBalanceEntry e",Long.class).getSingleResult()).isEqualTo(2L);
            assertThat(em.createQuery("select sum(e.net) from BaitlyDisputeBalanceEntry e",BigDecimal.class).getSingleResult()).isEqualByComparingTo("-15");
            assertThat(em.createQuery("from PaymentDispute",PaymentDispute.class).getSingleResult().getStatus()).isEqualTo(PaymentDispute.Status.WON);
            return null; });
    }
    @Test void closedBeforeOpenedStillRecordsLossAndNeverMakesLostMoneyAvailable() {
        tx(em->{ var store=new BaitlyDisputeStore(em,tenant); store.observe(proof("lost",false)); store.observe(proof("needs_response",false));
            assertThat(em.find(PaymentTransaction.class,paymentId).getDisputedAmount()).isEqualByComparingTo("35"); return null; });
    }
    @Test void warningClosedIsNotMistakenForALostDispute() {
        var inquiry=new BaitlyDisputeProof(paymentId,7L,"cs_test","dp_test","ch_test","pi_test",new BigDecimal("35"),"EUR","warning_closed",null,List.of());
        tx(em->{ var store=new BaitlyDisputeStore(em,tenant); var row=store.observe(inquiry);
            assertThat(row.getStatus()).isEqualTo(PaymentDispute.Status.CLOSED);
            assertThat(em.find(PaymentTransaction.class,paymentId).getDisputedAmount()).isZero(); return null; });
    }
    @Test void wonButNotYetReinstatedKeepsFundsHeldUntilCanonicalCreditArrives() {
        tx(em->{ var row=new BaitlyDisputeStore(em,tenant).observe(proof("won",false));
            assertThat(row.isFundingHeld()).isTrue(); assertThat(em.find(PaymentTransaction.class,paymentId).getDisputedAmount()).isEqualByComparingTo("35"); return null; });
        tx(em->{ var row=new BaitlyDisputeStore(em,tenant).observe(proof("won",true));
            assertThat(row.isFundingHeld()).isFalse(); assertThat(em.find(PaymentTransaction.class,paymentId).getDisputedAmount()).isZero(); return null; });
    }
    @Test void foreignTenantCannotObserveOrReserveFunds() {
        tenant.setOrganizationId(8L);
        assertThatThrownBy(()->tx(em->new BaitlyDisputeStore(em,tenant).observe(proof("needs_response",false)))).hasMessageContaining("hors organisation");
    }
    @Test void wonWithoutAnyMovementDoesNotInventRestitution() {
        var absent=new BaitlyDisputeProof(paymentId,7L,"cs_test","dp_test","ch_test","pi_test",new BigDecimal("35"),"EUR","won",null,List.of());
        tx(em->{ var row=new BaitlyDisputeStore(em,tenant).observe(absent);
            assertThat(row.isFundingHeld()).isTrue();
            assertThat(em.find(PaymentTransaction.class,paymentId).getDisputedAmount()).isEqualByComparingTo("35"); return null; });
    }
    @Test void conflictingBalanceEvidenceRollsBackTheWholeTransition() {
        tx(em->new BaitlyDisputeStore(em,tenant).observe(proof("needs_response",false)));
        var valid=proof("won",true);
        var wrong=new BaitlyDisputeProof(paymentId,7L,"cs_test","dp_test","ch_test","pi_test",new BigDecimal("35"),"EUR","won",null,
                List.of(new BaitlyDisputeProof.Movement("txn_debit",new BigDecimal("-35"),BigDecimal.ZERO,new BigDecimal("-35"),"EUR",Instant.EPOCH,Instant.EPOCH)));
        assertThatThrownBy(()->tx(em->new BaitlyDisputeStore(em,tenant).observe(wrong))).hasMessageContaining("Mouvement Stripe");
        tx(em->{ assertThat(em.find(PaymentTransaction.class,paymentId).getDisputedAmount()).isEqualByComparingTo("35"); return null; });
    }
}
