package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.catalog.ServiceCatalogReference;
import com.clenzy.service.payout.*;
import jakarta.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Preuves et préparation réellement persistées ; aucun appel Stripe ni modification du PMS. */
class BaitlyResidualPayoutPersistenceTest {
    static SessionFactory factory;
    final ProviderPayoutBeneficiaryService beneficiaries = mock(ProviderPayoutBeneficiaryService.class);

    @BeforeAll static void mapping() {
        var xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml, Intervention.class,
                Set.of("organizationId","status","paymentStatus","estimatedCost","actualCost","currency","stripeSessionId"));
        xml.append("</entity-mappings>");
        factory = new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .addAnnotatedClass(InterventionPaymentAllocation.class).addAnnotatedClass(LedgerEntry.class)
                .addAnnotatedClass(HousekeeperPayoutRecord.class)
                .addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url","jdbc:h2:mem:residualpayout;MODE=PostgreSQL;LOCK_TIMEOUT=5000")
                .setProperty("jakarta.persistence.validation.mode","none")
                .setProperty("hibernate.hbm2ddl.auto","create-drop").buildSessionFactory();
    }
    @AfterAll static void close() { if (factory != null) factory.close(); }
    <T> T tx(Function<EntityManager,T> action) {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin();
            try { T result = action.apply(em); em.getTransaction().commit(); return result; }
            catch (RuntimeException e) { em.getTransaction().rollback(); throw e; }
        }
    }
    <T> T repo(EntityManager em, Class<T> type) { return new JpaRepositoryFactory(em).getRepository(type); }
    BaitlyResidualPayoutFunding funding(EntityManager em) {
        return new BaitlyResidualPayoutFunding(em, repo(em,PaymentTransactionRepository.class),
                new BaitlyBatchRefundPersistence(em,repo(em,PaymentTransactionRepository.class),mock(InterventionPaymentCoordination.class),null));
    }
    BaitlyProviderPayoutGuard guard(EntityManager em) {
        var policy = new ProviderPayoutPolicy(repo(em,PaymentTransactionRepository.class),mock(ServiceCatalogReference.class),
                repo(em,InterventionPaymentAllocationRepository.class),funding(em));
        return new BaitlyProviderPayoutGuard(em,beneficiaries,policy,repo(em,HousekeeperPayoutRecordRepository.class));
    }
    HousekeeperPayoutRecorder recorder(EntityManager em) {
        return new HousekeeperPayoutRecorder(repo(em,HousekeeperPayoutRecordRepository.class),mock(HousekeeperPayoutConfigRepository.class),beneficiaries,guard(em));
    }
    PaymentTransaction refund(EntityManager em) { return repo(em,PaymentTransactionRepository.class).findByTransactionRef("EXT-re_partial").orElseThrow(); }
    Wallet wallet(Long id) { var w = new Wallet(); w.setId(id); w.setOrganizationId(7L); w.setCurrency("EUR"); return w; }
    @BeforeEach void seed() {
        tx(em -> {
            for (String entity : List.of("HousekeeperPayoutRecord","LedgerEntry","InterventionPaymentAllocation","PaymentTransaction","Intervention"))
                em.createQuery("delete from " + entity).executeUpdate();
            var mission = new Intervention(); mission.setId(364L); mission.setOrganizationId(7L);
            mission.setStatus(InterventionStatus.COMPLETED); mission.setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);
            mission.setEstimatedCost(new BigDecimal("35")); mission.setCurrency("EUR"); mission.setStripeSessionId("cs_original"); em.persist(mission);
            var original = RefundCreditNotePersistenceTest.transaction("TX-original",TransactionType.CHECKOUT);
            original.setProviderTxId("cs_original"); original.setAmount(new BigDecimal("35")); em.persist(original);
            var refund = RefundCreditNotePersistenceTest.transaction("EXT-re_partial",TransactionType.REFUND);
            refund.setAmount(new BigDecimal("5")); refund.setProviderTxId("re_partial");
            refund.setMetadata(Map.of("externalRefund",true,"externalRefundConfirmed",true,"reviewRequired",false,
                    "stripeStatus","succeeded","originalTransactionRef","TX-original")); em.persist(refund);
            var ledger = new LedgerService(repo(em,LedgerEntryRepository.class));
            ledger.recordTransfer(wallet(1L),wallet(2L),new BigDecimal("35"),LedgerReferenceType.PAYMENT,"364","Paiement intervention #364");
            ledger.recordTransfer(wallet(2L),wallet(1L),new BigDecimal("5"),LedgerReferenceType.REFUND,"EXT-re_partial","Remboursement partiel");
            return null;
        });
    }
    @Test void confirmedPartialRefundFundsOnlyThirtyEurosAndOneProviderOrder() {
        tx(em -> {
            var mission = em.find(Intervention.class,364L);
            assertThat(funding(em).available(mission)).contains(new BigDecimal("30.00"));
            assertThat(recorder(em).insertRecord(mission,PayoutBeneficiary.organization(9L),new BigDecimal("27"),new BigDecimal("3"),HousekeeperPayoutRecord.Status.PENDING,null)).isTrue();
            assertThat(recorder(em).insertRecord(mission,PayoutBeneficiary.organization(9L),new BigDecimal("27"),new BigDecimal("3"),HousekeeperPayoutRecord.Status.PENDING,null)).isFalse();
            guard(em).requireInstruction(new PayoutTransferInstruction(7L,PayoutTransfer.Source.INTERVENTION,364L,null,9L,
                    new BigDecimal("27"),"EUR","acct_provider","Solde"));
            assertThat(repo(em,HousekeeperPayoutRecordRepository.class).count()).isEqualTo(1);
            return null;
        });
    }
    @ParameterizedTest @ValueSource(strings={"review","pending","failed","unconfirmed","wrong-original","wrong-session","currency","foreign-org","price",
            "full-refund","second-refund","missing-reversal","broken-pair","wrong-reversal","batch"})
    void unsafeEvidenceNeverFundsTheRemainder(String defect) {
        tx(em -> {
            var r = refund(em); var metadata = new HashMap<>(r.getMetadata());
            switch (defect) {
                case "review" -> metadata.put("reviewRequired",true);
                case "pending" -> r.setStatus(TransactionStatus.PROCESSING);
                case "failed" -> metadata.put("stripeStatus","failed");
                case "unconfirmed" -> metadata.put("externalRefundConfirmed",false);
                case "wrong-original" -> metadata.put("originalTransactionRef","TX-other");
                case "wrong-session" -> em.find(Intervention.class,364L).setStripeSessionId("cs_other");
                case "currency" -> r.setCurrency("MAD");
                case "foreign-org" -> r.setOrganizationId(8L);
                case "price" -> em.find(Intervention.class,364L).setActualCost(new BigDecimal("40"));
                case "full-refund" -> r.setAmount(new BigDecimal("35"));
                case "second-refund" -> { var second = RefundCreditNotePersistenceTest.transaction("EXT-other",TransactionType.REFUND); second.setAmount(BigDecimal.ONE); em.persist(second); }
                case "missing-reversal" -> em.createQuery("delete from LedgerEntry where referenceType=com.clenzy.model.LedgerReferenceType.REFUND").executeUpdate();
                case "broken-pair" -> em.createQuery("update LedgerEntry set counterpartEntryId=null").executeUpdate();
                case "wrong-reversal" -> em.createQuery("update LedgerEntry set amount=4 where referenceType=com.clenzy.model.LedgerReferenceType.REFUND").executeUpdate();
                case "batch" -> { var p=repo(em,PaymentTransactionRepository.class).findByTransactionRef("TX-original").orElseThrow();
                    em.persist(new InterventionPaymentAllocation(p,364L,new BigDecimal("35"))); }
            }
            r.setMetadata(metadata); return null;
        });
        tx(em -> { assertThat(funding(em).available(em.find(Intervention.class,364L))).isEmpty(); return null; });
    }
    @Test void staleGrossAmountCannotBeReservedAfterRefund() {
        assertThatThrownBy(() -> tx(em -> recorder(em).insertRecord(em.find(Intervention.class,364L),PayoutBeneficiary.user(42L),
                new BigDecimal("35"),BigDecimal.ZERO,HousekeeperPayoutRecord.Status.PENDING,null))).hasMessageContaining("solde conservé");
        tx(em -> { assertThat(repo(em,HousekeeperPayoutRecordRepository.class).count()).isZero(); return null; });
    }

    @Test void successiveConfirmedRefundsFundOnlyTheExactRemainder() {
        tx(em->{var second=RefundCreditNotePersistenceTest.transaction("REF-series",TransactionType.REFUND);
            second.setAmount(new BigDecimal("7.01"));second.setProviderTxId("re_series");
            second.setMetadata(Map.of("managedRefund",true,"cumulativeRefund",true,"originalTransactionRef","TX-original","refundBefore","5"));
            em.persist(second);
            assertThat(funding(em).available(em.find(Intervention.class,364L))).isEmpty();
            new LedgerService(repo(em,LedgerEntryRepository.class)).recordTransfer(wallet(2L),wallet(1L),new BigDecimal("7.01"),
                    LedgerReferenceType.REFUND,"REF-series","Remboursement suivant");
            assertThat(funding(em).available(em.find(Intervention.class,364L))).contains(new BigDecimal("22.99"));return null;});
    }
    @ParameterizedTest @ValueSource(strings={"external-review","external-failed","external-unconfirmed","managed-review"})
    void cumulativeMetadataNeverBypassesAnUnresolvedRefund(String defect) {
        tx(em -> {
            var r=refund(em); var meta=new HashMap<>(r.getMetadata());
            meta.put("cumulativeRefund",true); meta.put("refundBefore","0");
            switch(defect) {
                case "external-review" -> meta.put("reviewRequired",true);
                case "external-failed" -> meta.put("stripeStatus","failed");
                case "external-unconfirmed" -> meta.put("externalRefundConfirmed",false);
                case "managed-review" -> { meta.remove("externalRefund"); meta.remove("externalRefundConfirmed"); meta.put("managedRefund",true); meta.put("reviewRequired",true); }
            }
            r.setMetadata(meta); return null;
        });
        tx(em -> { assertThat(funding(em).available(em.find(Intervention.class,364L))).isEmpty(); return null; });
        assertThatThrownBy(() -> tx(em -> recorder(em).insertRecord(em.find(Intervention.class,364L),PayoutBeneficiary.user(42L),
                new BigDecimal("30"),BigDecimal.ZERO,HousekeeperPayoutRecord.Status.PENDING,null)))
                .hasMessageContaining("rapprocher");
    }
    @Test void blockedOrderCanBeRecalculatedOnceButSentOrUncertainOrdersCannotBeRetried() {
        Long id = tx(em -> {
            var r = new HousekeeperPayoutRecord(7L,42L,364L,new BigDecimal("35"),BigDecimal.ZERO,HousekeeperPayoutRecord.Status.BLOCKED);
            em.persist(r); return r.getId();
        });
        tx(em -> { assertThat(recorder(em).requeueRecord(id,HousekeeperPayoutRecord.Status.BLOCKED,new BigDecimal("30"),BigDecimal.ZERO)).isEqualTo(1); return null; });
        tx(em -> {
            var record=em.find(HousekeeperPayoutRecord.class,id);
            assertThat(record.getAmount()).isEqualByComparingTo("30");
            assertThat(record.getStatus()).isEqualTo(HousekeeperPayoutRecord.Status.PENDING);
            assertThat(recorder(em).requeueRecord(id,HousekeeperPayoutRecord.Status.BLOCKED,new BigDecimal("30"),BigDecimal.ZERO)).isZero();
            record.setStatus(HousekeeperPayoutRecord.Status.BLOCKED); record.setFailureReason("RECONCILIATION_REQUIRED"); return null;
        });
        assertThatThrownBy(() -> tx(em -> recorder(em).requeueRecord(id,HousekeeperPayoutRecord.Status.BLOCKED,new BigDecimal("30"),BigDecimal.ZERO)))
                .hasMessageContaining("transfert existant");
    }
    @Test void transferReservationRejectsANewRefundObservedAfterOrderPreparation() {
        tx(em -> recorder(em).insertRecord(em.find(Intervention.class,364L),PayoutBeneficiary.user(42L),
                new BigDecimal("30"),BigDecimal.ZERO,HousekeeperPayoutRecord.Status.PENDING,null));
        tx(em -> { var m=new HashMap<>(refund(em).getMetadata()); m.put("reviewRequired",true); refund(em).setMetadata(m); return null; });
        assertThatThrownBy(() -> tx(em -> { guard(em).requireInstruction(new PayoutTransferInstruction(7L,PayoutTransfer.Source.INTERVENTION,364L,42L,
                    new BigDecimal("30"),"EUR","acct_provider","Solde")); return null; })).hasMessageContaining("rapprocher");
    }
    @Test void waitingPreparationReloadsTheProofCommittedByTheConcurrentRefund() throws Exception {
        var ready = new CountDownLatch(1); var release = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var observer = pool.submit(() -> tx(em -> {
                em.refresh(em.find(Intervention.class,364L),LockModeType.PESSIMISTIC_WRITE);
                var m = new HashMap<>(refund(em).getMetadata()); m.put("reviewRequired",true); refund(em).setMetadata(m);
                ready.countDown(); try { if (!release.await(5,TimeUnit.SECONDS)) throw new IllegalStateException("timeout"); }
                catch (InterruptedException e) { throw new IllegalStateException(e); } return null;
            }));
            assertThat(ready.await(5,TimeUnit.SECONDS)).isTrue();
            var attempting = new CountDownLatch(1);
            var prepare = pool.submit(() -> tx(em -> {
                var stale = em.find(Intervention.class,364L); attempting.countDown();
                return recorder(em).insertRecord(stale,PayoutBeneficiary.user(42L),new BigDecimal("30"),BigDecimal.ZERO,HousekeeperPayoutRecord.Status.PENDING,null);
            }));
            assertThat(attempting.await(5,TimeUnit.SECONDS)).isTrue(); release.countDown(); observer.get(5,TimeUnit.SECONDS);
            assertThatThrownBy(() -> prepare.get(5,TimeUnit.SECONDS)).hasCauseInstanceOf(IllegalStateException.class);
        } finally { release.countDown(); }
        tx(em -> { assertThat(repo(em,HousekeeperPayoutRecordRepository.class).count()).isZero(); return null; });
    }
}
