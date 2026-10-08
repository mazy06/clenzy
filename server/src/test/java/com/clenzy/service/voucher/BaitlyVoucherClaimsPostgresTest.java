package com.clenzy.service.voucher;

import com.clenzy.model.*;
import com.clenzy.model.voucher.*;
import com.clenzy.repository.*;
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
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;

/** Schéma réel, migration rejouée et deux transactions concurrentes ; aucun appel PSP. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyVoucherClaimsPostgresTest {
    static String url,user,schema; static SessionFactory factory;
    long voucherId;
    @BeforeAll static void schema() throws Exception {
        url=System.getProperty("baitly.test.jdbc"); user=System.getProperty("baitly.test.user","postgres");
        schema="baitly_voucher_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()) {s.execute("CREATE SCHEMA "+schema);}
        factory=new Configuration().addPackage("com.clenzy.model")
            .addAnnotatedClass(BookingVoucher.class).addAnnotatedClass(VoucherUsage.class).addAnnotatedClass(VoucherPropertyScope.class)
            .setProperty("hibernate.connection.url",url+(url.contains("?")?"&":"?")+"currentSchema="+schema)
            .setProperty("hibernate.connection.username",user).setProperty("hibernate.hbm2ddl.auto","create-drop")
            .setProperty("jakarta.persistence.validation.mode","none").buildSessionFactory();
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()) {
            s.execute("SET search_path TO "+schema);
            s.execute("ALTER TABLE voucher_usage DROP COLUMN claim_status, DROP COLUMN released_at");
            s.execute("ALTER TABLE booking_voucher DROP COLUMN currency");
        }
        for(int pass=0;pass<2;pass++)try(var c=DriverManager.getConnection(url+"?currentSchema="+schema,user,"")) {
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream()
                    .filter(cs->cs.getId().equals("0520-booking-voucher-claims")).findFirst().orElseThrow());
                selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream()
                    .filter(cs->cs.getId().equals("0525-booking-voucher-currency")).findFirst().orElseThrow());
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
        voucherId=tx(em->{
            em.createQuery("delete from VoucherUsage").executeUpdate();
            em.createQuery("delete from BookingVoucher").executeUpdate();
            var v=new BookingVoucher(); v.setOrganizationId(2L);v.setCode("SAVE20");v.setName("Séjour sandbox");
            v.setType(VoucherType.MANUAL_CODE);v.setDiscountType(VoucherDiscountType.PERCENTAGE);v.setDiscountValue(new BigDecimal("20"));
            v.setStatus(VoucherStatus.ACTIVE);v.setMaxUsesPerGuest(1);em.persist(v);return v.getId();
        });
    }
    VoucherEngine engine(EntityManager em) {
        var r=new JpaRepositoryFactory(em);
        return new VoucherEngine(r.getRepository(BookingVoucherRepository.class),r.getRepository(VoucherPropertyScopeRepository.class),r.getRepository(VoucherUsageRepository.class),em);
    }
    BaitlyVoucherClaims claims(EntityManager em) {
        var r=new JpaRepositoryFactory(em);
        return new BaitlyVoucherClaims(r.getRepository(BookingVoucherRepository.class),r.getRepository(VoucherUsageRepository.class),em);
    }
    boolean hold(EntityManager em, long stayId, String email) {
        var v=em.find(BookingVoucher.class,voucherId);
        return engine(em).recordUsage(v,stayId,2L,3L,engine(em).apply(v,new BigDecimal("100"),3),email,"BOOKING_ENGINE","MAD",true).isPresent();
    }
    Reservation stay(long id) {
        var r=new Reservation();r.setId(id);r.setOrganizationId(2L);r.setBookingVoucherId(voucherId);
        var p=new Property();p.setId(3L);r.setProperty(p);r.setCurrency("MAD");r.setDiscountAmount(new BigDecimal("20"));r.setTotalPrice(new BigDecimal("80"));
        r.setStatus("cancelled");return r;
    }
    @Test void concurrentClaimsShareTheSameGuestQuotaRegardlessOfEmailCase()throws Exception {
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);
            var a=pool.submit(()->{barrier.await(5,TimeUnit.SECONDS);return tx(em->hold(em,101,"Guest@Example.test"));});
            var b=pool.submit(()->{barrier.await(5,TimeUnit.SECONDS);return tx(em->hold(em,102," guest@example.test "));});
            assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        tx(em->{assertThat(em.find(BookingVoucher.class,voucherId).getUsageCount()).isEqualTo(1);
            assertThat(em.createQuery("select count(u) from VoucherUsage u",Long.class).getSingleResult()).isEqualTo(1);return null;});
    }
    @Test void expiredUnpaidHoldReleasesQuotaExactlyOnceAndKeepsAudit() {
        tx(em->{assertThat(hold(em,101,"guest@example.test")).isTrue();return null;});
        tx(em->{claims(em).releaseExpired(stay(101));claims(em).releaseExpired(stay(101));return null;});
        tx(em->{assertThat(em.find(BookingVoucher.class,voucherId).getUsageCount()).isZero();
            var u=new JpaRepositoryFactory(em).getRepository(VoucherUsageRepository.class).findByReservationId(101L).orElseThrow();
            assertThat(u.getClaimStatus()).isEqualTo("RELEASED");assertThat(u.getReleasedAt()).isNotNull();assertThat(u.getCurrency()).isEqualTo("MAD");
            assertThat(hold(em,102,"GUEST@example.test")).isTrue();return null;});
    }
    @Test void paidPromotionIsConsumedOnceAndCannotBeReleasedByExpiration() {
        tx(em->{hold(em,101,"guest@example.test");return null;});
        tx(em->{claims(em).consume(stay(101));claims(em).consume(stay(101));claims(em).releaseExpired(stay(101));return null;});
        tx(em->{assertThat(em.find(BookingVoucher.class,voucherId).getUsageCount()).isEqualTo(1);
            assertThat(hold(em,102,"guest@example.test")).isFalse();
            var stats=new JpaRepositoryFactory(em).getRepository(VoucherUsageRepository.class).aggregateStatsByVoucher(voucherId);
            assertThat(stats.usageCount()).isEqualTo(1);return null;});
    }
    @Test void failedBookingRollsBackQuotaAndUsageTogether() {
        assertThatThrownBy(()->tx(em->{hold(em,101,"guest@example.test");em.flush();throw new IllegalStateException("rollback simulé");})).hasMessageContaining("rollback");
        tx(em->{assertThat(em.find(BookingVoucher.class,voucherId).getUsageCount()).isZero();
            assertThat(hold(em,102,"guest@example.test")).isTrue();return null;});
    }
    @Test void latePaymentCannotReconsumeReleasedQuota() {
        tx(em->{hold(em,101,"guest@example.test");return null;});
        tx(em->{claims(em).releaseExpired(stay(101));return null;});
        assertThatThrownBy(()->tx(em->{claims(em).consume(stay(101));return null;})).hasMessageContaining("libération");
    }
}
