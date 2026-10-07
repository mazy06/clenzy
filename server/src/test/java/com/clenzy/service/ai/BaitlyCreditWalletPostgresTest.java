package com.clenzy.service.ai;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import liquibase.*;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.sql.DriverManager;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Base réelle : concurrence, retour arrière, reprise après interruption, dette et migration Liquibase. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyCreditWalletPostgresTest {
    static String url,user,schema; static SessionFactory factory;
    @BeforeAll static void schema() throws Exception {
        url=System.getProperty("baitly.test.jdbc"); user=System.getProperty("baitly.test.user","postgres");
        schema="baitly_credits_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()) {s.execute("CREATE SCHEMA "+schema);}
        factory=new Configuration().addAnnotatedClass(AiCreditGrant.class).addAnnotatedClass(AiUsageLedgerEntry.class)
                .addAnnotatedClass(BaitlySubscriptionFunding.class).addAnnotatedClass(BaitlyCreditCoverage.class).addAnnotatedClass(BaitlyCreditAccount.class).addAnnotatedClass(BaitlyCreditReservation.class).addAnnotatedClass(PaymentTransaction.class)
                .setProperty("hibernate.connection.url",url+(url.contains("?")?"&":"?")+"currentSchema="+schema)
                .setProperty("hibernate.connection.username",user).setProperty("hibernate.hbm2ddl.auto","create-drop")
                .setProperty("jakarta.persistence.validation.mode","none").buildSessionFactory();
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()) {
            s.execute("SET search_path TO "+schema);
            s.execute("DROP TABLE baitly_subscription_funding,baitly_ai_credit_reservations,baitly_ai_credit_accounts,baitly_ai_credit_coverage");
            s.execute("CREATE TABLE organizations(id BIGINT PRIMARY KEY)");s.execute("INSERT INTO organizations VALUES(7),(8)");
            s.execute("ALTER TABLE ai_credit_grant DROP COLUMN millicredits_revoked, DROP COLUMN millicredits_expired, DROP COLUMN funding_invoice_id, DROP COLUMN funding_pending");
        }
        for(int pass=0;pass<2;pass++)try(var c=DriverManager.getConnection(url+"?currentSchema="+schema,user,"")) {
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->cs.getId().equals("0524-durable-ai-credit-wallet")).findFirst().orElseThrow());
                selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->cs.getId().equals("0527-subscription-funding")).findFirst().orElseThrow());
                selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->cs.getId().equals("0535-legacy-credit-funding")).findFirst().orElseThrow());
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
    @BeforeEach void seed() { tx(em->{
        for(String entity:List.of("BaitlySubscriptionFunding","BaitlyCreditReservation","BaitlyCreditCoverage","BaitlyCreditAccount","AiUsageLedgerEntry","AiCreditGrant","PaymentTransaction")) em.createQuery("delete from "+entity).executeUpdate();
        em.persist(new AiCreditGrant(7L,"TOPUP",5000,Instant.now().plusSeconds(3600),"cs_credit"));return null;
    }); }
    BaitlyCreditWallet wallet(EntityManager em) {return new BaitlyCreditWallet(em,new JpaRepositoryFactory(em).getRepository(AiCreditGrantRepository.class));}
    BaitlyCreditDebit debit(EntityManager em) {return new BaitlyCreditDebit(new JpaRepositoryFactory(em).getRepository(AiUsageLedgerRepository.class),wallet(em),mock(CreditBalanceService.class));}
    AiUsageLedgerEntry entry(String key,long amount) { return new AiUsageLedgerEntry(7L,null,null,null,"test","CREDITS","DEBIT","INTERACTIVE",null,null,0,0,0,null,null,-amount,0,key); }
    @Test void concurrentExecutionsCannotSpendTheSameBalance() throws Exception {
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);Callable<Boolean> reserve=()->{barrier.await(5,TimeUnit.SECONDS);return tx(em->wallet(em).reserve(7L,UUID.randomUUID(),3000));};
            var a=pool.submit(reserve);var b=pool.submit(reserve);assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(2000L);
    }
    @Test void reservationSurvivesNewServiceAndCacheInvalidationThenReleasesOnlyOnce() {
        var key=UUID.randomUUID();tx(em->wallet(em).reserve(7L,key,4000));
        tx(em->{assertThat(wallet(em).reserve(7L,UUID.randomUUID(),2000)).isFalse();return null;});
        tx(em->{wallet(em).release(7L,key);wallet(em).release(7L,key);return null;});
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(5000L);
    }
    @Test void duplicateUsageCommitsLedgerAndGrantsExactlyOnce() throws Exception {
        var key=UUID.randomUUID();tx(em->wallet(em).reserve(7L,key,3000));
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);Callable<Boolean> consume=()->{barrier.await(5,TimeUnit.SECONDS);return tx(em->debit(em).record(entry("same-call",2000),key));};
            var a=pool.submit(consume);var b=pool.submit(consume);assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        tx(em->{wallet(em).release(7L,key);return null;});
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(3000L);
    }
    @Test void failedCommitLeavesBothLedgerAndCreditsUntouched() {
        assertThatThrownBy(()->tx(em->{debit(em).record(entry("rollback",2000),null);em.flush();throw new IllegalStateException("incident");})).hasMessage("incident");
        tx(em->{assertThat(wallet(em).available(7L)).isEqualTo(5000);assertThat(em.createQuery("select count(e) from AiUsageLedgerEntry e",Long.class).getSingleResult()).isZero();return null;});
    }
    @Test void usageOverdraftSurvivesRestartAndFutureTopUp() {
        tx(em->debit(em).record(entry("overrun",6500),null));
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(-1500L);
        tx(em->{em.persist(new AiCreditGrant(7L,"TOPUP",3000,Instant.now().plusSeconds(3600),"cs_new"));return null;});
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(1500L);
    }
    @Test void expiredReservationCannotResumeButLateUsageStillCounts() {
        var key=UUID.randomUUID();tx(em->wallet(em).reserve(7L,key,3000));
        tx(em->{em.createQuery("update BaitlyCreditReservation set expiresAt=:past").setParameter("past",Instant.now().minusSeconds(1)).executeUpdate();return null;});
        tx(em->{assertThat(wallet(em).renew(7L,key)).isFalse();assertThat(wallet(em).reserve(7L,key,1000)).isFalse();debit(em).record(entry("late",2000),key);return null;});
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(3000L);
    }
    @Test void refundOfConsumedCreditsCreatesDebtAndDisputeReinstatementRestoresExactRights() {
        tx(em->debit(em).record(entry("use",4000),null));
        tx(em->{var grant=em.createQuery("from AiCreditGrant",AiCreditGrant.class).getSingleResult();grant.setMillicreditsRevoked(2500);return null;});
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(-1500L);
        tx(em->{var grant=em.createQuery("from AiCreditGrant",AiCreditGrant.class).getSingleResult();grant.setMillicreditsRevoked(0);return null;});
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(1000L);
    }
    @Test void organizationCannotConsumeOrReleaseAnotherOrganizationsReservation() {
        var key=UUID.randomUUID();tx(em->wallet(em).reserve(7L,key,3000));
        assertThatThrownBy(()->tx(em->{wallet(em).release(8L,key);return null;})).hasMessageContaining("autre organisation");
        assertThatThrownBy(()->tx(em->wallet(em).consume(8L,key,1000))).hasMessageContaining("autre organisation");
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(2000L);
    }
    @Test void externalPartialRefundFreezesProportionAndFailureRestoresItWithoutDeletingUsage() {
        Long id=tx(em->{
            em.createQuery("delete from AiCreditGrant").executeUpdate();
            em.persist(new AiCreditGrant(7L,"TOPUP",500000,Instant.now().plusSeconds(3600),"cs_pack"));
            var payment=new PaymentTransaction();payment.setOrganizationId(7L);payment.setSourceType("AI_CREDIT_TOPUP");payment.setSourceId(7L);
            payment.setTransactionRef("pack-receipt");payment.setProviderType(PaymentProviderType.STRIPE);payment.setProviderTxId("cs_pack");
            payment.setPaymentType(TransactionType.CHECKOUT);payment.setStatus(TransactionStatus.COMPLETED);payment.setCurrency("EUR");payment.setAmount(new java.math.BigDecimal("12"));
            payment.setMetadata(Map.of("pack_key","pack_500","millicredits","500000"));em.persist(payment);
            debit(em).record(entry("pack-use",400000),null);return payment.getId();
        });
        tx(em->{
            var refund=new PaymentTransaction();refund.setOrganizationId(7L);refund.setSourceType("AI_CREDIT_TOPUP");refund.setSourceId(7L);
            refund.setTransactionRef("EXT-re_pack");refund.setProviderType(PaymentProviderType.STRIPE);refund.setProviderTxId("re_pack");
            refund.setPaymentType(TransactionType.REFUND);refund.setStatus(TransactionStatus.PROCESSING);refund.setCurrency("EUR");refund.setAmount(new java.math.BigDecimal("6"));
            refund.setMetadata(Map.of("externalRefund",true,"originalTransactionRef","pack-receipt","stripeStatus","pending","reviewRequired",true));em.persist(refund);
            funding(em).sync(em.find(PaymentTransaction.class,id));return null;
        });
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(-150000L);
        tx(em->{funding(em).sync(em.find(PaymentTransaction.class,id));
            assertThat(em.createQuery("select count(e) from AiUsageLedgerEntry e where entryType='ADJUSTMENT'",Long.class).getSingleResult()).isEqualTo(1);return null;});
        tx(em->{var refund=em.createQuery("from PaymentTransaction where transactionRef='EXT-re_pack'",PaymentTransaction.class).getSingleResult();
            refund.setStatus(TransactionStatus.FAILED);refund.setMetadata(Map.of("externalRefund",true,"originalTransactionRef","pack-receipt","stripeStatus","failed","reviewRequired",false));
            funding(em).sync(em.find(PaymentTransaction.class,id));return null;});
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(100000L);
        tx(em->{var payment=em.find(PaymentTransaction.class,id);payment.setDisputedAmount(new java.math.BigDecimal("12"));funding(em).sync(payment);return null;});
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(-400000L);
        tx(em->{var payment=em.find(PaymentTransaction.class,id);payment.setDisputedAmount(java.math.BigDecimal.ZERO);funding(em).sync(payment);return null;});
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(100000L);
    }
    BaitlyCreditFunding funding(EntityManager em) {
        return new BaitlyCreditFunding(em,wallet(em),mock(AiCreditGrantService.class),mock(CreditBalanceService.class));
    }
    @Test void expiredCreditsNeverBecomeUsageDebtWhenPaymentIsReversed() {
        tx(em->{var grant=em.createQuery("from AiCreditGrant",AiCreditGrant.class).getSingleResult();grant.applyConsumption(1000);grant.expireRemaining();grant.setMillicreditsRevoked(5000);return null;});
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(-1000L);
    }
    @Test void idempotencyKeyCannotSilentlyHideDifferentUsage() {
        tx(em->debit(em).record(entry("identity",1000),null));
        assertThatThrownBy(()->tx(em->debit(em).record(entry("identity",2000),null))).hasMessageContaining("autre usage");
        assertThat((long)tx(em->wallet(em).available(7L))).isEqualTo(4000L);
    }
    @Test void prepaidCoverageRequiresPaidCustomerInvoiceAndMatchingPeriod() {
        var payer=new User();payer.setOrganizationId(7L);payer.setStripeCustomerId("cus_7");payer.setStripeSubscriptionId("sub_7");
        long start=Instant.now().minusSeconds(30).getEpochSecond(),end=start+3600;
        var invoice=com.stripe.net.ApiResource.GSON.fromJson("""
                {"id":"in_7","status":"paid","customer":"cus_7","amount_paid":12000,"amount_remaining":0,
                 "billing_reason":"subscription_cycle","parent":{"subscription_details":{"subscription":"sub_7"}},
                 "lines":{"has_more":false,"data":[{"parent":{"subscription_item_details":{"subscription":"sub_7","proration":false}},"period":{"start":%d,"end":%d}}]}}
                """.formatted(start,end),com.stripe.model.Invoice.class);
        tx(em->{assertThat(wallet(em).paidUntil(7L,"sub_7")).isNull();wallet(em).recordCoverage(payer,invoice);return null;});
        tx(em->{assertThat(wallet(em).paidUntil(7L,"sub_7")).isEqualTo(Instant.ofEpochSecond(end));assertThat(wallet(em).paidUntil(8L,"sub_7")).isNull();return null;});
        invoice.setCustomer("cus_other");assertThatThrownBy(()->tx(em->wallet(em).recordCoverage(payer,invoice))).hasMessageContaining("non prouvée");
        invoice.setCustomer("cus_7");invoice.setAmountPaidOffStripe(12000L);
        assertThatThrownBy(()->tx(em->wallet(em).recordCoverage(payer,invoice))).hasMessageContaining("non prouvée");
    }
    @Test void historicalMonthlyCreditsRequireUniqueInvoiceThenFollowItsRefund() {
        tx(em->{
            var grant = new AiCreditGrant(7L,"SUBSCRIPTION",10000,Instant.now().plusSeconds(1000),"monthly:7:2026-10");em.persist(grant);
            assertThat(wallet(em).available(7L)).isEqualTo(5000);
            em.persist(new BaitlyCreditCoverage("in_old",7L,"sub_7",Instant.now().minusSeconds(3600),Instant.now().plusSeconds(3600)));
            wallet(em).reconcileLegacyCoverage(7L);
            assertThat(grant.getFundingInvoiceId()).isEqualTo("in_old");assertThat(wallet(em).available(7L)).isEqualTo(15000);
            var invoice=com.stripe.net.ApiResource.GSON.fromJson("{\"id\":\"in_old\",\"parent\":{\"subscription_details\":{\"subscription\":\"sub_7\"}}}",com.stripe.model.Invoice.class);
            new com.clenzy.service.BaitlySubscriptionFunds(null,em,wallet(em),mock(CreditBalanceService.class))
                    .apply(7L,invoice,new com.clenzy.service.BaitlySubscriptionFunds.Snapshot(1000,500,500,false),Instant.now().plusSeconds(3600));
            assertThat(grant.remaining()).isEqualTo(5000);return null;
        });
    }
    @Test void ambiguousAndCrossTenantCoverageDoesNotReleaseHistoricalCredits() {
        tx(em->{
            var grant = new AiCreditGrant(7L,"SUBSCRIPTION",10000,Instant.now().plusSeconds(1000),"monthly:7:2026-10");em.persist(grant);
            em.persist(new BaitlyCreditCoverage("in_other",8L,"sub_8",Instant.now().minusSeconds(3600),Instant.now().plusSeconds(3600)));
            wallet(em).reconcileLegacyCoverage(7L);assertThat(grant.isFundingPending()).isTrue();
            for(String id:List.of("in_one","in_two"))em.persist(new BaitlyCreditCoverage(id,7L,"sub_7",Instant.now().minusSeconds(3600),Instant.now().plusSeconds(3600)));
            wallet(em).reconcileLegacyCoverage(7L);assertThat(grant.isFundingPending()).isTrue();assertThat(grant.applyConsumption(100)).isZero();return null;
        });
    }

    @Test void refundedSubscriptionRevokesConsumedAndMonthlyCreditsAndRestoresOnlyOnNewProof() {
        var invoice=com.stripe.net.ApiResource.GSON.fromJson("{\"id\":\"in_annual\",\"parent\":{\"subscription_details\":{\"subscription\":\"sub_7\"}}}",com.stripe.model.Invoice.class);
        tx(em->{
            em.createQuery("delete from AiCreditGrant").executeUpdate();
            var grant=new AiCreditGrant(7L,"SUBSCRIPTION",10000,Instant.now().plusSeconds(3600),"in_annual");grant.applyConsumption(7000);em.persist(grant);
            em.persist(new BaitlyCreditCoverage("in_annual",7L,"sub_7",Instant.now().minusSeconds(3600),Instant.now().plusSeconds(3600)));
            var funds=new com.clenzy.service.BaitlySubscriptionFunds(null,em,wallet(em),mock(CreditBalanceService.class));
            funds.apply(7L,invoice,new com.clenzy.service.BaitlySubscriptionFunds.Snapshot(1000,500,500,false),Instant.now().plusSeconds(3600));
            assertThat(wallet(em).revokedDebt(7L)).isEqualTo(2000);
            var monthly=new AiCreditGrant(7L,"SUBSCRIPTION",10000,Instant.now().plusSeconds(3600),"monthly:7:2027-01:in_annual");wallet(em).applyFunding(monthly);em.persist(monthly);
            assertThat(monthly.remaining()).isEqualTo(5000);
            funds.apply(7L,invoice,new com.clenzy.service.BaitlySubscriptionFunds.Snapshot(1000,500,500,true),Instant.now().plusSeconds(3600));
            assertThat(wallet(em).paidUntil(7L,"sub_7")).isNull();assertThat(funds.paidUntil(7L,"sub_7")).isNull();
            funds.apply(7L,invoice,new com.clenzy.service.BaitlySubscriptionFunds.Snapshot(1000,0,0,false,Instant.now().minusSeconds(3600)),Instant.now().plusSeconds(3600));
            assertThat(wallet(em).paidUntil(7L,"sub_7")).isNull();assertThat(monthly.getMillicreditsRevoked()).isEqualTo(10000);
            funds.apply(7L,invoice,new com.clenzy.service.BaitlySubscriptionFunds.Snapshot(1000,500,500,false),Instant.now().plusSeconds(3600));
            assertThat(wallet(em).paidUntil(7L,"sub_7")).isNotNull();assertThat(monthly.getMillicreditsRevoked()).isEqualTo(5000);return null;
        });
    }

}
