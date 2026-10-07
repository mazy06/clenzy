package com.clenzy.booking.service;

import com.clenzy.booking.model.*;
import com.clenzy.booking.repository.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;

/** Vrais changesets, repositories et transactions concurrentes ; aucune base applicative. */
@EnabledIfSystemProperty(named="baitly.test.jdbc", matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyGuestCreditPostgresTest {
    static SessionFactory factory;
    static String url,user,schema;
    @BeforeAll static void start() throws Exception {
        url=System.getProperty("baitly.test.jdbc");user=System.getProperty("baitly.test.user","postgres");
        schema="baitly_credit_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()) {
            s.execute("CREATE SCHEMA "+schema);s.execute("CREATE TABLE "+schema+".organizations(id bigint primary key)");
            s.execute("INSERT INTO "+schema+".organizations VALUES(1),(2)");
        }
        for(int pass=0;pass<2;pass++) try(var c=DriverManager.getConnection(url+"?currentSchema="+schema,user,"")) {
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream()
                    .filter(cs->Set.of("0266-add-loyalty-credit","0268-add-referral","0514-loyalty-refund-rewards").contains(cs.getId())).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(3);
                new Liquibase(selected,resources,db).update("");
            }
        }
        factory=new Configuration().addAnnotatedClass(GuestCreditAccount.class).addAnnotatedClass(GuestCreditTransaction.class)
            .setProperty("hibernate.connection.url",url+"?currentSchema="+schema).setProperty("hibernate.connection.username",user)
            .setProperty("hibernate.hbm2ddl.auto","validate").buildSessionFactory();
    }
    @AfterAll static void stop() throws Exception {
        if(factory!=null)factory.close();
        if(schema!=null)try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}
    }
    static <T>T tx(Function<EntityManager,T> work) {
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin();
            try {T result=work.apply(em);em.getTransaction().commit();return result;}
            catch(RuntimeException ex){em.getTransaction().rollback();throw ex;}
        }
    }
    static <T>T repo(EntityManager em,Class<T> type){return new JpaRepositoryFactory(em).getRepository(type);}
    static GuestCreditService service(EntityManager em) {
        return new GuestCreditService(repo(em,GuestCreditAccountRepository.class),repo(em,GuestCreditTransactionRepository.class),
            mock(OrganizationRepository.class),mock(ReservationRepository.class),mock(ObjectProvider.class));
    }
    @BeforeEach void clean() {tx(em->{em.createQuery("delete from GuestCreditTransaction").executeUpdate();
        em.createQuery("delete from GuestCreditAccount").executeUpdate();return null;});}
    void earn(String code,long amount) {tx(em->{service(em).earn(1L,"guest@test.invalid",amount,"EUR",code);return null;});}
    long balance(){return tx(em->service(em).getBalanceCents(1L,"guest@test.invalid"));}
    List<Boolean> concurrently(java.util.function.IntFunction<Boolean> work) throws Exception {
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);var tasks=new ArrayList<Future<Boolean>>();
            for(int n=0;n<2;n++){int index=n;tasks.add(pool.submit(()->{barrier.await(10,TimeUnit.SECONDS);return work.apply(index);}));}
            return List.of(tasks.get(0).get(20,TimeUnit.SECONDS),tasks.get(1).get(20,TimeUnit.SECONDS));
        }
    }
    @Test void concurrentCreationAndDistinctEarningsConserveTheSum() throws Exception {
        concurrently(i->{earn("EARN-"+i,500);return true;});assertThat(balance()).isEqualTo(1000);
    }
    @Test void concurrentReplayCreditsExactlyOnce() throws Exception {
        concurrently(i->{earn("SAME",500);return true;});assertThat(balance()).isEqualTo(500);
        assertThat(BaitlyGuestCreditPostgresTest.<Long>tx(em->em.createQuery("select count(t) from GuestCreditTransaction t",Long.class).getSingleResult())).isEqualTo(1L);
    }
    @Test void twoBookingsCannotSpendTheSameBalance() throws Exception {
        earn("INITIAL",1000);
        var outcomes=concurrently(i->tx(em->service(em).redeem(1L,"guest@test.invalid",800,"BOOK-"+i)));
        assertThat(outcomes).containsExactlyInAnyOrder(true,false);assertThat(balance()).isEqualTo(200);
    }
    @Test void twoDeliveriesOfTheSamePaymentSucceedWithOneDebit() throws Exception {
        earn("INITIAL",1000);
        assertThat(concurrently(i->tx(em->service(em).redeem(1L,"guest@test.invalid",1000,"BOOK")))).containsOnly(true);
        assertThat(balance()).isZero();
    }
    @Test void staleAccountInPersistenceContextCannotOverwriteConcurrentEarnings() {
        earn("INITIAL",1000);
        tx(em->{assertThat(service(em).getBalanceCents(1L,"guest@test.invalid")).isEqualTo(1000);
            earn("OTHER",500);service(em).earn(1L,"guest@test.invalid",300,"EUR","STALE");return null;});
        assertThat(balance()).isEqualTo(1800);
    }
    @Test void concurrentClawbacksReturnOnlyTheConsumedAmount() throws Exception {
        earn("INITIAL",1000);tx(em->service(em).redeem(1L,"guest@test.invalid",700,"BOOK"));
        concurrently(i->tx(em->{service(em).clawback(1L,"guest@test.invalid",700,"BOOK");return true;}));
        assertThat(balance()).isEqualTo(1000);
        assertThatThrownBy(()->tx(em->service(em).redeem(1L,"guest@test.invalid",700,"BOOK"))).isInstanceOf(IllegalStateException.class);
    }
    @Test void rollbackRestoresBalanceAndRemovesProof() {
        earn("INITIAL",1000);
        assertThatThrownBy(()->tx(em->{assertThat(service(em).redeem(1L,"guest@test.invalid",700,"BOOK")).isTrue();
            throw new IllegalStateException("Simulated confirmation rollback");})).isInstanceOf(IllegalStateException.class);
        assertThat(balance()).isEqualTo(1000);assertThat(BaitlyGuestCreditPostgresTest.<Boolean>tx(em->service(em).wasRedeemed(1L,"BOOK"))).isFalse();
    }
    @Test void cancellationAfterPartialReturnKeepsProofAndRestoresOnlyTheRemainingCredit() {
        earn("INITIAL",1000);tx(em->service(em).redeem(1L,"guest@test.invalid",700,"BOOK"));
        tx(em->{
            var account=repo(em,GuestCreditAccountRepository.class).findByOrganizationIdAndEmail(1L,"guest@test.invalid").orElseThrow();
            service(em).restoreConsumed(1L,"BOOK",700,new java.math.BigDecimal("10"),java.math.BigDecimal.ZERO,new java.math.BigDecimal("5"),"REF-1",account.getId());return null;
        });
        tx(em->{service(em).clawback(1L,"guest@test.invalid",700,"BOOK");return null;});
        tx(em->{service(em).clawback(1L,"guest@test.invalid",700,"BOOK");return null;});
        assertThat(balance()).isEqualTo(1000);
        assertThat(BaitlyGuestCreditPostgresTest.<Boolean>tx(em->service(em).hasReconciledRedemption(1L,"guest@test.invalid",700,"EUR","BOOK"))).isTrue();
        assertThat(BaitlyGuestCreditPostgresTest.<Boolean>tx(em->service(em).hasExactRedemption(1L,"guest@test.invalid",700,"EUR","BOOK"))).isFalse();
        assertThat(BaitlyGuestCreditPostgresTest.<Boolean>tx(em->service(em).hasReconciledRedemption(2L,"guest@test.invalid",700,"EUR","BOOK"))).isFalse();
    }
    @Test void neitherAnotherGuestNorAnotherAmountCanReuseAReceipt() {
        earn("INITIAL",1000);tx(em->service(em).redeem(1L,"guest@test.invalid",700,"BOOK"));
        tx(em->{service(em).earn(1L,"other@test.invalid",1000,"EUR","OTHER");return null;});
        assertThatThrownBy(()->tx(em->service(em).redeem(1L,"other@test.invalid",700,"BOOK"))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->tx(em->{service(em).clawback(1L,"guest@test.invalid",701,"BOOK");return null;})).isInstanceOf(IllegalStateException.class);
        assertThat(balance()).isEqualTo(300);
    }
    @Test void anotherCurrencyCannotBeEarnedOrSpentAndAnotherTenantHasNoBalance() {
        earn("INITIAL",1000);
        assertThatThrownBy(()->tx(em->{service(em).earn(1L,"guest@test.invalid",500,"MAD","OTHER");return null;})).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->tx(em->service(em).redeem(1L,"guest@test.invalid",500,"MAD","BOOK",null))).isInstanceOf(IllegalStateException.class);
        assertThat(BaitlyGuestCreditPostgresTest.<Boolean>tx(em->service(em).redeem(2L,"guest@test.invalid",500,"BOOK"))).isFalse();assertThat(balance()).isEqualTo(1000);
    }
    @Test void referralCodeCreationCannotRestoreAnAlreadySpentStaleBalance() {
        earn("INITIAL",1000);
        String code=tx(em->{assertThat(service(em).getBalanceCents(1L,"guest@test.invalid")).isEqualTo(1000);
            tx(other->service(other).redeem(1L,"guest@test.invalid",700,"BOOK"));
            var referrals=new GuestReferralService(repo(em,GuestCreditAccountRepository.class),mock(GuestReferralRepository.class),
                mock(ReservationRepository.class),mock(OrganizationRepository.class),service(em),mock(ObjectProvider.class));
            return referrals.getOrCreateCode(1L,"guest@test.invalid");});
        assertThat(code).hasSize(8);assertThat(balance()).isEqualTo(300);
    }
}
