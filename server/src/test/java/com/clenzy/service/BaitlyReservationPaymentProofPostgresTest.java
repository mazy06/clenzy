package com.clenzy.service;

import com.clenzy.booking.service.*;
import com.clenzy.booking.model.*;
import com.clenzy.booking.repository.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** PostgreSQL + vrais services/CAS ; adaptateurs de repositories et effets externes simulés. */
@EnabledIfSystemProperty(named="baitly.test.jdbc", matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyReservationPaymentProofPostgresTest {
    static SessionFactory factory;
    static String url, user, schema;
    final java.util.List<BigDecimal> cashEntries=new java.util.concurrent.CopyOnWriteArrayList<>();
    final AtomicInteger confirmations = new AtomicInteger();

    @BeforeAll static void mapping() throws Exception {
        url=System.getProperty("baitly.test.jdbc"); user=System.getProperty("baitly.test.user","postgres");
        schema="baitly_booking_proof_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()) { s.execute("CREATE SCHEMA "+schema); }
        var xml=new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml,Reservation.class,Set.of("organizationId","paymentStatus","totalPrice",
                "amountPaid","amountDue","paidAt","currency","stripeSessionId","status","cancelledAt","creditApplied","confirmationCode"));
        int guestField=xml.indexOf("<transient name=\"guest\"/>");
        xml.replace(guestField,guestField+"<transient name=\"guest\"/>".length(),
            "<many-to-one name=\"guest\" target-entity=\"com.clenzy.model.Guest\"><join-column name=\"guest_id\"/></many-to-one>");
        RefundCreditNotePersistenceTest.mapping(xml,Guest.class,Set.of("email","organizationId"));
        xml.append("</entity-mappings>");
        factory=new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .addAnnotatedClass(GuestCreditAccount.class).addAnnotatedClass(GuestCreditTransaction.class)
                .addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url",url+"?currentSchema="+schema)
                .setProperty("hibernate.connection.username",user).setProperty("hibernate.hbm2ddl.auto","create-drop")
                .setProperty("jakarta.persistence.validation.mode","none").buildSessionFactory();
    }
    @AfterAll static void close() throws Exception {
        if(factory!=null)factory.close();
        if(schema!=null)try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}
    }
    static <T>T tx(Function<EntityManager,T> work) {
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin();
            try {T value=work.apply(em);em.getTransaction().commit();return value;}
            catch(RuntimeException e){em.getTransaction().rollback();throw e;}
        }
    }
    @BeforeEach void seed() {
        tx(em->{
            em.createQuery("delete from PaymentTransaction").executeUpdate();em.createQuery("delete from Reservation").executeUpdate();
            em.createQuery("delete from Guest").executeUpdate();
            em.createQuery("delete from GuestCreditTransaction").executeUpdate();
            em.createQuery("delete from GuestCreditAccount").executeUpdate();
            var r=new Reservation();r.setId(700L);r.setOrganizationId(7L);r.setPaymentStatus(PaymentStatus.PROCESSING);
            r.setStatus("pending");r.setStripeSessionId("cs_stay");r.setCurrency("EUR");r.setTotalPrice(new BigDecimal("100"));
            r.setConfirmationCode("BOOK-700");var guest=new Guest();guest.setId(400L);guest.setEmail("guest@test.invalid");em.persist(guest);r.setGuest(guest);
            r.setAmountPaid(BigDecimal.ZERO);r.setAmountDue(new BigDecimal("100"));em.persist(r);
            var p=new PaymentTransaction();p.setOrganizationId(7L);p.setTransactionRef("TX-stay");p.setSourceType("RESERVATION");
            p.setSourceId(700L);p.setProviderTxId("cs_stay");p.setProviderType(PaymentProviderType.STRIPE);
            p.setPaymentType(TransactionType.CHECKOUT);p.setStatus(TransactionStatus.COMPLETED);p.setAmount(new BigDecimal("100"));em.persist(p);
            return null;
        });
    }
    PaymentTransaction payment(EntityManager em){return em.createQuery("from PaymentTransaction where transactionRef='TX-stay'",PaymentTransaction.class).getSingleResult();}
    ReservationRepository reservations(EntityManager em) {
        var repository=mock(ReservationRepository.class);
        lenient().when(repository.findById(700L)).thenAnswer(c->Optional.ofNullable(em.find(Reservation.class,700L)));
        lenient().when(repository.findByStripeSessionId(anyString())).thenAnswer(c->em.createQuery("from Reservation where stripeSessionId=:session",Reservation.class)
                .setParameter("session",c.getArgument(0)).getResultStream().findFirst());
        lenient().when(repository.save(any())).thenAnswer(c->c.getArgument(0)); // entité managée, dirty checking réel
        return repository;
    }
    StripePaymentConfirmationService confirmation(EntityManager em,ReservationRepository reservations) {
        var documents=mock(DocumentGenerationOutbox.class);
        doAnswer(c->{confirmations.incrementAndGet();return null;}).when(documents).requestPaymentDocuments(any(),any(),any(),any());
        var ledger=mock(LedgerService.class);
        doAnswer(c->{cashEntries.add(c.getArgument(2));return null;}).when(ledger).recordTransfer(any(),any(),any(),any(),any(),any());
        return new StripePaymentConfirmationService(mock(InterventionRepository.class),reservations,mock(ServiceRequestRepository.class),
                mock(NotificationService.class),mock(ServiceRequestService.class),mock(WalletService.class),ledger,
                mock(SplitPaymentService.class),mock(AutoInvoiceService.class),documents,
                new PaymentStatusTransitionService(em,mock(InterventionRepository.class),documents),
                mock(com.clenzy.service.email.BookingConfirmationEmailService.class),mock(WebhookEventPublisher.class), new BaitlyReservationCredit(credits(em),payments(em),mock(com.clenzy.service.voucher.BaitlyVoucherClaims.class)));
    }
    GuestCreditService credits(EntityManager em) {
        var factory=new JpaRepositoryFactory(em);
        return new GuestCreditService(factory.getRepository(GuestCreditAccountRepository.class),
            factory.getRepository(GuestCreditTransactionRepository.class),mock(OrganizationRepository.class),
            mock(ReservationRepository.class),mock(org.springframework.beans.factory.ObjectProvider.class));
    }
    PaymentTransactionRepository payments(EntityManager em) {
        var repository=mock(PaymentTransactionRepository.class);
        when(repository.findByProviderTxId(anyString())).thenAnswer(c->em.createQuery("from PaymentTransaction where providerTxId=:session",PaymentTransaction.class)
            .setParameter("session",c.getArgument(0)).getResultStream().findFirst());
        return repository;
    }
    void credit() {tx(em->{
        var a=new GuestCreditAccount();a.setOrganizationId(7L);a.setEmail("guest@test.invalid");a.setBalanceCents(2000);em.persist(a);
        var r=em.find(Reservation.class,700L);r.setCreditApplied(new BigDecimal("20"));
        var p=payment(em);p.setAmount(new BigDecimal("80"));p.setMetadata(new HashMap<>(BaitlyReservationCredit.metadata(r,a.getId())));return null;
    });}

    void reconcile(EntityManager em,boolean balance) {
        var payments=mock(PaymentTransactionRepository.class);
        when(payments.findByTransactionRef("TX-stay")).thenAnswer(c->Optional.of(payment(em)));
        var reservations=reservations(em);var confirmation=confirmation(em,reservations);
        if(!balance) new ReservationPaymentReconciliationService(payments,confirmation,new BaitlyReservationPaymentProof(em)).reconcile("TX-stay");
        else {
            // Vraie finalisation du solde, sans construire les dépendances du catalogue public.
            var booking=mock(PublicBookingService.class,CALLS_REAL_METHODS);
            var stripe=mock(StripeService.class);doAnswer(c->{confirmation.confirmReservationPayment(c.getArgument(0));return null;})
                    .when(stripe).confirmReservationPayment(anyString());
            ReflectionTestUtils.setField(booking,"reservationRepository",reservations);ReflectionTestUtils.setField(booking,"stripeService",stripe);
            new BookingBalanceReconciliationService(payments,booking,new BaitlyReservationPaymentProof(em)).reconcile("TX-stay");
        }
    }
    void balance() {tx(em->{var r=em.find(Reservation.class,700L);r.setPaymentStatus(PaymentStatus.PARTIALLY_PAID);
        r.setAmountPaid(new BigDecimal("30"));r.setAmountDue(new BigDecimal("70"));
        var p=payment(em);p.setSourceType("BOOKING_BALANCE");p.setAmount(new BigDecimal("70"));p.setProviderTxId("cs_balance");return null;});}

    @Test void discountedCheckoutConsumesCreditOnceAndRecordsOnlyCashPaid() throws Exception {
        credit();
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);
            Callable<Void> run=()->{barrier.await(5,TimeUnit.SECONDS);return tx(em->{reconcile(em,false);return null;});};
            var a=pool.submit(run);var b=pool.submit(run);a.get(15,TimeUnit.SECONDS);b.get(15,TimeUnit.SECONDS);
        }
        tx(em->{var r=em.find(Reservation.class,700L);assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(r.getAmountPaid()).isEqualByComparingTo("80");assertThat(r.getAmountDue()).isZero();
            assertThat(r.getTotalPrice()).isEqualByComparingTo("100");
            assertThat(credits(em).getBalanceCents(7L,"guest@test.invalid")).isZero();
            assertThat(credits(em).hasExactRedemption(7L,"guest@test.invalid",2000,"EUR","BOOK-700")).isTrue();return null;});
        assertThat(confirmations).hasValue(1);
        assertThat(cashEntries).hasSize(1);assertThat(cashEntries.getFirst()).isEqualByComparingTo("80");
    }
    @ParameterizedTest @ValueSource(strings={"balance","currency","account","amount","proof","credit-changed","returned"})
    void creditMismatchKeepsPaymentUnconfirmedWithoutEffects(String reason) {
        credit();tx(em->{var r=em.find(Reservation.class,700L);var p=payment(em);
            var a=em.createQuery("from GuestCreditAccount",GuestCreditAccount.class).getSingleResult();
            switch(reason) {
                case "balance"->a.setBalanceCents(1999);case "currency"->a.setCurrency("MAD");
                case "account"->{var m=new HashMap<>(p.getMetadata());m.put("baitlyCreditAccount","999999");p.setMetadata(m);}
                case "amount"->p.setAmount(new BigDecimal("79.99"));case "proof"->p.setMetadata(Map.of());
                case "credit-changed"->r.setCreditApplied(new BigDecimal("21"));
                case "returned"->{assertThat(credits(em).redeem(7L,"guest@test.invalid",2000,"BOOK-700")).isTrue();
                    credits(em).clawback(7L,"guest@test.invalid",2000,"BOOK-700");}
            }return null;});
        assertThatThrownBy(()->tx(em->{reconcile(em,false);return null;})).isInstanceOf(IllegalStateException.class);
        assertThat(confirmations).hasValue(0);
        tx(em->{assertThat(em.find(Reservation.class,700L).getPaymentStatus()).isEqualTo(PaymentStatus.PROCESSING);return null;});
    }
    @Test void discountedConfirmationCannotBeBypassedThroughLegacyDirectEntryPoint() {
        credit();tx(em->{payment(em).setStatus(TransactionStatus.PROCESSING);return null;});
        assertThatThrownBy(()->tx(em->{confirmation(em,reservations(em)).confirmReservationPayment("cs_stay");return null;}))
            .isInstanceOf(IllegalStateException.class);
        assertThat(confirmations).hasValue(0);
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void concurrentDeliveriesConfirmExactlyOnceAndPersistAmounts(boolean balance) throws Exception {
        if(balance)balance();
        try(var pool=Executors.newFixedThreadPool(2)) {
            var ready=new CyclicBarrier(2);
            Callable<Void> run=()->{ready.await(5,TimeUnit.SECONDS);return tx(em->{reconcile(em,balance);return null;});};
            var first=pool.submit(run);var second=pool.submit(run);first.get(15,TimeUnit.SECONDS);second.get(15,TimeUnit.SECONDS);
        }
        tx(em->{var r=em.find(Reservation.class,700L);assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(r.getAmountPaid()).isEqualByComparingTo("100");assertThat(r.getAmountDue()).isZero();
            assertThat(r.getStripeSessionId()).isEqualTo(balance?"cs_balance":"cs_stay");return null;});
        assertThat(confirmations).hasValue(1);
    }
    @ParameterizedTest @ValueSource(strings={"amount","currency","org","source","session","failed","refund","disputed","cancelled","refunded","review"})
    void inconsistentProofCannotMarkReservationPaid(String reason) {
        tx(em->{var p=payment(em);var r=em.find(Reservation.class,700L);
            switch(reason){
                case "amount"->p.setAmount(new BigDecimal("99.99"));case "currency"->p.setCurrency("MAD");
                case "org"->p.setOrganizationId(8L);case "source"->p.setSourceType("INVOICE");
                case "session"->p.setProviderTxId("cs_other");case "failed"->p.setStatus(TransactionStatus.FAILED);
                case "refund"->p.setPaymentType(TransactionType.REFUND);case "disputed"->p.setDisputedAmount(BigDecimal.ONE);
                case "cancelled"->r.setStatus("cancelled");case "refunded"->r.setPaymentStatus(PaymentStatus.REFUNDED);
                case "review"->p.setMetadata(Map.of("reviewRequired",true));
            }return null;});
        assertThatThrownBy(()->tx(em->{reconcile(em,false);return null;})).isInstanceOf(IllegalStateException.class);
        tx(em->{assertThat(em.find(Reservation.class,700L).getPaymentStatus()).isNotEqualTo(PaymentStatus.PAID);return null;});
        assertThat(confirmations).hasValue(0);
    }
    @ParameterizedTest @ValueSource(strings={"underpaid","stale-total","no-deposit","refunded","other-session"})
    void balanceCannotErasePreviousFinancialState(String reason) {
        balance();tx(em->{var r=em.find(Reservation.class,700L);var p=payment(em);
            switch(reason){case "underpaid"->p.setAmount(new BigDecimal("69.99"));case "stale-total"->r.setTotalPrice(new BigDecimal("120"));
                case "no-deposit"->r.setAmountPaid(BigDecimal.ZERO);case "refunded"->r.setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);
                case "other-session"->r.setPaymentStatus(PaymentStatus.PAID);}
            return null;});
        assertThatThrownBy(()->tx(em->{reconcile(em,true);return null;})).isInstanceOf(IllegalStateException.class);
        tx(em->{var r=em.find(Reservation.class,700L);assertThat(r.getStripeSessionId()).isEqualTo("cs_stay");
            assertThat(r.getAmountDue()).isEqualByComparingTo("70");return null;});
        assertThat(confirmations).hasValue(0);
    }

    @ParameterizedTest @ValueSource(strings={"PAID","PARTIALLY_PAID","REFUNDED","PARTIALLY_REFUNDED","CANCELLED","NOT_REQUIRED","FAILED"})
    void lateFailurePreservesFinancialHistory(String state) {
        tx(em->{var r=em.find(Reservation.class,700L);r.setPaymentStatus(PaymentStatus.valueOf(state));
            r.setAmountPaid(new BigDecimal("30"));r.setAmountDue(new BigDecimal("70"));return null;});
        tx(em->{confirmation(em,reservations(em)).markReservationPaymentFailed("cs_stay");return null;});
        tx(em->{var r=em.find(Reservation.class,700L);assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.valueOf(state));
            assertThat(r.getAmountPaid()).isEqualByComparingTo("30");assertThat(r.getAmountDue()).isEqualByComparingTo("70");return null;});
    }
    @Test void concurrentSuccessAndFailureCannotLoseAConfirmedPayment() throws Exception {
        try(var pool=Executors.newFixedThreadPool(2)) {
            var loaded=new CountDownLatch(1);var paid=new CountDownLatch(1);
            var failure=pool.submit(()->tx(em->{
                var repository=reservations(em);
                when(repository.findByStripeSessionId("cs_stay")).thenAnswer(call->{
                    var stale=em.find(Reservation.class,700L);loaded.countDown();
                    if(!paid.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Confirmation concurrente absente");
                    return Optional.of(stale);
                });
                confirmation(em,repository).markReservationPaymentFailed("cs_stay");return null;
            }));
            var success=pool.submit(()->{
                if(!loaded.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Lecture initiale absente");
                try { return tx(em->{confirmation(em,reservations(em)).confirmReservationPayment("cs_stay");return null;}); }
                finally { paid.countDown(); }
            });
            success.get(15,TimeUnit.SECONDS);failure.get(15,TimeUnit.SECONDS);
        }
        tx(em->{var r=em.find(Reservation.class,700L);assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(r.getAmountPaid()).isEqualByComparingTo("100");assertThat(r.getAmountDue()).isZero();return null;});
        assertThat(confirmations).hasValue(1);
    }
    @Test void aSessionReplacedAfterInitialReadCannotBeFailedByAnOldNotification() {
        tx(em->{
            var repository=reservations(em);
            when(repository.findByStripeSessionId("cs_stay")).thenAnswer(call->{
                var stale=em.find(Reservation.class,700L);
                tx(other->{other.find(Reservation.class,700L).setStripeSessionId("cs_replacement");return null;});
                return Optional.of(stale);
            });
            confirmation(em,repository).markReservationPaymentFailed("cs_stay");return null;
        });
        tx(em->{var r=em.find(Reservation.class,700L);assertThat(r.getStripeSessionId()).isEqualTo("cs_replacement");
            assertThat(r.getPaymentStatus()).isEqualTo(PaymentStatus.PROCESSING);return null;});
    }
    @ParameterizedTest @ValueSource(strings={"cancelled-status","cancelled-date","refunded","partial-refund","not-required"})
    void directConfirmationDoesNotReviveCancelledOrRefundedStay(String reason) {
        tx(em->{var r=em.find(Reservation.class,700L);switch(reason) {
            case "cancelled-status"->r.setStatus("cancelled");
            case "cancelled-date"->r.setCancelledAt(java.time.LocalDateTime.now());
            case "refunded"->r.setPaymentStatus(PaymentStatus.REFUNDED);
            case "partial-refund"->r.setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);
            case "not-required"->r.setPaymentStatus(PaymentStatus.NOT_REQUIRED);
        }return null;});
        assertThatThrownBy(()->tx(em->{confirmation(em,reservations(em)).confirmReservationPayment("cs_stay");return null;}))
                .isInstanceOf(IllegalStateException.class);
        assertThat(confirmations).hasValue(0);
    }
}
