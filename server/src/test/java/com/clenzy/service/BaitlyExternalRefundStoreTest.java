package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
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

/** Persistance, verrous, contre-écritures et outbox réels ; le relais réseau n'est pas démarré. */
class BaitlyExternalRefundStoreTest {
    static SessionFactory factory;
    static String jdbc,user,schema;
    final TenantContext tenant=mock(TenantContext.class);
    final OutboxPublisher outbox=mock(OutboxPublisher.class);
    @BeforeAll static void mapping() throws Exception {
        jdbc=System.getProperty("baitly.test.jdbc"); user=System.getProperty("baitly.test.user","postgres");
        if(jdbc!=null) {
            assertThat(jdbc).matches("jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*");
            schema="baitly_external_"+UUID.randomUUID().toString().replace("-","");
            try(var c=java.sql.DriverManager.getConnection(jdbc,user,"");var s=c.createStatement()) { s.execute("CREATE SCHEMA "+schema); }
        }
        var xml=new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml,Intervention.class,Set.of("organizationId","paymentStatus","estimatedCost","currency","stripeSessionId"));
        xml.append("</entity-mappings>");
        var mapped=xml.toString().replace("<attributes>","<table name=\"interventions\"/><attributes>");
        for(String field:List.of("organizationId","paymentStatus","estimatedCost","stripeSessionId")) {
            String column=field.replaceAll("([a-z])([A-Z])","$1_$2").toLowerCase(Locale.ROOT);
            mapped=mapped.replace("<basic name=\""+field+"\">","<basic name=\""+field+"\"><column name=\""+column+"\"/>");
        }
        factory=new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .addAnnotatedClass(InterventionPaymentAllocation.class).addAnnotatedClass(LedgerEntry.class)
                .addAnnotatedClass(HousekeeperPayoutRecord.class).addAnnotatedClass(PayoutTransfer.class).addAnnotatedClass(BaitlyTransferRecovery.class)
                .addAnnotatedClass(Invoice.class).addAnnotatedClass(InvoiceLine.class).addAnnotatedClass(InvoiceNumberSequence.class).addAnnotatedClass(BaitlyInvoiceIssuerSequence.class)
                .addAnnotatedClass(OutboxEvent.class)
                .addInputStream(new ByteArrayInputStream(mapped.getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url",jdbc==null?"jdbc:h2:mem:externalrefund;MODE=PostgreSQL;LOCK_TIMEOUT=5000"
                        :jdbc+(jdbc.contains("?")?"&":"?")+"currentSchema="+schema)
                .setProperty("hibernate.connection.username",jdbc==null?"sa":user)
                .setProperty("jakarta.persistence.validation.mode","none").setProperty("hibernate.hbm2ddl.auto","create-drop").buildSessionFactory();
    }
    @AfterAll static void close() throws Exception {
        if(factory!=null) factory.close();
        if(schema!=null) try(var c=java.sql.DriverManager.getConnection(jdbc,user,"");var s=c.createStatement()) { s.execute("DROP SCHEMA "+schema+" CASCADE"); }
    }
    <T> T tx(Function<EntityManager,T> f) { try(var em=factory.createEntityManager()) { em.getTransaction().begin();
        try { T result=f.apply(em); em.getTransaction().commit(); return result; } catch(RuntimeException e) { em.getTransaction().rollback(); throw e; } } }
    PaymentTransactionRepository payments(EntityManager em) { return new JpaRepositoryFactory(em).getRepository(PaymentTransactionRepository.class); }
    Wallet wallet(Long id) { var w=new Wallet(); w.setId(id); w.setOrganizationId(7L); w.setCurrency("EUR"); return w; }
    BaitlyExternalRefundProof proof(String status, String amount) { return new BaitlyExternalRefundProof(7L,"TX-original","cs_original","INTERVENTION",364L,
            new BigDecimal("45"),"EUR","re_external","pi_original",new BigDecimal(amount),status); }
    BaitlyExternalRefundStore service(EntityManager em) {
        var repo=payments(em);
        var coordination=new InterventionPaymentCoordination(em,repo,mock(ServiceQuoteRepository.class),mock(CurrencyConverterService.class)) {
            @Override public void requireRefundOutsideCancellationCase(PaymentTransaction p) { /* Requête PostgreSQL couverte séparément par la recette existante. */ }
        };
        var locks=new BaitlyBatchRefundPersistence(em,repo,coordination, org.mockito.Mockito.mock(com.clenzy.service.payout.BaitlyTransferRecoveryStore.class));
        var transitions=mock(PaymentStatusTransitionService.class);
        doAnswer(c -> { em.find(Intervention.class,c.getArgument(0)).setPaymentStatus(PaymentStatus.REFUNDED); return true; })
                .when(transitions).markInterventionRefunded(anyLong());
        var ledgerRepo=new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class);
        var missionRepo=mock(InterventionRepository.class);
        when(missionRepo.findById(anyLong())).thenAnswer(c -> Optional.ofNullable(em.find(Intervention.class,c.getArgument(0))));
        var wallets=mock(WalletService.class); when(wallets.getWalletById(anyLong())).thenAnswer(c -> wallet(c.getArgument(0)));
        var reversal=new PaymentLedgerReversalService(missionRepo,ledgerRepo,new LedgerService(ledgerRepo),wallets);
        var reconciliation=new InterventionRefundReconciliationService(repo,coordination,transitions,reversal,tenant,locks);
        var durableOutbox=new OutboxPublisher(new JpaRepositoryFactory(em).getRepository(OutboxEventRepository.class)) {
            @Override public void publish(String aggregate,String id,String type,String topic,String key,String payload,Long org) {
                outbox.publish(aggregate,id,type,topic,key,payload,org);
                super.publish(aggregate,id,type,topic,key,payload,org);
            }
        };
        var persistence=new PaymentPersistence(repo,durableOutbox,new ObjectMapper(),mock(DepositReconciler.class),coordination,mock(InvoicePaymentCoordination.class), org.mockito.Mockito.mock(com.clenzy.service.payout.BaitlyTransferRecoveryStore.class));
        return new BaitlyExternalRefundStore(em,repo,tenant,new BaitlyExternalRefundEligibility(em,repo,coordination,locks,
                new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em)),persistence,reconciliation,mock(BaitlyExternalReservationRefunds.class),
                new BaitlyExternalBatchRefunds(em,repo,locks,coordination,new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em)),mock(com.clenzy.service.ai.BaitlyCreditFunding.class));
    }
    @BeforeEach void seed() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        tx(em -> {
            for(String entity:List.of("OutboxEvent","InvoiceLine","Invoice","InvoiceNumberSequence","BaitlyInvoiceIssuerSequence","BaitlyTransferRecovery","PayoutTransfer","HousekeeperPayoutRecord","LedgerEntry","InterventionPaymentAllocation","PaymentTransaction","Intervention")) em.createQuery("delete from "+entity).executeUpdate();
            em.createNativeQuery("DELETE FROM housekeeper_payout_records").executeUpdate(); em.createNativeQuery("DELETE FROM invoices").executeUpdate();
            var p=RefundCreditNotePersistenceTest.transaction("TX-original",TransactionType.CHECKOUT); p.setProviderTxId("cs_original"); em.persist(p);
            var mission=new Intervention(); mission.setId(364L); mission.setOrganizationId(7L); mission.setEstimatedCost(new BigDecimal("45"));
            mission.setCurrency("EUR"); mission.setStripeSessionId("cs_original"); mission.setPaymentStatus(PaymentStatus.PAID); em.persist(mission);
            var ledger=new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class));
            ledger.recordTransfer(wallet(1L),wallet(2L),new BigDecimal("45"),LedgerReferenceType.PAYMENT,"364","Paiement intervention #364");
            ledger.recordTransfer(wallet(2L),wallet(3L),new BigDecimal("44.5"),LedgerReferenceType.SPLIT,"SPLIT-INTERVENTION-364","Répartition"); return null;
        });
    }
    @Test void canonicalExternalFullRefundUpdatesOneMissionAndBalancesTheJournalOnce() {
        var p=proof("succeeded","45"); tx(em -> service(em).observe(p)); tx(em -> service(em).complete(p));
        tx(em -> service(em).observe(p)); tx(em -> service(em).complete(p));
        tx(em -> {
            var refund=payments(em).findByProviderTxId("re_external").orElseThrow();
            assertThat(refund.getStatus()).isEqualTo(TransactionStatus.COMPLETED); assertThat(BaitlyExternalRefundStore.confirmed(refund)).isTrue();
            assertThat(PaymentPersistence.managedRefund(refund)).isFalse();
            assertThat(em.find(Intervention.class,364L).getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
            assertThat(payments(em).count()).isEqualTo(2);
            var entries=em.createQuery("from LedgerEntry",LedgerEntry.class).getResultList(); assertThat(entries).hasSize(8);
            assertThat(new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).calculateBalance(3L)).isZero(); return null;
        });
        verify(outbox,times(1)).publish(any(),any(),eq("PAYMENT_REFUNDED"),any(),any(),any(),eq(7L));
    }

    @Test void refundingTheRemainingBalanceAfterExternalPartialClearsTheLedgerExactlyOnce() {
        var p=proof("succeeded","5");tx(em->service(em).observe(p));tx(em->service(em).complete(p));
        tx(em->{var refund=RefundCreditNotePersistenceTest.transaction("REF-balance",TransactionType.REFUND);
            refund.setAmount(new BigDecimal("40"));refund.setProviderTxId("re_balance");
            refund.setMetadata(Map.of("managedRefund",true,"cumulativeRefund",true,"originalTransactionRef","TX-original","refundBefore","5"));em.persist(refund);return null;});
        for(int replay=0;replay<2;replay++) tx(em->{
            var repo=payments(em);var coordination=new InterventionPaymentCoordination(em,repo,mock(ServiceQuoteRepository.class),mock(CurrencyConverterService.class));
            var ledgerRepo=new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class);
            var wallets=mock(WalletService.class);when(wallets.getWalletById(anyLong())).thenAnswer(c->wallet(c.getArgument(0)));
            var reversal=new PaymentLedgerReversalService(mock(InterventionRepository.class),ledgerRepo,new LedgerService(ledgerRepo),wallets);
            new InterventionRefundReconciliationService(repo,coordination,mock(PaymentStatusTransitionService.class),reversal,tenant,
                    mock(BaitlyBatchRefundPersistence.class)).reconcile("REF-balance");
            assertThat(em.find(Intervention.class,364L).getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
            var ledger=new LedgerService(ledgerRepo);assertThat(ledger.calculateBalance(1L)).isZero();
            assertThat(ledger.calculateBalance(2L)).isZero();assertThat(ledger.calculateBalance(3L)).isZero();
            assertThat(em.createQuery("select count(e) from LedgerEntry e",Long.class).getSingleResult()).isEqualTo(12);return null;});
    }
    @ParameterizedTest @ValueSource(strings={"pending","failed","canceled","requires_action"})
    void observationsNeverCreateFinancialEffects(String status) {
        tx(em -> service(em).observe(proof(status,"45")));
        tx(em -> { assertThat(em.find(Intervention.class,364L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(em.createQuery("select count(e) from LedgerEntry e",Long.class).getSingleResult()).isEqualTo(4); return null; });
        verifyNoInteractions(outbox);
    }
    @ParameterizedTest @ValueSource(strings={"payout","unpaid","amount","currency","session","other-org","other-funding","missing-ledger","broken-ledger","refunded-ledger","changed-original"})
    void unsupportedCasesKeepTheProofWithoutChangingMoney(String defect) {
        var p=proof("succeeded","45"); tx(em -> service(em).observe(p));
        tx(em -> {
            var mission=em.find(Intervention.class,364L);
            switch(defect) {
                case "payout" -> em.persist(new HousekeeperPayoutRecord(7L,42L,364L,new BigDecimal("40"),new BigDecimal("5"),HousekeeperPayoutRecord.Status.PENDING));
                case "unpaid" -> mission.setPaymentStatus(PaymentStatus.PENDING);
                case "amount" -> mission.setEstimatedCost(BigDecimal.ONE);
                case "currency" -> mission.setCurrency("USD");
                case "session" -> mission.setStripeSessionId("cs_other");
                case "other-org" -> mission.setOrganizationId(8L);
                case "other-funding" -> em.persist(RefundCreditNotePersistenceTest.transaction("TX-second",TransactionType.CHECKOUT));
                case "missing-ledger" -> em.createQuery("delete from LedgerEntry").executeUpdate();
                case "broken-ledger" -> em.createQuery("update LedgerEntry set counterpartEntryId=null").executeUpdate();
                case "refunded-ledger" -> new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class))
                        .recordTransfer(wallet(2L),wallet(1L),new BigDecimal("45"),LedgerReferenceType.REFUND,"REFUND-INTERVENTION-364","Ancien remboursement");
                case "changed-original" -> payments(em).findByTransactionRef("TX-original").orElseThrow().setAmount(BigDecimal.TEN);
            } return null;
        });
        assertThatThrownBy(() -> tx(em -> service(em).complete(p))).isInstanceOf(RuntimeException.class);
        tx(em -> { assertThat(payments(em).findByProviderTxId("re_external").orElseThrow().getStatus()).isEqualTo(TransactionStatus.PROCESSING); return null; });
        verifyNoInteractions(outbox);
    }
    @ParameterizedTest @ValueSource(strings={"45","5"})
    void outboxFailureRollsBackStatusAndReversalButKeepsObservedProof(String amount) {
        var p=proof("succeeded",amount); tx(em -> service(em).observe(p));
        doThrow(new IllegalStateException("outbox")).when(outbox).publish(any(),any(),any(),any(),any(),any(),any());
        assertThatThrownBy(() -> tx(em -> service(em).complete(p))).hasMessage("outbox");
        tx(em -> { assertThat(payments(em).findByProviderTxId("re_external").orElseThrow().getStatus()).isEqualTo(TransactionStatus.PROCESSING);
            assertThat(em.find(Intervention.class,364L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(em.createQuery("select count(e) from LedgerEntry e",Long.class).getSingleResult()).isEqualTo(4); return null; });
        reset(outbox); tx(em -> service(em).complete(p));
    }
    @ParameterizedTest @ValueSource(strings={"5","0.01","44.99"})
    void onePartialRefundReversesOnlyItsProportionAndSurvivesReplay(String amount) {
        var p=proof("succeeded",amount);
        tx(em -> service(em).observe(p)); tx(em -> service(em).complete(p));
        tx(em -> service(em).observe(p)); tx(em -> service(em).complete(p));
        tx(em -> {
            assertThat(em.find(Intervention.class,364L).getPaymentStatus()).isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);
            var refund=payments(em).findByProviderTxId("re_external").orElseThrow();
            assertThat(refund.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            assertThat(refund.getMetadata()).containsEntry("reviewRequired",false);
            var ledger=new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class));
            assertThat(ledger.calculateBalance(1L)).isEqualByComparingTo(new BigDecimal(amount).subtract(new BigDecimal("45")));
            var share=new BigDecimal("44.5").multiply(new BigDecimal(amount)).divide(new BigDecimal("45"),2,java.math.RoundingMode.HALF_UP);
            assertThat(ledger.calculateBalance(3L)).isEqualByComparingTo(new BigDecimal("44.5").subtract(share));
            var rows=em.createQuery("from LedgerEntry e where e.referenceType=com.clenzy.model.LedgerReferenceType.REFUND",LedgerEntry.class).getResultList();
            assertThat(rows).hasSize(4);
            assertThat(rows).allMatch(e -> e.getReferenceId().equals(refund.getTransactionRef()));
            assertThat(rows.stream().filter(e -> e.getEntryType()==LedgerEntryType.DEBIT).map(LedgerEntry::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add))
                    .isEqualByComparingTo(new BigDecimal(amount).add(share));
            return null;
        });
        verify(outbox,times(1)).publish(any(),any(),eq("PAYMENT_REFUNDED"),any(),any(),any(),eq(7L));
    }

    @Test void partialRefundRequiresTheCompleteCanonicalSnapshotBeforeAnotherExternalDecision() {
        var p=proof("succeeded","5"); tx(em -> service(em).observe(p)); tx(em -> service(em).complete(p));
        var second=new BaitlyExternalRefundProof(7L,"TX-original","cs_original","INTERVENTION",364L,
                new BigDecimal("45"),"EUR","re_other","pi_original",new BigDecimal("40"),"succeeded");
        tx(em -> service(em).observe(second));
        assertThatThrownBy(() -> tx(em -> service(em).complete(second))).isInstanceOf(RuntimeException.class);
        tx(em -> { assertThat(payments(em).findByProviderTxId("re_other").orElseThrow().getStatus()).isEqualTo(TransactionStatus.PROCESSING); return null; });
        tx(em -> service(em).complete(second,List.of(p,second)));
        assertZeroBalances();
    }
    BaitlyExternalRefundProof extra(String id,String amount) {
        return new BaitlyExternalRefundProof(7L,"TX-original","cs_original","INTERVENTION",364L,
                new BigDecimal("45"),"EUR",id,"pi_original",new BigDecimal(amount),"succeeded");
    }
    void assertZeroBalances() {
        tx(em -> {
            var ledger=new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class));
            for(Long wallet:List.of(1L,2L,3L)) assertThat(ledger.calculateBalance(wallet)).isZero();
            assertThat(em.find(Intervention.class,364L).getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED); return null;
        });
    }
    @Test void outOfOrderObservationsReconcileInLocalOrderWithoutLosingCentsOrDuplicatingProofs() {
        var first=proof("succeeded","5.01"); var second=extra("re_second","4.99"); var last=extra("re_last","35");
        var snapshot=List.of(first,second,last);
        tx(em -> service(em).observe(second)); tx(em -> service(em).observe(first)); tx(em -> service(em).observe(last));
        assertThatThrownBy(() -> tx(em -> service(em).complete(first,snapshot))).hasMessageContaining("précédent");
        List<BaitlyExternalRefundProof> ordered=tx(em -> service(em).orderedExternal(snapshot));
        assertThat(ordered).containsExactly(second,first,last);
        for(var p:List.of(second,first,last)) tx(em -> service(em).complete(p,snapshot));
        for(var p:snapshot) { tx(em -> service(em).observe(p)); tx(em -> service(em).complete(p,snapshot)); }
        assertZeroBalances();
        tx(em -> { assertThat(payments(em).count()).isEqualTo(4);
            assertThat(em.createQuery("select count(e) from LedgerEntry e",Long.class).getSingleResult()).isEqualTo(16); return null; });
        verify(outbox,times(3)).publish(any(),any(),eq("PAYMENT_REFUNDED"),any(),any(),any(),eq(7L));
    }
    @Test void realExternalSeriesReleasesOnlyTheReconciledRemainderAndSuspendsItOnReview() {
        var first=proof("succeeded","5.01"); var second=extra("re_second","4.99"); var snapshot=List.of(first,second);
        for(var p:snapshot) tx(em -> service(em).observe(p));
        tx(em -> service(em).complete(first,snapshot));
        tx(em -> { assertThat(new com.clenzy.service.payout.BaitlyResidualPayoutFunding(em,payments(em),mock(BaitlyBatchRefundPersistence.class))
                .available(em.find(Intervention.class,364L))).isEmpty(); return null; });
        tx(em -> service(em).complete(second,snapshot));
        tx(em -> { assertThat(new com.clenzy.service.payout.BaitlyResidualPayoutFunding(em,payments(em),mock(BaitlyBatchRefundPersistence.class))
                .available(em.find(Intervention.class,364L))).contains(new BigDecimal("35.00")); return null; });
        tx(em -> service(em).review("EXT-re_second"));
        tx(em -> { assertThat(new com.clenzy.service.payout.BaitlyResidualPayoutFunding(em,payments(em),mock(BaitlyBatchRefundPersistence.class))
                .available(em.find(Intervention.class,364L))).isEmpty(); return null; });
    }
    @Test void successiveExternalRefundsWaitForEachProviderRecoveryAndRecoverTheNetExactly() {
        providerTransferred();
        var first=proof("succeeded","5.01"); var second=extra("re_second","4.99"); var last=extra("re_last","35");
        var snapshot=List.of(first,second,last);
        for(var p:snapshot) tx(em -> service(em).observe(p));
        tx(em -> service(em).complete(first,snapshot));
        assertThatThrownBy(() -> tx(em -> service(em).complete(second,snapshot))).isInstanceOf(RuntimeException.class);
        for(var p:snapshot) {
            tx(em -> service(em).complete(p,snapshot));
            tx(em -> {
                var refund=payments(em).findByProviderTxId(p.refundId()).orElseThrow();
                var recovery=em.createQuery("from BaitlyTransferRecovery r where r.refundId=:id",BaitlyTransferRecovery.class)
                        .setParameter("id",refund.getId()).getSingleResult();
                var store=new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em);
                assertThat(store.claim(7L,recovery.getId())).isPresent(); store.confirm(7L,recovery.getId(),"trr_"+p.refundId());
                assertThat(store.claim(7L,recovery.getId())).isEmpty(); return null;
            });
        }
        assertZeroBalances();
        tx(em -> {
            var rows=em.createQuery("from BaitlyTransferRecovery order by id",BaitlyTransferRecovery.class).getResultList();
            assertThat(rows).hasSize(3);
            assertThat(rows.stream().map(BaitlyTransferRecovery::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("40");
            assertThat(rows.stream().map(BaitlyTransferRecovery::getCommissionRefundAmount).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("5");
            return null;
        });
    }
    @ParameterizedTest @ValueSource(strings={"failed","canceled"})
    void rejectedExternalAttemptDoesNotConsumeBudgetOrCreateAnAccountingEvent(String status) {
        var rejected=proof(status,"45"); var accepted=extra("re_accepted","45");
        tx(em -> service(em).observe(rejected)); tx(em -> service(em).observe(accepted));
        tx(em -> service(em).complete(accepted,List.of(accepted)));
        assertZeroBalances();
        tx(em -> {
            assertThat(payments(em).findByProviderTxId(rejected.refundId()).orElseThrow().getStatus()).isEqualTo(TransactionStatus.FAILED);
            assertThat(em.createQuery("select count(e) from OutboxEvent e",Long.class).getSingleResult()).isEqualTo(1);
            return null;
        });
    }
    @Test void externalSeriesCreatesDistinctCreditsWhoseTaxesAndLinesCancelTheOriginalExactly() {
        Long invoiceId=tx(em -> {
            var invoice=new Invoice();invoice.setBuyerName("Destinataire TEST");invoice.setSellerName("Émetteur test");invoice.setSellerAddress("1 rue de la Simulation, Paris");invoice.setSellerTaxId("FR-TEST-ONLY"); invoice.setOrganizationId(7L); invoice.setInvoiceNumber("FA-ORIGINAL");
            invoice.setInvoiceDate(java.time.LocalDate.now()); invoice.setStatus(InvoiceStatus.PAID); invoice.setInvoiceType(InvoiceType.GUEST);
            invoice.setInterventionId(364L); invoice.setPaymentTransactionId(payments(em).findByTransactionRef("TX-original").orElseThrow().getId());
            invoice.setCurrency("EUR"); invoice.setTotalHt(new BigDecimal("38.64")); invoice.setTotalTax(new BigDecimal("6.36")); invoice.setTotalTtc(new BigDecimal("45"));
            invoice.addLine(RefundCreditNotePersistenceTest.line(1,"25","5","30","0.20"));
            invoice.addLine(RefundCreditNotePersistenceTest.line(2,"13.64","1.36","15","0.10")); em.persist(invoice);
            em.persist(new InvoiceNumberSequence(7L,"FA",java.time.LocalDate.now().getYear())); return invoice.getId();
        });
        var snapshot=List.of(proof("succeeded","5.01"),extra("re_second","4.99"),extra("re_last","35"));
        for(var p:snapshot) tx(em -> service(em).observe(p));
        for(var p:snapshot) {
            tx(em -> service(em).complete(p,snapshot));
            for(int replay=0;replay<2;replay++) tx(em -> {
                var factory=new JpaRepositoryFactory(em);
                var notes=new RefundCreditNoteService(em,factory.getRepository(InvoiceRepository.class),payments(em),
                        new InvoiceNumberingService(factory.getRepository(InvoiceNumberSequenceRepository.class),tenant,em),tenant,
                        mock(BaitlyBatchRefundPersistence.class));
                return notes.reconcile("EXT-"+p.refundId());
            });
        }
        tx(em -> {
            var notes=em.createQuery("from Invoice i where i.originalInvoiceId=:id",Invoice.class).setParameter("id",invoiceId).getResultList();
            assertThat(notes).hasSize(3);
            assertThat(notes.stream().map(Invoice::getRefundTransactionId).distinct()).hasSize(3);
            assertThat(notes.stream().map(Invoice::getTotalTtc).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("-45");
            assertThat(notes.stream().map(Invoice::getTotalTax).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("-6.36");
            for(var original:em.find(Invoice.class,invoiceId).getLines()) {
                var lines=notes.stream().flatMap(n -> n.getLines().stream()).filter(l -> Objects.equals(l.getLineNumber(),original.getLineNumber())).toList();
                assertThat(lines.stream().map(InvoiceLine::getTotalTtc).reduce(original.getTotalTtc(),BigDecimal::add)).isZero();
                assertThat(lines.stream().map(InvoiceLine::getTaxAmount).reduce(original.getTaxAmount(),BigDecimal::add)).isZero();
            }
            return null;
        });
    }
    @ParameterizedTest @ValueSource(strings={"INTERVENTION_BATCH","SERVICE_REQUEST"})
    void otherSourcesAreHeldEvenWhenTheirRefundMatchesTheMissionAmount(String source) {
        tx(em -> { payments(em).findByTransactionRef("TX-original").orElseThrow().setSourceType(source); return null; });
        var p=new BaitlyExternalRefundProof(7L,"TX-original","cs_original",source,364L,
            new BigDecimal("45"),"EUR","re_external","pi_original",new BigDecimal("45"),"succeeded");
        tx(em -> service(em).observe(p));
        assertThatThrownBy(() -> tx(em -> service(em).complete(p))).hasMessageContaining(source.equals("INTERVENTION_BATCH")?"Affectez":"encaissée seule");
        tx(em -> {
            var refund=payments(em).findByProviderTxId("re_external").orElseThrow();
            assertThat(refund.getSourceType()).isEqualTo(source);
            assertThat(refund.getStatus()).isEqualTo(TransactionStatus.PROCESSING);
            assertThat(em.find(Intervention.class,364L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(em.createQuery("select count(e) from LedgerEntry e",Long.class).getSingleResult()).isEqualTo(4); return null;
        });
        verifyNoInteractions(outbox);
    }
    @Test void lateStripeFailureKeepsCompletedAccountingAndRequiresReview() {
        var success=proof("succeeded","45"); tx(em -> service(em).observe(success)); tx(em -> service(em).complete(success));
        var state=tx(em -> service(em).observe(proof("failed","45"))); assertThat(state.review()).isTrue();
        tx(em -> { assertThat(payments(em).findByProviderTxId("re_external").orElseThrow().getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            assertThat(em.createQuery("select count(e) from LedgerEntry e",Long.class).getSingleResult()).isEqualTo(8); return null; });
        tx(em -> {
            var original=payments(em).findByTransactionRef("TX-original").orElseThrow();
            var refund=payments(em).findByProviderTxId("re_external").orElseThrow();
            assertThatThrownBy(() -> BaitlyRefundSeries.history(original,List.of(refund)))
                    .hasMessageContaining("historique doit être rapproché");
            return null;
        });
    }
    @Test void successfulReplayDoesNotClearReviewUntilTheWholeChargeIsVerified() {
        var first=proof("succeeded","5.01");
        tx(em -> service(em).observe(first)); tx(em -> service(em).complete(first));
        tx(em -> service(em).review("EXT-re_external"));
        assertThat(tx(em -> service(em).observe(first)).review()).isTrue();
        var unknown=extra("re_unknown","1");
        assertThatThrownBy(() -> tx(em -> service(em).complete(first,List.of(first,unknown)))).hasMessageContaining("rapprocher");
        tx(em -> { var row=payments(em).findByProviderTxId(first.refundId()).orElseThrow();
            assertThat(row.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            assertThat(row.getMetadata()).containsEntry("reviewRequired",true);
            assertThat(em.createQuery("select count(e) from OutboxEvent e",Long.class).getSingleResult()).isEqualTo(1); return null; });
        assertThat(tx(em -> service(em).complete(first,List.of(first))).review()).isFalse();
    }
    @Test void foreignTenantCannotAttachAnExternalProof() {
        when(tenant.getRequiredOrganizationId()).thenReturn(8L);
        assertThatThrownBy(() -> tx(em -> service(em).observe(proof("succeeded","45")))).hasMessageContaining("organisation");
        tx(em -> { assertThat(payments(em).count()).isEqualTo(1); return null; });
    }
    private void providerTransferred() {
        tx(em -> {
            var record=new HousekeeperPayoutRecord(7L,42L,364L,new BigDecimal("40"),new BigDecimal("5"),HousekeeperPayoutRecord.Status.SENT);
            record.setStripeTransferId("tr_external"); em.persist(record);
            var transfer=new PayoutTransfer();
            Map<String,Object> fields=Map.ofEntries(Map.entry("organizationId",7L),Map.entry("source",PayoutTransfer.Source.INTERVENTION),
                    Map.entry("sourceId",364L),Map.entry("beneficiaryUserId",42L),Map.entry("amount",new BigDecimal("40")),
                    Map.entry("currency","EUR"),Map.entry("provider","STRIPE"),Map.entry("destination","acct_provider"),
                    Map.entry("description","TEST SANDBOX"),Map.entry("idempotencyKey","external-refund-transfer"),
                    Map.entry("createdAt",java.time.Instant.now()));
            fields.forEach((key,value)->org.springframework.test.util.ReflectionTestUtils.setField(transfer,key,value));
            transfer.transferred("tr_external"); transfer.captureDestinationPayment("py_external",false); em.persist(transfer);
            return null;
        });
    }
    @Test void lateCustomerRefundFailureStopsTheProviderRecoveryWithoutErasingHistory() {
        providerTransferred();
        var proof=proof("succeeded","5.01");
        tx(em -> service(em).observe(proof)); tx(em -> service(em).complete(proof));
        tx(em -> service(em).observe(proof("failed","5.01")));
        Long recovery=tx(em -> em.createQuery("from BaitlyTransferRecovery",BaitlyTransferRecovery.class).getSingleResult().getId());
        assertThatThrownBy(() -> tx(em -> new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em).claim(7L,recovery)))
                .hasMessageContaining("client doit être rapproché");
        tx(em -> {
            var row=em.find(BaitlyTransferRecovery.class,recovery);
            assertThat(row.getState()).isEqualTo(BaitlyTransferRecovery.State.WAITING_REFUND);
            assertThat(row.getFirstAttemptAt()).isNull(); assertThat(row.getReversalReference()).isNull();
            assertThat(payments(em).findByProviderTxId("re_external").orElseThrow().getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            assertThat(em.createQuery("from PayoutTransfer",PayoutTransfer.class).getSingleResult().getState()).isEqualTo(PayoutTransfer.State.TRANSFERRED);
            return null;
        });
    }
    @ParameterizedTest @ValueSource(strings={"5.01","45.00"})
    void externalRefundAfterProviderTransferKeepsTheProofAndRecoversOnlyTheFrozenNet(String amount) {
        providerTransferred();
        var proof=proof("succeeded",amount);
        tx(em->service(em).observe(proof)); tx(em->service(em).complete(proof));
        tx(em->service(em).observe(proof)); tx(em->service(em).complete(proof));
        tx(em->{
            var row=em.createQuery("from BaitlyTransferRecovery",BaitlyTransferRecovery.class).getSingleResult();
            var store=new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em);
            String net=amount.equals("45.00")?"40.00":"4.45";
            assertThat(row.getAmount()).isEqualByComparingTo(net);
            assertThat(row.getCommissionRefundAmount()).isEqualByComparingTo(new BigDecimal(amount).subtract(new BigDecimal(net)));
            assertThat(store.claim(7L,row.getId()).orElseThrow().amount()).isEqualByComparingTo(net);
            store.confirm(7L,row.getId(),"trr_external");
            assertThat(store.claim(7L,row.getId())).isEmpty();
            assertThat(em.createQuery("from PayoutTransfer",PayoutTransfer.class).getSingleResult().getAmount()).isEqualByComparingTo("40");
            assertThat(payments(em).count()).isEqualTo(2);
            assertThat(em.find(Intervention.class,364L).getPaymentStatus()).isEqualTo(amount.equals("45.00")?PaymentStatus.REFUNDED:PaymentStatus.PARTIALLY_REFUNDED);
            return null;
        });
        verify(outbox,times(1)).publish(any(),any(),eq("PAYMENT_REFUNDED"),any(),any(),any(),eq(7L));
    }
    @Test void twoConcurrentDeliveriesProduceOneExternalDecision() throws Exception {
        var p=proof("pending","45"); var ready=new CountDownLatch(1); var release=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(() -> tx(em -> { var s=service(em).observe(p); em.flush(); ready.countDown();
                try { if(!release.await(4,TimeUnit.SECONDS)) throw new IllegalStateException("timeout"); } catch(InterruptedException e) { throw new RuntimeException(e); } return s; }));
            assertThat(ready.await(4,TimeUnit.SECONDS)).isTrue();
            var second=pool.submit(() -> tx(em -> service(em).observe(p)));
            try { assertThatThrownBy(() -> second.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class); } finally { release.countDown(); }
            assertThat(first.get(5,TimeUnit.SECONDS).ref()).isEqualTo(second.get(5,TimeUnit.SECONDS).ref());
        }
        tx(em -> { assertThat(payments(em).count()).isEqualTo(2); return null; });
    }
    @Test void concurrentSeriesCompletionsPublishAndReverseOnlyOnce() throws Exception {
        var first=proof("succeeded","5.01"); var last=extra("re_last","39.99"); var snapshot=List.of(first,last);
        for(var p:snapshot) tx(em -> service(em).observe(p));
        tx(em -> service(em).complete(first,snapshot));
        try(var pool=Executors.newFixedThreadPool(2)) {
            var ready=new CyclicBarrier(2);
            Callable<BaitlyExternalRefundStore.State> work=() -> { ready.await(5,TimeUnit.SECONDS); return tx(em -> service(em).complete(last,snapshot)); };
            var a=pool.submit(work); var b=pool.submit(work);
            assertThat(a.get(10,TimeUnit.SECONDS).review()).isFalse(); assertThat(b.get(10,TimeUnit.SECONDS).review()).isFalse();
        }
        assertZeroBalances();
        verify(outbox,times(2)).publish(any(),any(),eq("PAYMENT_REFUNDED"),any(),any(),any(),eq(7L));
    }
    @ParameterizedTest @ValueSource(strings={"sum","changed-proof","unknown","duplicate","previous-review","other-original","other-provider","other-org","missing-ledger"})
    void invalidSeriesKeepsTheRemainingRefundUnderReviewWithoutNewAccounting(String defect) {
        var first=proof("succeeded","5.01"); var last=extra("re_last",defect.equals("sum")?"40":"39.99");
        tx(em -> service(em).observe(first)); tx(em -> service(em).complete(first)); tx(em -> service(em).observe(last));
        var snapshot=new ArrayList<>(List.of(first,last));
        switch(defect) {
            case "changed-proof" -> snapshot.set(1,extra("re_last","39.98"));
            case "unknown" -> snapshot.add(extra("re_unknown","0.01"));
            case "duplicate" -> snapshot.add(last);
            case "previous-review" -> tx(em -> service(em).review("EXT-re_external"));
            case "other-original" -> tx(em -> { var r=payments(em).findByProviderTxId("re_last").orElseThrow();
                var meta=new HashMap<>(r.getMetadata()); meta.put("originalTransactionRef","TX-other"); r.setMetadata(meta); return null; });
            case "other-provider" -> tx(em -> { payments(em).findByProviderTxId("re_last").orElseThrow().setProviderType(PaymentProviderType.CMI); return null; });
            case "other-org" -> tx(em -> { payments(em).findByProviderTxId("re_last").orElseThrow().setOrganizationId(8L); return null; });
            case "missing-ledger" -> tx(em -> { em.createQuery("delete from LedgerEntry e where e.referenceType=com.clenzy.model.LedgerReferenceType.REFUND").executeUpdate(); return null; });
        }
        Long before=tx(em -> em.createQuery("select count(e) from LedgerEntry e",Long.class).getSingleResult());
        assertThatThrownBy(() -> tx(em -> service(em).complete(last,snapshot))).isInstanceOf(RuntimeException.class);
        tx(em -> { assertThat(em.createQuery("select count(e) from LedgerEntry e",Long.class).getSingleResult()).isEqualTo(before);
            assertThat(payments(em).findByProviderTxId("re_last").orElseThrow().getStatus()).isEqualTo(TransactionStatus.PROCESSING);
            assertThat(em.createQuery("select count(e) from OutboxEvent e",Long.class).getSingleResult()).isEqualTo(1); return null; });
    }
}
