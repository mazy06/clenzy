package com.clenzy.repository;

import com.clenzy.config.EncryptedFieldConverter;
import com.clenzy.model.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Requêtes réelles dans un schéma de test isolé, noms vérifiés contre les entités et Liquibase. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyPaymentHistoryPostgresTest {
    static String schema,url,user;
    static JdbcTemplate jdbc;
    BaitlyPaymentHistoryRepository repository;
    EncryptedFieldConverter fields;

    @BeforeAll static void database() throws Exception {
        url=System.getProperty("baitly.test.jdbc");user=System.getProperty("baitly.test.user","postgres");
        schema="baitly_payment_page_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()){s.execute("CREATE SCHEMA "+schema);}
        jdbc=new JdbcTemplate(new DriverManagerDataSource(url+"?currentSchema="+schema,user,""));
        jdbc.execute("CREATE TABLE users(id bigint PRIMARY KEY,first_name text,last_name text)");
        jdbc.execute("CREATE TABLE properties(id bigint PRIMARY KEY,name text,owner_id bigint)");
        jdbc.execute("CREATE TABLE interventions(id bigint PRIMARY KEY,organization_id bigint,property_id bigint,requestor_id bigint,title text,estimated_cost numeric,currency text,payment_status text,status text,paid_at timestamp,start_time timestamp,created_at timestamp)");
        jdbc.execute("CREATE TABLE reservations(id bigint PRIMARY KEY,organization_id bigint,property_id bigint,total_price numeric,currency text,payment_status text,payment_collection text,credit_applied numeric,paid_at timestamp,created_at timestamp,channel_payment_collect text,external_uid text,channex_crs_booking_id text,stripe_session_id text,source_name text,source text,check_in date,check_out date,guest_name text)");
        jdbc.execute("CREATE TABLE service_requests(id bigint PRIMARY KEY,organization_id bigint,property_id bigint,user_id bigint,title text,estimated_cost numeric,payment_status text,status text,created_at timestamp)");
        jdbc.execute("CREATE TABLE service_quotes(id bigint,organization_id bigint,intervention_id bigint,status text,deposit_amount numeric,deposit_paid_at timestamp,deposit_transaction_ref text)");
        jdbc.execute("CREATE TABLE payment_transactions(id bigint,organization_id bigint,source_id bigint,source_type text,payment_type text,status text,amount numeric,currency text,metadata jsonb)");
    }
    @AfterAll static void cleanup() throws Exception {
        if(schema!=null)try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}
    }
    @BeforeEach void reset() {
        jdbc.execute("TRUNCATE users,properties,interventions,reservations,service_requests,service_quotes,payment_transactions");
        fields=mock(EncryptedFieldConverter.class);
        when(fields.convertToEntityAttribute("cipher_first")).thenReturn("Alice");
        when(fields.convertToEntityAttribute("cipher_last")).thenReturn("Durand");
        repository=new BaitlyPaymentHistoryRepository(new NamedParameterJdbcTemplate(jdbc),fields);
        jdbc.update("INSERT INTO users VALUES(42,'cipher_first','cipher_last'),(43,'FOREIGN','FOREIGN')");
        jdbc.update("INSERT INTO properties VALUES(1,'Maison Baitly',42),(2,'Autre maison',43)");
    }
    BaitlyPaymentHistoryRepository.Filter filter(Long host,String status,LocalDate from,LocalDate to,String search) {
        return repository.prepare(new BaitlyPaymentHistoryRepository.Filter(7,host,status,from,to,search));
    }
    void intervention(long id,long org,long host,String status,String date) {
        jdbc.update("INSERT INTO interventions(id,organization_id,property_id,requestor_id,title,estimated_cost,currency,payment_status,status,created_at) VALUES(?,?,1,?,'Ménage — Maison Baitly',100,'EUR',?,'COMPLETED',?::timestamp)",id,org,host,status,date);
    }
    @Test void globalPaginationHasNoTenThousandLimitAndHasStableTies() {
        jdbc.update("INSERT INTO interventions(id,organization_id,property_id,requestor_id,title,estimated_cost,currency,payment_status,status,created_at) SELECT n,7,1,42,'Ménage',10,'EUR','PAID','COMPLETED','2026-10-10'::timestamp FROM generate_series(1,10051) n");
        intervention(20000,8,42,"PAID","2026-10-11");
        var f=filter(null,null,null,null,null);
        assertThat(repository.count(f)).isEqualTo(10051);
        assertThat(repository.page(f,1000,10)).hasSize(10).extracting(BaitlyPaymentHistoryRepository.Key::id)
                .containsExactly(51L,50L,49L,48L,47L,46L,45L,44L,43L,42L);
        assertThat(repository.page(f,1005,10)).extracting(BaitlyPaymentHistoryRepository.Key::id).containsExactly(1L);
        assertThat(repository.page(f,1006,10)).isEmpty();
        assertThat(repository.amounts(f).getFirst().totals().getFirst().get(1)).isEqualTo(new java.math.BigDecimal("100510.00"));
    }
    @Test void filtersApplyBeforePaginationAcrossAllSources() {
        intervention(1,7,42,"PAID","2026-10-10 23:59:59");
        intervention(2,7,43,"PAID","2026-10-10");
        intervention(3,8,42,"PAID","2026-10-10");
        intervention(4,7,42,"PAID","2026-10-11");
        jdbc.update("INSERT INTO reservations(id,organization_id,property_id,total_price,payment_status,payment_collection,created_at,source,check_in,check_out) VALUES(1,7,1,200,'PAID','CHANNEL','2026-10-10','airbnb','2026-10-01','2026-10-05'),(2,7,2,200,'PAID','PMS','2026-10-10','direct','2026-10-01','2026-10-05')");
        jdbc.update("INSERT INTO service_requests(id,organization_id,property_id,user_id,title,estimated_cost,payment_status,status,created_at) VALUES(1,7,1,42,'Maintenance',50,'PAID','AWAITING_PAYMENT','2026-10-10'),(2,7,1,43,'Maintenance',50,'PAID','AWAITING_PAYMENT','2026-10-10')");
        var day=LocalDate.of(2026,10,10);
        var f=filter(42L,"PAID",day,day,null);
        assertThat(repository.count(f)).isEqualTo(2);
        assertThat(repository.page(f,0,1)).extracting(BaitlyPaymentHistoryRepository.Key::type).containsExactly("INTERVENTION");
        assertThat(repository.page(f,1,1)).extracting(BaitlyPaymentHistoryRepository.Key::type).containsExactly("SERVICE_REQUEST");
        assertThat(repository.count(filter(42L,"UNKNOWN",day,day,null))).isEqualTo(1);
    }
    @Test void reservationStatusExactlyMatchesTheJavaFinancialPolicy() {
        int id=0;
        Map<String,List<Long>> expected=new HashMap<>();
        for(var collection:PaymentCollection.values()) for(var status:PaymentStatus.values()) {
            var reservation=new Reservation();reservation.setPaymentCollection(collection);reservation.setPaymentStatus(status);
            reservation.setChannelPaymentCollect(id%2==0?"ota":null);
            jdbc.update("INSERT INTO reservations(id,organization_id,property_id,total_price,payment_status,payment_collection,channel_payment_collect,created_at) VALUES(?,7,1,100,?,?,?,'2026-10-10')",++id,status.name(),collection.name(),reservation.getChannelPaymentCollect());
            expected.computeIfAbsent(ReservationPaymentState.effectiveStatus(reservation).name(),ignored->new ArrayList<>()).add((long)id);
        }
        jdbc.update("INSERT INTO reservations(id,organization_id,property_id,total_price,payment_status,payment_collection,external_uid,created_at) VALUES(999,7,1,100,'PAID','PMS','channex:legacy','2026-10-10')");
        expected.computeIfAbsent("UNKNOWN",ignored->new ArrayList<>()).add(999L);
        for(var status:PaymentStatus.values()) assertThat(repository.page(filter(null,status.name(),null,null,null),0,500))
                .extracting(BaitlyPaymentHistoryRepository.Key::id).containsExactlyInAnyOrderElementsOf(expected.getOrDefault(status.name(),List.of()));
    }
    @Test void namesAreDecryptedOnlyForAuthorizedOwnersAndWildcardsAreLiteral() {
        intervention(1,7,42,"PAID","2026-10-10");intervention(2,8,43,"PAID","2026-10-10");
        assertThat(repository.count(filter(42L,null,null,null,"alice durand"))).isEqualTo(1);
        verify(fields,never()).convertToEntityAttribute("FOREIGN");
        assertThat(repository.count(filter(null,null,null,null,"%"))).isZero();
        assertThat(repository.count(filter(null,null,null,null,"ménage"))).isEqualTo(1);
    }
    @Test void totalsKeepConfirmedRefundsDepositsCurrenciesAndUnknownAmountsSeparate() {
        intervention(1,7,42,"PENDING","2026-10-10");intervention(2,7,42,"PARTIALLY_REFUNDED","2026-10-10");
        intervention(3,7,42,"CANCELLED","2026-10-10");
        jdbc.update("INSERT INTO service_quotes VALUES(1,7,1,'APPROVED',30,'2026-10-01','DEP-1')");
        jdbc.update("INSERT INTO payment_transactions VALUES(1,7,2,'INTERVENTION','REFUND','COMPLETED',20,'EUR',null),(2,7,2,'INTERVENTION','REFUND','PROCESSING',5,'EUR','{\"reviewRequired\":true}'),(3,8,2,'INTERVENTION','REFUND','COMPLETED',80,'EUR',null)");
        var groups=repository.amounts(filter(null,null,null,null,null));
        assertThat(groups.getFirst().count()).isEqualTo(2);
        assertThat(groups.getFirst().totals().getFirst().get(1)).isEqualTo(new java.math.BigDecimal("180.00"));
        assertThat(groups.get(1).totals().getFirst().get(1)).isEqualTo(new java.math.BigDecimal("70.00"));
        assertThat(groups.get(2).totals().getFirst().get(1)).isEqualTo(new java.math.BigDecimal("80.00"));
        assertThat(groups.get(4).count()).isEqualTo(1);
        jdbc.update("UPDATE payment_transactions SET status='PROCESSING' WHERE id=1");
        groups=repository.amounts(filter(null,null,null,null,null));
        assertThat(groups.getFirst().unavailable()).isEqualTo(1);
        assertThat(groups.get(2).totals()).isEmpty();
    }

    @Test void aggregatesNeverMixCurrenciesAndKeepEmptyBucketsExplicit() {
        intervention(1,7,42,"PAID","2026-10-10");intervention(2,7,42,"PAID","2026-10-10");
        intervention(3,7,42,"PAID","2026-10-10");intervention(4,7,42,"PAID","2026-10-10");
        jdbc.update("UPDATE interventions SET currency='MAD',estimated_cost=12.35 WHERE id=2");
        jdbc.update("UPDATE interventions SET currency='JPY',estimated_cost=12.35 WHERE id=3");
        jdbc.update("UPDATE interventions SET currency='',estimated_cost=50 WHERE id=4");
        var groups=repository.amounts(filter(null,null,null,null,null));
        assertThat(groups.getFirst().totals()).containsExactly(List.of("EUR",new java.math.BigDecimal("100.00")),
                List.of("JPY",new java.math.BigDecimal("12")),List.of("MAD",new java.math.BigDecimal("12.35")));
        assertThat(groups.getFirst().count()).isEqualTo(4);assertThat(groups.getFirst().unavailable()).isEqualTo(1);
        assertThat(groups.get(1).totals()).containsExactly(List.of("EUR",java.math.BigDecimal.ZERO),List.of("JPY",java.math.BigDecimal.ZERO),List.of("MAD",java.math.BigDecimal.ZERO));
        assertThat(repository.amounts(filter(null,"PENDING",null,null,null))).allMatch(group->group.count()==0 && group.totals().isEmpty());
    }
}
