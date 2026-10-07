package com.clenzy.booking.service;

import com.clenzy.dto.CancellationRefundPreviewDto;
import com.clenzy.model.*;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import jakarta.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Transactions SQL réelles : verrous, journal équilibré, rollback et rejeux concurrents. */
class BookingCancellationRefundPersistenceTest {
    static SessionFactory factory;
    static final PaymentResult SUCCESS = PaymentResult.success("re_case", null, "REFUNDED");
    Long escrowId, ownerId, conciergeId, platformId;

    @BeforeAll static void start() {
        var fields = Set.of("organizationId", "status", "paymentStatus", "totalPrice", "creditApplied", "currency",
                "stripeSessionId", "confirmationCode", "paymentCollection", "paidAt");
        var xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">"
                + "<entity class=\"com.clenzy.model.Reservation\" access=\"FIELD\" metadata-complete=\"true\"><attributes><id name=\"id\"/>");
        for (var field : Reservation.class.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers()) || field.getName().equals("id")) continue;
            if (fields.contains(field.getName())) {
                xml.append("<basic name=\"").append(field.getName()).append("\">");
                if (field.getType().isEnum()) xml.append("<enumerated>STRING</enumerated>");
                xml.append("</basic>");
            } else xml.append("<transient name=\"").append(field.getName()).append("\"/>");
        }
        xml.append("</attributes></entity></entity-mappings>");
        factory = new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .addAnnotatedClass(LedgerEntry.class).addAnnotatedClass(Wallet.class).addAnnotatedClass(OwnerPayoutReservation.class)
                .addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:bookingrefunds;MODE=PostgreSQL;LOCK_TIMEOUT=5000")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop").setProperty("jakarta.persistence.validation.mode", "none")
                .buildSessionFactory();
    }
    @AfterAll static void stop() { if (factory != null) factory.close(); }
    @BeforeEach void seed() {
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin();
            for (var name : List.of("LedgerEntry", "Wallet", "PaymentTransaction", "Reservation", "OwnerPayoutReservation"))
                em.createQuery("delete from " + name).executeUpdate();
            var r = new Reservation(); r.setId(314L); r.setOrganizationId(7L); r.setStatus("confirmed");
            r.setPaymentStatus(PaymentStatus.PAID); r.setTotalPrice(new BigDecimal("100")); r.setCurrency("EUR");
            r.setStripeSessionId("cs_original"); r.setConfirmationCode("ABC123"); r.setPaymentCollection(PaymentCollection.PMS); em.persist(r);
            em.persist(original("TX-original"));
            var escrow = wallet(em, WalletType.ESCROW); var owner = wallet(em, WalletType.OWNER);
            var concierge = wallet(em, WalletType.CONCIERGE); var platform = wallet(em, WalletType.PLATFORM);
            escrowId = escrow.getId(); ownerId = owner.getId(); conciergeId = concierge.getId(); platformId = platform.getId();
            var ledger = new LedgerService(repo(em, LedgerEntryRepository.class));
            ledger.recordTransfer(platform, escrow, new BigDecimal("100"), LedgerReferenceType.PAYMENT, "314", "Paiement reservation: ABC123");
            ledger.recordTransfer(escrow, owner, new BigDecimal("80"), LedgerReferenceType.SPLIT, "SPLIT-RES-314", "Part propriétaire");
            ledger.recordTransfer(escrow, concierge, new BigDecimal("15"), LedgerReferenceType.SPLIT, "SPLIT-RES-314", "Part gestionnaire");
            em.getTransaction().commit();
        }
    }
    static PaymentTransaction original(String ref) {
        var t = new PaymentTransaction(); t.setOrganizationId(7L); t.setTransactionRef(ref); t.setSourceType("RESERVATION");
        t.setSourceId(314L); t.setStatus(TransactionStatus.COMPLETED); t.setPaymentType(TransactionType.CHECKOUT);
        t.setProviderType(PaymentProviderType.STRIPE); t.setProviderTxId("cs_original"); t.setAmount(new BigDecimal("100")); t.setCurrency("EUR"); return t;
    }
    Wallet wallet(EntityManager em, WalletType type) {
        var w = new Wallet(); w.setOrganizationId(7L); w.setWalletType(type); w.setCurrency("EUR"); em.persist(w); return w;
    }
    <T> T repo(EntityManager em, Class<T> type) { return new JpaRepositoryFactory(em).getRepository(type); }
    ReservationRepository reservations(EntityManager em) {
        var r = mock(ReservationRepository.class); when(r.findById(anyLong())).thenAnswer(c -> Optional.ofNullable(em.find(Reservation.class, c.getArgument(0)))); return r;
    }
    BookingCancellationRefunds service(EntityManager em) {
        var wallets = mock(WalletService.class); when(wallets.getWalletById(anyLong())).thenAnswer(c -> em.find(Wallet.class, c.getArgument(0)));
        var entries = repo(em, LedgerEntryRepository.class);
        return new BookingCancellationRefunds(repo(em, PaymentTransactionRepository.class), reservations(em), em,
                new PaymentStatusTransitionService(em, mock(InterventionRepository.class), mock(DocumentGenerationOutbox.class)),
                new ReservationCancellationLedger(entries, new LedgerService(entries), wallets), repo(em, OwnerPayoutReservationRepository.class),mock(GuestCreditService.class));
    }
    PaymentTransaction refund(EntityManager em) { return repo(em, PaymentTransactionRepository.class).findByIdempotencyKey("BOOKING-CANCEL-7-314").orElseThrow(); }
    static CancellationRefundPreviewDto preview(String amount) {
        return new CancellationRefundPreviewDto(314L, "FLEXIBLE", 100, new BigDecimal(amount), BigDecimal.ZERO, "EUR", 10, true, "Règle test");
    }
    String prepare(EntityManager em, String amount) {
        var r = em.find(Reservation.class, 314L, LockModeType.PESSIMISTIC_WRITE); em.refresh(r, LockModeType.PESSIMISTIC_WRITE);
        r.setStatus("cancelled"); service(em).prepare(r, preview(amount), new BigDecimal(amount)); return refund(em).getTransactionRef();
    }
    String prepare(String amount) {
        try (var em = factory.createEntityManager()) { em.getTransaction().begin(); var ref = prepare(em, amount); em.getTransaction().commit(); return ref; }
    }
    List<LedgerEntry> reversed(EntityManager em, String ref) { return repo(em, LedgerEntryRepository.class).findByOrganizationIdAndReferenceTypeAndReferenceId(7L, LedgerReferenceType.REFUND, ref); }

    @ParameterizedTest @ValueSource(strings={"100", "50"})
    void onlyConfirmedProofChangesStatusAndReversesExactlyTheRefundedFraction(String amount) {
        String ref = prepare(amount);
        try (var em = factory.createEntityManager()) {
            var r = em.find(Reservation.class, 314L);
            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(service(em).result(r, "already_cancelled").refundStatus()).isEqualTo("PENDING");
            assertThat(service(em).result(r, "already_cancelled").refundedAmount()).isEqualByComparingTo("0");
            em.getTransaction().begin(); service(em).apply(7L, ref, new PaymentResult(false, "re_case", null, null, null, "REFUND_PENDING", "Attente")); em.getTransaction().commit(); em.clear();
            assertThat(refund(em).getProviderTxId()).isEqualTo("re_case"); assertThat(reversed(em, ref)).isEmpty();
            for (int i=0;i<2;i++) {
                em.getTransaction().begin(); service(em).apply(7L, ref, SUCCESS); em.getTransaction().commit(); em.clear();
            }
            r = em.find(Reservation.class, 314L);
            assertThat(r.getPaymentStatus()).isEqualTo(amount.equals("100") ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED);
            assertThat(service(em).result(r, "already_cancelled").refundedAmount()).isEqualByComparingTo(amount);
            assertThat(service(em).result(r, "already_cancelled").refundStatus()).isEqualTo("CONFIRMED");
            var entries = reversed(em, ref); assertThat(entries).hasSize(6);
            assertThat(entries.stream().filter(e -> e.getEntryType() == LedgerEntryType.DEBIT).map(LedgerEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add))
                    .isEqualByComparingTo(new BigDecimal(amount).multiply(new BigDecimal("1.95")));
            var ledger = new LedgerService(repo(em, LedgerEntryRepository.class));
            assertThat(ledger.calculateBalance(ownerId)).isEqualByComparingTo(amount.equals("100") ? "0" : "40");
            assertThat(ledger.calculateBalance(conciergeId)).isEqualByComparingTo(amount.equals("100") ? "0" : "7.5");
            em.getTransaction().begin(); assertThat(new PaymentStatusTransitionService(em, mock(InterventionRepository.class), mock(DocumentGenerationOutbox.class)).markReservationPaid(314L)).isFalse(); em.getTransaction().commit();
        }
    }
    @Test void failedThenReplayedPendingNeverConfirmsOrErasesRefusal() {
        var ref = prepare("50");
        try (var em = factory.createEntityManager()) {
            for (var state : List.of("REFUND_REJECTED", "REFUND_PENDING")) {
                em.getTransaction().begin(); service(em).apply(7L, ref, new PaymentResult(false,"re_case",null,null,null,state,"Non confirmé")); em.getTransaction().commit(); em.clear();
            }
            assertThat(refund(em).getStatus()).isEqualTo(TransactionStatus.FAILED);
            assertThat(em.find(Reservation.class,314L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID); assertThat(reversed(em,ref)).isEmpty();
        }
    }
    @ParameterizedTest @ValueSource(strings={"ota","currency","two-payments","other-source","amount","payout","legacy-refund"})
    void ambiguousReceiptsAreDurableReviewCasesWithoutAutomaticEmission(String scenario) {
        try (var em=factory.createEntityManager()) {
            em.getTransaction().begin(); var r=em.find(Reservation.class,314L);
            switch(scenario) {
                case "ota" -> r.setPaymentCollection(PaymentCollection.CHANNEL);
                case "currency" -> r.setCurrency("USD");
                case "two-payments" -> em.persist(original("TX-second"));
                case "other-source" -> { var t=original("TX-second"); t.setSourceType("BOOKING_BALANCE"); em.persist(t); }
                case "amount" -> r.setTotalPrice(new BigDecimal("101"));
                case "payout" -> em.persist(new OwnerPayoutReservation(314L,7L,12L,new BigDecimal("100"),"EUR",List.of(1L)));
                case "legacy-refund" -> new ReservationRefundCoordination(reservations(em),repo(em,PaymentTransactionRepository.class),em).reserve(7L,314L,"cs_original",BigDecimal.TEN,"legacy");
            }
            em.getTransaction().commit(); em.clear(); em.getTransaction().begin(); prepare(em,"50"); em.getTransaction().commit(); em.clear();
            assertThat(refund(em).getStatus()).isEqualTo(TransactionStatus.FAILED);
            assertThat(service(em).result(em.find(Reservation.class,314L),"already_cancelled").refundStatus()).isEqualTo("RECONCILIATION_REQUIRED");
        }
    }
    @ParameterizedTest @ValueSource(strings={"wrong-org","new-session","changed-currency","second-payment","missing-receipt","broken-pair","payout"})
    void changedEvidenceCannotConfirmAndRollsBackAnyLedgerWrites(String scenario) {
        var ref=prepare("50");
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); var r=em.find(Reservation.class,314L);
            switch(scenario) {
                case "new-session" -> r.setStripeSessionId("cs_other");
                case "changed-currency" -> r.setCurrency("USD");
                case "second-payment" -> em.persist(original("TX-second"));
                case "missing-receipt" -> em.createQuery("delete from LedgerEntry e where e.referenceType=com.clenzy.model.LedgerReferenceType.PAYMENT").executeUpdate();
                case "broken-pair" -> repo(em,LedgerEntryRepository.class).findByOrganizationIdAndReferenceTypeAndReferenceId(7L,LedgerReferenceType.PAYMENT,"314").getFirst().setCounterpartEntryId(9999L);
                case "payout" -> em.persist(new OwnerPayoutReservation(314L,7L,12L,new BigDecimal("100"),"EUR",List.of(1L)));
            }
            em.getTransaction().commit(); em.clear(); em.getTransaction().begin();
            assertThatThrownBy(()->service(em).apply(scenario.equals("wrong-org")?8L:7L,ref,SUCCESS)).isInstanceOf(RuntimeException.class);
            em.getTransaction().rollback(); em.clear(); assertThat(reversed(em,ref)).isEmpty();
            assertThat(refund(em).getStatus()).isEqualTo(TransactionStatus.PROCESSING);
            assertThat(em.find(Reservation.class,314L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }
    }
    @Test void transactionRollbackIsRecoverableWithSameProof() {
        var ref=prepare("50");
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); service(em).apply(7L,ref,SUCCESS); em.getTransaction().rollback(); em.clear();
            assertThat(reversed(em,ref)).isEmpty(); assertThat(refund(em).getStatus()).isEqualTo(TransactionStatus.PROCESSING);
            em.getTransaction().begin(); service(em).recordFailure(7L,ref); em.getTransaction().commit(); em.clear();
            assertThat(service(em).result(em.find(Reservation.class,314L),"cancelled").refundStatus()).isEqualTo("RECONCILIATION_REQUIRED");
            em.getTransaction().begin(); service(em).apply(7L,ref,SUCCESS); em.getTransaction().commit(); em.clear();
            assertThat(reversed(em,ref)).hasSize(6); assertThat(refund(em).getMetadata()).doesNotContainKey("reviewRequired");
        }
    }
    @Test void missingLedgerEvidenceIsRejectedBeforeTheProcessorCanAskStripe() {
        var ref=prepare("50");
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); em.createQuery("delete from LedgerEntry").executeUpdate(); em.getTransaction().commit();
            assertThatThrownBy(()->service(em).load(7L,ref)).hasMessageContaining("comptable");
            assertThat(refund(em).getStatus()).isEqualTo(TransactionStatus.PROCESSING);
        }
    }
    @Test void unchangedPendingResultAdvancesItsRetryTimestamp() {
        var ref=prepare("50");
        var pending=new PaymentResult(false,"re_case",null,null,null,"REFUND_PENDING","Attente");
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); service(em).apply(7L,ref,pending); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); em.createQuery("update PaymentTransaction t set t.updatedAt=:old where t.transactionRef=:ref")
                    .setParameter("old",java.time.LocalDateTime.now().minusDays(1)).setParameter("ref",ref).executeUpdate(); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); service(em).apply(7L,ref,pending); em.getTransaction().commit(); em.clear();
            assertThat(refund(em).getUpdatedAt()).isAfter(java.time.LocalDateTime.now().minusMinutes(1));
            assertThat(repo(em,PaymentTransactionRepository.class).findPendingBookingCancellationRefunds(org.springframework.data.domain.PageRequest.of(0,20)))
                    .extracting(PaymentTransaction::getTransactionRef).containsExactly(ref);
        }
    }
    @Test void paymentStatusChangedAfterDecisionPreventsEmission() {
        var ref=prepare("50");
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); em.find(Reservation.class,314L).setPaymentStatus(PaymentStatus.REFUNDED); em.getTransaction().commit(); em.clear();
            assertThatThrownBy(()->service(em).load(7L,ref)).hasMessageContaining("Identité");
        }
    }
    @Test void legacyManagerRetryMustKeepItsFrozenCurrencyAndAmount() {
        try(var em=factory.createEntityManager()) {
            var coordination=new ReservationRefundCoordination(reservations(em),repo(em,PaymentTransactionRepository.class),em);
            em.getTransaction().begin(); coordination.reserve(7L,314L,"cs_original",BigDecimal.TEN,"legacy"); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); coordination.reserve(7L,314L,"cs_original",BigDecimal.TEN,"legacy"); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); em.find(Reservation.class,314L).setCurrency("USD"); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); assertThatThrownBy(()->coordination.reserve(7L,314L,"cs_original",BigDecimal.TEN,"legacy"))
                    .hasMessageContaining("antérieur"); em.getTransaction().rollback();
        }
    }
    @Test void lateProviderFailureRemainsVisibleWithoutErasingHistoricalEntries() {
        var ref=prepare("50");
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); service(em).apply(7L,ref,SUCCESS); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin();
            assertThatThrownBy(()->service(em).apply(7L,ref,new PaymentResult(false,"re_case",null,null,null,"REFUND_REJECTED","late")))
                    .hasMessageContaining("tardive");
            em.getTransaction().rollback(); em.clear();
            em.getTransaction().begin(); service(em).recordFailure(7L,ref); em.getTransaction().commit(); em.clear();
            var result=service(em).result(em.find(Reservation.class,314L),"cancelled");
            assertThat(result.refundStatus()).isEqualTo("RECONCILIATION_REQUIRED"); assertThat(result.refundedAmount()).isZero();
            assertThat(reversed(em,ref)).hasSize(6); assertThat(refund(em).getStatus()).isEqualTo(TransactionStatus.COMPLETED);
        }
    }
    @Test void paymentArrivingAfterUnpaidCancellationRequiresReviewInsteadOfClaimingNoRefund() {
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); em.find(Reservation.class,314L).setPaymentStatus(PaymentStatus.PENDING); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); prepare(em,"100"); em.getTransaction().commit(); em.clear();
            em.getTransaction().begin(); em.find(Reservation.class,314L).setPaymentStatus(PaymentStatus.PAID); em.getTransaction().commit(); em.clear();
            assertThat(service(em).result(em.find(Reservation.class,314L),"cancelled").refundStatus()).isEqualTo("RECONCILIATION_REQUIRED");
        }
    }
    @Test void simultaneousConfirmationsProduceOneJournal() throws Exception {
        var ref=prepare("50"); var started=new CountDownLatch(1);
        try(var first=factory.createEntityManager(); var pool=Executors.newSingleThreadExecutor()) {
            first.getTransaction().begin(); service(first).apply(7L,ref,SUCCESS);
            var second=pool.submit(()->{try(var em=factory.createEntityManager()) {
                em.getTransaction().begin(); started.countDown(); service(em).apply(7L,ref,SUCCESS); em.getTransaction().commit(); return true;
            }});
            try { assertThat(started.await(2,TimeUnit.SECONDS)).isTrue(); assertThatThrownBy(()->second.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class); }
            finally { first.getTransaction().commit(); }
            assertThat(second.get(5,TimeUnit.SECONDS)).isTrue(); assertThat(reversed(first,ref)).hasSize(6);
        }
    }
    @Test void simultaneousCancellationsKeepOneDecisionAndBlockLegacyManagerRefund() throws Exception {
        var started=new CountDownLatch(1);
        try(var first=factory.createEntityManager();var pool=Executors.newSingleThreadExecutor()) {
            first.getTransaction().begin(); var ref=prepare(first,"50");
            var second=pool.submit(()->{try(var em=factory.createEntityManager()) {
                em.getTransaction().begin(); started.countDown(); var value=prepare(em,"100"); em.getTransaction().commit(); return value;
            }});
            try { assertThat(started.await(2,TimeUnit.SECONDS)).isTrue(); assertThatThrownBy(()->second.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class); }
            finally { first.getTransaction().commit(); }
            assertThat(second.get(5,TimeUnit.SECONDS)).isEqualTo(ref);
            first.clear(); assertThat(refund(first).getAmount()).isEqualByComparingTo("50");
            first.getTransaction().begin();
            assertThatThrownBy(()->new ReservationRefundCoordination(reservations(first),repo(first,PaymentTransactionRepository.class),first)
                    .reserve(7L,314L,"cs_original",BigDecimal.TEN,"new-attempt")).hasMessageContaining("rapproché");
            first.getTransaction().rollback();
        }
    }
    @ParameterizedTest @ValueSource(strings={"zero-policy","unpaid"})
    void noCashDueNeverCreatesAPspOperation(String scenario) {
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin(); if(scenario.equals("unpaid")) em.find(Reservation.class,314L).setPaymentStatus(PaymentStatus.PENDING);
            em.getTransaction().commit(); em.clear(); em.getTransaction().begin(); prepare(em,scenario.equals("unpaid")?"100":"0"); em.getTransaction().commit(); em.clear();
            assertThat(refund(em).getStatus()).isEqualTo(TransactionStatus.CANCELLED);
            assertThat(service(em).result(em.find(Reservation.class,314L),"cancelled").refundStatus()).isEqualTo("NONE");
        }
    }
}
