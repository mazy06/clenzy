package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Rapprochement documentaire réel, sans réémission d'argent ni changement de la dette. */
class BaitlyInvoicePaymentMatchingTest {
    static SessionFactory factory;
    final TenantContext tenant = mock(TenantContext.class);
    Long invoiceId;
    @BeforeAll static void mapping() {
        var xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml, Intervention.class,
                Set.of("organizationId","paymentStatus","estimatedCost","currency","stripeSessionId","paidAt"));
        RefundCreditNotePersistenceTest.mapping(xml, Reservation.class,
                Set.of("organizationId","paymentStatus","paymentCollection","totalPrice","currency","stripeSessionId","paidAt","status","creditApplied"));
        xml.append("</entity-mappings>");
        factory = new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .addAnnotatedClass(Invoice.class).addAnnotatedClass(InvoiceLine.class).addAnnotatedClass(InterventionPaymentAllocation.class)
                .addAnnotatedClass(LedgerEntry.class)
                .addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url","jdbc:h2:mem:invoicematching;MODE=PostgreSQL;LOCK_TIMEOUT=5000")
                .setProperty("jakarta.persistence.validation.mode","none").setProperty("hibernate.hbm2ddl.auto","create-drop").buildSessionFactory();
    }
    @AfterAll static void close() { if(factory!=null) factory.close(); }
    <T> T tx(Function<EntityManager,T> f) {
        try(var em=factory.createEntityManager()) { em.getTransaction().begin();
            try { T result=f.apply(em); em.getTransaction().commit(); return result; }
            catch(RuntimeException e) { em.getTransaction().rollback(); throw e; }
        }
    }
    PaymentTransactionRepository payments(EntityManager em) { return new JpaRepositoryFactory(em).getRepository(PaymentTransactionRepository.class); }
    BaitlyInvoicePaymentMatching service(EntityManager em) { return new BaitlyInvoicePaymentMatching(em,payments(em),tenant); }
    PaymentTransaction payment(EntityManager em) { return payments(em).findByTransactionRef("TX-batch").orElseThrow(); }
    @BeforeEach void seed() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        invoiceId=tx(em -> {
            for(String entity:List.of("InvoiceLine","Invoice","LedgerEntry","InterventionPaymentAllocation","PaymentTransaction","Intervention","Reservation"))
                em.createQuery("delete from "+entity).executeUpdate();
            var payment=new PaymentTransaction(); payment.setOrganizationId(7L); payment.setTransactionRef("TX-batch");
            payment.setPaymentType(TransactionType.CHECKOUT); payment.setProviderType(PaymentProviderType.STRIPE); payment.setStatus(TransactionStatus.COMPLETED);
            payment.setAmount(new BigDecimal("90")); payment.setCurrency("EUR"); payment.setProviderTxId("cs_batch");
            payment.setSourceType("INTERVENTION_BATCH"); payment.setSourceId(304L); payment.setMetadata(Map.of("interventionIds","304,320")); em.persist(payment);
            for(long id:List.of(304L,320L)) {
                var amount=new BigDecimal(id==304 ? "35" : "55");
                var part=new InterventionPaymentAllocation(payment,id,amount); part.confirm(); em.persist(part);
                var mission=new Intervention(); mission.setId(id); mission.setOrganizationId(7L); mission.setEstimatedCost(amount); mission.setCurrency("EUR");
                mission.setPaymentStatus(id==304 ? PaymentStatus.REFUNDED : PaymentStatus.PAID); mission.setStripeSessionId("cs_batch");
                mission.setPaidAt(LocalDateTime.of(2026,10,5,14,17)); em.persist(mission);
                receipt(em,"TX-batch:"+id,amount);
            }
            var invoice=new Invoice(); invoice.setOrganizationId(7L); invoice.setInvoiceNumber("FA-test"); invoice.setInvoiceDate(LocalDate.of(2026,10,5));
            invoice.setInvoiceType(InvoiceType.GUEST); invoice.setStatus(InvoiceStatus.ISSUED); invoice.setInterventionId(320L);
            invoice.setTotalHt(new BigDecimal("45.83")); invoice.setTotalTax(new BigDecimal("9.17")); invoice.setTotalTtc(new BigDecimal("55"));
            invoice.setLegalMentions("Mentions historiques"); em.persist(invoice); return invoice.getId();
        });
    }
    void receipt(EntityManager em,String ref,BigDecimal amount) {
        var a=new Wallet(); a.setId(1L); a.setOrganizationId(7L); a.setCurrency("EUR");
        var b=new Wallet(); b.setId(2L); b.setOrganizationId(7L); b.setCurrency("EUR");
        new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).recordTransfer(a,b,amount,LedgerReferenceType.PAYMENT,ref,"Encaissement test");
    }
    @Test void paidBatchMatchesOnlyItsInvoiceWithoutMovingFundsOrChangingSiblingRefund() {
        var proof=tx(em -> service(em).prepare(invoiceId));
        for(int n=0;n<2;n++) tx(em -> { service(em).apply(proof); return null; });
        tx(em -> {
            var invoice=em.find(Invoice.class,invoiceId);
            assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.PAID);
            assertThat(invoice.getPaymentTransactionId()).isEqualTo(payment(em).getId());
            assertThat(invoice.getPaidAt()).isEqualTo(proof.paidAt());
            assertThat(invoice.getTotalHt()).isEqualByComparingTo("45.83");
            assertThat(invoice.getTotalTax()).isEqualByComparingTo("9.17");
            assertThat(invoice.getLegalMentions()).isEqualTo("Mentions historiques");
            assertThat(em.find(Intervention.class,304L).getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
            assertThat(em.find(Intervention.class,320L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(payments(em).findAll()).hasSize(1);
            assertThat(em.createQuery("select count(e) from LedgerEntry e",Long.class).getSingleResult()).isEqualTo(4);
            assertThat(service(em).candidates(0)).isEmpty(); return null;
        });
    }
    @Test void provenExpiredAttemptDoesNotHideTheLaterConfirmedPayment() {
        tx(em -> {
            var expired = RefundCreditNotePersistenceTest.transaction("TX-expired", TransactionType.CHECKOUT);
            expired.setSourceId(320L);
            expired.setStatus(TransactionStatus.FAILED);
            expired.setProviderTxId("cs_expired");
            expired.setMetadata(Map.of("standaloneRetryAllowed", true, "expiredSessionId", "cs_expired"));
            em.persist(expired);
            return null;
        });
        var proof = tx(em -> service(em).prepare(invoiceId));
        tx(em -> { service(em).apply(proof); return null; });
        tx(em -> {
            assertThat(em.find(Invoice.class, invoiceId).getPaymentTransactionId()).isEqualTo(payment(em).getId());
            assertThat(payments(em).findByTransactionRef("TX-expired").orElseThrow().getStatus()).isEqualTo(TransactionStatus.FAILED);
            assertThat(em.createQuery("select count(e) from LedgerEntry e", Long.class).getSingleResult()).isEqualTo(4);
            return null;
        });
    }

    @ParameterizedTest @ValueSource(strings={"SENT","OVERDUE","PAID"})
    void lateOrAlreadyPaidUnboundInvoiceCanBeLinked(String status) {
        tx(em -> { em.find(Invoice.class,invoiceId).setStatus(InvoiceStatus.valueOf(status)); return null; });
        var proof=tx(em -> service(em).prepare(invoiceId)); tx(em -> { service(em).apply(proof); return null; });
        Long paymentId=tx(em -> em.find(Invoice.class,invoiceId).getPaymentTransactionId()); assertThat(paymentId).isNotNull();
    }
    @ParameterizedTest @ValueSource(strings={"unpaid","refunded","amount","currency","session","other-org","draft","commission","duplicate","credit","other-binding","partial-batch","unconfirmed","pending-funding","other-psp","second-payment","failed-unknown","second-invoice","missing-ledger","broken-ledger"})
    void ambiguousDocumentsRemainUnchanged(String reason) {
        tx(em -> {
            var invoice=em.find(Invoice.class,invoiceId); var p=payment(em); var mission=em.find(Intervention.class,320L);
            switch(reason) {
                case "unpaid" -> mission.setPaymentStatus(PaymentStatus.PENDING);
                case "refunded" -> mission.setPaymentStatus(PaymentStatus.REFUNDED);
                case "amount" -> invoice.setTotalTtc(BigDecimal.ONE);
                case "currency" -> invoice.setCurrency("USD");
                case "session" -> mission.setStripeSessionId("cs_other");
                case "other-org" -> invoice.setOrganizationId(8L);
                case "draft" -> invoice.setStatus(InvoiceStatus.DRAFT);
                case "commission" -> invoice.setInvoiceType(InvoiceType.COMMISSION);
                case "duplicate" -> invoice.setDuplicateOfId(99L);
                case "credit" -> invoice.setOriginalInvoiceId(99L);
                case "other-binding" -> invoice.setPaymentTransactionId(99L);
                case "partial-batch" -> em.createQuery("delete from InterventionPaymentAllocation a where a.interventionId=304").executeUpdate();
                case "unconfirmed" -> em.createQuery("update InterventionPaymentAllocation a set a.confirmedAt=null where a.interventionId=304").executeUpdate();
                case "pending-funding" -> p.setStatus(TransactionStatus.PROCESSING);
                case "other-psp" -> p.setProviderType(PaymentProviderType.CMI);
                case "second-payment", "failed-unknown" -> { var other=RefundCreditNotePersistenceTest.transaction("TX-other",TransactionType.CHECKOUT);
                    other.setSourceId(320L); other.setStatus(reason.equals("second-payment")?TransactionStatus.COMPLETED:TransactionStatus.FAILED); em.persist(other); }
                case "second-invoice" -> { var other=new Invoice(); other.setOrganizationId(7L); other.setInvoiceNumber("FA-other"); other.setInvoiceDate(LocalDate.now());
                    other.setTotalHt(invoice.getTotalHt()); other.setTotalTax(invoice.getTotalTax()); other.setTotalTtc(invoice.getTotalTtc());
                    other.setInvoiceType(InvoiceType.GUEST); other.setInterventionId(320L); em.persist(other); }
                case "missing-ledger" -> em.createQuery("delete from LedgerEntry e").executeUpdate();
                case "broken-ledger" -> em.createQuery("update LedgerEntry e set e.counterpartEntryId=null").executeUpdate();
            }
            return null;
        });
        assertThatThrownBy(() -> tx(em -> service(em).prepare(invoiceId))).isInstanceOf(RuntimeException.class);
        InvoiceStatus status=tx(em -> em.find(Invoice.class,invoiceId).getStatus());
        assertThat(status).isNotEqualTo(InvoiceStatus.PAID);
    }
    @Test void changedDebtBetweenReadAndApplyIsRejectedAndCanBeRetried() {
        var proof=tx(em -> service(em).prepare(invoiceId));
        tx(em -> { em.find(Intervention.class,320L).setPaymentStatus(PaymentStatus.REFUNDED); return null; });
        assertThatThrownBy(() -> tx(em -> { service(em).apply(proof); return null; })).isInstanceOf(IllegalStateException.class);
        tx(em -> { service(em).recordFailure(invoiceId); return null; });
        tx(em -> {
            assertThat(em.find(Invoice.class,invoiceId).getStatus()).isEqualTo(InvoiceStatus.ISSUED);
            assertThat(payment(em).getMetadata().get("invoiceMatches").toString()).contains("REVIEW_REQUIRED");
            em.find(Intervention.class,320L).setPaymentStatus(PaymentStatus.PAID); return null;
        });
        tx(em -> { service(em).apply(proof); return null; });
        tx(em -> { assertThat(payment(em).getMetadata().get("invoiceMatches").toString()).contains("MATCHED").doesNotContain("REVIEW_REQUIRED"); return null; });
    }
    @Test void concurrentWorkersProduceOneLinkUnderThePaymentLock() throws Exception {
        var proof=tx(em -> service(em).prepare(invoiceId)); var started=new CountDownLatch(1); var release=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(() -> tx(em -> { service(em).apply(proof); em.flush(); started.countDown();
                try { if(!release.await(4,TimeUnit.SECONDS)) throw new IllegalStateException("timeout"); } catch(InterruptedException e) { throw new RuntimeException(e); } return true; }));
            assertThat(started.await(4,TimeUnit.SECONDS)).isTrue();
            var second=pool.submit(() -> tx(em -> { service(em).apply(proof); return true; }));
            try { assertThatThrownBy(() -> second.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class); }
            finally { release.countDown(); }
            assertThat(first.get(5,TimeUnit.SECONDS)).isTrue(); assertThat(second.get(5,TimeUnit.SECONDS)).isTrue();
        }
    }
    @ParameterizedTest @ValueSource(strings={"RESERVATION","INTERVENTION"})
    void uniqueIndividualPaymentAlsoMatchesTheHistoricalInvoice(String source) {
        tx(em -> {
            var p=payment(em); p.setAmount(new BigDecimal("55")); p.setSourceType(source); p.setSourceId(320L);
            p.setMetadata(Map.of()); em.createQuery("delete from InterventionPaymentAllocation").executeUpdate();
            var invoice=em.find(Invoice.class,invoiceId);
            if(source.equals("RESERVATION")) {
                invoice.setInterventionId(null); invoice.setReservationId(320L);
                var stay=new Reservation(); stay.setId(320L); stay.setOrganizationId(7L); stay.setPaymentStatus(PaymentStatus.PAID);
                stay.setPaymentCollection(PaymentCollection.PMS); stay.setTotalPrice(new BigDecimal("55")); stay.setCurrency("EUR");
                stay.setStripeSessionId("cs_batch"); stay.setPaidAt(LocalDateTime.of(2026,10,5,14,17)); em.persist(stay);
            }
            receipt(em,"320",new BigDecimal("55")); return null;
        });
        var proof=tx(em -> service(em).prepare(invoiceId)); tx(em -> { service(em).apply(proof); return null; });
        InvoiceStatus status=tx(em -> em.find(Invoice.class,invoiceId).getStatus()); assertThat(status).isEqualTo(InvoiceStatus.PAID);
    }
    @Test void candidatePaginationDoesNotReturnEarlierOrUnfundedInvoices() {
        tx(em -> { assertThat(service(em).candidates(0)).extracting(BaitlyInvoicePaymentMatching.Candidate::invoiceId).containsExactly(invoiceId);
            assertThat(service(em).candidates(invoiceId)).isEmpty(); payment(em).setStatus(TransactionStatus.FAILED); return null; });
        tx(em -> { assertThat(service(em).candidates(0)).isEmpty(); return null; });
    }
    @Test void scannerLeavesAlreadyPaidHistoricalInvoicesAlone() {
        tx(em -> { em.find(Invoice.class,invoiceId).setStatus(InvoiceStatus.PAID); return null; });
        tx(em -> { assertThat(service(em).candidates(0)).isEmpty(); return null; });
    }
}
