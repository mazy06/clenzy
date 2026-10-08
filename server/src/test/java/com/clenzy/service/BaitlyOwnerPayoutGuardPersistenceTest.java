package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.payout.*;
import jakarta.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Verrous SQL et identité de la destination, sans appel PSP ni modification du PMS. */
class BaitlyOwnerPayoutGuardPersistenceTest {
    static SessionFactory factory;
    Long payoutId, paymentId, configId;
    Long commissionInvoiceId;

    @BeforeAll static void start() {
        var xml=new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml,Reservation.class,Set.of("organizationId","status","paymentStatus",
                "currency","totalPrice","checkIn","checkOut","cancelledAt","paymentCollection","stripeSessionId","creditApplied"));
        RefundCreditNotePersistenceTest.mapping(xml,Property.class,Set.of("organizationId","timezone"));
        RefundCreditNotePersistenceTest.mapping(xml,User.class,Set.of());
        RefundCreditNotePersistenceTest.mapping(xml,ProviderExpense.class,Set.of("organizationId","status","currency","amountHt","taxAmount","amountTtc","expenseDate","paymentReference"));
        xml.append("</entity-mappings>");
        String orm=xml.toString().replace("<transient name=\"property\"/>","<many-to-one name=\"property\"/>")
                .replace("<transient name=\"owner\"/>","<many-to-one name=\"owner\"/>")
                .replace("<transient name=\"provider\"/>","<many-to-one name=\"provider\"/>")
                .replace("<transient name=\"ownerPayout\"/>","<many-to-one name=\"ownerPayout\"/>");
        factory=new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
                .addAnnotatedClass(OwnerPayout.class).addAnnotatedClass(OwnerPayoutConfig.class)
                .addAnnotatedClass(OwnerPayoutReservation.class)
                .addAnnotatedClass(Invoice.class).addAnnotatedClass(InvoiceLine.class)
                .addInputStream(new ByteArrayInputStream(orm.getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url","jdbc:h2:mem:ownerGuard;MODE=PostgreSQL;NON_KEYWORDS=USER;LOCK_TIMEOUT=5000")
                .setProperty("hibernate.hbm2ddl.auto","create-drop").setProperty("jakarta.persistence.validation.mode","none")
                .buildSessionFactory();
    }
    @AfterAll static void stop() { if(factory!=null) factory.close(); }
    <T>T tx(Function<EntityManager,T> fn) {
        try(var em=factory.createEntityManager()) { em.getTransaction().begin();
            try { T result=fn.apply(em); em.getTransaction().commit(); return result; }
            catch(RuntimeException e) { em.getTransaction().rollback(); throw e; }
        }
    }
    <T>T repo(EntityManager em,Class<T> type) { return new JpaRepositoryFactory(em).getRepository(type); }
    @BeforeEach void seed() {
        tx(em->{
            for(String entity:List.of("ProviderExpense","InvoiceLine","Invoice","OwnerPayoutReservation","OwnerPayoutConfig","OwnerPayout","PaymentTransaction","Reservation","Property","User"))
                em.createQuery("delete from "+entity).executeUpdate();
            var owner=new User(); owner.setId(10L); em.persist(owner);
            var other=new User(); other.setId(11L); em.persist(other);
            var property=new Property(); property.setId(50L); property.setOrganizationId(7L); property.setOwner(owner);
            property.setTimezone("Europe/Paris"); em.persist(property);
            var stay=new Reservation(); stay.setId(314L); stay.setOrganizationId(7L); stay.setProperty(property);
            stay.setCheckIn(LocalDate.of(2025,9,1)); stay.setCheckOut(LocalDate.of(2025,9,2)); stay.setStatus("completed");
            stay.setPaymentStatus(PaymentStatus.PAID); stay.setPaymentCollection(PaymentCollection.PMS);
            stay.setCurrency("EUR"); stay.setTotalPrice(new BigDecimal("100")); stay.setStripeSessionId("cs_original"); em.persist(stay);
            var payment=new PaymentTransaction(); payment.setOrganizationId(7L); payment.setSourceType("RESERVATION");
            payment.setSourceId(314L); payment.setTransactionRef("TX-original"); payment.setProviderTxId("cs_original");
            payment.setProviderType(PaymentProviderType.STRIPE); payment.setPaymentType(TransactionType.CHECKOUT);
            payment.setStatus(TransactionStatus.COMPLETED); payment.setAmount(new BigDecimal("100")); payment.setCurrency("EUR");
            em.persist(payment); paymentId=payment.getId();
            var payout=new OwnerPayout(); payout.setOrganizationId(7L); payout.setOwnerId(10L); payout.setFundingVersion(1);
            payout.setPeriodStart(LocalDate.of(2025,9,1)); payout.setPeriodEnd(LocalDate.of(2025,9,30));
            payout.setGrossRevenue(new BigDecimal("100")); payout.setCommissionAmount(new BigDecimal("20"));
            payout.setCommissionRate(new BigDecimal("0.2")); payout.setNetAmount(new BigDecimal("80"));
            payout.setStatus(OwnerPayout.PayoutStatus.PROCESSING); payout.setPayoutMethod(PayoutMethod.STRIPE_CONNECT);
            em.persist(payout); payoutId=payout.getId();
            em.persist(new OwnerPayoutReservation(314L,7L,payoutId,new BigDecimal("100"),"EUR",List.of(paymentId)));
            var invoice=invoice(InvoiceType.COMMISSION,InvoiceStatus.ISSUED,"20");
            invoice.setPayoutId(payoutId); invoice.setPaymentMethod("RETENUE_REVERSEMENT");
            em.persist(invoice); commissionInvoiceId=invoice.getId();
            var config=new OwnerPayoutConfig(); config.setOrganizationId(7L); config.setOwnerId(10L);
            config.setPayoutMethod(PayoutMethod.STRIPE_CONNECT); config.setStripeConnectedAccountId("acct_owner"); config.setVerified(true);
            em.persist(config); configId=config.getId(); return null;
        });
    }
    ReservationRepository stays(EntityManager em) {
        var r=mock(ReservationRepository.class);
        when(r.findById(314L)).thenAnswer(c->Optional.ofNullable(em.find(Reservation.class,314L)));
        when(r.findAllById(any())).thenAnswer(c->List.of(em.find(Reservation.class,314L))); return r;
    }
    BaitlyOwnerPayoutGuard guard(EntityManager em) {
        var payouts=mock(OwnerPayoutRepository.class);
        when(payouts.lockForReconciliation(payoutId,7L)).thenAnswer(c->Optional.ofNullable(em.find(OwnerPayout.class,payoutId,LockModeType.PESSIMISTIC_WRITE)));
        var configs=mock(OwnerPayoutConfigRepository.class);
        when(configs.findByOwnerIdAndOrgId(10L,7L)).thenAnswer(c->Optional.ofNullable(em.find(OwnerPayoutConfig.class,configId)));
        var claims=repo(em,OwnerPayoutReservationRepository.class);
        var documents=new BaitlyOwnerPayoutDocuments(repo(em,InvoiceRepository.class),mock(InvoiceGeneratorService.class),
                mock(InvoiceNumberingService.class),claims,em);
        var expenses=mock(ProviderExpenseRepository.class);
        when(expenses.findByPayoutIdAndOrgId(anyLong(),anyLong())).thenAnswer(call ->
                em.createQuery("select e from ProviderExpense e where e.ownerPayout.id=:payout and e.organizationId=:org", ProviderExpense.class)
                        .setParameter("payout",call.getArgument(0,Long.class))
                        .setParameter("org",call.getArgument(1,Long.class)).getResultList());
        var funding=new OwnerPayoutFundingService(repo(em,PaymentTransactionRepository.class),claims,payouts,stays(em),documents,
                new BaitlyExpenseRetention(expenses,em), org.mockito.Mockito.mock(com.clenzy.booking.service.BaitlyReservationCredit.class));
        ReflectionTestUtils.setField(funding,"em",em);
        return new BaitlyOwnerPayoutGuard(em,payouts,claims,configs,funding);
    }
    PayoutTransferInstruction instruction() {
        return new PayoutTransferInstruction(7L,PayoutTransfer.Source.OWNER_PAYOUT,payoutId,10L,new BigDecimal("80"),"EUR","acct_owner","Reversement test");
    }
    @Test void exactFundingAndDestinationPermitOneInstruction() {
        tx(em->{ guard(em).requireInstruction(instruction()); return null; });
    }
    @Test void ownerPayoutCannotRetainAnUnboundExpenseOrIgnoreAConcurrentCancellation() throws Exception {
        tx(em->{
            var p=em.find(OwnerPayout.class,payoutId);p.setExpenses(BigDecimal.TEN);p.setNetAmount(new BigDecimal("70"));
            return null;
        });
        var instruction=new PayoutTransferInstruction(7L,PayoutTransfer.Source.OWNER_PAYOUT,payoutId,10L,
                new BigDecimal("70"),"EUR","acct_owner","Reversement test");
        assertThatThrownBy(()->tx(em->{guard(em).requireInstruction(instruction);return null;})).hasMessageContaining("exactement");
        tx(em->{
            var e=new ProviderExpense();e.setId(601L);e.setOrganizationId(7L);e.setProvider(em.find(User.class,11L));
            e.setProperty(em.find(Property.class,50L));e.setOwnerPayout(em.find(OwnerPayout.class,payoutId));
            e.setStatus(ExpenseStatus.INCLUDED);e.setExpenseDate(LocalDate.of(2025,9,2));
            e.setAmountHt(BigDecimal.TEN);e.setAmountTtc(BigDecimal.TEN);e.setTaxAmount(BigDecimal.ZERO);em.persist(e);return null;
        });
        tx(em->{guard(em).requireInstruction(instruction);return null;});
        try(var lock=factory.createEntityManager();var executor=Executors.newSingleThreadExecutor()) {
            lock.getTransaction().begin();lock.find(ProviderExpense.class,601L,LockModeType.PESSIMISTIC_WRITE);
            var loaded=new CountDownLatch(1);
            var future=executor.submit(()->tx(em->{em.find(ProviderExpense.class,601L);loaded.countDown();guard(em).requireInstruction(instruction);return true;}));
            assertThat(loaded.await(5,TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(()->future.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            lock.find(ProviderExpense.class,601L).setStatus(ExpenseStatus.CANCELLED);lock.getTransaction().commit();
            assertThatThrownBy(()->future.get(5,TimeUnit.SECONDS)).hasCauseInstanceOf(IllegalStateException.class);
        }
    }
    private Invoice invoice(InvoiceType type, InvoiceStatus status, String total) {
        var invoice=new Invoice(); invoice.setOrganizationId(7L); invoice.setReservationId(314L);
        invoice.setInvoiceNumber("TEST-"+UUID.randomUUID().toString().substring(0,8)); invoice.setInvoiceDate(LocalDate.of(2025,9,2));
        invoice.setInvoiceType(type); invoice.setStatus(status); invoice.setTotalHt(new BigDecimal(total));
        invoice.setTotalTax(BigDecimal.ZERO); invoice.setTotalTtc(new BigDecimal(total)); return invoice;
    }
    @ParameterizedTest @ValueSource(strings={"tax","cancelled","currency","other-stay","other-payout","separate-payment","missing"})
    void inconsistentCommissionDocumentsPreventIssuingMoney(String defect) {
        tx(em->{var i=em.find(Invoice.class,commissionInvoiceId);
            switch(defect) {
                case "tax" -> {i.setTotalTax(new BigDecimal("4"));i.setTotalTtc(new BigDecimal("24"));}
                case "cancelled" -> i.setStatus(InvoiceStatus.CANCELLED);
                case "currency" -> i.setCurrency("MAD");
                case "other-stay" -> i.setReservationId(999L);
                case "other-payout" -> i.setPayoutId(999L);
                case "separate-payment" -> i.setPaymentTransactionId(999L);
                case "missing" -> em.remove(i);
            } return null;});
        assertThatThrownBy(()->tx(em->{guard(em).requireInstruction(instruction());return null;})).isInstanceOf(IllegalStateException.class);
    }
    @Test void completedRefundWithItsCreditNoteFundsOnlyTheRetainedBalance() {
        tx(em->{
            var stay=em.find(Reservation.class,314L);stay.setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);
            stay.setStatus("cancelled");stay.setCancelledAt(stay.getCheckIn().atStartOfDay());
            var refund=new PaymentTransaction();refund.setOrganizationId(7L);refund.setSourceId(314L);refund.setSourceType("BOOKING_CANCELLATION");
            refund.setTransactionRef("BCR-confirmed");refund.setProviderTxId("re_confirmed");refund.setProviderType(PaymentProviderType.STRIPE);
            refund.setPaymentType(TransactionType.REFUND);refund.setStatus(TransactionStatus.COMPLETED);refund.setCurrency("EUR");refund.setAmount(new BigDecimal("40"));
            refund.setMetadata(Map.of("cancellationRefund",true,"originalTransactionRef","TX-original","originalAmount","100","checkoutSessionId","cs_original"));em.persist(refund);
            var guest=invoice(InvoiceType.GUEST,InvoiceStatus.PAID,"100");em.persist(guest);
            var credit=invoice(InvoiceType.GUEST,InvoiceStatus.CREDIT_NOTE,"-40");credit.setOriginalInvoiceId(guest.getId());credit.setRefundTransactionId(refund.getId());em.persist(credit);
            em.createQuery("delete from OwnerPayoutReservation").executeUpdate();
            em.persist(new OwnerPayoutReservation(314L,7L,payoutId,new BigDecimal("60"),"EUR",List.of(paymentId,refund.getId())));
            var payout=em.find(OwnerPayout.class,payoutId);payout.setGrossRevenue(new BigDecimal("60"));payout.setNetAmount(new BigDecimal("45.60"));payout.setCommissionAmount(new BigDecimal("14.40"));
            var commission=em.find(Invoice.class,commissionInvoiceId);commission.setTotalHt(new BigDecimal("12"));commission.setTotalTax(new BigDecimal("2.40"));commission.setTotalTtc(new BigDecimal("14.40"));return null;
        });
        tx(em->{guard(em).requireInstruction(new PayoutTransferInstruction(7L,PayoutTransfer.Source.OWNER_PAYOUT,payoutId,10L,
                new BigDecimal("45.60"),"EUR","acct_owner","Solde après remboursement"));return null;});
        // Un avoir absent bloque la même instruction, sans changer l'encaissement.
        tx(em->{em.createQuery("delete from Invoice where status=:s").setParameter("s",InvoiceStatus.CREDIT_NOTE).executeUpdate();return null;});
        assertThatThrownBy(()->tx(em->{guard(em).requireInstruction(new PayoutTransferInstruction(7L,PayoutTransfer.Source.OWNER_PAYOUT,payoutId,10L,
                new BigDecimal("45.60"),"EUR","acct_owner","Solde après remboursement"));return null;})).hasMessageContaining("avoir");
    }
    @ParameterizedTest @ValueSource(strings={"cancelled","disputed","guard","amount","currency","owner","destination","unverified","already-transferred","wrong-status","foreign-property"})
    void changesBeforeInstructionNeverPassTheFinalGuard(String defect) {
        tx(em->{
            switch(defect) {
                case "cancelled" -> em.find(Reservation.class,314L).setStatus("cancelled");
                case "disputed" -> em.find(PaymentTransaction.class,paymentId).setDisputedAmount(BigDecimal.TEN);
                case "guard" -> { var p=new PaymentTransaction(); p.setOrganizationId(7L); p.setSourceType(ReservationRefundCoordination.SOURCE);
                    p.setSourceId(314L); p.setTransactionRef("RRG-test"); p.setPaymentType(TransactionType.REFUND);
                    p.setProviderType(PaymentProviderType.STRIPE); p.setStatus(TransactionStatus.PROCESSING); p.setAmount(BigDecimal.TEN); em.persist(p); }
                case "amount" -> em.find(OwnerPayout.class,payoutId).setNetAmount(new BigDecimal("81"));
                case "currency" -> em.find(PaymentTransaction.class,paymentId).setCurrency("USD");
                case "owner" -> em.find(Property.class,50L).setOwner(em.find(User.class,11L));
                case "destination" -> em.find(OwnerPayoutConfig.class,configId).setStripeConnectedAccountId("acct_other");
                case "unverified" -> em.find(OwnerPayoutConfig.class,configId).setVerified(false);
                case "already-transferred" -> em.find(OwnerPayout.class,payoutId).setStripeTransferId("tr_original");
                case "wrong-status" -> em.find(OwnerPayout.class,payoutId).setStatus(OwnerPayout.PayoutStatus.APPROVED);
                case "foreign-property" -> em.find(Property.class,50L).setOrganizationId(8L);
            } return null;
        });
        assertThatThrownBy(()->tx(em->{ guard(em).requireInstruction(instruction()); return null; })).isInstanceOf(IllegalStateException.class);
    }
    @Test void stalePaymentLoadedBeforeWaitingForTheReservationCannotHideACommittedDispute() throws Exception {
        try(var lock=factory.createEntityManager(); var executor=Executors.newSingleThreadExecutor()) {
            lock.getTransaction().begin(); lock.find(Reservation.class,314L,LockModeType.PESSIMISTIC_WRITE);
            var loaded=new CountDownLatch(1);
            var future=executor.submit(()->tx(em->{ em.find(PaymentTransaction.class,paymentId); loaded.countDown();
                guard(em).requireInstruction(instruction()); return true; }));
            assertThat(loaded.await(5,TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(()->future.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            lock.find(PaymentTransaction.class,paymentId).setDisputedAmount(BigDecimal.TEN); lock.getTransaction().commit();
            assertThatThrownBy(()->future.get(5,TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class).hasCauseInstanceOf(IllegalStateException.class);
        }
    }
    @Test void managerRefundCannotSpendMoneyAlreadyAssignedToAnOwnerPayout() {
        assertThatThrownBy(()->tx(em->{ new ReservationRefundCoordination(stays(em),repo(em,PaymentTransactionRepository.class),em)
                .reserve(7L,314L,"cs_original",BigDecimal.TEN,"test-refund"); return null; }))
                .hasMessageContaining("déjà attribué");
        long guards=tx(em->em.createQuery("select count(t) from PaymentTransaction t where t.paymentType=com.clenzy.model.TransactionType.REFUND",Long.class).getSingleResult());
        assertThat(guards).isZero();
    }
}
