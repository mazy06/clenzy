package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Parts réelles, transactions et verrous SQL : aucune émission n'est simulée par un changement de statut. */
class BaitlyBatchRefundPersistenceTest {
    static SessionFactory factory;
    @BeforeAll static void mapping() {
        var xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml, Intervention.class,
                Set.of("organizationId", "paymentStatus", "estimatedCost", "currency", "stripeSessionId"));
        xml.append("</entity-mappings>");
        factory = new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
            .addAnnotatedClass(InterventionPaymentAllocation.class)
            .addAnnotatedClass(LedgerEntry.class).addAnnotatedClass(HousekeeperPayoutRecord.class)
            .addAnnotatedClass(PayoutTransfer.class).addAnnotatedClass(BaitlyTransferRecovery.class)
            .addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
            .setProperty("hibernate.connection.url", "jdbc:h2:mem:batchrefund;MODE=PostgreSQL;LOCK_TIMEOUT=5000")
            .setProperty("jakarta.persistence.validation.mode", "none")
            .setProperty("hibernate.hbm2ddl.auto", "create-drop").buildSessionFactory();

    }
    @AfterAll static void close() { if (factory != null) factory.close(); }
    <T> T tx(Function<EntityManager,T> action) {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin();
            try { T result=action.apply(em); em.getTransaction().commit(); return result; }
            catch (RuntimeException failure) { em.getTransaction().rollback(); throw failure; }
        }
    }
    PaymentTransactionRepository payments(EntityManager em) { return new JpaRepositoryFactory(em).getRepository(PaymentTransactionRepository.class); }
    BaitlyBatchRefundPersistence service(EntityManager em) {
        var coordination = mock(InterventionPaymentCoordination.class);
        when(coordination.lockMission(anyLong(), anyLong())).thenAnswer(call -> {
            var mission = em.find(Intervention.class, call.getArgument(1));
            em.refresh(mission, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE); return mission;
        });
        return new BaitlyBatchRefundPersistence(em, payments(em), coordination, new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em));
    }
    PaymentTransaction original(EntityManager em) { return payments(em).findByTransactionRef("TX-batch").orElseThrow(); }
    @BeforeEach void seed() {
        tx(em -> {
            for (String entity : List.of("BaitlyTransferRecovery", "PayoutTransfer", "HousekeeperPayoutRecord", "LedgerEntry", "InterventionPaymentAllocation", "PaymentTransaction", "Intervention")) em.createQuery("delete from " + entity).executeUpdate();
            em.createNativeQuery("DELETE FROM housekeeper_payout_records").executeUpdate();
            var p = new PaymentTransaction(); p.setOrganizationId(7L); p.setTransactionRef("TX-batch");
            p.setSourceType("INTERVENTION_BATCH"); p.setSourceId(10L); p.setProviderType(PaymentProviderType.STRIPE);
            p.setProviderTxId("cs_batch"); p.setPaymentType(TransactionType.CHECKOUT); p.setStatus(TransactionStatus.COMPLETED);
            p.setAmount(new BigDecimal("80")); p.setCurrency("EUR"); p.setMetadata(Map.of("interventionIds", "10,20")); em.persist(p);
            for (long id : List.of(10L, 20L)) {
                var amount = new BigDecimal(id == 10 ? "35" : "45");
                var mission = new Intervention(); mission.setId(id); mission.setOrganizationId(7L); mission.setPaymentStatus(PaymentStatus.PAID);
                mission.setEstimatedCost(amount); mission.setCurrency("EUR"); mission.setStripeSessionId("cs_batch"); em.persist(mission);
                var part = new InterventionPaymentAllocation(p, id, amount); part.confirm(); em.persist(part);
                var ledger = new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class));
                ledger.recordTransfer(wallet(1L),wallet(2L),amount,LedgerReferenceType.PAYMENT,"TX-batch:"+id,"Paiement groupé");
                ledger.recordTransfer(wallet(2L),wallet(3L),amount,LedgerReferenceType.SPLIT,"SPLIT-INTERVENTION-TX-batch:"+id,"Répartition");
            }
            return null;
        });
    }
    Wallet wallet(Long id) { var w=new Wallet(); w.setId(id); w.setOrganizationId(7L); w.setCurrency("EUR"); return w; }

    void confirmPartial(String ref) {
        tx(em -> {
            var refund=payments(em).findByTransactionRef(ref).orElseThrow();
            refund.setStatus(TransactionStatus.COMPLETED); refund.setProviderTxId("re_"+refund.getId());
            var repository=new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class);
            var wallets=mock(WalletService.class); when(wallets.getWalletById(anyLong())).thenAnswer(c -> wallet(c.getArgument(0)));
            var ledger=new PaymentLedgerReversalService(mock(InterventionRepository.class),repository,new LedgerService(repository),wallets);
            var coordination=mock(InterventionPaymentCoordination.class);
            var tenant=mock(com.clenzy.tenant.TenantContext.class); when(tenant.getRequiredOrganizationId()).thenReturn(7L);
            new InterventionRefundReconciliationService(payments(em),coordination,mock(PaymentStatusTransitionService.class),ledger,tenant,service(em)).reconcile(ref);
            return null;
        });
    }

    @Test void partialSequenceKeepsTheSiblingPaidAndReleasesOnlyItsResidual() {
        var key=UUID.randomUUID();
        String first=tx(em -> service(em).prepareInstallment(7L,10L,new BigDecimal("5.01"),key));
        String replay=tx(em -> service(em).prepareInstallment(7L,10L,new BigDecimal("5.01"),key));
        assertThat(replay).isEqualTo(first);
        assertThatThrownBy(() -> tx(em -> service(em).prepareInstallment(7L,10L,BigDecimal.ONE,UUID.randomUUID())))
                .hasMessageContaining("en cours");
        confirmPartial(first); confirmPartial(first);
        tx(em -> {
            assertThat(em.find(Intervention.class,10L).getPaymentStatus()).isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);
            assertThat(em.find(Intervention.class,20L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            var funding=new com.clenzy.service.payout.BaitlyResidualPayoutFunding(em,payments(em),service(em));
            assertThat(funding.available(em.find(Intervention.class,10L))).contains(new BigDecimal("29.99"));
            assertThat(new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).calculateBalance(3L))
                    .isEqualByComparingTo("74.99");
            return null;
        });
        assertThatThrownBy(() -> tx(em -> service(em).prepareInstallment(7L,10L,new BigDecimal("30"),UUID.randomUUID())))
                .hasMessageContaining("solde");
        assertThatThrownBy(() -> tx(em -> service(em).prepare(7L,10L))).hasMessageContaining("solde");
        assertThatThrownBy(() -> tx(em -> service(em).prepareInstallment(7L,10L,new BigDecimal("6"),key)))
                .hasMessageContaining("autre montant");
        String last=tx(em -> service(em).prepareInstallment(7L,10L,new BigDecimal("29.99"),UUID.randomUUID()));
        confirmPartial(last); confirmPartial(first); confirmPartial(last);
        tx(em -> {
            assertThat(em.find(Intervention.class,10L).getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
            assertThat(em.find(Intervention.class,20L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(service(em).manifest(original(em))).hasSize(2);
            assertThat(new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).calculateBalance(3L))
                    .isEqualByComparingTo("45");
            return null;
        });
    }

    @ParameterizedTest @ValueSource(booleans={true,false})
    void retryAfterExpiryKeepsAmbiguousFailuresBlocked(boolean proven) {
        tx(em -> {
            var failed=new PaymentTransaction(); failed.setOrganizationId(7L); failed.setSourceType("INTERVENTION");
            failed.setSourceId(10L); failed.setTransactionRef("TX-expired"); failed.setPaymentType(TransactionType.CHECKOUT);
            failed.setProviderType(PaymentProviderType.STRIPE); failed.setProviderTxId("cs_expired");
            failed.setStatus(TransactionStatus.FAILED); failed.setAmount(new BigDecimal("35")); failed.setCurrency("EUR");
            if(proven) failed.setMetadata(Map.of("standaloneRetryAllowed",true,"expiredSessionId","cs_expired"));
            em.persist(failed); return null;
        });
        if(!proven) {
            assertThatThrownBy(() -> tx(em -> service(em).prepareInstallment(7L,10L,new BigDecimal("5.01"),UUID.randomUUID())))
                    .hasMessageContaining("Plusieurs encaissements");
            return;
        }
        String ref=tx(em -> {
            var coordination=mock(InterventionPaymentCoordination.class);
            var recovery=mock(com.clenzy.service.payout.BaitlyTransferRecoveryStore.class);
            var routing=new BaitlyRefundSeriesStore(payments(em),coordination,em,recovery,service(em));
            return routing.prepare(7L,10L,new BigDecimal("5.01"),UUID.randomUUID());
        });
        confirmPartial(ref);
        tx(em -> {
            assertThat(em.find(Intervention.class,10L).getPaymentStatus()).isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);
            assertThat(em.find(Intervention.class,20L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(payments(em).findByTransactionRef("TX-expired").orElseThrow().getStatus()).isEqualTo(TransactionStatus.FAILED);
            return null;
        });
    }

    @Test void residualStaysBlockedUntilAccountingAndCanonicalProofAgree() {
        String ref=tx(em -> service(em).prepareInstallment(7L,10L,new BigDecimal("5"),UUID.randomUUID()));
        tx(em -> {
            var refund=payments(em).findByTransactionRef(ref).orElseThrow();
            refund.setStatus(TransactionStatus.COMPLETED); refund.setProviderTxId("re_pending_ledger");
            em.find(Intervention.class,10L).setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);
            assertThat(new com.clenzy.service.payout.BaitlyResidualPayoutFunding(em,payments(em),service(em))
                    .available(em.find(Intervention.class,10L))).isEmpty();
            return null;
        });
        confirmPartial(ref);
        tx(em -> {
            var refund=payments(em).findByTransactionRef(ref).orElseThrow();
            var metadata=new HashMap<>(refund.getMetadata()); metadata.put("batchAllocationId","999"); refund.setMetadata(metadata);
            assertThat(new com.clenzy.service.payout.BaitlyResidualPayoutFunding(em,payments(em),service(em))
                    .available(em.find(Intervention.class,10L))).isEmpty();
            return null;
        });
    }

    @ParameterizedTest @ValueSource(strings={"0.00","5.00"})
    void partialRefundsOfAnAlreadyTransferredPartKeepItsSiblingAndReserveSeparateRecoveries(String commission) {
        BigDecimal fee = new BigDecimal(commission), net = new BigDecimal("35").subtract(fee);
        tx(em -> {
            var record = new HousekeeperPayoutRecord(7L,42L,10L,net,fee,HousekeeperPayoutRecord.Status.SENT);
            record.setStripeTransferId("tr_batch_part"); em.persist(record);
            var transfer = new PayoutTransfer();
            Map<String,Object> fields=Map.ofEntries(Map.entry("organizationId",7L),Map.entry("source",PayoutTransfer.Source.INTERVENTION),
                    Map.entry("sourceId",10L),Map.entry("beneficiaryUserId",42L),Map.entry("amount",net),
                    Map.entry("currency","EUR"),Map.entry("provider","STRIPE"),Map.entry("destination","acct_provider"),
                    Map.entry("description","TEST SANDBOX"),Map.entry("idempotencyKey","batch-part"),
                    Map.entry("createdAt",java.time.Instant.now()));
            fields.forEach((key,value) -> org.springframework.test.util.ReflectionTestUtils.setField(transfer,key,value));
            transfer.transferred("tr_batch_part"); transfer.captureDestinationPayment("py_batch_part",false); em.persist(transfer);
            return null;
        });
        for (String amount : List.of("5.01","29.99")) {
            var key = UUID.randomUUID();
            String reference = tx(em -> service(em).prepareInstallment(7L,10L,new BigDecimal(amount),key));
            confirmPartial(reference);
            assertThatThrownBy(() -> tx(em -> service(em).prepareInstallment(7L,10L,BigDecimal.ONE,UUID.randomUUID())))
                    .isInstanceOf("5.01".equals(amount) ? com.clenzy.exception.PaymentValidationException.class : IllegalStateException.class)
                    .hasMessageContaining("5.01".equals(amount) ? "récupération précédente" : "solde remboursable");
            tx(em -> {
                var refund = payments(em).findByTransactionRef(reference).orElseThrow();
                var recovery = em.createQuery("from BaitlyTransferRecovery where refundId=:refund",BaitlyTransferRecovery.class)
                        .setParameter("refund",refund.getId()).getSingleResult();
                var store = new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em);
                String expected = fee.signum() == 0 ? amount : "5.01".equals(amount) ? "4.29" : "25.71";
                assertThat(store.claim(7L,recovery.getId()).orElseThrow().amount()).isEqualByComparingTo(expected);
                store.confirm(7L,recovery.getId(),"trr_"+recovery.getId());
                assertThat(em.find(Intervention.class,20L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
                return null;
            });
            String replay = tx(em -> service(em).prepareInstallment(7L,10L,new BigDecimal(amount),key));
            assertThat(replay).isEqualTo(reference);
        }
        tx(em -> {
            assertThat(em.createQuery("select sum(amount) from BaitlyTransferRecovery",BigDecimal.class).getSingleResult())
                    .isEqualByComparingTo(net);
            assertThat(em.createQuery("select sum(commissionRefundAmount) from BaitlyTransferRecovery",BigDecimal.class).getSingleResult())
                    .isEqualByComparingTo(fee);
            assertThat(em.createQuery("select sum(amount) from LedgerEntry where entryType=:direction",BigDecimal.class)
                    .setParameter("direction",LedgerEntryType.DEBIT).getSingleResult())
                    .isEqualByComparingTo(em.createQuery("select sum(amount) from LedgerEntry where entryType=:direction",BigDecimal.class)
                            .setParameter("direction",LedgerEntryType.CREDIT).getSingleResult());
            assertThat(em.find(Intervention.class,10L).getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
            assertThat(new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).calculateBalance(3L))
                    .isEqualByComparingTo("45");
            return null;
        });
    }

    @Test void concurrentPartialRequestsWithSameIntentCreateOneDecision() throws Exception {
        var key=UUID.randomUUID(); var ready=new CountDownLatch(1); var release=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(() -> tx(em -> {
                String ref=service(em).prepareInstallment(7L,10L,BigDecimal.ONE,key); em.flush(); ready.countDown();
                try { if(!release.await(4,TimeUnit.SECONDS)) throw new IllegalStateException("timeout"); }
                catch(InterruptedException e) { throw new RuntimeException(e); } return ref;
            }));
            assertThat(ready.await(4,TimeUnit.SECONDS)).isTrue();
            var second=pool.submit(() -> tx(em -> service(em).prepareInstallment(7L,10L,BigDecimal.ONE,key)));
            try { assertThatThrownBy(() -> second.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class); }
            finally { release.countDown(); }
            assertThat(first.get(4,TimeUnit.SECONDS)).isEqualTo(second.get(4,TimeUnit.SECONDS));
        }
    }

    @Test void reversalUsesOnlyTheChosenAllocationAndIsIdempotent() {
        String ref=tx(em -> service(em).prepare(7L,10L));
        for(int replay=0;replay<2;replay++) tx(em -> {
            var repository=new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class);
            var wallets=mock(WalletService.class); when(wallets.getWalletById(anyLong())).thenAnswer(c -> wallet(c.getArgument(0)));
            var reverse=new PaymentLedgerReversalService(mock(InterventionRepository.class),repository,new LedgerService(repository),wallets);
            reverse.reverseAllocatedPaymentEntries(original(em),payments(em).findByTransactionRef(ref).orElseThrow(),10L);
            return null;
        });
        tx(em -> {
            var entries=em.createQuery("from LedgerEntry e where e.referenceType=com.clenzy.model.LedgerReferenceType.REFUND",LedgerEntry.class).getResultList();
            assertThat(entries).hasSize(4).allMatch(e -> ref.equals(e.getReferenceId()));
            assertThat(entries.stream().filter(e -> e.getEntryType()==LedgerEntryType.DEBIT).map(LedgerEntry::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("70");
            assertThat(entries.stream().filter(e -> e.getEntryType()==LedgerEntryType.CREDIT).map(LedgerEntry::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("70");
            assertThat(new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).calculateBalance(3L)).isEqualByComparingTo("45");
            return null;
        });
    }
    @Test void distinctPartsReserveTheirOwnAmountsAndReplayWithoutTouchingPaidSiblings() {
        String first = tx(em -> service(em).prepare(7L,10L));
        tx(em -> { var refund = payments(em).findByTransactionRef(first).orElseThrow(); refund.setStatus(TransactionStatus.COMPLETED);
            refund.setProviderTxId("re_first"); em.find(Intervention.class,10L).setPaymentStatus(PaymentStatus.REFUNDED); return null; });
        String replay=tx(em -> service(em).prepare(7L,10L));
        assertThat(replay).isEqualTo(first);
        String second = tx(em -> service(em).prepare(7L,20L));
        assertThat(second).isNotEqualTo(first);
        tx(em -> {
            assertThat(service(em).manifest(original(em))).containsEntry(first,new BigDecimal("35.00")).containsEntry(second,new BigDecimal("45.00"));
            assertThat(original(em).getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            assertThat(em.find(Intervention.class,20L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(payments(em).findByTransactionRef(second).orElseThrow().getStatus()).isEqualTo(TransactionStatus.PROCESSING);
            return null;
        });
    }
    @Test void concurrentClicksShareOneDecisionUnderBatchLock() throws Exception {
        var ready = new CountDownLatch(1); var release = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> tx(em -> { String ref=service(em).prepare(7L,10L); em.flush(); ready.countDown();
                try { if (!release.await(4,TimeUnit.SECONDS)) throw new IllegalStateException("timeout"); }
                catch (InterruptedException e) { throw new RuntimeException(e); } return ref; }));
            assertThat(ready.await(4,TimeUnit.SECONDS)).isTrue();
            var second = pool.submit(() -> tx(em -> service(em).prepare(7L,10L)));
            try { assertThatThrownBy(() -> second.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class); }
            finally { release.countDown(); }
            assertThat(first.get(4,TimeUnit.SECONDS)).isEqualTo(second.get(4,TimeUnit.SECONDS));
        }
    }
    @ParameterizedTest @ValueSource(strings={"other-org","unpaid","wrong-session","amount","currency","batch-pending","batch-currency","wrong-provider","incomplete-parts","unconfirmed-part","duplicate-funding","payout","legacy-refund","missing-ledger","broken-ledger"})
    void inconsistentOrAlreadyDisbursedPartsAreRefusedBeforeDecision(String scenario) {
        tx(em -> {
            var mission=em.find(Intervention.class,10L); var payment=original(em);
            switch (scenario) {
                case "other-org" -> mission.setOrganizationId(8L);
                case "unpaid" -> mission.setPaymentStatus(PaymentStatus.PENDING);
                case "wrong-session" -> mission.setStripeSessionId("cs_other");
                case "amount" -> mission.setEstimatedCost(BigDecimal.ONE);
                case "currency" -> mission.setCurrency("USD");
                case "batch-pending" -> payment.setStatus(TransactionStatus.PROCESSING);
                case "batch-currency" -> payment.setCurrency("USD");
                case "wrong-provider" -> payment.setProviderTxId("pi_wrong");
                case "incomplete-parts" -> em.createQuery("delete from InterventionPaymentAllocation a where a.interventionId=20").executeUpdate();
                case "unconfirmed-part" -> em.createQuery("update InterventionPaymentAllocation a set a.confirmedAt=null where a.interventionId=20").executeUpdate();
                case "payout" -> em.persist(new HousekeeperPayoutRecord(7L,42L,10L,new BigDecimal("35"),BigDecimal.ZERO,HousekeeperPayoutRecord.Status.PENDING));
                case "missing-ledger" -> em.createQuery("delete from LedgerEntry e where e.referenceId='TX-batch:10'").executeUpdate();
                case "broken-ledger" -> em.createQuery("update LedgerEntry e set e.counterpartEntryId=null where e.referenceId='TX-batch:10'").executeUpdate();
                case "duplicate-funding", "legacy-refund" -> { var other=new PaymentTransaction(); other.setOrganizationId(7L); other.setTransactionRef("old");
                    other.setSourceType("INTERVENTION"); other.setSourceId(10L); other.setProviderType(PaymentProviderType.STRIPE);
                    other.setPaymentType(scenario.equals("legacy-refund") ? TransactionType.REFUND : TransactionType.CHECKOUT);
                    other.setStatus(TransactionStatus.COMPLETED); other.setAmount(new BigDecimal("35")); other.setCurrency("EUR"); em.persist(other); }
            }
            return null;
        });
        assertThatThrownBy(() -> tx(em -> service(em).prepare(7L,10L))).isInstanceOf(RuntimeException.class);
        long count=tx(em -> payments(em).findAll().stream().filter(p -> p.getTransactionRef().startsWith("REF-")).count());
        assertThat(count).isZero();
    }
    @Test void orgAndMissionNotInTheBatchCannotCreateRefunds() {
        assertThatThrownBy(() -> tx(em -> service(em).prepare(8L,10L))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> tx(em -> service(em).prepare(7L,99L))).isInstanceOf(IllegalStateException.class);
    }
    @Test void rollbackDoesNotLeaveAPartReserved() {
        assertThatThrownBy(() -> tx(em -> { service(em).prepare(7L,10L); throw new IllegalStateException("rollback"); })).hasMessage("rollback");
        Map<String,BigDecimal> manifest=tx(em -> service(em).manifest(original(em)));
        assertThat(manifest).isEmpty();
        String ref=tx(em -> service(em).prepare(7L,10L));
        assertThat(ref).startsWith("REF-");
    }
}
