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
class BaitlyExternalBatchRefundsTest {
    static SessionFactory factory;
    static String jdbc,user,schema;
    final TenantContext tenant=mock(TenantContext.class);
    final OutboxPublisher outbox=mock(OutboxPublisher.class);
    @BeforeAll static void mapping() throws Exception {
        jdbc=System.getProperty("baitly.test.jdbc"); user=System.getProperty("baitly.test.user","postgres");
        if(jdbc!=null) {
            assertThat(jdbc).matches("jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*");
            schema="baitly_external_batch_"+UUID.randomUUID().toString().replace("-","");
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
                .addAnnotatedClass(Invoice.class).addAnnotatedClass(InvoiceLine.class).addAnnotatedClass(InvoiceNumberSequence.class)
                .addAnnotatedClass(OutboxEvent.class)
                .addInputStream(new ByteArrayInputStream(mapped.getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url",jdbc==null?"jdbc:h2:mem:externalbatchrefund;MODE=PostgreSQL;LOCK_TIMEOUT=5000"
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
                new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em)),persistence,reconciliation,mock(BaitlyExternalReservationRefunds.class),batch(em));
    }
    BaitlyBatchRefundPersistence batches(EntityManager em) {
        var coordination=new InterventionPaymentCoordination(em,payments(em),mock(ServiceQuoteRepository.class),mock(CurrencyConverterService.class)) {
            @Override public void requireRefundOutsideCancellationCase(PaymentTransaction p) { }
        };
        return new BaitlyBatchRefundPersistence(em,payments(em),coordination,new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em));
    }
    BaitlyExternalBatchRefunds batch(EntityManager em) {
        return new BaitlyExternalBatchRefunds(em,payments(em),batches(em),mock(InterventionPaymentCoordination.class),
                new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em));
    }
    BaitlyExternalRefundProof proof(String id,String amount) { return new BaitlyExternalRefundProof(7L,"TX-batch","cs_batch","INTERVENTION_BATCH",10L,
            new BigDecimal("80"),"EUR",id,"pi_batch",new BigDecimal(amount),"succeeded"); }
    @BeforeEach void seed() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        tx(em -> {
            for(String entity:List.of("OutboxEvent","InvoiceLine","Invoice","InvoiceNumberSequence","BaitlyTransferRecovery","PayoutTransfer","HousekeeperPayoutRecord","LedgerEntry","InterventionPaymentAllocation","PaymentTransaction","Intervention"))
                em.createQuery("delete from "+entity).executeUpdate();
            em.createNativeQuery("DELETE FROM housekeeper_payout_records").executeUpdate();
            em.createNativeQuery("DELETE FROM invoices").executeUpdate();
            var payment=new PaymentTransaction();payment.setOrganizationId(7L);payment.setTransactionRef("TX-batch");payment.setSourceType("INTERVENTION_BATCH");payment.setSourceId(10L);
            payment.setPaymentType(TransactionType.CHECKOUT);payment.setStatus(TransactionStatus.COMPLETED);payment.setProviderType(PaymentProviderType.STRIPE);
            payment.setProviderTxId("cs_batch");payment.setAmount(new BigDecimal("80"));payment.setCurrency("EUR");payment.setMetadata(Map.of("interventionIds","10,20"));em.persist(payment);
            for(long id:List.of(10L,20L)) {
                var amount=new BigDecimal(id==10?"35":"45");
                var mission=new Intervention();mission.setId(id);mission.setOrganizationId(7L);mission.setPaymentStatus(PaymentStatus.PAID);mission.setEstimatedCost(amount);mission.setCurrency("EUR");mission.setStripeSessionId("cs_batch");em.persist(mission);
                var part=new InterventionPaymentAllocation(payment,id,amount);part.confirm();em.persist(part);
                var ledger=new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class));
                ledger.recordTransfer(wallet(1L),wallet(2L),amount,LedgerReferenceType.PAYMENT,"TX-batch:"+id,"Paiement groupé");
                ledger.recordTransfer(wallet(2L),wallet(3L),amount,LedgerReferenceType.SPLIT,"SPLIT-INTERVENTION-TX-batch:"+id,"Répartition");
            }
            return null;
        });
    }

    @Test void oneStripeProofDistributesAtomicallyAcrossTwoServicesAndReplays() {
        var proof=proof("re_shared","50.00");
        tx(em->{service(em).observe(proof);return null;});
        var parts=List.of(new BaitlyExternalBatchRefunds.Portion(10L,new BigDecimal("20.00")),new BaitlyExternalBatchRefunds.Portion(20L,new BigDecimal("30.00")));
        tx(em->{batch(em).distribute(7L,10L,"EXT-re_shared",new BigDecimal("50.00"),"EUR",parts,"Deux prestations remboursées","admin-test");return null;});
        for(int repeat=0;repeat<2;repeat++) tx(em->{service(em).observe(proof);service(em).complete(proof,List.of(proof));return null;});
        tx(em->{
            var parent=payments(em).findByProviderTxId("re_shared").orElseThrow();
            assertThat(parent.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            var children=batch(em).children(parent);assertThat(children).hasSize(2);
            assertThat(children).allSatisfy(c->{assertThat(c.getProviderTxId()).isNull();assertThat(BaitlyRefundEvidence.stripeReference(c)).isEqualTo("re_shared");});
            assertThat(children).extracting(PaymentTransaction::getAmount).containsExactly(new BigDecimal("20.00"),new BigDecimal("30.00"));
            assertThat(em.find(Intervention.class,10L).getPaymentStatus()).isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);
            assertThat(em.find(Intervention.class,20L).getPaymentStatus()).isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);
            assertThat(batches(em).externalManifest(payments(em).findByTransactionRef("TX-batch").orElseThrow())).containsEntry("re_shared",new BigDecimal("50.00"));
            assertThat(em.createQuery("from LedgerEntry where referenceType=com.clenzy.model.LedgerReferenceType.REFUND",LedgerEntry.class).getResultList()).hasSize(8);
            return null;
        });
        tx(em->{batch(em).distribute(7L,10L,"EXT-re_shared",new BigDecimal("50.00"),"EUR",parts,"Rejeu","another-admin");return null;});
    }

    @Test void distributionRejectsIncorrectTotalDuplicateForeignAndExcessivePartsWithoutEffects() {
        var proof=proof("re_distribution","50.00");tx(em->{service(em).observe(proof);return null;});
        for(var parts:List.of(
                List.of(new BaitlyExternalBatchRefunds.Portion(10L,new BigDecimal("35.00"))),
                List.of(new BaitlyExternalBatchRefunds.Portion(10L,new BigDecimal("25.00")),new BaitlyExternalBatchRefunds.Portion(10L,new BigDecimal("25.00"))),
                List.of(new BaitlyExternalBatchRefunds.Portion(999L,new BigDecimal("50.00"))),
                List.of(new BaitlyExternalBatchRefunds.Portion(10L,new BigDecimal("36.00")),new BaitlyExternalBatchRefunds.Portion(20L,new BigDecimal("14.00"))))) {
            assertThatThrownBy(()->tx(em->batch(em).distribute(7L,10L,"EXT-re_distribution",new BigDecimal("50.00"),"EUR",parts,"Test","admin"))).isInstanceOf(RuntimeException.class);
        }
        tx(em->{assertThat(em.createQuery("from PaymentTransaction where refundParent is not null",PaymentTransaction.class).getResultList()).isEmpty();return null;});
    }
    @Test void distributionOrderDoesNotChangeChronologyOfBankProofs() {
        var first=proof("re_observed_first","10.00");var last=proof("re_observed_last","70.00");
        var all=List.of(first,last);
        for(var p:all)tx(em->service(em).observe(p));
        // L'opérateur affecte d'abord le second remboursement : les enfants ont donc des IDs inversés.
        tx(em->batch(em).distribute(7L,10L,"EXT-re_observed_last",new BigDecimal("70.00"),"EUR",
            List.of(new BaitlyExternalBatchRefunds.Portion(10L,new BigDecimal("30.00")),new BaitlyExternalBatchRefunds.Portion(20L,new BigDecimal("40.00"))),"Solde","admin"));
        tx(em->batch(em).distribute(7L,10L,"EXT-re_observed_first",new BigDecimal("10.00"),"EUR",
            List.of(new BaitlyExternalBatchRefunds.Portion(10L,new BigDecimal("5.00")),new BaitlyExternalBatchRefunds.Portion(20L,new BigDecimal("5.00"))),"Premier remboursement","admin"));
        assertThatThrownBy(()->tx(em->service(em).complete(last,all))).isInstanceOf(com.clenzy.exception.PaymentValidationException.class).hasMessageContaining("précédent");
        for(var p:all)tx(em->service(em).complete(p,all));
        for(var p:all)tx(em->service(em).complete(p,all));
        tx(em->{
            for(long id:List.of(10L,20L))assertThat(em.find(Intervention.class,id).getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
            assertThat(new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).calculateBalance(3L)).isZero();
            assertThat(batches(em).externalManifest(payments(em).findByTransactionRef("TX-batch").orElseThrow())).containsEntry("re_observed_first",new BigDecimal("10.00")).containsEntry("re_observed_last",new BigDecimal("70.00"));return null;
        });
    }
    void assign(BaitlyExternalRefundProof proof,long mission) {
        tx(em -> batch(em).assign(7L,mission,"EXT-"+proof.refundId(),proof.amount(),"EUR","Prestation identifiée dans le dossier","admin-test"));
    }
    @Test void assignmentDoesNotEmitOrConfirmMoneyAndReplayPreservesItsAudit() {
        var proof=proof("re_external","5.01");tx(em -> service(em).observe(proof));
        assertThatThrownBy(() -> tx(em -> service(em).complete(proof))).hasMessageContaining("Affectez");
        assign(proof,10);assign(proof,10);
        tx(em -> {
            var refund=payments(em).findByProviderTxId(proof.refundId()).orElseThrow();
            assertThat(refund.getStatus()).isEqualTo(TransactionStatus.PROCESSING);
            assertThat(refund.getSourceType()).isEqualTo("INTERVENTION");assertThat(refund.getSourceId()).isEqualTo(10L);
            assertThat(refund.getMetadata()).containsEntry("assignedBy","admin-test").containsEntry("originalSourceType","INTERVENTION_BATCH");
            assertThat(refund.getMetadata().get("assignedAt")).isNotNull();assertThat(PaymentPersistence.managedRefund(refund)).isFalse();
            assertThat(em.find(Intervention.class,10L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(em.createQuery("select count(e) from OutboxEvent e",Long.class).getSingleResult()).isZero();return null;
        });
        tx(em -> service(em).observe(proof));tx(em -> service(em).complete(proof));
        tx(em -> service(em).observe(proof));tx(em -> service(em).complete(proof));
        tx(em -> {
            assertThat(em.find(Intervention.class,10L).getPaymentStatus()).isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);
            assertThat(em.find(Intervention.class,20L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).calculateBalance(3L)).isEqualByComparingTo("74.99");
            assertThat(em.createQuery("select count(e) from OutboxEvent e",Long.class).getSingleResult()).isEqualTo(1);
            assertThat(new com.clenzy.service.payout.BaitlyResidualPayoutFunding(em,payments(em),batches(em)).available(em.find(Intervention.class,10L))).contains(new BigDecimal("29.99"));return null;
        });
    }
    @Test void observedSeriesPostsPrefixesWithoutTouchingSiblingAndAbsorbsCents() {
        var first=proof("re_first","5.01");var last=proof("re_last","29.99");var all=List.of(first,last);
        for(var p:all){tx(em -> service(em).observe(p));assign(p,10);}
        assertThatThrownBy(() -> tx(em -> service(em).complete(last,all))).hasMessageContaining("précédent");
        for(var p:all)tx(em -> service(em).complete(p,all));
        for(var p:all){tx(em -> service(em).observe(p));tx(em -> service(em).complete(p,all));}
        tx(em -> {
            assertThat(em.find(Intervention.class,10L).getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
            assertThat(em.find(Intervention.class,20L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).calculateBalance(3L)).isEqualByComparingTo("45");
            assertThat(batches(em).externalManifest(payments(em).findByTransactionRef("TX-batch").orElseThrow())).containsOnlyKeys("re_first","re_last");
            assertThat(batches(em).managedManifest(payments(em).findByTransactionRef("TX-batch").orElseThrow())).isEmpty();return null;
        });
    }
    @Test void unmanagedRemainderKeepsResidualPayoutBlocked() {
        var first=proof("re_first","5");tx(em -> service(em).observe(first));assign(first,10);tx(em -> service(em).complete(first));
        tx(em -> service(em).observe(proof("re_unassigned","10")));
        tx(em -> {assertThat(new com.clenzy.service.payout.BaitlyResidualPayoutFunding(em,payments(em),batches(em)).available(em.find(Intervention.class,10L))).isEmpty();return null;});
    }
    @Test void partialExternalSeriesIssuesOneCreditNotePerProofWithExactTaxTotal() {
        tx(em -> {
            em.persist(new InvoiceNumberSequence(7L,"FA",java.time.LocalDate.now().getYear()));
            var invoice=new Invoice();invoice.setOrganizationId(7L);invoice.setInvoiceNumber("INV-BATCH");invoice.setInvoiceDate(java.time.LocalDate.now());
            invoice.setInvoiceType(InvoiceType.GUEST);invoice.setInterventionId(10L);invoice.setStatus(InvoiceStatus.SENT);invoice.setCurrency("EUR");
            invoice.setTotalHt(new BigDecimal("29.17"));invoice.setTotalTax(new BigDecimal("5.83"));invoice.setTotalTtc(new BigDecimal("35"));
            invoice.addLine(RefundCreditNotePersistenceTest.line(1,"29.17","5.83","35","0.20"));em.persist(invoice);return null;
        });
        var proofs=new ArrayList<BaitlyExternalRefundProof>();
        for(var p:List.of(proof("re_note_a","5.01"),proof("re_note_b","29.99"))) {
            proofs.add(p);tx(em -> service(em).observe(p));assign(p,10);tx(em -> service(em).complete(p,List.copyOf(proofs)));
            for(int replay=0;replay<2;replay++)tx(em -> new RefundCreditNoteService(em,new JpaRepositoryFactory(em).getRepository(InvoiceRepository.class),payments(em),
                    new InvoiceNumberingService(new JpaRepositoryFactory(em).getRepository(InvoiceNumberSequenceRepository.class),tenant,em),tenant,batches(em)).reconcile("EXT-"+p.refundId()));
        }
        tx(em -> {
            var notes=em.createQuery("from Invoice where status=com.clenzy.model.InvoiceStatus.CREDIT_NOTE",Invoice.class).getResultList();
            assertThat(notes).hasSize(2);assertThat(notes.stream().map(Invoice::getTotalTtc).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("-35");
            assertThat(notes.stream().map(Invoice::getTotalTax).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("-5.83");
            assertThat(notes.stream().map(Invoice::getRefundTransactionId).distinct()).hasSize(2);return null;
        });
    }
    @Test void refundOfPaidOutPartCreatesRecoveryForItsNetOnly() {
        tx(em -> {
            var record=new HousekeeperPayoutRecord(7L,42L,10L,new BigDecimal("30"),new BigDecimal("5"),HousekeeperPayoutRecord.Status.SENT);
            record.setStripeTransferId("tr_batch");em.persist(record);
            var transfer=new PayoutTransfer();
            Map<String,Object> fields=Map.ofEntries(Map.entry("organizationId",7L),Map.entry("source",PayoutTransfer.Source.INTERVENTION),
                    Map.entry("sourceId",10L),Map.entry("beneficiaryUserId",42L),Map.entry("amount",new BigDecimal("30")),Map.entry("currency","EUR"),
                    Map.entry("provider","STRIPE"),Map.entry("destination","acct_provider"),Map.entry("description","TEST ISOLÉ"),
                    Map.entry("idempotencyKey","external-batch-test"),Map.entry("createdAt",java.time.Instant.now()));
            fields.forEach((key,value) -> org.springframework.test.util.ReflectionTestUtils.setField(transfer,key,value));
            transfer.transferred("tr_batch");transfer.captureDestinationPayment("py_batch",false);em.persist(transfer);return null;
        });
        var p=proof("re_paidout","5.01");tx(em -> service(em).observe(p));assign(p,10);tx(em -> service(em).complete(p));
        tx(em -> {
            var row=em.createQuery("from BaitlyTransferRecovery",BaitlyTransferRecovery.class).getSingleResult();
            var recoveries=new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em);
            assertThat(recoveries.claim(7L,row.getId()).orElseThrow().amount()).isEqualByComparingTo("4.29");
            assertThat(row.getCommissionRefundAmount()).isEqualByComparingTo("0.72");
            assertThat(em.find(Intervention.class,20L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);return null;
        });
    }
    @ParameterizedTest @ValueSource(strings={"amount","currency","org","mission","blank-reason","too-large","pending","failed","wrong-session","other-refund"})
    void unsafeAssignmentIsRefusedWithoutChangingTheExternalProof(String scenario) {
        var p=proof("re_guard",scenario.equals("too-large")?"36":"5");tx(em -> service(em).observe(p));
        tx(em -> {
            var row=payments(em).findByProviderTxId(p.refundId()).orElseThrow();
            if(Set.of("pending","failed").contains(scenario)){var metadata=new HashMap<>(row.getMetadata());metadata.put("stripeStatus",scenario);row.setMetadata(metadata);}
            if(scenario.equals("wrong-session"))em.find(Intervention.class,10L).setStripeSessionId("cs_other");
            if(scenario.equals("other-refund")){var r=new PaymentTransaction();r.setOrganizationId(7L);r.setTransactionRef("REF-old");r.setPaymentType(TransactionType.REFUND);r.setProviderType(PaymentProviderType.STRIPE);r.setStatus(TransactionStatus.COMPLETED);r.setSourceType("INTERVENTION");r.setSourceId(10L);r.setAmount(BigDecimal.ONE);r.setCurrency("EUR");em.persist(r);}return null;
        });
        assertThatThrownBy(() -> tx(em -> batch(em).assign(scenario.equals("org")?8L:7L,scenario.equals("mission")?99L:10L,"EXT-re_guard",
                scenario.equals("amount")?BigDecimal.ONE:p.amount(),scenario.equals("currency")?"USD":"EUR",scenario.equals("blank-reason")?" ":"Dossier vérifié","actor"))).isInstanceOf(RuntimeException.class);
        tx(em -> {assertThat(payments(em).findByProviderTxId(p.refundId()).orElseThrow().getSourceType()).isEqualTo("INTERVENTION_BATCH");return null;});
    }
    @Test void simultaneousDifferentAssignmentsCanOnlyChooseOneMission() throws Exception {
        var p=proof("re_concurrent","5");tx(em -> service(em).observe(p));
        var locked=new CountDownLatch(1);var release=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(() -> tx(em -> {var result=batch(em).assign(7L,10L,"EXT-re_concurrent",p.amount(),"EUR","Dossier vérifié","a");
                em.flush();locked.countDown();try{if(!release.await(5,TimeUnit.SECONDS))throw new IllegalStateException("timeout");}catch(InterruptedException e){throw new RuntimeException(e);}return result;}));
            assertThat(locked.await(5,TimeUnit.SECONDS)).isTrue();
            var second=pool.submit(() -> tx(em -> batch(em).assign(7L,20L,"EXT-re_concurrent",p.amount(),"EUR","Dossier vérifié","b")));
            try{assertThatThrownBy(() -> second.get(100,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);}finally{release.countDown();}
            assertThat(first.get(5,TimeUnit.SECONDS).interventionId()).isEqualTo(10L);
            assertThatThrownBy(() -> second.get(5,TimeUnit.SECONDS)).hasCauseInstanceOf(com.clenzy.exception.PaymentValidationException.class);
        }
    }
    @Test void failureRollsBackAccountingAndOutboxButKeepsAssignmentForRetry() {
        var p=proof("re_rollback","5");tx(em -> service(em).observe(p));assign(p,10);
        doThrow(new IllegalStateException("outbox unavailable")).when(outbox).publish(any(),any(),any(),any(),any(),any(),anyLong());
        assertThatThrownBy(() -> tx(em -> service(em).complete(p))).hasMessage("outbox unavailable");
        tx(em -> {var row=payments(em).findByProviderTxId(p.refundId()).orElseThrow();assertThat(BaitlyExternalBatchRefunds.assigned(row)).isTrue();
            assertThat(row.getStatus()).isEqualTo(TransactionStatus.PROCESSING);assertThat(BaitlyExternalRefundStore.confirmed(row)).isFalse();
            assertThat(em.find(Intervention.class,10L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);return null;});
        reset(outbox);tx(em -> service(em).complete(p));
    }
    @ParameterizedTest @ValueSource(strings={"missing","duplicate","amount","other-intent"})
    void incompleteCanonicalSnapshotNeverPosts(String scenario) {
        var p=proof("re_snapshot","5");tx(em -> service(em).observe(p));assign(p,10);
        List<BaitlyExternalRefundProof> snapshot=switch(scenario){
            case "missing" -> List.of();case "duplicate" -> List.of(p,p);case "amount" -> List.of(proof(p.refundId(),"6"));
            default -> List.of(new BaitlyExternalRefundProof(7L,"OTHER","cs_other","INTERVENTION_BATCH",10L,new BigDecimal("80"),"EUR",p.refundId(),"pi_other",p.amount(),"succeeded"));};
        assertThatThrownBy(() -> tx(em -> service(em).complete(p,snapshot))).isInstanceOf(RuntimeException.class);
        tx(em -> {assertThat(em.find(Intervention.class,10L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);return null;});
    }
}
