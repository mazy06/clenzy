package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.payout.*;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Acompte + solde, décisions, grand livre et avoirs dans de vraies transactions PostgreSQL. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyMaintenanceRefundPostgresTest {
    static SessionFactory factory;static String url,user,schema;
    final TenantContext tenant=mock(TenantContext.class);
    final BaitlyTransferRecoveryStore recoveries=mock(BaitlyTransferRecoveryStore.class);
    @BeforeAll static void start() throws Exception {
        url=System.getProperty("baitly.test.jdbc");user=System.getProperty("baitly.test.user","postgres");
        schema="baitly_maintenance_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()){s.execute("CREATE SCHEMA "+schema);}
        var xml=new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml,Intervention.class,Set.of("organizationId","status","paymentStatus","estimatedCost","actualCost","currency","stripeSessionId"));
        xml.append("</entity-mappings>");
        factory=new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .addAnnotatedClass(ServiceQuote.class).addAnnotatedClass(InterventionPaymentAllocation.class)
                .addAnnotatedClass(LedgerEntry.class).addAnnotatedClass(Invoice.class).addAnnotatedClass(InvoiceLine.class)
                .addAnnotatedClass(InvoiceNumberSequence.class).addAnnotatedClass(BaitlyInvoiceIssuerSequence.class)
                .addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url",url+(url.contains("?")?"&":"?")+"currentSchema="+schema)
                .setProperty("hibernate.connection.username",user).setProperty("hibernate.hbm2ddl.auto","create-drop")
                .setProperty("jakarta.persistence.validation.mode","none").buildSessionFactory();
    }
    @AfterAll static void stop() throws Exception {
        if(factory!=null)factory.close();
        if(schema!=null)try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}
    }
    <T>T tx(Function<EntityManager,T> work){try(var em=factory.createEntityManager()){
        em.getTransaction().begin();try{T value=work.apply(em);em.getTransaction().commit();return value;}
        catch(RuntimeException e){em.getTransaction().rollback();throw e;}}}
    <T>T repo(EntityManager em,Class<T> type){return new JpaRepositoryFactory(em).getRepository(type);}
    PaymentTransaction payment(EntityManager em,String ref){return repo(em,PaymentTransactionRepository.class).findByTransactionRef(ref).orElseThrow();}
    List<PaymentTransaction> rows(EntityManager em){return repo(em,PaymentTransactionRepository.class).findByOrganizationIdAndSourceTypeAndSourceId(7L,"INTERVENTION",364L);}
    InterventionPaymentCoordination coordination(EntityManager em){
        var locks=mock(InterventionPaymentCoordination.class);
        doAnswer(call->{
            var receipt=(PaymentTransaction)call.getArgument(0);
            var all=rows(em);var mission=em.find(Intervention.class,364L);
            if(BaitlyMaintenanceReceipts.multiple(all)) BaitlyMaintenanceReceipts.verify(mission,all,
                    em.createQuery("from ServiceQuote",ServiceQuote.class).getResultList());
            else if(mission.getEstimatedCost().compareTo(receipt.getAmount())!=0)throw new IllegalStateException("Encaissement incomplet");
            return null;
        }).when(locks).requireStandaloneRefundSeries(any());
        when(locks.lockMission(7L,364L)).thenAnswer(call -> {var m=em.find(Intervention.class,364L);em.refresh(m,LockModeType.PESSIMISTIC_WRITE);return m;});
        when(locks.maintenanceReceipts(any(),any())).thenAnswer(call -> BaitlyMaintenanceReceipts.verify(call.getArgument(0),call.getArgument(1),
                em.createQuery("from ServiceQuote",ServiceQuote.class).getResultList()));return locks;
    }
    BaitlyRefundSeriesStore store(EntityManager em){return new BaitlyRefundSeriesStore(repo(em,PaymentTransactionRepository.class),coordination(em),em,recoveries,mock(BaitlyBatchRefundPersistence.class));}
    Wallet wallet(Long id){var w=new Wallet();w.setId(id);w.setOrganizationId(7L);w.setCurrency("EUR");return w;}
    PaymentLedgerReversalService reversals(EntityManager em){
        var wallets=mock(WalletService.class);when(wallets.getWalletById(anyLong())).thenAnswer(c->wallet(c.getArgument(0)));
        return new PaymentLedgerReversalService(mock(InterventionRepository.class),repo(em,LedgerEntryRepository.class),new LedgerService(repo(em,LedgerEntryRepository.class)),wallets);
    }
    BaitlyResidualPayoutFunding funding(EntityManager em){return new BaitlyResidualPayoutFunding(em,repo(em,PaymentTransactionRepository.class),mock(BaitlyBatchRefundPersistence.class));}
    RefundCreditNoteService notes(EntityManager em){return new RefundCreditNoteService(em,repo(em,InvoiceRepository.class),repo(em,PaymentTransactionRepository.class),
            new InvoiceNumberingService(repo(em,InvoiceNumberSequenceRepository.class),tenant,em),tenant,mock(BaitlyBatchRefundPersistence.class));}
    @BeforeEach void seed(){when(tenant.getRequiredOrganizationId()).thenReturn(7L);tx(em->{
        for(var entity:List.of("InvoiceLine","Invoice","InvoiceNumberSequence","BaitlyInvoiceIssuerSequence","LedgerEntry","ServiceQuote","InterventionPaymentAllocation","PaymentTransaction","Intervention"))em.createQuery("delete from "+entity).executeUpdate();
        var m=new Intervention();m.setId(364L);m.setOrganizationId(7L);m.setEstimatedCost(new BigDecimal("100"));m.setCurrency("EUR");m.setStripeSessionId("cs_balance");
        m.setPaymentStatus(PaymentStatus.PAID);m.setStatus(InterventionStatus.COMPLETED);em.persist(m);
        for(var ref:List.of("deposit","balance")) {var p=RefundCreditNotePersistenceTest.transaction("TX-"+ref,TransactionType.CHECKOUT);
            p.setProviderTxId("cs_"+ref);p.setAmount(new BigDecimal(ref.equals("deposit")?"30":"70"));if(ref.equals("deposit"))p.setMetadata(Map.of("purpose","DEPOSIT"));em.persist(p);}
        var quote=new ServiceQuote();quote.setOrganizationId(7L);quote.setInterventionId(364L);quote.setStatus(ServiceQuote.Status.APPROVED);quote.setAmount(new BigDecimal("100"));
        quote.setProviderName("Prestataire test");quote.setCurrency("EUR");quote.setDepositAmount(new BigDecimal("30"));quote.setDepositPaidAt(LocalDateTime.now());quote.setDepositTransactionRef("TX-deposit");em.persist(quote);
        var ledger=new LedgerService(repo(em,LedgerEntryRepository.class));ledger.recordTransfer(wallet(1L),wallet(2L),new BigDecimal("100"),LedgerReferenceType.PAYMENT,"364","Paiement intervention test");
        ledger.recordTransfer(wallet(2L),wallet(3L),new BigDecimal("90"),LedgerReferenceType.SPLIT,"SPLIT-INTERVENTION-364","Répartition test");
        em.persist(new InvoiceNumberSequence(7L,"FA",LocalDate.now().getYear()));
        var invoice=new Invoice();invoice.setSellerName("Émetteur test");invoice.setSellerAddress("1 rue de la Simulation, Paris");invoice.setSellerTaxId("FR-TEST-ONLY");invoice.setBuyerName("Voyageur test");invoice.setOrganizationId(7L);invoice.setInvoiceNumber("FA-TEST");invoice.setInvoiceDate(LocalDate.now());invoice.setInvoiceType(InvoiceType.GUEST);
        invoice.setStatus(InvoiceStatus.PAID);invoice.setInterventionId(364L);invoice.setTotalHt(new BigDecimal("83.33"));invoice.setTotalTax(new BigDecimal("16.67"));invoice.setTotalTtc(new BigDecimal("100"));
        invoice.addLine(RefundCreditNotePersistenceTest.line(1,"83.33","16.67","100","0.20"));em.persist(invoice);return null;});}
    List<String> refundRefs(){return tx(em->rows(em).stream().filter(p->p.getPaymentType()==TransactionType.REFUND).sorted(Comparator.comparing(PaymentTransaction::getId)).map(PaymentTransaction::getTransactionRef).toList());}
    void confirm(String ref){tx(em->{var refund=payment(em,ref);refund.setStatus(TransactionStatus.COMPLETED);refund.setProviderTxId("re_"+refund.getId());em.flush();
        new InterventionRefundReconciliationService(repo(em,PaymentTransactionRepository.class),coordination(em),mock(PaymentStatusTransitionService.class),reversals(em),tenant,mock(BaitlyBatchRefundPersistence.class)).reconcile(ref);
        notes(em).reconcile(ref);return null;});}
    @Test void eightyEurosAcrossTwoChargesProduceExactCreditsAndTwentyEurosResidual(){
        var key=UUID.randomUUID();String first=tx(em->store(em).prepare(7L,364L,new BigDecimal("80"),key));var refs=refundRefs();assertThat(refs).hasSize(2);
        String replay=tx(em->store(em).prepare(7L,364L,new BigDecimal("80"),key));assertThat(replay).isEqualTo(first);
        tx(em->{assertThat(payment(em,refs.get(0)).getAmount()).isEqualByComparingTo("70");assertThat(payment(em,refs.get(1)).getAmount()).isEqualByComparingTo("10");
            assertThat(store(em).prepareMaintenanceRecovery(payment(em,refs.get(1)))).isFalse();return null;});
        confirm(first);
        tx(em->{assertThat(funding(em).available(em.find(Intervention.class,364L))).isEmpty();assertThat(store(em).status(7L,first)).containsEntry("reconciled",false);
            assertThat(store(em).prepareMaintenanceRecovery(payment(em,refs.get(1)))).isTrue();return null;});
        confirm(refs.get(1));
        tx(em->{assertThat(funding(em).available(em.find(Intervention.class,364L))).contains(new BigDecimal("20.00"));
            assertThat(store(em).status(7L,first)).containsEntry("reconciled",true);
            assertThat(em.createQuery("select sum(i.totalTtc) from Invoice i where i.status=com.clenzy.model.InvoiceStatus.CREDIT_NOTE",BigDecimal.class).getSingleResult()).isEqualByComparingTo("-80");return null;});
        String last=tx(em->store(em).prepare(7L,364L,new BigDecimal("20"),UUID.randomUUID()));confirm(last);confirm(last);confirm(first);
        tx(em->{assertThat(em.find(Intervention.class,364L).getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
            assertThat(em.createQuery("select sum(i.totalTax) from Invoice i where i.status=com.clenzy.model.InvoiceStatus.CREDIT_NOTE",BigDecimal.class).getSingleResult()).isEqualByComparingTo("-16.67");return null;});
    }
    @Test void unconfirmedOrForeignDepositNeverCreatesRefundInstructions(){
        tx(em->{payment(em,"TX-deposit").setOrganizationId(8L);return null;});
        assertThatThrownBy(()->tx(em->store(em).prepare(7L,364L,BigDecimal.ONE,UUID.randomUUID()))).isInstanceOf(RuntimeException.class);
        assertThat(refundRefs()).isEmpty();verifyNoInteractions(recoveries);
    }
    @Test void refundCeilingAndIntentMismatchDoNotChangeTheReservedPlan(){
        assertThatThrownBy(()->tx(em->store(em).prepare(7L,364L,new BigDecimal("100.01"),UUID.randomUUID()))).hasMessageContaining("solde");
        var id=UUID.randomUUID();tx(em->store(em).prepare(7L,364L,new BigDecimal("80"),id));
        assertThatThrownBy(()->tx(em->store(em).prepare(7L,364L,new BigDecimal("81"),id))).hasMessageContaining("autre montant");
        assertThatThrownBy(()->tx(em->store(em).prepare(7L,364L,BigDecimal.ONE,UUID.randomUUID()))).hasMessageContaining("confirmation");
        assertThat(refundRefs()).hasSize(2);
    }
}
