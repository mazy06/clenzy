package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.service.payout.BaitlyTransferRecoveryStore;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;

/** Persistance et concurrence réelles ; aucune écriture dans le PMS de développement. */
class BaitlyTransferRecoveryPersistenceTest {
    static SessionFactory factory;
    Long refundId, transferId, recordId;
    @BeforeAll static void mapping() {
        var xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml, Intervention.class, Set.of("organizationId","paymentStatus","estimatedCost","currency","stripeSessionId"));
        xml.append("</entity-mappings>");
        factory = new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .addAnnotatedClass(PayoutTransfer.class).addAnnotatedClass(HousekeeperPayoutRecord.class).addAnnotatedClass(BaitlyTransferRecovery.class)
                .addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url","jdbc:h2:mem:transferrecovery;MODE=PostgreSQL;LOCK_TIMEOUT=5000")
                .setProperty("hibernate.hbm2ddl.auto","create-drop").setProperty("jakarta.persistence.validation.mode","none").buildSessionFactory();
    }
    @AfterAll static void close() { if(factory!=null) factory.close(); }
    <T> T tx(Function<EntityManager,T> action) {
        try(var em=factory.createEntityManager()) { em.getTransaction().begin();
            try { T result=action.apply(em); em.getTransaction().commit(); return result; }
            catch(RuntimeException e) { em.getTransaction().rollback(); throw e; }
        }
    }
    @BeforeEach void seed() {
        tx(em -> {
            for(var name:List.of("BaitlyTransferRecovery","PayoutTransfer","HousekeeperPayoutRecord","PaymentTransaction","Intervention"))
                em.createQuery("delete from "+name).executeUpdate();
            var mission=new Intervention(); mission.setId(364L); mission.setOrganizationId(7L); mission.setPaymentStatus(PaymentStatus.PAID);
            mission.setEstimatedCost(new BigDecimal("35")); mission.setCurrency("EUR"); mission.setStripeSessionId("cs_original"); em.persist(mission);
            var refund=RefundCreditNotePersistenceTest.transaction("REF-test",TransactionType.REFUND);
            refund.setStatus(TransactionStatus.PROCESSING); refund.setAmount(new BigDecimal("35"));
            refund.setProviderTxId("re_test"); em.persist(refund); refundId=refund.getId();
            var record=new HousekeeperPayoutRecord(7L,42L,364L,new BigDecimal("30"),new BigDecimal("5"),HousekeeperPayoutRecord.Status.SENT);
            record.setStripeTransferId("tr_test"); em.persist(record); recordId=record.getId();
            var transfer=new PayoutTransfer();
            Map<String,Object> values=Map.ofEntries(Map.entry("organizationId",7L),Map.entry("source",PayoutTransfer.Source.INTERVENTION),
                    Map.entry("sourceId",364L),Map.entry("beneficiaryUserId",42L),Map.entry("amount",new BigDecimal("30")),
                    Map.entry("currency","EUR"),Map.entry("provider","STRIPE"),Map.entry("destination","acct_provider"),
                    Map.entry("description","TEST SANDBOX"),Map.entry("idempotencyKey","payout-test"),
                    Map.entry("createdAt",Instant.now()));
            values.forEach((key,value)->ReflectionTestUtils.setField(transfer,key,value));
            transfer.transferred("tr_test"); transfer.captureDestinationPayment("py_test",false); em.persist(transfer); transferId=transfer.getId();
            return null;
        });
    }
    Long prepare(EntityManager em) {
        new BaitlyTransferRecoveryStore(em).prepareFullInterventionRefund(em.find(PaymentTransaction.class,refundId),new BigDecimal("35"));
        em.flush(); return em.createQuery("select id from BaitlyTransferRecovery",Long.class).getSingleResult();
    }
    @Test void fullRefundReservesOnlyProviderNetAndWaitsForConfirmedCustomerRefund() {
        Long id=tx(this::prepare);
        tx(em -> { var store=new BaitlyTransferRecoveryStore(em); assertThat(store.claim(7L,id)).isEmpty();
            assertThat(store.candidates()).isEmpty(); em.find(PaymentTransaction.class,refundId).setStatus(TransactionStatus.COMPLETED); return null; });
        tx(em -> { var store=new BaitlyTransferRecoveryStore(em); assertThat(store.candidates()).hasSize(1);
            var instruction=store.claim(7L,id).orElseThrow(); assertThat(instruction.amount()).isEqualByComparingTo("30");
            assertThat(store.claim(7L,id)).isEmpty(); store.confirm(7L,id,"trr_test"); store.confirm(7L,id,"trr_test");
            store.review(7L,id,"LATE_TIMEOUT"); assertThat(store.candidates()).isEmpty();
            assertThat(em.find(BaitlyTransferRecovery.class,id).getState()).isEqualTo(BaitlyTransferRecovery.State.RECOVERED);
            assertThat(em.find(PayoutTransfer.class,transferId).getState()).isEqualTo(PayoutTransfer.State.TRANSFERRED);
            assertThat(em.find(HousekeeperPayoutRecord.class,recordId).getAmount()).isEqualByComparingTo("30"); return null; });
    }
    @Test void companyRecipientUsesItsOriginalTransferEvidence() {
        tx(em -> { var record=em.find(HousekeeperPayoutRecord.class,recordId); record.setUserId(null); record.setBeneficiaryOrganizationId(9L);
            em.createNativeQuery("update payout_transfers set beneficiary_user_id=null,beneficiary_organization_id=9").executeUpdate(); return null; });
        assertThat(tx(this::prepare)).isNotNull();
    }

    @Test void refundingTheEntireRetainedBalanceRecoversTheResidualTransferOnly() {
        tx(em->{em.find(HousekeeperPayoutRecord.class,recordId).setCommissionAmount(BigDecimal.ZERO);
            em.find(PaymentTransaction.class,refundId).setAmount(new BigDecimal("30"));
            new BaitlyTransferRecoveryStore(em).prepareSeriesInterventionRefund(em.find(PaymentTransaction.class,refundId),new BigDecimal("30"));
            var row=em.createQuery("from BaitlyTransferRecovery",BaitlyTransferRecovery.class).getSingleResult();
            assertThat(row.getAmount()).isEqualByComparingTo("30");return null;});
    }

    @Test void partialRefundBeforeAnyTransferDoesNotInventARecovery() {
        tx(em->{em.remove(em.find(PayoutTransfer.class,transferId));em.remove(em.find(HousekeeperPayoutRecord.class,recordId));
            em.find(PaymentTransaction.class,refundId).setAmount(new BigDecimal("5"));
            new BaitlyTransferRecoveryStore(em).prepareSeriesInterventionRefund(em.find(PaymentTransaction.class,refundId),new BigDecimal("35"));
            assertThat(em.createQuery("select count(r) from BaitlyTransferRecovery r",Long.class).getSingleResult()).isZero();return null;});
    }

    @Test void successiveCentExactRefundsRecoverOnlyTheirShareThenTheRemainingNet() {
        tx(em -> { em.find(HousekeeperPayoutRecord.class,recordId).setCommissionAmount(BigDecimal.ZERO); return null; });
        BigDecimal remaining = new BigDecimal("30");
        var ids = new ArrayList<Long>();
        for (String amount : List.of("0.01","5.01","24.98")) {
            final BigDecimal before = remaining;
            Long id = tx(em -> {
                var refund = newRefund(em,amount);
                var store = new BaitlyTransferRecoveryStore(em);
                store.prepareSeriesInterventionRefund(refund,before);
                em.flush();
                return em.createQuery("select id from BaitlyTransferRecovery where refundId=:refund",Long.class)
                        .setParameter("refund",refund.getId()).getSingleResult();
            });
            final int priorCount = ids.size();
            tx(em -> {
                var store = new BaitlyTransferRecoveryStore(em);
                var order = store.claim(7L,id).orElseThrow();
                assertThat(order.amount()).isEqualByComparingTo(amount);
                assertThat(order.previous()).hasSize(priorCount);
                assertThat(order.previous()).allSatisfy(p -> {
                    assertThat(p.reference()).startsWith("trr_");
                    assertThat(p.metadata()).containsEntry("baitly_transfer_id",transferId.toString());
                });
                store.confirm(7L,id,"trr_"+id);
                assertThat(store.claim(7L,id)).isEmpty();
                return null;
            });
            ids.add(id); remaining = remaining.subtract(new BigDecimal(amount));
        }
        tx(em -> {
            BigDecimal total = em.createQuery("select sum(amount) from BaitlyTransferRecovery",BigDecimal.class).getSingleResult();
            assertThat(total).isEqualByComparingTo("30");
            assertThat(em.find(PayoutTransfer.class,transferId).getAmount()).isEqualByComparingTo("30");
            return null;
        });
    }

    @Test void uncertainPreviousRecoveryBlocksTheNextRefundBeforeAnyNewDecision() {
        tx(em -> { em.find(HousekeeperPayoutRecord.class,recordId).setCommissionAmount(BigDecimal.ZERO);
            new BaitlyTransferRecoveryStore(em).prepareSeriesInterventionRefund(newRefund(em,"5"),new BigDecimal("30")); return null; });
        assertThatThrownBy(() -> tx(em -> {
            new BaitlyTransferRecoveryStore(em).prepareSeriesInterventionRefund(newRefund(em,"5"),new BigDecimal("25")); return null;
        })).hasMessageContaining("récupération précédente");
        long count = tx(em -> em.createQuery("select count(r) from BaitlyTransferRecovery r",Long.class).getSingleResult());
        assertThat(count).isEqualTo(1);
    }

    @Test void partialRefundWithCommissionUsesTheFrozenNetAndCumulativeRounding() {
        // 30 € versés sur 35 € encaissés, avec 5 € de commission déjà retenue.
        BigDecimal remaining = new BigDecimal("35");
        String[][] installments = {{"5.01","4.29"},{"4.99","4.28"},{"25.00","21.43"}};
        for (var installment : installments) {
            BigDecimal before = remaining;
            tx(em -> {
                var refund = newRefund(em,installment[0]);
                var store = new BaitlyTransferRecoveryStore(em);
                store.prepareSeriesInterventionRefund(refund,before);
                store.prepareSeriesInterventionRefund(refund,before);
                em.flush();
                var row = em.createQuery("from BaitlyTransferRecovery where refundId=:refund",BaitlyTransferRecovery.class)
                        .setParameter("refund",refund.getId()).getSingleResult();
                assertThat(row.getAmount()).isEqualByComparingTo(installment[1]);
                assertThat(row.getCommissionRefundAmount()).isEqualByComparingTo(new BigDecimal(installment[0]).subtract(row.getAmount()));
                assertThat(row.getGrossBasis()).isEqualByComparingTo("35");
                var instruction = store.claim(7L,row.getId()).orElseThrow();
                assertThat(instruction.amount()).isEqualByComparingTo(installment[1]);
                store.confirm(7L,row.getId(),"trr_"+row.getId());
                return null;
            });
            remaining = remaining.subtract(new BigDecimal(installment[0]));
        }
        tx(em -> {
            assertThat(em.createQuery("select sum(amount) from BaitlyTransferRecovery",BigDecimal.class).getSingleResult())
                    .isEqualByComparingTo("30");
            assertThat(em.find(HousekeeperPayoutRecord.class,recordId).getCommissionAmount()).isEqualByComparingTo("5");
            assertThat(em.find(PayoutTransfer.class,transferId).getAmount()).isEqualByComparingTo("30");
            assertThat(em.createQuery("select sum(commissionRefundAmount) from BaitlyTransferRecovery",BigDecimal.class).getSingleResult())
                    .isEqualByComparingTo("5");
            return null;
        });
    }

    @Test void aCentCoveredByCommissionWaitsForRefundProofAndNeverCreatesAZeroReversal() {
        Long first = tx(em -> {
            em.find(HousekeeperPayoutRecord.class,recordId).setAmount(new BigDecimal("0.01"));
            em.find(HousekeeperPayoutRecord.class,recordId).setCommissionAmount(new BigDecimal("0.99"));
            em.createNativeQuery("update payout_transfers set amount=0.01").executeUpdate();
            var refund = em.find(PaymentTransaction.class,refundId); refund.setAmount(new BigDecimal("0.01"));
            var store = new BaitlyTransferRecoveryStore(em);
            store.prepareSeriesInterventionRefund(refund,new BigDecimal("1.00")); em.flush();
            return em.createQuery("select id from BaitlyTransferRecovery",Long.class).getSingleResult();
        });
        tx(em -> {
            var store = new BaitlyTransferRecoveryStore(em);
            assertThat(store.claim(7L,first)).isEmpty();
            assertThat(em.find(BaitlyTransferRecovery.class,first).getState()).isEqualTo(BaitlyTransferRecovery.State.WAITING_REFUND);
            var refund = em.find(PaymentTransaction.class,refundId); refund.setStatus(TransactionStatus.COMPLETED); refund.setProviderTxId(null);
            return null;
        });
        assertThatThrownBy(() -> tx(em -> new BaitlyTransferRecoveryStore(em).claim(7L,first)))
                .hasMessage("Remboursement Stripe non rapproché");
        tx(em -> { em.find(PaymentTransaction.class,refundId).setProviderTxId("re_cent"); return null; });
        tx(em -> {
            var store = new BaitlyTransferRecoveryStore(em);
            assertThat(store.candidates()).hasSize(1);
            assertThat(store.claim(7L,first)).isEmpty();
            assertThat(store.claim(7L,first)).isEmpty();
            var row = em.find(BaitlyTransferRecovery.class,first);
            assertThat(row.getState()).isEqualTo(BaitlyTransferRecovery.State.NO_RECOVERY_REQUIRED);
            assertThat(row.getFirstAttemptAt()).isNull(); assertThat(row.getReversalReference()).isNull();
            assertThat(row.getCommissionRefundAmount()).isEqualByComparingTo("0.01");
            assertThatThrownBy(() -> row.confirm("trr_false")).isInstanceOf(IllegalStateException.class);
            assertThatThrownBy(row::cancel).isInstanceOf(IllegalStateException.class);
            assertThat(store.candidates()).isEmpty();
            var last = newRefund(em,"0.99"); store.prepareSeriesInterventionRefund(last,new BigDecimal("0.99")); em.flush();
            var lastRow = em.createQuery("from BaitlyTransferRecovery where refundId=:id",BaitlyTransferRecovery.class)
                    .setParameter("id",last.getId()).getSingleResult();
            var instruction = store.claim(7L,lastRow.getId()).orElseThrow();
            assertThat(instruction.amount()).isEqualByComparingTo("0.01");
            assertThat(instruction.previous()).isEmpty();
            assertThat(lastRow.getCommissionRefundAmount()).isEqualByComparingTo("0.98");
            store.confirm(7L,lastRow.getId(),"trr_last_cent"); return null;
        });
    }

    @Test void changedCommissionBasisOrHistoricalAllocationBlocksTheNextRefund() {
        tx(em -> {
            var store = new BaitlyTransferRecoveryStore(em); store.prepareSeriesInterventionRefund(newRefund(em,"5"),new BigDecimal("35")); em.flush();
            var row = em.createQuery("from BaitlyTransferRecovery",BaitlyTransferRecovery.class).getSingleResult();
            store.claim(7L,row.getId()); store.confirm(7L,row.getId(),"trr_first");
            em.find(HousekeeperPayoutRecord.class,recordId).setCommissionAmount(new BigDecimal("5.01")); return null;
        });
        assertThatThrownBy(() -> tx(em -> {
            new BaitlyTransferRecoveryStore(em).prepareSeriesInterventionRefund(newRefund(em,"5"),new BigDecimal("30.01")); return null;
        })).hasMessageContaining("répartition");
        tx(em -> { em.find(HousekeeperPayoutRecord.class,recordId).setCommissionAmount(new BigDecimal("5"));
            em.createNativeQuery("update baitly_transfer_recoveries set amount=4.28,commission_refund_amount=0.72").executeUpdate(); return null; });
        assertThatThrownBy(() -> tx(em -> {
            new BaitlyTransferRecoveryStore(em).prepareSeriesInterventionRefund(newRefund(em,"5"),new BigDecimal("30")); return null;
        })).hasMessageContaining("répartition");
    }

    @ParameterizedTest @ValueSource(strings={"0.01","0.08","0.16"})
    void centByCentRefundsNeverOverdrawEitherShareAndExhaustBothExactly(String originalNet) {
        BigDecimal net = new BigDecimal(originalNet), gross = new BigDecimal("0.17");
        tx(em -> {
            var record = em.find(HousekeeperPayoutRecord.class,recordId);
            record.setAmount(net); record.setCommissionAmount(gross.subtract(net));
            em.createNativeQuery("update payout_transfers set amount=:net").setParameter("net",net).executeUpdate(); return null;
        });
        BigDecimal recovered = BigDecimal.ZERO, commission = BigDecimal.ZERO;
        int proofCount = 0;
        for (int cent=0; cent<17; cent++) {
            BigDecimal remaining = gross.subtract(BigDecimal.valueOf(cent,2));
            final int priorProofs = proofCount;
            var shares = tx(em -> {
                var store = new BaitlyTransferRecoveryStore(em);
                var refund = newRefund(em,"0.01"); store.prepareSeriesInterventionRefund(refund,remaining); em.flush();
                var row = em.createQuery("from BaitlyTransferRecovery where refundId=:id",BaitlyTransferRecovery.class)
                        .setParameter("id",refund.getId()).getSingleResult();
                var instruction = store.claim(7L,row.getId());
                if (row.getAmount().signum() == 0) {
                    assertThat(instruction).isEmpty();
                    assertThat(row.getState()).isEqualTo(BaitlyTransferRecovery.State.NO_RECOVERY_REQUIRED);
                } else {
                    assertThat(instruction.orElseThrow().previous()).hasSize(priorProofs);
                    store.confirm(7L,row.getId(),"trr_"+row.getId());
                }
                var projection = com.clenzy.dto.PayoutTransferDto.Recovery.from(row);
                assertThat(projection.amount().add(projection.commissionRefundAmount())).isEqualByComparingTo("0.01");
                return List.of(row.getAmount(),row.getCommissionRefundAmount());
            });
            recovered = recovered.add(shares.getFirst()); commission = commission.add(shares.get(1));
            assertThat(shares).allMatch(v -> v.signum() >= 0);
            assertThat(recovered).isLessThanOrEqualTo(net);
            assertThat(commission).isLessThanOrEqualTo(gross.subtract(net));
            if (shares.getFirst().signum()>0) proofCount++;
        }
        assertThat(recovered).isEqualByComparingTo(net);
        assertThat(commission).isEqualByComparingTo(gross.subtract(net));
    }

    @Test void anUntrackedRefundCannotShrinkThePostTransferBudget() {
        tx(em -> { em.find(HousekeeperPayoutRecord.class,recordId).setCommissionAmount(BigDecimal.ZERO); return null; });
        assertThatThrownBy(() -> tx(em -> {
            new BaitlyTransferRecoveryStore(em).prepareSeriesInterventionRefund(newRefund(em,"5"),new BigDecimal("25")); return null;
        })).hasMessageContaining("solde après reversement");
    }

    private PaymentTransaction newRefund(EntityManager em, String amount) {
        var refund = RefundCreditNotePersistenceTest.transaction("REF-"+UUID.randomUUID(),TransactionType.REFUND);
        refund.setStatus(TransactionStatus.COMPLETED); refund.setAmount(new BigDecimal(amount));
        refund.setProviderTxId("re_"+UUID.randomUUID()); em.persist(refund); em.flush(); return refund;
    }
    @Test void missingRefundProofNeverClaimsProviderMoney() {
        Long id=tx(this::prepare);
        tx(em -> { var refund=em.find(PaymentTransaction.class,refundId); refund.setStatus(TransactionStatus.COMPLETED);
            refund.setProviderTxId(null); return null; });
        assertThatThrownBy(()->tx(em -> new BaitlyTransferRecoveryStore(em).claim(7L,id)))
            .hasMessage("Remboursement Stripe non rapproché");
        Instant attempted = tx(em -> em.find(BaitlyTransferRecovery.class,id).getFirstAttemptAt());
        assertThat(attempted).isNull();
    }
    @Test void rejectedCustomerRefundNeverRecoversProvidersMoney() {
        Long id=tx(this::prepare);
        tx(em -> { em.find(PaymentTransaction.class,refundId).setStatus(TransactionStatus.FAILED); return null; });
        tx(em -> { var store=new BaitlyTransferRecoveryStore(em); assertThat(store.claim(7L,id)).isEmpty();
            assertThat(em.find(BaitlyTransferRecovery.class,id).getState()).isEqualTo(BaitlyTransferRecovery.State.CANCELLED);
            assertThat(em.find(BaitlyTransferRecovery.class,id).getFirstAttemptAt()).isNull(); return null; });
    }
    @Test void foreignOrganizationCannotClaimConfirmOrReadRecovery() {
        Long id=tx(this::prepare);
        assertThatThrownBy(()->tx(em -> new BaitlyTransferRecoveryStore(em).claim(8L,id))).isInstanceOf(jakarta.persistence.NoResultException.class);
        assertThatThrownBy(()->tx(em -> { new BaitlyTransferRecoveryStore(em).confirm(8L,id,"trr_other"); return null; })).isInstanceOf(jakarta.persistence.NoResultException.class);
    }
    @ParameterizedTest @ValueSource(strings={"pending","wrong-recipient","wrong-net","wrong-fee","wrong-ref","journal-missing","uncertain","missing-live","currency","partial","foreign-mission"})
    void incompatibleDisbursementRollsBackDecision(String defect) {
        tx(em -> { var record=em.find(HousekeeperPayoutRecord.class,recordId);
            switch(defect) {
                case "pending" -> record.setStatus(HousekeeperPayoutRecord.Status.PENDING);
                case "wrong-recipient" -> record.setUserId(43L);
                case "wrong-net" -> record.setAmount(new BigDecimal("31"));
                case "wrong-fee" -> record.setCommissionAmount(BigDecimal.ZERO);
                case "wrong-ref" -> record.setStripeTransferId("tr_other");
                case "journal-missing" -> em.remove(em.find(PayoutTransfer.class,transferId));
                case "uncertain" -> em.createNativeQuery("update payout_transfers set state='SUBMITTING'").executeUpdate();
                case "missing-live" -> em.createNativeQuery("update payout_transfers set stripe_livemode=null").executeUpdate();
                case "currency" -> em.find(PaymentTransaction.class,refundId).setCurrency("USD");
                case "partial" -> em.find(PaymentTransaction.class,refundId).setAmount(BigDecimal.ONE);
                case "foreign-mission" -> em.find(Intervention.class,364L).setOrganizationId(8L);
            } return null; });
        assertThatThrownBy(()->tx(this::prepare)).isInstanceOf(RuntimeException.class);
        long count=tx(em -> em.createQuery("select count(r) from BaitlyTransferRecovery r",Long.class).getSingleResult());
        assertThat(count).isZero();
    }
    @Test void concurrentRefundPreparationsShareOneRecovery() throws Exception {
        var ready=new CountDownLatch(1); var release=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(()->tx(em -> { Long id=prepare(em); ready.countDown();
                try { if(!release.await(5,TimeUnit.SECONDS)) throw new IllegalStateException("timeout"); }
                catch(InterruptedException e) { throw new IllegalStateException(e); } return id; }));
            assertThat(ready.await(5,TimeUnit.SECONDS)).isTrue();
            var second=pool.submit(()->tx(this::prepare));
            try { assertThatThrownBy(()->second.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class); }
            finally { release.countDown(); }
            assertThat(first.get(5,TimeUnit.SECONDS)).isEqualTo(second.get(5,TimeUnit.SECONDS));
        } finally { release.countDown(); }
    }
}
