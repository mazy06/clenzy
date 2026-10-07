package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import liquibase.*;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.sql.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyOtaSettlementPostgresTest {
    static String url,user,schema;static DriverManagerDataSource source;
    NamedParameterJdbcTemplate jdbc;TransactionTemplate tx;BaitlyOtaSettlementService service;TenantContext tenant;
    static final BaitlyFinancialDocument STATEMENT=BaitlyFinancialDocument.checked("%PDF-1.4 OTA receipt".getBytes());
    static final BaitlyFinancialDocument BANK=BaitlyFinancialDocument.checked("%PDF-1.4 Bank receipt".getBytes());
    @BeforeAll static void start() throws Exception {
        url=System.getProperty("baitly.test.jdbc");user=System.getProperty("baitly.test.user","postgres");
        schema="baitly_ota_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()) {
            s.execute("CREATE SCHEMA "+schema);
            s.execute("SET search_path TO "+schema);
            s.execute("CREATE TABLE organizations(id bigint primary key,name varchar(255))");
            s.execute("CREATE TABLE users(id bigint primary key)");
            s.execute("CREATE TABLE properties(id bigint primary key,organization_id bigint,owner_id bigint,name varchar(255))");
            s.execute("CREATE TABLE reservations(id bigint primary key,organization_id bigint,property_id bigint,source varchar(100),currency varchar(3),total_price numeric(10,2),payment_collection varchar(20),payment_status varchar(30))");
            s.execute("INSERT INTO organizations VALUES(1,'Baitly test'),(2,'Other')");s.execute("INSERT INTO users VALUES(1),(42),(43)");
            s.execute("INSERT INTO properties VALUES(1,1,42,'Maison test'),(2,2,43,'Other')");
        }
        String scoped=url+(url.contains("?")?"&":"?")+"currentSchema="+schema;
        source=new DriverManagerDataSource(scoped,user,"");
        for(int pass=0;pass<2;pass++)try(var c=source.getConnection()) {
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->cs.getId().equals("0510-ota-documentary-settlements")).findFirst().orElseThrow());
                new Liquibase(selected,resources,db).update("");
            }
        }
    }
    @AfterAll static void stop() throws Exception {
        if(schema!=null)try(var c=DriverManager.getConnection(url,user,"");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}
    }
    @BeforeEach void setup() {
        jdbc=new NamedParameterJdbcTemplate(source);tx=new TransactionTemplate(new DataSourceTransactionManager(source));
        jdbc.getJdbcTemplate().execute("TRUNCATE baitly_ota_settlement_voids,baitly_ota_settlement_lines,baitly_ota_settlements,reservations CASCADE");
        jdbc.getJdbcTemplate().execute("INSERT INTO reservations VALUES(1,1,1,'AIRBNB','EUR',100,'CHANNEL','PAID'),(2,1,1,'AIRBNB','EUR',100,'CHANNEL','UNKNOWN'),(3,2,2,'AIRBNB','EUR',100,'CHANNEL','PAID')");
        var users=mock(UserRepository.class);var admin=new User();admin.setId(1L);admin.setRole(UserRole.SUPER_ADMIN);
        var owner=new User();owner.setId(42L);owner.setFirstName("Jean");owner.setLastName("Martin");
        when(users.findByKeycloakId("admin")).thenReturn(Optional.of(admin));when(users.findById(42L)).thenReturn(Optional.of(owner));
        tenant=mock(TenantContext.class);when(tenant.getRequiredOrganizationId()).thenReturn(1L);
        service=new BaitlyOtaSettlementService(jdbc,users,tenant,new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules());
    }
    static BigDecimal d(String n){return new BigDecimal(n);}
    BaitlyOtaSettlementService.Request request(String ref,long stay,String gross,String fee,String net) {
        return new BaitlyOtaSettlementService.Request(UUID.randomUUID(),ref,"BANK-"+ref,LocalDate.now(),"EUR",42L,
            List.of(new BaitlyOtaSettlementService.Line(stay,d(gross),d(fee),BigDecimal.ZERO,d(net))));
    }
    long record(BaitlyOtaSettlementService.Request r){return tx.execute(s->service.record(r,STATEMENT,BANK,"admin"));}
    @Test void multiStayDocumentaryReceiptBalancesWithoutMarkingGuestOrStripePaid() {
        var first=request("BATCH",1,"100","10","90");var lines=new ArrayList<>(first.lines());
        lines.add(new BaitlyOtaSettlementService.Line(2L,d("100"),d("20"),d("5"),d("75")));
        long id=record(new BaitlyOtaSettlementService.Request(first.requestId(),first.otaReference(),first.bankReference(),first.receivedOn(),"EUR",42L,lines));
        assertThat(jdbc.getJdbcTemplate().queryForObject("SELECT net FROM baitly_ota_settlements WHERE id="+id,BigDecimal.class)).isEqualByComparingTo("165");
        assertThat(service.list(2,"admin")).hasSize(1);
        assertThat(jdbc.getJdbcTemplate().queryForObject("SELECT payment_status FROM reservations WHERE id=2",String.class)).isEqualTo("UNKNOWN");
        assertThat(service.document(id,true,"admin").sha256()).isEqualTo(BANK.sha256());
    }
    @Test void exactRetryReusesProofButChangedPayloadCannotOverwriteIt() {
        var r=request("SAME",1,"100","10","90");long id=record(r);assertThat(record(r)).isEqualTo(id);
        var changed=new BaitlyOtaSettlementService.Request(r.requestId(),r.otaReference(),r.bankReference(),r.receivedOn(),"EUR",42L,
            List.of(new BaitlyOtaSettlementService.Line(1L,d("100"),d("11"),d("0"),d("89"))));
        assertThatThrownBy(()->record(changed)).hasMessageContaining("contenu différent");
        assertThat(service.list(1,"admin")).hasSize(1);
    }
    @Test void duplicateBankOrOtaReferenceIsRejectedAndRollsBackAllLines() {
        record(request("DUP",1,"50","5","45"));
        assertThatThrownBy(()->record(request("DUP",2,"50","5","45"))).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(service.list(2,"admin")).isEmpty();
    }
    @Test void concurrentReceiptsCannotExceedTheStay() throws Exception {
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);var jobs=new ArrayList<Future<Boolean>>();
            for(int n=0;n<2;n++){final int i=n;jobs.add(pool.submit(()->{barrier.await();try{record(request("CONCURRENT-"+i,1,"70","5","65"));return true;}catch(IllegalArgumentException e){return false;}}));}
            assertThat(List.of(jobs.get(0).get(15,TimeUnit.SECONDS),jobs.get(1).get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        assertThat(service.list(1,"admin")).hasSize(1);
    }
    @Test void concurrentDisjointStaysCannotReuseOneBankOrOtaReference() throws Exception {
        try(var pool=Executors.newFixedThreadPool(2)) {
            var barrier=new CyclicBarrier(2);var jobs=new ArrayList<Future<Boolean>>();
            for(int n=1;n<=2;n++){final int stay=n;jobs.add(pool.submit(()->{barrier.await();try{record(request("ONE-BANK",stay,"70","5","65"));return true;}catch(org.springframework.dao.DataIntegrityViolationException e){return false;}}));}
            assertThat(List.of(jobs.get(0).get(15,TimeUnit.SECONDS),jobs.get(1).get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        assertThat(jdbc.getJdbcTemplate().queryForObject("SELECT count(*) FROM baitly_ota_settlements",Long.class)).isEqualTo(1L);
    }
    @Test void candidatesStayWithinOrganizationChannelCurrencyAndExposeUnallocatedGross() {
        record(request("PART",1,"40","5","35"));
        var choices=service.candidates(1,"admin");assertThat(choices).hasSize(2);
        assertThat(choices.stream().filter(r->((Number)r.get("id")).longValue()==1).findFirst().orElseThrow().get("remaining")).isEqualTo(d("60.00"));
        jdbc.getJdbcTemplate().update("UPDATE reservations SET currency='MAD' WHERE id=2");
        assertThat(service.candidates(1,"admin")).hasSize(1);
        jdbc.getJdbcTemplate().update("UPDATE reservations SET currency='EUR',source='BOOKING' WHERE id=2");
        assertThat(service.candidates(1,"admin")).hasSize(1);
        jdbc.getJdbcTemplate().update("UPDATE reservations SET source='AIRBNB',payment_collection='PMS' WHERE id=2");
        assertThat(service.candidates(1,"admin")).hasSize(1);
    }
    @Test void voidRetainsEvidenceAndAllowsCorrectedAllocationOfTheSameBankReceipt() {
        long id=record(request("OLD",1,"100","10","90"));
        tx.execute(s->{service.voidRecord(id,"Erreur de justificatif", "admin");return null;});
        record(request("OLD",1,"100","10","90"));
        assertThat(service.list(1,"admin")).hasSize(2);assertThat(service.document(id,false,"admin").sha256()).isEqualTo(STATEMENT.sha256());
        assertThatThrownBy(()->jdbc.getJdbcTemplate().update("UPDATE baitly_ota_settlements SET net=1 WHERE id="+id)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void anotherTenantCannotReadOrUseProofs() {
        long id=record(request("TENANT",1,"100","10","90"));
        assertThatThrownBy(()->record(request("OTHER",3,"100","10","90"))).hasMessageContaining("inaccessible");
        when(tenant.getRequiredOrganizationId()).thenReturn(2L);
        assertThatThrownBy(()->service.document(id,true,"admin")).hasMessageContaining("inaccessible");
        assertThatThrownBy(()->tx.execute(s->{service.voidRecord(id,"Mauvaise organisation","admin");return null;})).hasMessageContaining("inaccessible");
    }
    @Test void incompatibleChannelCurrencyAndBeneficiaryNeverCreateAProof() {
        jdbc.getJdbcTemplate().update("UPDATE reservations SET payment_collection='PMS' WHERE id=1");
        assertThatThrownBy(()->record(request("DIRECT",1,"100","10","90"))).hasMessageContaining("incompatibles");
        jdbc.getJdbcTemplate().update("UPDATE reservations SET payment_collection='CHANNEL',currency='MAD' WHERE id=1");
        assertThatThrownBy(()->record(request("CURRENCY",1,"100","10","90"))).hasMessageContaining("incompatibles");
        assertThat(service.list(1,"admin")).isEmpty();
    }
    @Test void databasePoliciesHideEveryPieceFromAnotherOrganization() throws Exception {
        record(request("RLS",1,"100","10","90"));
        String role="baitly_ota_reader_"+UUID.randomUUID().toString().replace("-","");
        try(var c=source.getConnection();var s=c.createStatement()) {
            s.execute("CREATE ROLE "+role+" NOLOGIN NOSUPERUSER NOBYPASSRLS");
            try {
                s.execute("GRANT USAGE ON SCHEMA "+schema+" TO "+role);
                s.execute("GRANT SELECT ON ALL TABLES IN SCHEMA "+schema+" TO "+role);
                c.setAutoCommit(false);
                s.execute("SET LOCAL ROLE "+role);s.execute("SET LOCAL app.current_org='2'");
                for(String table:List.of("baitly_ota_settlements","baitly_ota_settlement_lines","baitly_ota_settlement_voids"))
                    try(var rs=s.executeQuery("SELECT count(*) FROM "+table)){rs.next();assertThat(rs.getLong(1)).isZero();}
                s.execute("SET LOCAL app.current_org='1'");
                try(var rs=s.executeQuery("SELECT count(*) FROM baitly_ota_settlements")){rs.next();assertThat(rs.getLong(1)).isEqualTo(1);}
                c.rollback();c.setAutoCommit(true);
            } finally {if(!c.getAutoCommit())c.rollback();c.setAutoCommit(true);s.execute("DROP OWNED BY "+role);s.execute("DROP ROLE "+role);}
        }
    }
    @Test void malformedMoneyFutureDateOrSameDocumentCannotBeAccepted() {
        assertThatThrownBy(()->record(request("BAD",1,"100","10","95"))).hasMessageContaining("ventilation");
        assertThatThrownBy(()->record(request("BAD2",1,"100.001","10","90.001"))).hasMessageContaining("ventilation");
        var r=request("BAD3",1,"100","10","90");
        assertThatThrownBy(()->tx.execute(s->service.record(r,STATEMENT,STATEMENT,"admin"))).hasMessageContaining("distincts");
        assertThatThrownBy(()->BaitlyFinancialDocument.checked("<script>bad</script>".getBytes())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->record(new BaitlyOtaSettlementService.Request(r.requestId(),r.otaReference(),r.bankReference(),LocalDate.now().plusDays(1),"EUR",42L,r.lines()))).hasMessageContaining("future");
    }
}
