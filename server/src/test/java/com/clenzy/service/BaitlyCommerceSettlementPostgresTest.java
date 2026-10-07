package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.payout.*;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import liquibase.*;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import java.sql.DriverManager;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Verrous, écritures, rollback et migrations réels ; services de configuration remplacés par des fixtures. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyCommerceSettlementPostgresTest {
    static String url,user,schema; static SessionFactory factory;
    long orderId;
    static final com.clenzy.fiscal.einvoicing.francepdp.BaitlyCiiValidator CII_VALIDATOR=new com.clenzy.fiscal.einvoicing.francepdp.BaitlyCiiValidator();
    com.clenzy.fiscal.einvoicing.BaitlyInvoiceFiscalDocuments fiscalDocuments(EntityManager em){
        return new com.clenzy.fiscal.einvoicing.BaitlyInvoiceFiscalDocuments(em,new com.clenzy.fiscal.einvoicing.francepdp.BaitlyInvoiceCiiBuilder(),CII_VALIDATOR);
    }
    Long completeFiscalInvoice(){return tx(em->{var i=com.clenzy.fiscal.einvoicing.francepdp.BaitlyInvoiceCiiTest.invoice();em.persist(i);return i.getId();});}
    com.clenzy.fiscal.einvoicing.BaitlyInvoiceFiscalDocuments.Request fiscalRequest(Long id){return tx(em->new com.clenzy.fiscal.einvoicing.BaitlyInvoiceFiscalDocuments.Request(fiscalDocuments(em).view(2L,id).sourceHash(),com.clenzy.fiscal.einvoicing.francepdp.BaitlyInvoiceCiiTest.data()));}

    @Test void localFiscalArchiveIsValidatedImmutableAndDoesNotRewriteTheIssuedInvoice() {
        Long id=completeFiscalInvoice();var request=fiscalRequest(id);
        tx(em->{var store=fiscalDocuments(em);assertThat(store.check(2L,id,request).valid()).isTrue();
            var view=store.archive(2L,id,request,"staff");assertThat(view.state()).isEqualTo("LOCAL_VALIDATED");
            assertThat(view.documentHash()).hasSize(64);assertThat(store.archive(2L,id,request,"staff").documentHash()).isEqualTo(view.documentHash());
            assertThat(em.find(Invoice.class,id).getXmlContent()).isNull();assertThat(em.createQuery("from EInvoiceSubmission").getResultList()).isEmpty();
            assertThat(CII_VALIDATOR.validate(new String(store.document(2L,id),java.nio.charset.StandardCharsets.UTF_8))).isEmpty();
            em.find(Invoice.class,id).setStatus(InvoiceStatus.CANCELLED);
            assertThat(store.view(2L,id).state()).isEqualTo("LOCAL_VALIDATED");assertThat(store.document(2L,id)).isNotEmpty();
            assertThat(store.preparedArtifact(em.find(Invoice.class,id))).isEmpty();return null;});
        assertThatThrownBy(()->tx(em->fiscalDocuments(em).document(3L,id))).hasMessageContaining("inaccessible");
        assertThatThrownBy(()->tx(em->fiscalDocuments(em).archive(3L,id,request,"other"))).hasMessageContaining("inaccessible");
        assertThatThrownBy(()->tx(em->{em.createNativeQuery("UPDATE baitly_invoice_fiscal_documents SET xml='changed'").executeUpdate();return null;})).hasMessageContaining("immutable");
        assertThatThrownBy(()->tx(em->{em.createNativeQuery("DELETE FROM baitly_invoice_fiscal_documents").executeUpdate();return null;})).hasMessageContaining("immutable");
        tx(em->{em.find(Invoice.class,id).setDueDate(java.time.LocalDate.of(2027,1,1));return null;});
        assertThatThrownBy(()->tx(em->fiscalDocuments(em).document(2L,id))).hasMessageContaining("changé");
        tx(em->{var store=fiscalDocuments(em);assertThat(store.view(2L,id).state()).isEqualTo("REVIEW_REQUIRED");assertThat(store.preparedArtifact(em.find(Invoice.class,id))).isEmpty();return null;});
    }
    @Test void concurrentArchiveIsIdempotentAndCannotReplaceRouting() throws Exception {
        Long id=completeFiscalInvoice();var request=fiscalRequest(id);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);Callable<String> save=()->{barrier.await(5,TimeUnit.SECONDS);return tx(em->fiscalDocuments(em).archive(2L,id,request,"staff").documentHash());};
            var a=pool.submit(save);var b=pool.submit(save);assertThat(a.get(20,TimeUnit.SECONDS)).isEqualTo(b.get(20,TimeUnit.SECONDS));
        }
        var changed=new com.clenzy.fiscal.einvoicing.francepdp.BaitlyCiiPreparation(request.data().seller(),new com.clenzy.fiscal.einvoicing.francepdp.BaitlyCiiPreparation.Party("69002","Lyon","987654321","987654321_OTHER"),request.data().terms());
        assertThatThrownBy(()->tx(em->fiscalDocuments(em).archive(2L,id,new com.clenzy.fiscal.einvoicing.BaitlyInvoiceFiscalDocuments.Request(request.sourceHash(),changed),"staff"))).hasMessageContaining("modification interdite");
    }
    @Test void staleInvoiceAndPriorTransmissionPreventAnAlternativeFiscalArtifact() {
        Long id=completeFiscalInvoice();var request=fiscalRequest(id);
        tx(em->{em.find(Invoice.class,id).setBuyerName("Modification concurrente");return null;});
        assertThatThrownBy(()->tx(em->fiscalDocuments(em).archive(2L,id,request,"staff"))).hasMessageContaining("changé");
        var fresh=fiscalRequest(id);tx(em->{new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(2L,id,"FR",pollingProvider());return null;});
        assertThatThrownBy(()->tx(em->fiscalDocuments(em).archive(2L,id,fresh,"staff"))).hasMessageContaining("transmission existe");
    }
    @Test void checksPersistAndBecomeStaleAfterDraftChange() {
        Long id=completeFiscalInvoice();
        tx(em->{var i=em.find(Invoice.class,id);i.setStatus(InvoiceStatus.DRAFT);i.setSellerAddress(null);return null;});
        tx(em->{var service=new BaitlyInvoiceVerification(em);var view=service.check(2L,id,"staff");
            assertThat(view.state()).isEqualTo("BLOCKED");assertThat(view.history()).hasSize(1);return null;});
        tx(em->{em.find(Invoice.class,id).setSellerAddress("1 rue Exemple");return null;});
        tx(em->{var service=new BaitlyInvoiceVerification(em);var view=service.view(2L,id);
            assertThat(view.state()).isEqualTo("TO_CHECK");assertThat(view.history().getFirst().current()).isFalse();
            assertThat(service.check(2L,id,"reviewer").state()).isEqualTo("CHECKED");return null;});
        tx(em->{var rows=new BaitlyInvoiceVerification(em).list(2L);assertThat(rows).hasSize(1);assertThat(rows.getFirst().state()).isEqualTo("CHECKED");return null;});
        assertThatThrownBy(()->tx(em->new BaitlyInvoiceVerification(em).check(3L,id,"other"))).hasMessageContaining("inaccessible");
        assertThatThrownBy(()->tx(em->{em.createNativeQuery("DELETE FROM baitly_invoice_reviews").executeUpdate();return null;})).hasMessageContaining("immutable");
    }
    @Test void archivedPdfIsStableAndCannotBeReplacedOrReadAcrossOrganizations() {
        Long id=completeFiscalInvoice();byte[] first=BaitlyPdfEngineTest.pdf("Baitly TEST facture");byte[] second=BaitlyPdfEngineTest.pdf("Alternative interdite");
        tx(em->{var i=em.find(Invoice.class,id);var store=new BaitlyInvoicePdfStore(em,null);String hash=BaitlyInvoiceChecks.fingerprint(i);
            assertThat(store.archive(2L,id,hash,first)).isEqualTo(first);assertThat(store.archive(2L,id,hash,second)).isEqualTo(first);return null;});
        tx(em->{assertThat(new BaitlyInvoicePdfStore(em,null).existing(2L,id)).isEqualTo(first);return null;});
        assertThatThrownBy(()->tx(em->new BaitlyInvoicePdfStore(em,null).existing(3L,id))).hasMessageContaining("inaccessible");
        assertThatThrownBy(()->tx(em->{em.createNativeQuery("UPDATE baitly_invoice_pdf_archives SET content='changed'").executeUpdate();return null;})).hasMessageContaining("immutable");
        tx(em->{em.find(Invoice.class,id).setBuyerName("Concurrent change");return null;});
        assertThatThrownBy(()->tx(em->new BaitlyInvoicePdfStore(em,null).existing(2L,id))).hasMessageContaining("divergé");
    }
    @Test void incompleteDraftCannotConsumeLegalNumber() {
        Long id=completeFiscalInvoice();
        tx(em->{var i=em.find(Invoice.class,id);i.setStatus(InvoiceStatus.DRAFT);i.setSellerTaxId(null);return null;});
        assertThatThrownBy(()->tx(em->new InvoiceNumberingService(null,null,em).generateNextNumberFor(em.find(Invoice.class,id)))).hasMessageContaining("compléter");
    }

    @BeforeAll static void schema() throws Exception {
        url=System.getProperty("baitly.test.jdbc"); user=System.getProperty("baitly.test.user","postgres");
        schema="baitly_commerce_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()) {s.execute("CREATE SCHEMA "+schema);}
        factory=new Configuration().addPackage("com.clenzy.model")
                .addAnnotatedClass(PaymentConnection.class).addAnnotatedClass(BaitlyCommerceEvidence.class).addAnnotatedClass(UpsellOrder.class).addAnnotatedClass(ActivityCommission.class).addAnnotatedClass(BaitlyAffiliateAdjustment.class)
                .addAnnotatedClass(BaitlyInvoiceReview.class).addAnnotatedClass(BaitlyInvoicePdfArchive.class).addAnnotatedClass(DocumentGeneration.class).addAnnotatedClass(DocumentTemplate.class).addAnnotatedClass(DocumentTemplateTag.class).addAnnotatedClass(TemplateComplianceReport.class)
                .addAnnotatedClass(BaitlyInvoiceFiscalDocument.class).addAnnotatedClass(BaitlyIopoleStatus.class).addAnnotatedClass(BaitlyInvoiceIssuerSequence.class).addAnnotatedClass(Invoice.class).addAnnotatedClass(InvoiceLine.class).addAnnotatedClass(EInvoiceSubmission.class)
                .addAnnotatedClass(BaitlySaleDocument.class).addAnnotatedClass(BaitlySubscriptionInvoice.class).addAnnotatedClass(BaitlySubscriptionOrder.class)
                .addAnnotatedClass(BaitlyCommercePayout.class).addAnnotatedClass(BaitlyCommerceRecovery.class).addAnnotatedClass(PayoutTransfer.class)
                .addAnnotatedClass(BaitlyCommerceOperation.class).addAnnotatedClass(BaitlyHardwareStock.class).addAnnotatedClass(BaitlyHardwareStockChange.class).addAnnotatedClass(BaitlyHardwareReservation.class).addAnnotatedClass(BaitlyPurchaseRequest.class).addAnnotatedClass(HardwareOrder.class).addAnnotatedClass(PaymentTransaction.class)
                .addAnnotatedClass(ServiceQuote.class).addAnnotatedClass(AiCreditGrant.class).addAnnotatedClass(AiUsageLedgerEntry.class)
                .addAnnotatedClass(Wallet.class).addAnnotatedClass(LedgerEntry.class)
                .setProperty("hibernate.connection.url",url+(url.contains("?")?"&":"?")+"currentSchema="+schema)
                .setProperty("hibernate.connection.username",user).setProperty("hibernate.hbm2ddl.auto","create-drop")
                .setProperty("jakarta.persistence.validation.mode","none").buildSessionFactory();
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()) {
            s.execute("SET search_path TO "+schema);
            s.execute("CREATE TABLE users(id bigint PRIMARY KEY,organization_id bigint)");
            s.execute("DROP TABLE baitly_iopole_statuses");
            s.execute("DROP TABLE baitly_invoice_fiscal_documents,baitly_invoice_reviews,baitly_invoice_pdf_archives");
            s.execute("CREATE TABLE organizations(id bigint PRIMARY KEY)");
            s.execute("INSERT INTO organizations(id) VALUES (2),(3)");
            s.execute("ALTER TABLE template_compliance_reports DROP COLUMN country_code,DROP COLUMN source_hash");
            s.execute("ALTER TABLE einvoice_submissions DROP COLUMN invoice_id,DROP COLUMN document_hash,DROP COLUMN submission_started_at,DROP COLUMN retry_at");
            s.execute("DROP TABLE baitly_invoice_issuer_sequences,baitly_commerce_evidence,baitly_sale_documents,baitly_commerce_recoveries,baitly_commerce_payouts,baitly_affiliate_adjustments,baitly_commerce_operations,baitly_hardware_reservations,baitly_hardware_stock_changes,baitly_hardware_stock,baitly_purchase_requests");
            s.execute("ALTER TABLE upsell_orders DROP COLUMN concierge_amount, DROP COLUMN beneficiary_owner_id");
            s.execute("ALTER TABLE upsell_orders ALTER COLUMN reservation_id SET NOT NULL");
            s.execute("ALTER TABLE activity_commissions DROP COLUMN property_id, DROP COLUMN beneficiary_owner_id, DROP COLUMN receipt_reference, DROP COLUMN received_at, DROP COLUMN recorded_by");
            s.execute("ALTER TABLE ai_credit_grant ALTER COLUMN stripe_ref TYPE VARCHAR(64)");
            s.execute("ALTER TABLE ai_usage_ledger ALTER COLUMN idempotency_key TYPE VARCHAR(128)");
            s.execute("ALTER TABLE service_quotes DROP COLUMN deposit_transaction_ref");
        }
        for(int pass=0;pass<2;pass++)try(var c=DriverManager.getConnection(url+(url.contains("?")?"&":"?")+"currentSchema="+schema,user,"")) {
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                for(String id:List.of("0516-upsell-settlement-snapshot","0517-affiliate-receipts","0519-commerce-payment-references","0521-ai-credit-ledger-reference","0528-affiliate-adjustments","0529-commerce-operations","0530-hardware-inventory","0531-commerce-purchase-requests","0532-commerce-payouts","0533-sale-documents","0534-einvoice-submission-boundary","0536-unissued-commerce-payout-cancellation","0537-invoice-issuer-sequences","0538-commerce-beneficiary-read-and-stock-retry","0539-commerce-issuer-evidence","0540-iopole-status-inbox","0541-invoice-fiscal-documents","0542-invoice-verification-and-pdf-archive"))
                    selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->cs.getId().equals(id)).findFirst().orElseThrow());
                new Liquibase(selected,resources,db).update("");
            }
        }
    }
    @AfterAll static void close() throws Exception {
        if(factory!=null)factory.close();
        if(schema!=null)try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}
    }
    static <T>T tx(Function<EntityManager,T> work) {
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin();
            try {T result=work.apply(em);em.getTransaction().commit();return result;}
            catch(RuntimeException e) {em.getTransaction().rollback();throw e;}
        }
    }
    @BeforeEach void seed() {
        orderId=tx(em->{
            em.createNativeQuery("TRUNCATE baitly_invoice_reviews,baitly_invoice_pdf_archives,users,payment_connections,baitly_commerce_evidence,baitly_sale_documents,baitly_iopole_statuses,baitly_invoice_fiscal_documents").executeUpdate();
            for(String entity:List.of("EInvoiceSubmission","InvoiceLine","Invoice","BaitlyCommerceRecovery","PayoutTransfer","BaitlyCommercePayout","BaitlyPurchaseRequest","BaitlyHardwareReservation","BaitlyHardwareStockChange","BaitlyHardwareStock","BaitlyCommerceOperation","BaitlyAffiliateAdjustment","LedgerEntry","Wallet","PaymentTransaction","UpsellOrder","HardwareOrder","ActivityCommission","ServiceQuote","AiCreditGrant","AiUsageLedgerEntry"))
                em.createQuery("delete from "+entity).executeUpdate();
            UpsellOrder order=new UpsellOrder();order.setOrganizationId(2L);order.setTitle("Petit déjeuner");
            order.setAmount(new BigDecimal("100"));order.setCurrency("EUR");order.setStripeSessionId("cs_test");
            order.setPlatformFeeAmount(new BigDecimal("10"));order.setConciergeAmount(new BigDecimal("18"));order.setHostAmount(new BigDecimal("72"));order.setBeneficiaryOwnerId(4L);em.persist(order);
            PaymentTransaction payment=new PaymentTransaction();payment.setOrganizationId(2L);payment.setTransactionRef("TX-TEST");
            payment.setProviderType(PaymentProviderType.STRIPE);payment.setPaymentType(TransactionType.CHECKOUT);payment.setStatus(TransactionStatus.COMPLETED);
            payment.setSourceType("UPSELL");payment.setSourceId(order.getId());payment.setProviderTxId("cs_test");payment.setAmount(new BigDecimal("100"));payment.setCurrency("EUR");em.persist(payment);
            for(WalletType type:List.of(WalletType.PLATFORM,WalletType.CONCIERGE,WalletType.OWNER)) {
                Wallet wallet=new Wallet();wallet.setOrganizationId(2L);wallet.setWalletType(type);wallet.setCurrency("EUR");
                if(type==WalletType.OWNER)wallet.setOwnerId(4L);em.persist(wallet);
            }
            return order.getId();
        });
    }
    @Test void sellerEvidenceIsImmutableIdempotentAndBoundToActualMoney() {
        tx(em->{service(em).settle("cs_test");return null;});
        var file=BaitlyFinancialDocument.checked("%PDF-1.4 TEST ONLY\n%%EOF".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var request=new BaitlyCommerceEvidenceStore.Request(UUID.randomUUID(),"INVOICE","TX-TEST","VENDOR-1","Vendeur de test","Mandat test",new BigDecimal("100"),"EUR");
        Long evidence=tx(em->new BaitlyCommerceEvidenceStore(em).attach(2L,"UPSELL",orderId,request,file,"staff").id());
        tx(em->{var store=new BaitlyCommerceEvidenceStore(em);assertThat(store.attach(2L,"UPSELL",orderId,request,file,"staff").id()).isEqualTo(evidence);
            assertThat(store.dossier(2L,"UPSELL",orderId).targets()).isEmpty();assertThat(store.document(2L,evidence).sha256()).isEqualTo(file.sha256());return null;});
        assertThatThrownBy(()->tx(em->new BaitlyCommerceEvidenceStore(em).document(3L,evidence))).hasMessageContaining("inaccessible");
        assertThatThrownBy(()->tx(em->{em.createNativeQuery("UPDATE baitly_commerce_evidence SET issuer='Autre' WHERE id=:id").setParameter("id",evidence).executeUpdate();return null;})).hasMessageContaining("immutable");
        String ref=tx(em->refunds(em).prepare(2L,"TX-TEST",new BigDecimal("5"),UUID.randomUUID(),"Partiel","staff"));
        tx(em->{assertThat(new BaitlyCommerceEvidenceStore(em).dossier(2L,"UPSELL",orderId).targets()).isEmpty();return null;});
        confirmRefund(ref,"re_evidence");
        var credit=new BaitlyCommerceEvidenceStore.Request(UUID.randomUUID(),"CREDIT_NOTE",ref,"CREDIT-1","Vendeur de test","Mandat test",new BigDecimal("5"),"EUR");
        tx(em->{var store=new BaitlyCommerceEvidenceStore(em);assertThat(store.dossier(2L,"UPSELL",orderId).targets()).singleElement().satisfies(t->assertThat(t.amount()).isEqualByComparingTo("5"));
            store.attach(2L,"UPSELL",orderId,credit,file,"staff");assertThat(store.dossier(2L,"UPSELL",orderId).documents()).hasSize(2);return null;});
    }

    @Test void iopoleEventsSurviveConcurrentReplayAndRemainScopedAndImmutable() throws Exception {
        var customer=UUID.randomUUID();var remote=UUID.randomUUID();var status=UUID.randomUUID();
        var event=new com.clenzy.fiscal.einvoicing.francepdp.BaitlyIopoleInboxStore.Event(status,remote,"{\"status\":\"RECEIVED\"}");
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);
            Callable<Void> save=()->{barrier.await(5,TimeUnit.SECONDS);tx(em->{new com.clenzy.fiscal.einvoicing.francepdp.BaitlyIopoleInboxStore(em).retain(2L,"SANDBOX",customer,List.of(event));return null;});return null;};
            var a=pool.submit(save);var b=pool.submit(save);a.get(20,TimeUnit.SECONDS);b.get(20,TimeUnit.SECONDS);
        }
        tx(em->{var store=new com.clenzy.fiscal.einvoicing.francepdp.BaitlyIopoleInboxStore(em);
            assertThat(store.history(2L,"SANDBOX",customer,remote)).containsExactly(event.body());
            assertThat(store.history(3L,"SANDBOX",customer,remote)).isEmpty();assertThat(store.history(2L,"LIVE",customer,remote)).isEmpty();return null;});
        assertThatThrownBy(()->tx(em->{new com.clenzy.fiscal.einvoicing.francepdp.BaitlyIopoleInboxStore(em).retain(3L,"SANDBOX",customer,List.of(event));return null;})).hasMessageContaining("autre organisation");
        var changed=new com.clenzy.fiscal.einvoicing.francepdp.BaitlyIopoleInboxStore.Event(status,remote,"{\"status\":\"REJECTED\"}");
        assertThatThrownBy(()->tx(em->{new com.clenzy.fiscal.einvoicing.francepdp.BaitlyIopoleInboxStore(em).retain(2L,"SANDBOX",customer,List.of(changed));return null;})).hasMessageContaining("différent");
        assertThatThrownBy(()->tx(em->{em.createNativeQuery("UPDATE baitly_iopole_statuses SET body='{}'").executeUpdate();return null;})).hasMessageContaining("immutable");
    }

    @Test void iopoleBatchRollbackCannotLeaveAnAcknowledgableHalfBatch() {
        var customer=UUID.randomUUID();var remote=UUID.randomUUID();
        var event=new com.clenzy.fiscal.einvoicing.francepdp.BaitlyIopoleInboxStore.Event(UUID.randomUUID(),remote,"{}");
        assertThatThrownBy(()->tx(em->{new com.clenzy.fiscal.einvoicing.francepdp.BaitlyIopoleInboxStore(em).retain(2L,"SANDBOX",customer,List.of(event));throw new IllegalStateException("test rollback");})).hasMessageContaining("rollback");
        tx(em->{assertThat(new com.clenzy.fiscal.einvoicing.francepdp.BaitlyIopoleInboxStore(em).history(2L,"SANDBOX",customer,remote)).isEmpty();return null;});
    }
    @Test void commerceAccountResolutionUsesTheFrozenBeneficiaryAndRejectsRevocation() {
        tx(em->{service(em).settle("cs_test");em.createNativeQuery("INSERT INTO users(id,organization_id) VALUES (4,9),(5,10)").executeUpdate();
            var connection=new PaymentConnection();connection.setOrganizationId(9L);connection.setUserId(4L);connection.setBeneficiaryKey("user:4");connection.setCountry("FR");connection.setProviderAccountId("acct_cross_org");connection.updateCapabilities(true,true,true,true);em.persist(connection);em.flush();
            var repo=new JpaRepositoryFactory(em).getRepository(PaymentConnectionRepository.class);
            assertThat(repo.findCommerceOwnerAccount(2L,"UPSELL",orderId,4L)).get().satisfies(a->{assertThat(a.getAccountId()).isEqualTo("acct_cross_org");assertThat(a.getReady()).isTrue();});
            assertThat(repo.findCommerceOwnerAccount(3L,"UPSELL",orderId,4L)).isEmpty();assertThat(repo.findCommerceOwnerAccount(2L,"UPSELL",orderId,5L)).isEmpty();
            connection.setAuthorized(false);em.flush();assertThat(repo.findCommerceOwnerAccount(2L,"UPSELL",orderId,4L).orElseThrow().getReady()).isFalse();return null;});
    }
    @Test void refundAloneDoesNotRestockAndPhysicalReturnCannotBeCountedTwice() {
        Long id=tx(em->{inventory(em).adjust("FR","CLENZY-NM-01",0,1,UUID.randomUUID(),"Stock réel test","staff");var order=hardware(em);inventory(em).reserve(order,"FR");em.flush();inventory(em).paid(order);order.setStatus(OrderStatus.PAID);return order.getId();});
        assertThatThrownBy(()->tx(em->{inventory(em).returnToStock(2L,id,"RETURN-1","staff");return null;})).hasMessageContaining("Retour reçu");
        tx(em->{em.persist(new BaitlyCommerceOperation(2L,"HARDWARE_ORDER",id,UUID.randomUUID(),"RETURNED","RETURN-1","Retour contrôlé test","staff"));return null;});
        tx(em->{inventory(em).returnToStock(2L,id,"RETURN-1","staff");return null;});
        tx(em->{inventory(em).returnToStock(2L,id,"RETURN-1","staff");assertThat(inventory(em).list("FR").getFirst().getAvailable()).isEqualTo(1);return null;});
        assertThatThrownBy(()->tx(em->{inventory(em).returnToStock(2L,id,"WRONG","staff");return null;})).hasMessageContaining("autre justificatif");
    }

    BaitlyUpsellSettlement service(EntityManager em) {
        var repos=new JpaRepositoryFactory(em);
        var payments=mock(PaymentTransactionRepository.class);
        when(payments.findByProviderTxId("cs_test")).thenAnswer(call->em.createQuery("from PaymentTransaction where providerTxId=:id",PaymentTransaction.class).setParameter("id","cs_test").getResultStream().findFirst());
        var wallets=mock(WalletService.class);
        when(wallets.getOrCreatePlatformWallet(2L,"EUR")).thenAnswer(call->wallet(em,WalletType.PLATFORM));
        when(wallets.getOrCreateWallet(eq(2L),any(),nullable(Long.class),eq("EUR"))).thenAnswer(call->wallet(em,call.getArgument(1)));
        return new BaitlyUpsellSettlement(repos.getRepository(UpsellOrderRepository.class),payments,mock(ReservationRepository.class),
                mock(WelcomeGuideRepository.class),mock(MonetizationConfigService.class),mock(ManagementContractService.class),wallets,
                new LedgerService(repos.getRepository(LedgerEntryRepository.class)),Clock.systemUTC());
    }
    Wallet wallet(EntityManager em,WalletType type) {return em.createQuery("from Wallet where walletType=:type",Wallet.class).setParameter("type",type).getSingleResult();}
    @Test void concurrentWebhooksCreditExactlyOneBalancedSplit() throws Exception {
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);
            Callable<Void> settle=()->{barrier.await(5,TimeUnit.SECONDS);tx(em->{service(em).settle("cs_test");return null;});return null;};
            var first=pool.submit(settle);var second=pool.submit(settle);first.get(20,TimeUnit.SECONDS);second.get(20,TimeUnit.SECONDS);
        }
        tx(em->{
            assertThat(em.find(UpsellOrder.class,orderId).getStatus()).isEqualTo(UpsellOrderStatus.PAID);
            assertThat(em.createQuery("from LedgerEntry",LedgerEntry.class).getResultList()).hasSize(4);
            var ledger=new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class));
            assertThat(ledger.calculateBalance(wallet(em,WalletType.OWNER).getId())).isEqualByComparingTo("72");
            assertThat(ledger.calculateBalance(wallet(em,WalletType.PLATFORM).getId())).isEqualByComparingTo("-90");
            return null;
        });
    }
    @Test void failedCommitRollsBackAllAllocationsAndCanBeRetried() {
        assertThatThrownBy(()->tx(em->{service(em).settle("cs_test");em.flush();throw new IllegalStateException("incident simulé");})).hasMessageContaining("simulé");
        tx(em->{assertThat(em.createQuery("select count(e) from LedgerEntry e",Long.class).getSingleResult()).isZero();
            assertThat(em.find(UpsellOrder.class,orderId).getStatus()).isEqualTo(UpsellOrderStatus.PENDING);service(em).settle("cs_test");return null;});
    }
    @Test void hardwareCartPersistsAsJsonArrayAndSurvivesReload() {
        long id=tx(em->{HardwareOrder order=new HardwareOrder();order.setOrganizationId(2L);order.setUserId("test-buyer");order.setTotalAmount(19900);order.setItemsJson("[{\"sku\":\"CLENZY-NM-01\",\"quantity\":1}]");em.persist(order);return order.getId();});
        tx(em->{assertThat(em.find(HardwareOrder.class,id).getItemsJson()).contains("CLENZY-NM-01");
            assertThat(em.createNativeQuery("SELECT jsonb_typeof(items_json) FROM hardware_orders WHERE id=:id",String.class).setParameter("id",id).getSingleResult()).isEqualTo("array");return null;});
    }
    @Test void longStripeCheckoutReferenceSurvivesCreditGrantPersistence() {
        String ref="cs_test_"+"a".repeat(247);
        tx(em->{var r=new JpaRepositoryFactory(em);
            var service=new com.clenzy.service.ai.AiCreditGrantService(r.getRepository(AiCreditGrantRepository.class),
                r.getRepository(AiUsageLedgerRepository.class),mock(com.clenzy.service.ai.CreditBalanceService.class),
                mock(UserRepository.class),mock(OrganizationRepository.class),500000,2000000,8000000);
            service.grantTopUp(2L,500000,ref);service.grantTopUp(2L,500000,ref);return null;});
        tx(em->{assertThat(em.createQuery("from AiCreditGrant",AiCreditGrant.class).getResultList()).singleElement()
                .satisfies(g->assertThat(g.getStripeRef()).isEqualTo(ref));
            assertThat(em.createQuery("from AiUsageLedgerEntry",AiUsageLedgerEntry.class).getResultList()).singleElement()
                .satisfies(e->{assertThat(e.getIdempotencyKey()).isEqualTo("grant:"+ref);assertThat(e.getMillicredits()).isEqualTo(500000);});return null;});
    }
    @Test void concurrentDepositReceiptsCannotReduceBalanceTwiceAndRollbackLeavesNoPaidDate()throws Exception {
        Long id=tx(em->{var q=BaitlyMaintenanceDepositTest.quote();q.setId(null);q.setProviderName("Prestataire sandbox");em.persist(q);return q.getId();});
        assertThatThrownBy(()->tx(em->{new DepositReconciler(new JpaRepositoryFactory(em).getRepository(ServiceQuoteRepository.class))
                .onPaymentCompleted(BaitlyMaintenanceDepositTest.payment());em.flush();throw new IllegalStateException("échec simulé");})).hasMessageContaining("simulé");
        tx(em->{assertThat(em.find(ServiceQuote.class,id).getDepositPaidAt()).isNull();return null;});
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);Callable<Void> receipt=()->{barrier.await(5,TimeUnit.SECONDS);tx(em->{
                new DepositReconciler(new JpaRepositoryFactory(em).getRepository(ServiceQuoteRepository.class)).onPaymentCompleted(BaitlyMaintenanceDepositTest.payment());return null;});return null;};
            var a=pool.submit(receipt);var b=pool.submit(receipt);a.get(20,TimeUnit.SECONDS);b.get(20,TimeUnit.SECONDS);
        }
        tx(em->{var q=em.find(ServiceQuote.class,id);assertThat(q.getDepositTransactionRef()).isEqualTo("DEP-1");assertThat(q.getDepositPaidAt()).isNotNull();
            var mission=new Intervention();mission.setEstimatedCost(new BigDecimal("200"));
            assertThat(InterventionPaymentAmounts.payable(mission,List.of(q),false)).isEqualByComparingTo("160");return null;});
    }
    BaitlyAffiliateAdjustments adjustments(EntityManager em) {
        var repos=new JpaRepositoryFactory(em);var wallets=mock(WalletService.class);
        when(wallets.getOrCreatePlatformWallet(2L,"EUR")).thenAnswer(c->wallet(em,WalletType.PLATFORM));
        when(wallets.getOrCreateWallet(2L,WalletType.OWNER,4L,"EUR")).thenAnswer(c->wallet(em,WalletType.OWNER));
        return new BaitlyAffiliateAdjustments(repos.getRepository(ActivityCommissionRepository.class),em,wallets,new LedgerService(repos.getRepository(LedgerEntryRepository.class)),commercePayouts(em));
    }
    long receivedCommission(boolean ledgerProof) {
        return tx(em->{var row=new ActivityCommission();row.setOrganizationId(2L);row.setProvider(ActivityProvider.VIATOR);row.setExternalBookingId("VT-proof");
            row.setGrossCommission(new BigDecimal("100"));row.setHostShare(new BigDecimal("80"));row.setPlatformShare(new BigDecimal("20"));row.setCurrency("EUR");
            row.setBeneficiaryOwnerId(4L);row.setReceiptReference("BANK-proof");row.setStatus(ActivityCommissionStatus.RECEIVED);em.persist(row);em.flush();
            if(ledgerProof)new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).recordTransfer(wallet(em,WalletType.PLATFORM),wallet(em,WalletType.OWNER),new BigDecimal("80"),LedgerReferenceType.COMMISSION,"ACTIVITY-"+row.getId(),"Recette locale");return row.getId();});
    }
    @Test void commissionCorrectionIsConcurrentIdempotentAndKeepsOriginalRate()throws Exception {
        long id=receivedCommission(true);UUID request=UUID.randomUUID();
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);Callable<Void> work=()->{barrier.await(5,TimeUnit.SECONDS);tx(em->{adjustments(em).correct(2L,id,request,new BigDecimal("100"),new BigDecimal("33.33"),"EUR","BANK-adjust","Remboursement activité","staff");return null;});return null;};
            var a=pool.submit(work);var b=pool.submit(work);a.get(20,TimeUnit.SECONDS);b.get(20,TimeUnit.SECONDS);
        }
        tx(em->{var row=em.find(ActivityCommission.class,id);assertThat(row.getHostShare()).isEqualByComparingTo("26.66");
            assertThat(adjustments(em).history(2L,id)).hasSize(1);
            assertThat(new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).calculateBalance(wallet(em,WalletType.OWNER).getId())).isEqualByComparingTo("26.66");
            adjustments(em).correct(2L,id,UUID.randomUUID(),new BigDecimal("33.33"),new BigDecimal("60"),"EUR","BANK-correction","Montant révisé","staff");
            assertThat(row.getHostShare()).isEqualByComparingTo("48");return null;});
        assertThatThrownBy(()->tx(em->adjustments(em).correct(2L,id,UUID.randomUUID(),new BigDecimal("33.33"),BigDecimal.ZERO,"EUR","BANK-stale","Annulation","staff"))).hasMessageContaining("actualisez");
        assertThatThrownBy(()->tx(em->adjustments(em).history(3L,id))).hasMessageContaining("inaccessible");
    }
    @Test void correctionRefusesUnprovenHistoricalAllocationAndRollsBack() {
        long id=receivedCommission(false);
        assertThatThrownBy(()->tx(em->adjustments(em).correct(2L,id,UUID.randomUUID(),new BigDecimal("100"),BigDecimal.ZERO,"EUR","BANK-cancel","Annulation","staff"))).hasMessageContaining("rapprochement");
        tx(em->{assertThat(adjustments(em).history(2L,id)).isEmpty();assertThat(em.find(ActivityCommission.class,id).getGrossCommission()).isEqualByComparingTo("100");return null;});
    }
    @Test void fullCommissionCancellationKeepsAuditAndReversesOnlyAttributedMoney() {
        long id=receivedCommission(true);UUID request=UUID.randomUUID();
        tx(em->{var service=adjustments(em);service.correct(2L,id,request,new BigDecimal("100"),BigDecimal.ZERO,"EUR","BANK-cancel","Annulation activité","staff");
            service.correct(2L,id,request,new BigDecimal("100"),BigDecimal.ZERO,"EUR","BANK-cancel","Annulation activité","staff");return null;});
        tx(em->{assertThat(em.find(ActivityCommission.class,id).getStatus()).isEqualTo(ActivityCommissionStatus.CANCELLED);
            var ledger=new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class));
            assertThat(ledger.calculateBalance(wallet(em,WalletType.OWNER).getId())).isZero();
            assertThat(em.createQuery("from LedgerEntry",LedgerEntry.class).getResultList()).hasSize(4);return null;});
    }

    BaitlyCommerceRefunds refunds(EntityManager em) {
        var repos=new JpaRepositoryFactory(em);var wallets=mock(WalletService.class);
        when(wallets.getOrCreatePlatformWallet(2L,"EUR")).thenAnswer(c->wallet(em,WalletType.PLATFORM));
        when(wallets.getOrCreateWallet(eq(2L),any(),nullable(Long.class),eq("EUR"))).thenAnswer(c->wallet(em,c.getArgument(1)));
        return new BaitlyCommerceRefunds(em,repos.getRepository(PaymentTransactionRepository.class),wallets,new LedgerService(repos.getRepository(LedgerEntryRepository.class)),mock(com.clenzy.service.ai.BaitlyCreditFunding.class),commercePayouts(em));
    }
    void confirmRefund(String ref,String proof) {
        tx(em->{var row=em.createQuery("from PaymentTransaction where transactionRef=:ref",PaymentTransaction.class).setParameter("ref",ref).getSingleResult();
            row.setStatus(TransactionStatus.COMPLETED);row.setProviderTxId(proof);em.flush();refunds(em).reconcile(ref);return null;});
    }
    @Test void partialThenFullUpsellRefundReversesFrozenSharesExactlyOnce() {
        tx(em->{service(em).settle("cs_test");return null;});UUID key=UUID.randomUUID();
        String first=tx(em->refunds(em).prepare(2L,"TX-TEST",new BigDecimal("33.33"),key,"Annulation partielle","staff"));
        String replay=tx(em->refunds(em).prepare(2L,"TX-TEST",new BigDecimal("33.33"),key,"Annulation partielle","staff"));assertThat(replay).isEqualTo(first);
        assertThatThrownBy(()->tx(em->refunds(em).prepare(2L,"TX-TEST",new BigDecimal("2"),UUID.randomUUID(),"Deuxième","staff"))).hasMessageContaining("précédente");
        confirmRefund(first,"re_first");
        tx(em->{refunds(em).reconcile(first);assertThat(refunds(em).view(2L,"TX-TEST").available()).isEqualByComparingTo("66.67");
            var ledger=new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class));
            assertThat(ledger.calculateBalance(wallet(em,WalletType.OWNER).getId())).isEqualByComparingTo("48.00");return null;});
        assertThatThrownBy(()->tx(em->refunds(em).prepare(2L,"TX-TEST",new BigDecimal("66.68"),UUID.randomUUID(),"Trop","staff"))).hasMessageContaining("dépasse");
        String last=tx(em->refunds(em).prepare(2L,"TX-TEST",new BigDecimal("66.67"),UUID.randomUUID(),"Solde","staff"));confirmRefund(last,"re_last");
        tx(em->{refunds(em).reconcile(first);refunds(em).reconcile(last);assertThat(refunds(em).view(2L,"TX-TEST").available()).isZero();
            var ledger=new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class));
            assertThat(ledger.calculateBalance(wallet(em,WalletType.OWNER).getId())).isZero();assertThat(ledger.calculateBalance(wallet(em,WalletType.CONCIERGE).getId())).isZero();
            assertThat(em.find(UpsellOrder.class,orderId).getStatus()).isEqualTo(UpsellOrderStatus.REFUNDED);
            assertThat(em.createQuery("from LedgerEntry",LedgerEntry.class).getResultList()).hasSize(12);return null;});
    }
    @Test void concurrentCommerceRefundDecisionsCannotExceedBudget() throws Exception {
        tx(em->{service(em).settle("cs_test");return null;});
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);Callable<Boolean> work=()->{barrier.await(5,TimeUnit.SECONDS);try{tx(em->refunds(em).prepare(2L,"TX-TEST",new BigDecimal("60"),UUID.randomUUID(),"Annulation","staff"));return true;}catch(com.clenzy.exception.PaymentValidationException expected){return false;}};
            var a=pool.submit(work);var b=pool.submit(work);assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        assertThatThrownBy(()->tx(em->refunds(em).view(3L,"TX-TEST"))).hasMessageContaining("Encaissement");
        tx(em->{assertThat(refunds(em).view(2L,"TX-TEST").reserved()).isEqualByComparingTo("60");return null;});
    }

    BaitlyHardwareInventory inventory(EntityManager em){return new BaitlyHardwareInventory(em,new com.fasterxml.jackson.databind.ObjectMapper());}
    ShopService shop(EntityManager em,com.clenzy.payment.StripeGateway stripe) {
        var repos=new JpaRepositoryFactory(em);
        return new ShopService(repos.getRepository(HardwareOrderRepository.class),new com.clenzy.tenant.TenantContext(),
                new com.fasterxml.jackson.databind.ObjectMapper(),stripe,mock(PaymentOrchestrationService.class),
                mock(org.springframework.transaction.PlatformTransactionManager.class),repos.getRepository(PaymentTransactionRepository.class),
                inventory(em),new BaitlyPurchaseRequests(em),mock(OrganizationRepository.class),mock(BaitlyPlatformCommerce.class));
    }
    @Test void lostCheckoutBindingIsRecoveredAndUnavailablePspDoesNotStarveOtherStock() throws Exception {
        List<Long> ids=tx(em->{
            inventory(em).adjust("FR","CLENZY-NM-01",0,2,UUID.randomUUID(),"Stock test","staff");
            var lost=hardware(em);lost.setStripeSessionId(null);inventory(em).reserve(lost,"FR");
            var next=hardware(em);next.setStripeSessionId("cs_next");inventory(em).reserve(next,"FR");
            var payment=new PaymentTransaction();payment.setOrganizationId(2L);payment.setTransactionRef("TX-HARDWARE");
            payment.setProviderType(PaymentProviderType.STRIPE);payment.setPaymentType(TransactionType.CHECKOUT);
            payment.setStatus(TransactionStatus.PROCESSING);payment.setSourceType("HARDWARE_ORDER");payment.setSourceId(lost.getId());
            payment.setProviderTxId("cs_lost");payment.setAmount(new BigDecimal("49"));payment.setCurrency("EUR");em.persist(payment);em.flush();
            em.createNativeQuery("UPDATE hardware_orders SET created_at=now()-interval '2 hours',stock_check_at=now()-interval '1 hour'").executeUpdate();
            return List.of(lost.getId(),next.getId());
        });
        var stripe=mock(com.clenzy.payment.StripeGateway.class);
        when(stripe.retrieveSession("cs_lost")).thenThrow(new com.stripe.exception.ApiException("indisponible",null,null,503,null));
        var expired=new com.stripe.model.checkout.Session();expired.setId("cs_next");expired.setStatus("expired");expired.setPaymentStatus("unpaid");
        expired.setAmountTotal(4900L);expired.setCurrency("eur");expired.setMetadata(Map.of("sourceType","HARDWARE_ORDER","sourceId",ids.get(1).toString(),"orgId","2"));
        when(stripe.retrieveSession("cs_next")).thenReturn(expired);
        tx(em->{var tenants=mock(com.clenzy.tenant.TenantScopedExecutor.class);
            doAnswer(call->{((Runnable)call.getArgument(1)).run();return null;}).when(tenants).runAsOrganization(eq(2L),any());
            new BaitlyHardwareAbandonment(em,new JpaRepositoryFactory(em).getRepository(HardwareOrderRepository.class),stripe,inventory(em),shop(em,stripe),tenants).recover();return null;});
        tx(em->{var lost=em.find(HardwareOrder.class,ids.getFirst());assertThat(lost.getStripeSessionId()).isEqualTo("cs_lost");
            assertThat(lost.getStatus()).isEqualTo(OrderStatus.PENDING);assertThat(em.find(HardwareOrder.class,ids.get(1)).getStatus()).isEqualTo(OrderStatus.CANCELLED);
            assertThat(inventory(em).list("FR").getFirst().getAvailable()).isEqualTo(1);
            assertThat(((Number)em.createNativeQuery("SELECT count(*) FROM hardware_orders WHERE stock_check_at<=now()").getSingleResult()).intValue()).isZero();return null;});
    }
    HardwareOrder hardware(EntityManager em){var order=new HardwareOrder();order.setOrganizationId(2L);order.setUserId("buyer");order.setTotalAmount(4900);order.setStripeSessionId("cs_hardware");order.setItemsJson("[{\"sku\":\"CLENZY-NM-01\",\"quantity\":1}]");em.persist(order);return order;}
    @Test void lastHardwareUnitIsReservedOnceAndAbandonmentReleasesIt()throws Exception {
        tx(em->{inventory(em).adjust("FR","CLENZY-NM-01",0,1,UUID.randomUUID(),"STOCK-received","staff");return null;});
        List<Long> ids=tx(em->List.of(hardware(em).getId(),hardware(em).getId()));
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);var results=new ArrayList<Future<Boolean>>();
            for(Long id:ids)results.add(pool.submit(()->{barrier.await(5,TimeUnit.SECONDS);try{tx(em->{inventory(em).reserve(em.find(HardwareOrder.class,id),"FR");return null;});return true;}catch(IllegalStateException expected){return false;}}));
            assertThat(List.of(results.get(0).get(20,TimeUnit.SECONDS),results.get(1).get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        Long held=tx(em->{var rows=em.createQuery("from BaitlyHardwareReservation",BaitlyHardwareReservation.class).getResultList();assertThat(rows).hasSize(1);
            assertThat(inventory(em).list("FR").getFirst().getAvailable()).isZero();return rows.getFirst().getOrderId();});
        tx(em->{inventory(em).release(2L,held,"cs_hardware");assertThat(inventory(em).list("FR").getFirst().getAvailable()).isEqualTo(1);return null;});
        assertThatThrownBy(()->tx(em->{inventory(em).paid(em.find(HardwareOrder.class,held));return null;})).hasMessageContaining("tardif");
    }
    @Test void stockReceiptRetryAndPurchaseRetryAreDurableAndBoundToBuyer()throws Exception {
        UUID stock=UUID.randomUUID(),purchase=UUID.randomUUID();
        tx(em->{inventory(em).adjust("FR","CLENZY-NM-01",0,2,stock,"STOCK-proof","staff");inventory(em).adjust("FR","CLENZY-NM-01",0,2,stock,"STOCK-proof","staff");return null;});
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);Callable<Long> work=()->{barrier.await(5,TimeUnit.SECONDS);return tx(em->new BaitlyPurchaseRequests(em).prepare(2L,purchase,"HARDWARE_ORDER","buyer","CLENZY-NM-01:1",()->{var order=hardware(em);inventory(em).reserve(order,"FR");return order.getId();}));};
            var a=pool.submit(work);var b=pool.submit(work);assertThat(a.get(20,TimeUnit.SECONDS)).isEqualTo(b.get(20,TimeUnit.SECONDS));
        }
        assertThatThrownBy(()->tx(em->new BaitlyPurchaseRequests(em).prepare(2L,purchase,"HARDWARE_ORDER","other-buyer","CLENZY-NM-01:1",()->9L))).hasMessageContaining("autre achat");
        tx(em->{assertThat(inventory(em).list("FR").getFirst().getAvailable()).isEqualTo(1);assertThat(em.createQuery("from HardwareOrder",HardwareOrder.class).getResultList()).hasSize(1);return null;});
    }
    @Test void upsellFulfilmentRequiresReceiptAndKeepsEvidenceAfterCancellation() {
        tx(em->{service(em).settle("cs_test");var operations=new BaitlyCommerceOperations(em);UUID request=UUID.randomUUID();
            operations.record(2L,"UPSELL",orderId,request,"SCHEDULED","RDV-1","Demain 10 h","staff");
            operations.record(2L,"UPSELL",orderId,request,"SCHEDULED","RDV-1","Demain 10 h","staff");
            operations.record(2L,"UPSELL",orderId,UUID.randomUUID(),"CANCELLED","CANCEL-1","Demande voyageur","staff");
            assertThat(operations.history(2L,"UPSELL",orderId)).hasSize(2);return null;});
        assertThatThrownBy(()->tx(em->new BaitlyCommerceOperations(em).record(2L,"UPSELL",orderId,UUID.randomUUID(),"FULFILLED","PROOF","","staff"))).hasMessageContaining("Transition");
        assertThatThrownBy(()->tx(em->new BaitlyCommerceOperations(em).history(3L,"UPSELL",orderId))).hasMessageContaining("hors organisation");
    }

    WalletService payoutWallets(EntityManager em) {
        var wallets=mock(WalletService.class);
        when(wallets.getOrCreatePlatformWallet(2L,"EUR")).thenAnswer(c->wallet(em,WalletType.PLATFORM));
        when(wallets.getOrCreateWallet(eq(2L),any(),nullable(Long.class),eq("EUR"))).thenAnswer(c->wallet(em,c.getArgument(1)));return wallets;
    }
    BaitlyCommercePayoutStore commercePayouts(EntityManager em) {
        var connections=mock(PaymentConnectionRepository.class);
        var owner=mock(PaymentConnectionRepository.ProviderAccount.class);when(owner.getReady()).thenReturn(true);when(owner.getAccountId()).thenReturn("acct_owner");
        when(connections.findCommerceOwnerAccount(eq(2L),anyString(),anyLong(),eq(4L))).thenReturn(Optional.of(owner));
        when(connections.findByOrganizationIdAndBeneficiaryKey(eq(2L),anyString())).thenAnswer(c->{
            var p=new PaymentConnection();p.setOrganizationId(2L);p.setBeneficiaryKey(c.getArgument(1));
            if(p.getBeneficiaryKey().startsWith("user:"))p.setUserId(4L);p.setCountry("FR");p.setProviderAccountId("acct_owner");p.updateCapabilities(true,true,true,true);return Optional.of(p);});
        return new BaitlyCommercePayoutStore(em,payoutWallets(em),new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)),connections);
    }
    PayoutTransfer markTransferred(EntityManager em,PayoutTransferInstruction instruction) {
        var repo=new JpaRepositoryFactory(em).getRepository(PayoutTransferRepository.class);var store=commercePayouts(em);store.requireInstruction(instruction);
        repo.insertIfAbsent(instruction.organizationId(),instruction.source().name(),instruction.sourceId(),instruction.beneficiaryUserId(),instruction.beneficiaryOrganizationId(),instruction.amount(),instruction.currency(),instruction.destination(),instruction.description(),instruction.idempotencyKey());
        var transfer=repo.lockBySource(instruction.organizationId(),instruction.source(),instruction.sourceId()).orElseThrow();
        transfer.captureDestinationPayment("py_"+transfer.getId(),false);transfer.transferred("tr_"+transfer.getId());store.settle(transfer);em.flush();return transfer;
    }
    @Test void refundAfterPayoutCreatesExactRecoverableDebtAndPreservesProof() {
        tx(em->{service(em).settle("cs_test");return null;});UUID request=UUID.randomUUID();
        Long transferred=tx(em->{var store=commercePayouts(em);var instruction=store.prepare(2L,"UPSELL",orderId,"OWNER",request,"staff");
            assertThat(instruction.amount()).isEqualByComparingTo("72");var t=markTransferred(em,instruction);store.settle(t);return t.getId();});
        String refund=tx(em->refunds(em).prepare(2L,"TX-TEST",new BigDecimal("33.33"),UUID.randomUUID(),"Retour partiel","staff"));confirmRefund(refund,"re_partial");
        Long recovery=tx(em->{var rows=em.createQuery("from BaitlyCommerceRecovery",BaitlyCommerceRecovery.class).getResultList();assertThat(rows).singleElement().satisfies(r->{assertThat(r.getAmount()).isEqualByComparingTo("24");assertThat(r.getTransferId()).isEqualTo(transferred);});
            assertThat(new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).calculateBalance(wallet(em,WalletType.OWNER).getId())).isEqualByComparingTo("-24");return rows.getFirst().getId();});
        assertThatThrownBy(()->tx(em->commercePayouts(em).prepare(2L,"UPSELL",orderId,"OWNER",UUID.randomUUID(),"staff"))).hasMessageContaining("Récupération");
        tx(em->{var store=new BaitlyCommerceRecoveryStore(em,commercePayouts(em),new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)),payoutWallets(em));
            var instruction=store.claim(2L,recovery).orElseThrow();assertThat(instruction.commerce()).isTrue();assertThat(instruction.key()).startsWith("baitly-commerce-recovery-");
            store.confirm(2L,recovery,"trr_recovered");store.confirm(2L,recovery,"trr_recovered");return null;});
        tx(em->{var view=commercePayouts(em).view(2L,"UPSELL",orderId);assertThat(view.ownerAvailable()).isZero();assertThat(view.conciergeAvailable()).isEqualByComparingTo("12");
            assertThat(em.find(PayoutTransfer.class,transferred).getAmount()).isEqualByComparingTo("72");
            assertThat(new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)).calculateBalance(wallet(em,WalletType.OWNER).getId())).isZero();return null;});
    }
    @Test void affiliatePayoutThenCorrectionAndRecoveryAllowsOnlyNewEntitlement() {
        Long id=receivedCommission(true);
        tx(em->{var instruction=commercePayouts(em).prepare(2L,"AFFILIATE",id,"OWNER",UUID.randomUUID(),"staff");assertThat(instruction.amount()).isEqualByComparingTo("80");markTransferred(em,instruction);return null;});
        tx(em->{adjustments(em).correct(2L,id,UUID.randomUUID(),new BigDecimal("100"),new BigDecimal("50"),"EUR","BANK-correction","Activité partielle","staff");return null;});
        tx(em->{var row=em.createQuery("from BaitlyCommerceRecovery",BaitlyCommerceRecovery.class).getSingleResult();assertThat(row.getAmount()).isEqualByComparingTo("40");
            var store=new BaitlyCommerceRecoveryStore(em,commercePayouts(em),new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class)),payoutWallets(em));store.claim(2L,row.getId());store.confirm(2L,row.getId(),"trr_affiliate");return null;});
        tx(em->{adjustments(em).correct(2L,id,UUID.randomUUID(),new BigDecimal("50"),new BigDecimal("75"),"EUR","BANK-extra","Complément reçu","staff");
            assertThat(commercePayouts(em).prepare(2L,"AFFILIATE",id,"OWNER",UUID.randomUUID(),"staff").amount()).isEqualByComparingTo("20");return null;});
    }
    @Test void onlyAnUnissuedPreparationCanBeCancelledAndReplaced() {
        tx(em->{service(em).settle("cs_test");return null;});UUID request=UUID.randomUUID();
        var prepared=tx(em->commercePayouts(em).prepare(2L,"UPSELL",orderId,"OWNER",request,"staff"));
        assertThatThrownBy(()->tx(em->{commercePayouts(em).cancel(3L,prepared.sourceId(),"other");return null;})).hasMessageContaining("inaccessible");
        tx(em->{var store=commercePayouts(em);store.cancel(2L,prepared.sourceId(),"staff");store.cancel(2L,prepared.sourceId(),"staff");em.flush();
            assertThat(store.view(2L,"UPSELL",orderId).ownerAvailable()).isEqualByComparingTo("72");return null;});
        assertThatThrownBy(()->tx(em->{commercePayouts(em).requireInstruction(prepared);return null;})).hasMessageContaining("changé");
        var sent=tx(em->{var i=commercePayouts(em).prepare(2L,"UPSELL",orderId,"OWNER",UUID.randomUUID(),"staff");markTransferred(em,i);return i;});
        assertThatThrownBy(()->tx(em->{commercePayouts(em).cancel(2L,sent.sourceId(),"staff");return null;})).hasMessageContaining("émission");
    }

    @Test void refundBeforeLateTransferConfirmationStillReservesRecovery() {
        tx(em->{service(em).settle("cs_test");return null;});
        Long transferId=tx(em->{var store=commercePayouts(em);var i=store.prepare(2L,"UPSELL",orderId,"OWNER",UUID.randomUUID(),"staff");store.requireInstruction(i);
            var repo=new JpaRepositoryFactory(em).getRepository(PayoutTransferRepository.class);repo.insertIfAbsent(i.organizationId(),i.source().name(),i.sourceId(),i.beneficiaryUserId(),i.beneficiaryOrganizationId(),i.amount(),i.currency(),i.destination(),i.description(),i.idempotencyKey());
            return repo.lockBySource(i.organizationId(),i.source(),i.sourceId()).orElseThrow().getId();});
        String ref=tx(em->refunds(em).prepare(2L,"TX-TEST",new BigDecimal("50"),UUID.randomUUID(),"Retour tardif","staff"));confirmRefund(ref,"re_late");
        tx(em->{assertThat(em.createQuery("from BaitlyCommerceRecovery").getResultList()).isEmpty();var t=em.find(PayoutTransfer.class,transferId);t.captureDestinationPayment("py_late",false);t.transferred("tr_late");em.flush();commercePayouts(em).settle(t);return null;});
        tx(em->{assertThat(em.createQuery("from BaitlyCommerceRecovery",BaitlyCommerceRecovery.class).getResultList()).singleElement().satisfies(d->assertThat(d.getAmount()).isEqualByComparingTo("36"));return null;});
    }
    Invoice seller(String identity){var i=BaitlyDocumentVerificationTest.invoice();i.setOrganizationId(2L);i.setCountryCode("FR");i.setSellerName("Émetteur de test");i.setSellerAddress("Adresse de test");i.setSellerTaxId(identity);return i;}
    @Test void numberingSeparatesIssuersAndRollsBackWithInvoice() {
        String first=tx(em->new InvoiceNumberingService(null,null,em).generateNextNumberFor(seller("FR-A")));
        var rolledBack=new java.util.concurrent.atomic.AtomicReference<String>();
        assertThatThrownBy(()->tx(em->{rolledBack.set(new InvoiceNumberingService(null,null,em).generateNextNumberFor(seller("FR-A")));throw new IllegalStateException("rollback");}));
        String second=tx(em->new InvoiceNumberingService(null,null,em).generateNextNumberFor(seller("FR-A")));
        assertThat(first).endsWith("00001");assertThat(second).endsWith("00002").isEqualTo(rolledBack.get());
        String other=tx(em->new InvoiceNumberingService(null,null,em).generateNextNumberFor(seller("FR-B")));
        assertThat(other).endsWith("00001").isNotEqualTo(first);
        assertThatThrownBy(()->tx(em->new InvoiceNumberingService(null,null,em).generateNextNumberFor(new Invoice()))).hasMessageContaining("Organisation");
    }
    @Test void concurrentNumberingNeverIssuesSameNumber()throws Exception {
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);Callable<String> work=()->{barrier.await(5,TimeUnit.SECONDS);return tx(em->new InvoiceNumberingService(null,null,em).generateNextNumberFor(seller("FR-CONCURRENT")));};
            var a=pool.submit(work);var b=pool.submit(work);assertThat(a.get(20,TimeUnit.SECONDS)).isNotEqualTo(b.get(20,TimeUnit.SECONDS));
        }
    }
    @Test void documentsKeepCanonicalSnapshotAndRejectCrossTenantOrMutation() {
        Long id=tx(em->{var d=new BaitlySaleDocument(2L,"AI_CREDIT_TOPUP",2L,"TX-IMMUTABLE","");em.persist(d);em.flush();d.complete("acct_test","in_immutable","FR-1","EUR",1000,1200,"https://pay.stripe.com/pdf",java.time.Instant.ofEpochSecond(100),Map.of("seller","Test"));return d.getId();});
        tx(em->{var docs=new BaitlySaleDocumentStore(em);assertThat(docs.list(3L,null,null)).isEmpty();assertThat(docs.list(2L,"AI_CREDIT_TOPUP",2L)).singleElement().satisfies(v->assertThat(v.totalCents()).isEqualTo(1200));return null;});
        assertThatThrownBy(()->tx(em->{em.createNativeQuery("UPDATE baitly_sale_documents SET total_cents=1300 WHERE id=:id").setParameter("id",id).executeUpdate();return null;})).hasMessageContaining("immutable");
        assertThatThrownBy(()->tx(em->{em.createNativeQuery("DELETE FROM baitly_sale_documents WHERE id=:id").setParameter("id",id).executeUpdate();return null;})).hasMessageContaining("immutable");
        assertThatThrownBy(()->tx(em->new BaitlySaleDocumentStore(em).claim(3L,id))).hasMessageContaining("NOT_ACCESSIBLE");
        tx(em->{assertThat(new BaitlySaleDocumentStore(em).export(2L,id,"AI_CREDIT_TOPUP",2L)).containsEntry("number","FR-1").containsEntry("totalCents",1200L);return null;});
        assertThatThrownBy(()->tx(em->new BaitlySaleDocumentStore(em).export(3L,id,null,null))).hasMessageContaining("NOT_ACCESSIBLE");
        assertThatThrownBy(()->tx(em->new BaitlySaleDocumentStore(em).export(2L,id,"HARDWARE_ORDER",2L))).hasMessageContaining("NOT_ACCESSIBLE");
    }
    @Test void missingLegacyDocumentDoesNotStarveTheQueueAndClaimIsFenced() {
        Long id=tx(em->{var d=new BaitlySaleDocument(2L,"AI_CREDIT_TOPUP",2L,"TX-TEST","");em.persist(d);return d.getId();});
        tx(em->{new BaitlySaleDocumentStore(em).failed(2L,id,null,"LEGACY_DOCUMENT_RECONCILIATION_REQUIRED");return null;});
        tx(em->{var store=new BaitlySaleDocumentStore(em);assertThat(store.claim(2L,id)).isEmpty();assertThat(store.list(2L,null,null)).singleElement().satisfies(v->assertThat(v.state()).isEqualTo("REVIEW_REQUIRED"));return null;});
    }

    @Test void simultaneousCommercePayoutsReserveOnlyOneBalance()throws Exception {
        tx(em->{service(em).settle("cs_test");return null;});
        try(var pool=Executors.newFixedThreadPool(2)) {var barrier=new CyclicBarrier(2);Callable<Boolean> work=()->{barrier.await(5,TimeUnit.SECONDS);try{tx(em->commercePayouts(em).prepare(2L,"UPSELL",orderId,"OWNER",UUID.randomUUID(),"staff"));return true;}catch(com.clenzy.exception.PaymentValidationException expected){return false;}};
            var a=pool.submit(work);var b=pool.submit(work);assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        assertThatThrownBy(()->tx(em->commercePayouts(em).prepare(3L,"UPSELL",orderId,"OWNER",UUID.randomUUID(),"staff"))).hasMessageContaining("Encaissement");
    }

    Long fiscalInvoice(){return tx(em->{var i=new Invoice();i.setOrganizationId(2L);i.setInvoiceNumber("FA-TEST");i.setInvoiceDate(java.time.LocalDate.now());i.setStatus(InvoiceStatus.ISSUED);i.setTotalHt(new BigDecimal("100"));i.setTotalTax(new BigDecimal("20"));i.setTotalTtc(new BigDecimal("120"));i.setSellerName("Test vendeur");em.persist(i);return i.getId();});}
    @Test void fiscalSubmissionIsClaimedOnceBeforeAnyPartnerCall()throws Exception {
        Long id=fiscalInvoice();var provider=mock(com.clenzy.fiscal.einvoicing.EInvoicingProvider.class);when(provider.configured()).thenReturn(true);when(provider.providerCode()).thenReturn("test");when(provider.mode()).thenReturn(com.clenzy.fiscal.einvoicing.EInvoicingMode.FACTURX_PDP);
        try(var pool=Executors.newFixedThreadPool(2)){var barrier=new CyclicBarrier(2);Callable<Boolean> submit=()->{barrier.await();return tx(em->new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(2L,id,"FR",provider).send());};
            var a=pool.submit(submit);var b=pool.submit(submit);assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);}
        tx(em->{var store=new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em);assertThat(store.list(3L)).isEmpty();assertThat(store.list(2L)).singleElement().satisfies(v->assertThat(v.getSubmissionStartedAt()).isNotNull());return null;});
        assertThatThrownBy(()->tx(em->new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(3L,id,"FR",provider))).hasMessageContaining("inaccessible");
    }
    @Test void noFiscalConnectorMeansPendingAndNotAnExemption(){
        Long id=fiscalInvoice();var provider=mock(com.clenzy.fiscal.einvoicing.EInvoicingProvider.class);when(provider.providerCode()).thenReturn("unconfigured");when(provider.mode()).thenReturn(com.clenzy.fiscal.einvoicing.EInvoicingMode.NONE);
        tx(em->{var prepared=new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(2L,id,"FR",provider);assertThat(prepared.send()).isFalse();assertThat(prepared.submission().getSubmissionStartedAt()).isNull();assertThat(prepared.submission().getStatus()).isEqualTo(com.clenzy.fiscal.einvoicing.EInvoiceStatus.PENDING);return null;});
        tx(em->{var i=em.find(Invoice.class,id);i.setSellerName("Autre vendeur");return null;});
        tx(em->{var result=new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(2L,id,"FR",provider);
            assertThat(result.send()).isFalse();assertThat(result.submission().getMessage()).contains("a changé");
            assertThat(result.submission().getRetryAt()).isAfter(java.time.Instant.now().plusSeconds(3600));return null;});
    }

    com.clenzy.fiscal.einvoicing.EInvoicingProvider pollingProvider(){
        var provider=mock(com.clenzy.fiscal.einvoicing.EInvoicingProvider.class);
        when(provider.configured()).thenReturn(true);when(provider.providerCode()).thenReturn("factur_x");
        when(provider.mode()).thenReturn(com.clenzy.fiscal.einvoicing.EInvoicingMode.FACTURX_PDP);
        when(provider.supportsReconciliation()).thenReturn(true);return provider;
    }
    void makeSubmissionDue(Long id){tx(em->{em.createNativeQuery("UPDATE einvoice_submissions SET retry_at=now()-interval '1 minute' WHERE invoice_id=:id").setParameter("id",id).executeUpdate();return null;});}

    @Test void incompleteFiscalDocumentIsNotMarkedAsSent(){
        Long id=fiscalInvoice();var provider=pollingProvider();when(provider.readinessIssue(any())).thenReturn("Document CII incomplet");
        tx(em->{var result=new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(2L,id,"FR",provider);
            assertThat(result.send()).isFalse();assertThat(result.submission().getSubmissionStartedAt()).isNull();
            assertThat(result.submission().getMessage()).isEqualTo("Document CII incomplet");return null;});
    }
    @Test void acceptedDepositResumesWithSingleConcurrentReadClaimAndNeverResends()throws Exception {
        Long id=fiscalInvoice();var provider=pollingProvider();
        Long submission=tx(em->new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(2L,id,"FR",provider).submission().getId());
        tx(em->{new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).finish(2L,submission,new com.clenzy.fiscal.einvoicing.EInvoiceResult(com.clenzy.fiscal.einvoicing.EInvoiceStatus.PENDING,"IOPOLE-TEST","Déposé"));return null;});
        makeSubmissionDue(id);
        tx(em->{assertThat(new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).candidates()).contains(new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore.Candidate(2L,id));return null;});
        try(var pool=Executors.newFixedThreadPool(2)){var barrier=new CyclicBarrier(2);Callable<Boolean> poll=()->{barrier.await();return tx(em->{var p=new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(2L,id,"FR",provider);assertThat(p.send()).isFalse();return p.reconcile();});};
            var a=pool.submit(poll);var b=pool.submit(poll);assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);}
        tx(em->{var result=new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).finish(2L,submission,com.clenzy.fiscal.einvoicing.EInvoiceResult.pending("Indisponible"));assertThat(result.getExternalRef()).isEqualTo("IOPOLE-TEST");return null;});
        makeSubmissionDue(id);
        tx(em->{var store=new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em);assertThat(store.prepare(2L,id,"FR",provider).reconcile()).isTrue();
            store.finish(2L,submission,com.clenzy.fiscal.einvoicing.EInvoiceResult.reported("IOPOLE-TEST"));return null;});
        makeSubmissionDue(id);
        tx(em->{var store=new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em);assertThat(store.candidates()).isEmpty();assertThat(store.prepare(2L,id,"FR",provider).reconcile()).isFalse();return null;});
    }
    @Test void unknownDepositOutcomeIsNeverAutomaticallyReemitted(){
        Long id=fiscalInvoice();var provider=pollingProvider();
        Long submission=tx(em->new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(2L,id,"FR",provider).submission().getId());
        tx(em->{new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).finish(2L,submission,com.clenzy.fiscal.einvoicing.EInvoiceResult.pending("Réponse perdue"));return null;});
        makeSubmissionDue(id);
        tx(em->{var store=new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em);assertThat(store.candidates()).isEmpty();var p=store.prepare(2L,id,"FR",provider);assertThat(p.send()).isFalse();assertThat(p.reconcile()).isFalse();return null;});
    }
    @Test void canonicalReceiptCannotBeReplacedOrReadAcrossOrganizations(){
        Long id=fiscalInvoice();var provider=pollingProvider();
        Long submission=tx(em->new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(2L,id,"FR",provider).submission().getId());
        tx(em->{new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).finish(2L,submission,new com.clenzy.fiscal.einvoicing.EInvoiceResult(com.clenzy.fiscal.einvoicing.EInvoiceStatus.PENDING,"IOPOLE-TEST",null));return null;});
        assertThatThrownBy(()->tx(em->new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).finish(2L,submission,com.clenzy.fiscal.einvoicing.EInvoiceResult.reported("OTHER")))).hasMessageContaining("différente");
        assertThatThrownBy(()->tx(em->new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).finish(3L,submission,com.clenzy.fiscal.einvoicing.EInvoiceResult.reported("IOPOLE-TEST")))).hasMessageContaining("inaccessible");
    }
    @Test void archivedXmlMutationBlocksReconciliation(){
        Long id=fiscalInvoice();var provider=pollingProvider();
        tx(em->{em.find(Invoice.class,id).setXmlContent("<TEST>original</TEST>");return null;});
        Long submission=tx(em->new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(2L,id,"FR",provider).submission().getId());
        tx(em->{new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).finish(2L,submission,new com.clenzy.fiscal.einvoicing.EInvoiceResult(com.clenzy.fiscal.einvoicing.EInvoiceStatus.PENDING,"IOPOLE-TEST",null));em.find(Invoice.class,id).setXmlContent("<TEST>changed</TEST>");return null;});
        makeSubmissionDue(id);
        tx(em->{var p=new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(2L,id,"FR",provider);assertThat(p.send()).isFalse();assertThat(p.reconcile()).isFalse();assertThat(p.submission().getMessage()).contains("a changé");return null;});
    }
    @Test void confirmedRejectionIsNotErasedByALatePendingResult(){
        Long id=fiscalInvoice();var provider=pollingProvider();
        Long submission=tx(em->new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).prepare(2L,id,"FR",provider).submission().getId());
        tx(em->{var store=new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em);store.finish(2L,submission,new com.clenzy.fiscal.einvoicing.EInvoiceResult(com.clenzy.fiscal.einvoicing.EInvoiceStatus.FAILED,"IOPOLE-TEST","Refus confirmé"));
            var late=store.finish(2L,submission,com.clenzy.fiscal.einvoicing.EInvoiceResult.pending("Réponse ancienne"));
            assertThat(late.getStatus()).isEqualTo(com.clenzy.fiscal.einvoicing.EInvoiceStatus.FAILED);assertThat(late.getMessage()).isEqualTo("Refus confirmé");return null;});
        makeSubmissionDue(id);
        tx(em->{assertThat(new com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore(em).candidates()).isEmpty();return null;});
    }

}
