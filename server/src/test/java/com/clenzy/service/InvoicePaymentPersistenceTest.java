package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Baitly : transactions réelles, verrous concurrents, rejeu et rollback de l'encaissement facturé. */
class InvoicePaymentPersistenceTest {
    static SessionFactory factory;
    static Long invoiceId;
    final TenantContext tenant = mock(TenantContext.class);

    @BeforeAll static void mappings() {
        String xml = "<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">"
                + entity(Reservation.class, Set.of("organizationId", "status", "paymentStatus", "paymentCollection", "totalPrice",
                        "currency", "paidAt", "amountPaid", "stripeSessionId", "cancelledAt", "externalUid", "channelPaymentCollect", "channexCrsBookingId", "paymentLinkSentAt", "paymentLinkEmail"))
                + entity(Intervention.class, Set.of("organizationId", "paymentStatus", "paidAt", "estimatedCost", "currency"))
                + "</entity-mappings>";
        factory = new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .addAnnotatedClass(Invoice.class).addAnnotatedClass(InvoiceLine.class)
                .addAnnotatedClass(InterventionPaymentAllocation.class)
                .addAnnotatedClass(Wallet.class).addAnnotatedClass(LedgerEntry.class)
                .addInputStream(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:invoicecoord;MODE=PostgreSQL;LOCK_TIMEOUT=5000")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("jakarta.persistence.validation.mode", "none").buildSessionFactory();
    }
    private static String entity(Class<?> type, Set<String> fields) {
        var xml = new StringBuilder("<entity class=\"").append(type.getName())
                .append("\" access=\"FIELD\" metadata-complete=\"true\"><attributes><id name=\"id\"/>");
        for (var field : type.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers()) || field.getName().equals("id")) continue;
            if (fields.contains(field.getName())) {
                xml.append("<basic name=\"").append(field.getName()).append("\">");
                if (field.getType().isEnum()) xml.append("<enumerated>STRING</enumerated>");
                xml.append("</basic>");
            } else xml.append("<transient name=\"").append(field.getName()).append("\"/>");
        }
        return xml.append("</attributes></entity>").toString();
    }
    @AfterAll static void closeFactory() { if (factory != null) factory.close(); }

    @BeforeEach void seed() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin();
            for (String type : List.of("LedgerEntry","Wallet","InvoiceLine","Invoice","InterventionPaymentAllocation","PaymentTransaction","Reservation","Intervention"))
                em.createQuery("delete from " + type).executeUpdate();
            var i = new Invoice(); i.setOrganizationId(7L); i.setInvoiceNumber("INV-1"); i.setInvoiceDate(LocalDate.now());
            i.setTotalHt(new BigDecimal("80")); i.setTotalTax(BigDecimal.ZERO); i.setTotalTtc(new BigDecimal("80"));
            i.setStatus(InvoiceStatus.ISSUED); i.setInvoiceType(InvoiceType.GUEST); i.setReservationId(2L); em.persist(i);
            invoiceId = i.getId();
            var stay = new Reservation(); stay.setId(2L); stay.setOrganizationId(7L);
            stay.setTotalPrice(new BigDecimal("80")); stay.setCurrency("EUR");
            stay.setPaymentStatus(PaymentStatus.PENDING); stay.setPaymentCollection(PaymentCollection.PMS); em.persist(stay);
            em.getTransaction().commit();
        }
    }
    PaymentTransactionRepository payments(EntityManager em) {
        return new JpaRepositoryFactory(em).getRepository(PaymentTransactionRepository.class);
    }
    InvoicePaymentCoordination coordination(EntityManager em, LedgerService ledger) {
        var wallets = mock(WalletService.class);
        when(wallets.getOrCreateEscrowWallet(7L, "EUR")).thenAnswer(c -> wallet(em, WalletType.ESCROW));
        when(wallets.getOrCreatePlatformWallet(7L, "EUR")).thenAnswer(c -> wallet(em, WalletType.PLATFORM));
        return new InvoicePaymentCoordination(em, tenant, payments(em), mock(ServiceQuoteRepository.class),
                mock(InvoicePaymentRecipient.class), mock(ManagementContractService.class), wallets, ledger);
    }
    Wallet wallet(EntityManager em, WalletType type) {
        var w = new Wallet(); w.setOrganizationId(7L); w.setCurrency("EUR"); w.setWalletType(type); em.persist(w); return w;
    }
    LedgerService ledger(EntityManager em) {
        return new LedgerService(new JpaRepositoryFactory(em).getRepository(LedgerEntryRepository.class));
    }
    PaymentOrchestrationRequest request(boolean withInvoice) {
        return new PaymentOrchestrationRequest(new BigDecimal("80"), "EUR", "RESERVATION", 2L, "Séjour Baitly",
                "guest@example.test", PaymentProviderType.STRIPE, null, null,
                withInvoice ? Map.of("invoiceId", invoiceId.toString()) : Map.of(), "RESERVATION-2");
    }
    PaymentTransaction intent(EntityManager em, String source) {
        var tx = new PaymentTransaction(); tx.setOrganizationId(7L); tx.setTransactionRef("TX-invoice");
        tx.setSourceType(source); tx.setSourceId(source.equals("INVOICE") ? invoiceId : 2L);
        tx.setPaymentType(TransactionType.CHECKOUT); tx.setProviderType(PaymentProviderType.STRIPE);
        tx.setStatus(TransactionStatus.PROCESSING); tx.setAmount(new BigDecimal("80")); tx.setCurrency("EUR");
        tx.setProviderTxId("cs_invoice"); tx.setIdempotencyKey("RESERVATION-2");
        tx.setMetadata(Map.of("invoiceId", invoiceId.toString())); em.persist(tx); return tx;
    }
    InvoicePaymentReconciliationService writer(EntityManager em, InvoicePaymentCoordination coordination) {
        var persistence = new PaymentPersistence(payments(em), mock(OutboxPublisher.class), new ObjectMapper(),
                mock(DepositReconciler.class), mock(InterventionPaymentCoordination.class), coordination, org.mockito.Mockito.mock(com.clenzy.service.payout.BaitlyTransferRecoveryStore.class));
        return new InvoicePaymentReconciliationService(em, tenant, payments(em), persistence, coordination,
                mock(ReservationPaymentReconciliationService.class));
    }

    @Test void commissionConfirmationAndReplayProduceOneBalancedPair() {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin();
            var coord = coordination(em, ledger(em)); var tx = intent(em, "INVOICE");
            em.find(Invoice.class, invoiceId).setInvoiceType(InvoiceType.COMMISSION);
            em.flush();
            coord.bindPrepared(tx); em.getTransaction().commit(); em.clear();
            for (int replay = 0; replay < 2; replay++) {
                em.getTransaction().begin(); writer(em, coord).confirm("TX-invoice", "cs_invoice");
                em.getTransaction().commit(); em.clear();
            }
            assertThat(em.find(Invoice.class, invoiceId).getStatus()).isEqualTo(InvoiceStatus.PAID);
            assertThat(payments(em).findByTransactionRef("TX-invoice").orElseThrow().getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            var entries = em.createQuery("from LedgerEntry", LedgerEntry.class).getResultList();
            assertThat(entries).hasSize(2);
            assertThat(entries).extracting(LedgerEntry::getAmount).allMatch(a -> a.compareTo(new BigDecimal("80")) == 0);
            assertThat(entries).extracting(LedgerEntry::getEntryType).containsExactlyInAnyOrder(LedgerEntryType.DEBIT, LedgerEntryType.CREDIT);
        }
    }
    @Test void ledgerFailureRollsBackTransactionInvoiceAndEntriesTogether() {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin(); var tx = intent(em, "INVOICE");
            var i = em.find(Invoice.class, invoiceId); i.setInvoiceType(InvoiceType.COMMISSION); i.setPaymentTransactionId(tx.getId());
            em.getTransaction().commit(); em.clear();
            var broken = spy(ledger(em));
            doAnswer(c -> { c.callRealMethod(); throw new IllegalStateException("ledger unavailable"); })
                    .when(broken).recordTransfer(any(), any(), any(), any(), any(), any());
            var coord = coordination(em, broken); em.getTransaction().begin();
            assertThatThrownBy(() -> writer(em, coord).confirm("TX-invoice", "cs_invoice")).hasMessageContaining("ledger unavailable");
            em.getTransaction().rollback(); em.clear();
            assertThat(em.find(Invoice.class, invoiceId).getStatus()).isEqualTo(InvoiceStatus.ISSUED);
            assertThat(payments(em).findByTransactionRef("TX-invoice").orElseThrow().getStatus()).isEqualTo(TransactionStatus.PROCESSING);
            assertThat(em.createQuery("select count(e) from LedgerEntry e", Long.class).getSingleResult()).isZero();
        }
    }
    @Test void expiryReleasesReservationAndInvoiceThenAllowsOneNewAttempt() {
        try (var em = factory.createEntityManager()) {
            var coord = coordination(em, ledger(em));
            em.getTransaction().begin(); var tx = intent(em, "RESERVATION");
            coord.bindPrepared(tx); coord.attachReservation(tx); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); writer(em, coord).expire("TX-invoice", "cs_invoice"); em.getTransaction().commit(); em.clear();
            assertThat(em.find(Invoice.class, invoiceId).getPaymentTransactionId()).isNull();
            assertThat(em.find(Reservation.class, 2L).getStripeSessionId()).isNull();
            assertThat(payments(em).findByTransactionRef("TX-invoice").orElseThrow().getIdempotencyKey()).isNull();
            em.getTransaction().begin(); coord.lockForPayment(7L, request(true)); em.getTransaction().rollback();
        }
    }
    @Test void successfulMissionMustBeReconciledBeforeItsInvoice() {
        try (var em = factory.createEntityManager()) {
            var coord = coordination(em, ledger(em)); em.getTransaction().begin();
            var tx = intent(em, "INTERVENTION_BATCH"); tx.setMetadata(Map.of("invoiceId", invoiceId.toString(), "interventionIds", "2"));
            tx.setStatus(TransactionStatus.COMPLETED);
            var part = new InterventionPaymentAllocation(tx, 2L, tx.getAmount()); part.confirm(); em.persist(part);
            var i = em.find(Invoice.class, invoiceId); i.setReservationId(null); i.setInterventionId(2L); em.flush(); coord.bindPrepared(tx);
            var m = new Intervention(); m.setId(2L); m.setOrganizationId(7L); m.setPaymentStatus(PaymentStatus.PENDING); em.persist(m);
            em.getTransaction().commit(); em.clear();
            em.getTransaction().begin();
            assertThatThrownBy(() -> coord.reconcile("TX-invoice")).hasMessageContaining("pas encore rapprochée");
            em.getTransaction().rollback(); em.clear();
            em.getTransaction().begin(); em.find(Intervention.class, 2L).setPaymentStatus(PaymentStatus.PAID);
            coord.reconcile("TX-invoice"); em.getTransaction().commit(); em.clear();
            assertThat(em.find(Invoice.class, invoiceId).getStatus()).isEqualTo(InvoiceStatus.PAID);
            assertThat(em.createQuery("select count(e) from LedgerEntry e", Long.class).getSingleResult()).isZero();
        }
    }
    @Test void replayOfBatchWithRefundedPartKeepsBothInvoicesAndAmountsIntact() {
        try (var em = factory.createEntityManager()) {
            var coord = coordination(em, ledger(em)); em.getTransaction().begin();
            var tx = intent(em, "INTERVENTION_BATCH"); tx.setMetadata(Map.of("interventionIds", "2,3"));
            tx.setStatus(TransactionStatus.COMPLETED);
            for (long id : List.of(2L, 3L)) {
                var amount = new BigDecimal(id == 2 ? "35" : "45");
                var part = new InterventionPaymentAllocation(tx, id, amount); part.confirm(); em.persist(part);
                var mission = new Intervention(); mission.setId(id); mission.setOrganizationId(7L);
                mission.setPaymentStatus(id == 2 ? PaymentStatus.REFUNDED : PaymentStatus.PAID); em.persist(mission);
                var invoice = id == 2 ? em.find(Invoice.class, invoiceId) : new Invoice();
                invoice.setOrganizationId(7L); invoice.setInvoiceNumber("PART-" + id); invoice.setInvoiceDate(LocalDate.now());
                invoice.setInvoiceType(InvoiceType.GUEST); invoice.setReservationId(null); invoice.setInterventionId(id);
                invoice.setTotalHt(amount); invoice.setTotalTtc(amount); invoice.setTotalTax(BigDecimal.ZERO);
                invoice.setPaymentTransactionId(tx.getId()); invoice.setStatus(id == 2 ? InvoiceStatus.PAID : InvoiceStatus.ISSUED);
                if (id == 3) em.persist(invoice);
            }
            em.getTransaction().commit(); em.clear();
            for (int replay = 0; replay < 2; replay++) {
                em.getTransaction().begin(); coord.reconcile("TX-invoice"); em.getTransaction().commit(); em.clear();
            }
            assertThat(em.createQuery("from Invoice order by interventionId", Invoice.class).getResultList())
                .allMatch(i -> i.getStatus() == InvoiceStatus.PAID)
                .extracting(Invoice::getTotalTtc).containsExactly(new BigDecimal("35.00"), new BigDecimal("45.00"));
            assertThat(em.find(Intervention.class, 2L).getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
            assertThat(em.find(Intervention.class, 3L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(em.createQuery("select count(e) from LedgerEntry e", Long.class).getSingleResult()).isZero();
        }
    }
    @Test void unrelatedOwnerCannotReleaseInvoiceOrReservation() {
        try (var em = factory.createEntityManager()) {
            var coord = coordination(em, ledger(em)); em.getTransaction().begin(); var tx = intent(em, "RESERVATION");
            coord.bindPrepared(tx); coord.attachReservation(tx); em.getTransaction().commit(); em.clear();
            when(tenant.getRequiredOrganizationId()).thenReturn(8L); em.getTransaction().begin();
            assertThatThrownBy(() -> writer(em, coord).expire("TX-invoice", "cs_invoice")).hasMessageContaining("hors organisation");
            em.getTransaction().rollback(); em.clear();
            assertThat(em.find(Invoice.class, invoiceId).getPaymentTransactionId()).isNotNull();
        }
    }
    @Test void invoiceAndReservationButtonsCannotStartTwoConcurrentSessions() throws Exception {
        var attempting = new CountDownLatch(1);
        try (var winner = factory.createEntityManager(); var pool = Executors.newSingleThreadExecutor()) {
            winner.getTransaction().begin();
            var coord = coordination(winner, ledger(winner)); coord.lockForPayment(7L, request(true));
            var tx = intent(winner, "RESERVATION"); coord.bindPrepared(tx); winner.flush();
            var loser = pool.submit(() -> {
                try (var em = factory.createEntityManager()) {
                    em.getTransaction().begin(); attempting.countDown();
                    try { coordination(em, ledger(em)).lockForPayment(7L, request(false)); return "unexpected admission"; }
                    catch (IllegalStateException expected) { return expected.getMessage(); }
                    finally { em.getTransaction().rollback(); }
                }
            });
            try {
                assertThat(attempting.await(2, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> loser.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            } finally { winner.getTransaction().commit(); }
            assertThat(loser.get(5, TimeUnit.SECONDS)).contains("paiement existe déjà");
            assertThat(winner.createQuery("select count(t) from PaymentTransaction t", Long.class).getSingleResult()).isEqualTo(1L);
        }
    }

    @Test void legacyInvoiceAttemptBlocksNormalReservationCheckoutEvenAfterLocalFailure() {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin(); intent(em, "INVOICE").setStatus(TransactionStatus.FAILED);
            em.getTransaction().commit(); em.clear(); em.getTransaction().begin();
            assertThatThrownBy(() -> coordination(em, ledger(em)).lockForPayment(7L, request(false)))
                    .hasMessageContaining("ancien paiement de facture");
            em.getTransaction().rollback();
        }
    }

    @Test void embeddedAndHostedCheckoutCannotReserveTheSameDebtTwice() throws Exception {
        var attempting=new CountDownLatch(1);
        var embedded=new PaymentOrchestrationRequest(new BigDecimal("80"),"EUR","BOOKING_CHECKOUT",2L,"Séjour",
            "guest@example.test",PaymentProviderType.STRIPE,null,null,Map.of("server_total","80","deposit_balance","0"),"EMBEDDED-2");
        try(var winner=factory.createEntityManager();var pool=Executors.newSingleThreadExecutor()) {
            winner.getTransaction().begin();
            coordination(winner,ledger(winner)).lockForPayment(7L,embedded);
            intent(winner,"BOOKING_CHECKOUT");winner.flush();
            var loser=pool.submit(()->{
                try(var em=factory.createEntityManager()) {
                    em.getTransaction().begin();em.find(Reservation.class,2L);attempting.countDown();
                    try {coordination(em,ledger(em)).lockForPayment(7L,request(false));return "unexpected admission";}
                    catch(IllegalStateException expected){return expected.getMessage();}
                    finally {em.getTransaction().rollback();}
                }
            });
            try {assertThat(attempting.await(2,TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(()->loser.get(200,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            } finally {winner.getTransaction().commit();}
            assertThat(loser.get(5,TimeUnit.SECONDS)).contains("paiement existe déjà");
            assertThat(winner.createQuery("select count(t) from PaymentTransaction t",Long.class).getSingleResult()).isEqualTo(1L);
        }
    }
}
