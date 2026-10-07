package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.booking.model.GuestCreditTransaction;
import com.clenzy.repository.*;
import com.clenzy.service.payout.ReservationPayoutFunding;
import com.clenzy.tenant.TenantContext;
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
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** SQL réel, journal, avoirs et outbox atomiques. Aucun appel ou compte Stripe. */
class BaitlyExternalReservationRefundsTest {
    static SessionFactory factory;static String jdbc,user,schema;
    final TenantContext tenant=mock(TenantContext.class);boolean failOutbox;
    @BeforeAll static void start() throws Exception {
        jdbc=System.getProperty("baitly.test.jdbc");user=System.getProperty("baitly.test.user","postgres");
        if(jdbc!=null) {
            assertThat(jdbc).matches("jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*");schema="baitly_stay_refund_"+UUID.randomUUID().toString().replace("-","");
            try(var c=java.sql.DriverManager.getConnection(jdbc,user,"");var s=c.createStatement()){s.execute("CREATE SCHEMA "+schema);}
        }
        var xml=new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml,Reservation.class,Set.of("organizationId","status","paymentStatus","paymentCollection","totalPrice","creditApplied","currency","stripeSessionId","confirmationCode","checkOut"));
        xml.append("</entity-mappings>");
        factory=new Configuration().addPackage("com.clenzy.model").addAnnotatedClass(PaymentTransaction.class)
            .addAnnotatedClass(LedgerEntry.class).addAnnotatedClass(Wallet.class).addAnnotatedClass(OwnerPayoutReservation.class)
            .addAnnotatedClass(Invoice.class).addAnnotatedClass(InvoiceLine.class).addAnnotatedClass(InvoiceNumberSequence.class)
            .addAnnotatedClass(OutboxEvent.class).addAnnotatedClass(GuestCreditTransaction.class)
            .addAnnotatedClass(com.clenzy.booking.model.GuestCreditAccount.class).addAnnotatedClass(OwnerPayout.class)
            .addAnnotatedClass(PayoutTransfer.class).addAnnotatedClass(BaitlyTransferRecovery.class)
            .addInputStream(new ByteArrayInputStream(xml.toString().getBytes(StandardCharsets.UTF_8)))
            .setProperty("hibernate.connection.url",jdbc==null?"jdbc:h2:mem:externalstay;MODE=PostgreSQL;LOCK_TIMEOUT=5000":jdbc+(jdbc.contains("?")?"&":"?")+"currentSchema="+schema)
            .setProperty("hibernate.connection.username",jdbc==null?"sa":user)
            .setProperty("jakarta.persistence.validation.mode","none").setProperty("hibernate.hbm2ddl.auto","create-drop").buildSessionFactory();
    }
    @AfterAll static void close() throws Exception {
        if(factory!=null)factory.close();if(schema!=null)try(var c=java.sql.DriverManager.getConnection(jdbc,user,"");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}
    }
    <T>T tx(Function<EntityManager,T> work){try(var em=factory.createEntityManager()){em.getTransaction().begin();try{T result=work.apply(em);em.getTransaction().commit();return result;}catch(RuntimeException e){em.getTransaction().rollback();throw e;}}}
    <T>T repo(EntityManager em,Class<T> type){return new JpaRepositoryFactory(em).getRepository(type);}
    PaymentTransactionRepository payments(EntityManager em){return repo(em,PaymentTransactionRepository.class);}
    Wallet wallet(EntityManager em,WalletType type){var w=new Wallet();w.setOrganizationId(7L);w.setWalletType(type);w.setCurrency("EUR");em.persist(w);return w;}
    @BeforeEach void seed(){when(tenant.getRequiredOrganizationId()).thenReturn(7L);failOutbox=false;tx(em->{
        for(String name:List.of("OutboxEvent","InvoiceLine","Invoice","InvoiceNumberSequence","GuestCreditTransaction","GuestCreditAccount","BaitlyTransferRecovery","PayoutTransfer","OwnerPayoutReservation","OwnerPayout","LedgerEntry","Wallet","PaymentTransaction","Reservation"))em.createQuery("delete from "+name).executeUpdate();
        var stay=new Reservation();stay.setId(314L);stay.setOrganizationId(7L);stay.setStatus("confirmed");stay.setPaymentStatus(PaymentStatus.PAID);
        stay.setPaymentCollection(PaymentCollection.PMS);stay.setCurrency("EUR");stay.setTotalPrice(new BigDecimal("45"));stay.setStripeSessionId("cs_original");stay.setConfirmationCode("STAY-314");stay.setCheckOut(LocalDate.now().minusDays(1));em.persist(stay);
        var payment=RefundCreditNotePersistenceTest.transaction("TX-original",TransactionType.CHECKOUT);payment.setSourceType("RESERVATION");payment.setSourceId(314L);payment.setProviderTxId("cs_original");em.persist(payment);em.flush();
        var escrow=wallet(em,WalletType.ESCROW);var owner=wallet(em,WalletType.OWNER);var concierge=wallet(em,WalletType.CONCIERGE);var platform=wallet(em,WalletType.PLATFORM);
        var ledger=new LedgerService(repo(em,LedgerEntryRepository.class));ledger.recordTransfer(platform,escrow,new BigDecimal("45"),LedgerReferenceType.PAYMENT,"314","Paiement reservation: STAY-314");
        ledger.recordTransfer(escrow,owner,new BigDecimal("37.77"),LedgerReferenceType.SPLIT,"SPLIT-RES-314","Part propriétaire");
        ledger.recordTransfer(escrow,concierge,new BigDecimal("7.01"),LedgerReferenceType.SPLIT,"SPLIT-RES-314","Part gestionnaire");
        em.persist(new InvoiceNumberSequence(7L,"FA",LocalDate.now().getYear()));
        var invoice=new Invoice();invoice.setOrganizationId(7L);invoice.setInvoiceNumber("INV-STAY");invoice.setInvoiceDate(LocalDate.now());invoice.setStatus(InvoiceStatus.PAID);invoice.setInvoiceType(InvoiceType.GUEST);invoice.setReservationId(314L);invoice.setPaymentTransactionId(payment.getId());invoice.setCurrency("EUR");
        invoice.setTotalHt(new BigDecimal("38.64"));invoice.setTotalTax(new BigDecimal("6.36"));invoice.setTotalTtc(new BigDecimal("45"));
        invoice.addLine(RefundCreditNotePersistenceTest.line(1,"25","5","30","0.20"));invoice.addLine(RefundCreditNotePersistenceTest.line(2,"13.64","1.36","15","0.10"));em.persist(invoice);return null;
    });}
    BaitlyExternalRefundProof proof(String id,String amount){return new BaitlyExternalRefundProof(7L,"TX-original","cs_original","RESERVATION",314L,new BigDecimal("45"),"EUR",id,"pi_original",new BigDecimal(amount),"succeeded");}
    BaitlyExternalRefundStore service(EntityManager em){
        var entries=repo(em,LedgerEntryRepository.class);var wallets=mock(WalletService.class);when(wallets.getWalletById(anyLong())).thenAnswer(c->em.find(Wallet.class,c.getArgument(0)));
        var outbox=new OutboxPublisher(repo(em,OutboxEventRepository.class)){
            @Override public void publish(String aggregate,String id,String type,String topic,String key,String payload,Long org){
                super.publish(aggregate,id,type,topic,key,payload,org);if(failOutbox)throw new IllegalStateException("outbox unavailable");
            }};
        var persistence=new PaymentPersistence(payments(em),outbox,new com.fasterxml.jackson.databind.ObjectMapper(),mock(DepositReconciler.class),mock(InterventionPaymentCoordination.class),mock(InvoicePaymentCoordination.class),mock(com.clenzy.service.payout.BaitlyTransferRecoveryStore.class));
        return new BaitlyExternalRefundStore(em,payments(em),tenant,mock(BaitlyExternalRefundEligibility.class),persistence,mock(InterventionRefundReconciliationService.class),
            new BaitlyExternalReservationRefunds(em,payments(em),repo(em,OwnerPayoutReservationRepository.class),new ReservationCancellationLedger(entries,new LedgerService(entries),wallets),
                new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em),credits(em)),mock(BaitlyExternalBatchRefunds.class));
    }
    com.clenzy.booking.service.GuestCreditService credits(EntityManager em) {
        return new com.clenzy.booking.service.GuestCreditService(repo(em,com.clenzy.booking.repository.GuestCreditAccountRepository.class),
                repo(em,com.clenzy.booking.repository.GuestCreditTransactionRepository.class),mock(OrganizationRepository.class),mock(ReservationRepository.class),mock(org.springframework.beans.factory.ObjectProvider.class));
    }
    RefundCreditNoteService notes(EntityManager em){return new RefundCreditNoteService(em,repo(em,InvoiceRepository.class),payments(em),new InvoiceNumberingService(repo(em,InvoiceNumberSequenceRepository.class),tenant,em),tenant,mock(BaitlyBatchRefundPersistence.class));}
    void complete(BaitlyExternalRefundProof p,List<BaitlyExternalRefundProof> all){tx(em->service(em).observe(p));tx(em->service(em).complete(p,all));}
    @Test void successiveRefundsReverseTheExactTotalAndIssueTaxConsistentCreditNotes(){
        var all=new ArrayList<BaitlyExternalRefundProof>();
        for(var part:List.of(proof("re_a","5.01"),proof("re_b","4.99"),proof("re_c","35"))){all.add(part);complete(part,List.copyOf(all));tx(em->notes(em).reconcile("EXT-"+part.refundId()));}
        for(var p:all){complete(p,all);tx(em->notes(em).reconcile("EXT-"+p.refundId()));}
        tx(em->{
            assertThat(em.find(Reservation.class,314L).getStatus()).isEqualTo("confirmed");
            assertThat(em.find(Reservation.class,314L).getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
            var ledger=new LedgerService(repo(em,LedgerEntryRepository.class));for(var wallet:em.createQuery("from Wallet",Wallet.class).getResultList())assertThat(ledger.calculateBalance(wallet.getId())).isZero();
            var notes=em.createQuery("from Invoice where status=com.clenzy.model.InvoiceStatus.CREDIT_NOTE",Invoice.class).getResultList();assertThat(notes).hasSize(3);
            assertThat(notes.stream().map(Invoice::getTotalTax).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("-6.36");
            assertThat(notes.stream().map(Invoice::getTotalTtc).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("-45");
            assertThat(em.createQuery("select count(e) from OutboxEvent e",Long.class).getSingleResult()).isEqualTo(3);return null;
        });
    }
    @Test void residualFundingUsesConfirmedExternalRefundsOnly(){
        var p=proof("re_partial","5");complete(p,List.of(p));
        tx(em->{var r=em.find(Reservation.class,314L);var funding=payments(em).findReservationFunding(7L,List.of(314L),ReservationPayoutFunding.FUNDING_SOURCES);
            assertThat(ReservationPayoutFunding.evaluate(r,funding)).get().extracting(ReservationPayoutFunding.Evidence::collectedAmount).isEqualTo(new BigDecimal("40.00"));return null;});
        tx(em->service(em).review("EXT-re_partial"));
        tx(em->{assertThat(ReservationPayoutFunding.evaluate(em.find(Reservation.class,314L),payments(em).findReservationFunding(7L,List.of(314L),ReservationPayoutFunding.FUNDING_SOURCES))).isEmpty();return null;});
    }
    @Test void failureRollsBackJournalStatusAndOutboxWithoutErasingTheExternalProof(){
        var p=proof("re_failedlocal","5");tx(em->service(em).observe(p));failOutbox=true;
        assertThatThrownBy(()->tx(em->service(em).complete(p,List.of(p)))).hasMessage("outbox unavailable");
        tx(em->{assertThat(em.find(Reservation.class,314L).getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(em.createQuery("select count(e) from LedgerEntry e",Long.class).getSingleResult()).isEqualTo(6);
            assertThat(payments(em).findByProviderTxId(p.refundId()).orElseThrow().getStatus()).isEqualTo(TransactionStatus.PROCESSING);return null;});
        failOutbox=false;tx(em->service(em).complete(p,List.of(p)));
    }
    @ParameterizedTest @ValueSource(strings={"credit","ota","currency","amount","receipt","ledger","reward","cancellation","payout"})
    void ambiguousCasesRemainInReviewWithoutAccounting(String defect){
        var p=proof("re_review","5");tx(em->service(em).observe(p));
        tx(em->{var r=em.find(Reservation.class,314L);switch(defect){
            case "credit" -> r.setCreditApplied(BigDecimal.ONE);
            case "ota" -> r.setPaymentCollection(PaymentCollection.CHANNEL);
            case "currency" -> r.setCurrency("USD");
            case "amount" -> r.setTotalPrice(BigDecimal.TEN);
            case "receipt" -> r.setStripeSessionId("cs_other");
            case "ledger" -> em.createQuery("delete from LedgerEntry").executeUpdate();
            case "reward" -> {var reward=new GuestCreditTransaction();reward.setOrganizationId(7L);reward.setAccountId(1L);reward.setReservationCode("STAY-314");reward.setAmountCents(100);reward.setType(com.clenzy.booking.model.GuestCreditTxType.EARN);em.persist(reward);}
            case "cancellation" -> {var other=RefundCreditNotePersistenceTest.transaction("BCR-other",TransactionType.REFUND);other.setSourceType("BOOKING_CANCELLATION");other.setSourceId(314L);em.persist(other);}
            case "payout" -> em.persist(new OwnerPayoutReservation(314L,7L,1L,new BigDecimal("45"),"EUR",List.of(payments(em).findByTransactionRef("TX-original").orElseThrow().getId())));
        }return null;});
        assertThatThrownBy(()->tx(em->service(em).complete(p,List.of(p)))).isInstanceOf(RuntimeException.class);
        tx(em->{assertThat(payments(em).findByProviderTxId(p.refundId()).orElseThrow().getStatus()).isEqualTo(TransactionStatus.PROCESSING);assertThat(em.createQuery("select count(e) from OutboxEvent e",Long.class).getSingleResult()).isZero();return null;});
    }
    @Test void concurrentReplayProducesOneAccountingEffect() throws Exception {
        var p=proof("re_concurrent","5");tx(em->service(em).observe(p));
        try(var pool=Executors.newFixedThreadPool(2)){var gate=new CyclicBarrier(2);var futures=new ArrayList<Future<?>>();
            for(int n=0;n<2;n++)futures.add(pool.submit(()->{gate.await();return tx(em->service(em).complete(p,List.of(p)));}));
            for(var future:futures)future.get(15,TimeUnit.SECONDS);
        }
        tx(em->{assertThat(em.createQuery("select count(e) from OutboxEvent e",Long.class).getSingleResult()).isEqualTo(1);return null;});
    }

    void seedPaidOwner() { seedPaidOwner(false); }
    void seedPaidOwner(boolean multiStay) {
        tx(em->{
            var payout=new OwnerPayout();payout.setOrganizationId(7L);payout.setOwnerId(42L);payout.setFundingVersion(1);
            payout.setPeriodStart(LocalDate.now().minusMonths(1));payout.setPeriodEnd(LocalDate.now());payout.setCommissionRate(new BigDecimal("0.3333"));
            payout.setGrossRevenue(new BigDecimal(multiStay?"120.00":"45.00"));payout.setNetAmount(new BigDecimal(multiStay?"70.00":"30.00"));payout.setCommissionAmount(new BigDecimal("15.00"));
            payout.setExpenses(new BigDecimal(multiStay?"35.00":"0.00"));
            payout.setStatus(OwnerPayout.PayoutStatus.PAID);payout.setStripeTransferId("tr_owner");em.persist(payout);em.flush();
            var claim=new OwnerPayoutReservation(314L,7L,payout.getId(),new BigDecimal("45.00"),"EUR",List.of(payments(em).findByTransactionRef("TX-original").orElseThrow().getId()));
            claim.setNetAmount(new BigDecimal("30.00"));em.persist(claim);
            var transfer=new PayoutTransfer();
            Map<String,Object> fields=Map.ofEntries(Map.entry("organizationId",7L),Map.entry("source",PayoutTransfer.Source.OWNER_PAYOUT),Map.entry("sourceId",payout.getId()),
                    Map.entry("beneficiaryUserId",42L),Map.entry("amount",new BigDecimal(multiStay?"70.00":"30.00")),Map.entry("currency","EUR"),Map.entry("provider","STRIPE"),
                    Map.entry("destination","acct_owner"),Map.entry("description","TEST propriétaire"),Map.entry("idempotencyKey","owner-test"),Map.entry("createdAt",java.time.Instant.now()));
            fields.forEach((key,value)->org.springframework.test.util.ReflectionTestUtils.setField(transfer,key,value));
            transfer.transferred("tr_owner");transfer.captureDestinationPayment("py_owner",false);em.persist(transfer);
            var invoice=new Invoice();invoice.setOrganizationId(7L);invoice.setInvoiceNumber("COM-TEST");invoice.setInvoiceDate(LocalDate.now());invoice.setInvoiceType(InvoiceType.COMMISSION);
            invoice.setStatus(InvoiceStatus.PAID);invoice.setPayoutId(payout.getId());invoice.setReservationId(314L);invoice.setCurrency("EUR");
            invoice.setTotalHt(new BigDecimal("12.50"));invoice.setTotalTax(new BigDecimal("2.50"));invoice.setTotalTtc(new BigDecimal("15.00"));
            invoice.addLine(RefundCreditNotePersistenceTest.line(1,"12.50","2.50","15.00","0.20"));em.persist(invoice);return null;
        });
    }

    @Test void refundAfterOwnerTransferKeepsHistoricalTransferAndRecoversExactNetWithCommissionNotes() {
        seedPaidOwner();
        var first=proof("re_owner_a","5.00");var second=proof("re_owner_b","40.00");
        complete(first,List.of(first));tx(em->notes(em).reconcile("EXT-re_owner_a"));
        complete(second,List.of(first,second));tx(em->notes(em).reconcile("EXT-re_owner_b"));
        tx(em->{
            var rows=em.createQuery("from BaitlyTransferRecovery order by id",BaitlyTransferRecovery.class).getResultList();
            assertThat(rows).extracting(BaitlyTransferRecovery::getAmount).containsExactly(new BigDecimal("3.33"),new BigDecimal("26.67"));
            var store=new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em);
            assertThat(store.claim(7L,rows.getFirst().getId())).isPresent();store.confirm(7L,rows.getFirst().getId(),"trr_owner_a");
            assertThat(store.claim(7L,rows.getLast().getId())).get().extracting(com.clenzy.service.payout.BaitlyTransferRecoveryStore.Instruction::amount).isEqualTo(new BigDecimal("26.67"));
            store.confirm(7L,rows.getLast().getId(),"trr_owner_b");
            var credits=em.createQuery("from Invoice where ownerRefundTransactionId is not null",Invoice.class).getResultList();
            assertThat(credits).hasSize(2);assertThat(credits.stream().map(Invoice::getTotalTtc).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("-15.00");
            assertThat(credits.stream().map(Invoice::getTotalTax).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("-2.50");
            assertThat(em.createQuery("from PayoutTransfer",PayoutTransfer.class).getSingleResult().getAmount()).isEqualByComparingTo("30");return null;
        });
        complete(first,List.of(first,second));tx(em->notes(em).reconcile("EXT-re_owner_a"));
    }

    @Test void spentRewardsAreReversedOnceWithoutInventingCashAndCanOffsetFutureRewards() {
        tx(em->{var account=new com.clenzy.booking.model.GuestCreditAccount();account.setOrganizationId(7L);account.setEmail("reward@test.invalid");account.setBalanceCents(0);em.persist(account);em.flush();
            var earned=new GuestCreditTransaction();earned.setOrganizationId(7L);earned.setAccountId(account.getId());earned.setReservationCode("STAY-314");earned.setAmountCents(100);earned.setType(com.clenzy.booking.model.GuestCreditTxType.EARN);em.persist(earned);return null;});
        var first=proof("re_reward_a","5.00");var second=proof("re_reward_b","40.00");complete(first,List.of(first));complete(second,List.of(first,second));complete(first,List.of(first,second));
        tx(em->{assertThat(credits(em).getBalanceCents(7L,"reward@test.invalid","EUR")).isZero();
            var account=em.createQuery("from GuestCreditAccount",com.clenzy.booking.model.GuestCreditAccount.class).getSingleResult();assertThat(account.getBalanceCents()).isEqualTo(-100);
            assertThat(em.createQuery("from GuestCreditTransaction where sourceCreditId is not null",GuestCreditTransaction.class).getResultList()).hasSize(2);return null;});
        tx(em->{credits(em).earn(7L,"reward@test.invalid",150,"EUR","OTHER-STAY");return null;});
        tx(em->{assertThat(credits(em).getBalanceCents(7L,"reward@test.invalid","EUR")).isEqualTo(50);return null;});
    }

    @Test void multiStayOwnerTransferRecoversOnlyTheFrozenNetOfTheRefundedStay() {
        seedPaidOwner(true);
        tx(em->{
            var payout=em.createQuery("from OwnerPayout",OwnerPayout.class).getSingleResult();
            var original=RefundCreditNotePersistenceTest.transaction("TX-other",TransactionType.CHECKOUT);original.setSourceType("RESERVATION");original.setSourceId(315L);original.setAmount(new BigDecimal("75.00"));original.setProviderTxId("cs_other");em.persist(original);em.flush();
            var claim=new OwnerPayoutReservation(315L,7L,payout.getId(),new BigDecimal("75.00"),"EUR",List.of(original.getId()));claim.setNetAmount(new BigDecimal("40.00"));em.persist(claim);
            return null;
        });
        var p=proof("re_owner_multi","45.00");complete(p,List.of(p));tx(em->notes(em).reconcile("EXT-re_owner_multi"));
        tx(em->{
            var row=em.createQuery("from BaitlyTransferRecovery",BaitlyTransferRecovery.class).getSingleResult();
            var instruction=new com.clenzy.service.payout.BaitlyTransferRecoveryStore(em).claim(7L,row.getId()).orElseThrow();
            assertThat(instruction.transferAmount()).isEqualByComparingTo("70.00");assertThat(instruction.amount()).isEqualByComparingTo("30.00");
            assertThat(row.getNetBasis()).isEqualByComparingTo("30.00");assertThat(row.getGrossBasis()).isEqualByComparingTo("45.00");
            var sibling=em.createQuery("from OwnerPayoutReservation where reservationId=315",OwnerPayoutReservation.class).getSingleResult();
            assertThat(sibling.getNetAmount()).isEqualByComparingTo("40.00");return null;
        });
    }

    @Test void discountedStayRestoresOnlyConsumedPointsAndCreditsOnlyCashOnInvoice() {
        tx(em->{var stay=em.find(Reservation.class,314L);stay.setTotalPrice(new BigDecimal("55.00"));stay.setCreditApplied(new BigDecimal("10.00"));
            var account=new com.clenzy.booking.model.GuestCreditAccount();account.setOrganizationId(7L);account.setEmail("credit@test.invalid");em.persist(account);em.flush();
            var spend=new GuestCreditTransaction();spend.setOrganizationId(7L);spend.setAccountId(account.getId());spend.setReservationCode("STAY-314");spend.setAmountCents(-1000);spend.setType(com.clenzy.booking.model.GuestCreditTxType.REDEEM);em.persist(spend);
            payments(em).findByTransactionRef("TX-original").orElseThrow().setMetadata(new HashMap<>(com.clenzy.booking.service.BaitlyReservationCredit.metadata(stay,account.getId())));return null;});
        var first=proof("re_credit_a","5.00");var second=proof("re_credit_b","40.00");complete(first,List.of(first));tx(em->notes(em).reconcile("EXT-re_credit_a"));
        complete(second,List.of(first,second));tx(em->notes(em).reconcile("EXT-re_credit_b"));complete(first,List.of(first,second));
        tx(em->{assertThat(credits(em).getBalanceCents(7L,"credit@test.invalid","EUR")).isEqualTo(1000);
            var notes=em.createQuery("from Invoice where status=com.clenzy.model.InvoiceStatus.CREDIT_NOTE",Invoice.class).getResultList();
            assertThat(notes.stream().map(Invoice::getTotalTtc).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("-45.00");return null;});
    }
}
