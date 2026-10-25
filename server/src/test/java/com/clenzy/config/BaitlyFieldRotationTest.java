package com.clenzy.config;

import com.clenzy.service.BaitlyFieldRotationService;
import com.clenzy.service.BaitlyFieldRotationService.*;
import com.clenzy.util.BaitlySecretValueCodec;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyFieldRotationTest {
    private JdbcTemplate jdbc,admin;
    private DriverManagerDataSource source;
    private String schema;
    private BaitlySecretValueCodec codec;
    private BaitlyFieldRotationService service;
    private TenantContext tenant;
    @BeforeEach void setup() {
        String url=System.getProperty("baitly.test.jdbc");
        if(url==null) source=new DriverManagerDataSource("jdbc:h2:mem:fieldrotation"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
        else {
            if(!url.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]*(?:test|recipe|ci)[a-zA-Z0-9_]*")) throw new IllegalArgumentException("Isolated recipe required");
            admin=new JdbcTemplate(new DriverManagerDataSource(url,"postgres",""));
            schema="baitly_field_"+UUID.randomUUID().toString().replace("-","");admin.execute("CREATE SCHEMA "+schema);
            source=new DriverManagerDataSource(url+"?currentSchema="+schema,"postgres","");
        }
        jdbc=new JdbcTemplate(source);
        jdbc.execute("CREATE TABLE users(id BIGINT PRIMARY KEY,organization_id BIGINT,first_name TEXT,last_name TEXT,email TEXT,phone_number TEXT)");
        jdbc.execute("CREATE TABLE check_in_instructions(id BIGINT PRIMARY KEY,organization_id BIGINT,access_code TEXT,wifi_password TEXT,extra_access_codes TEXT)");
        codec=new BaitlySecretValueCodec("synthetic-field-key",1,"","",true);
        var old=new org.jasypt.util.text.AES256TextEncryptor();old.setPassword("synthetic-field-key");
        jdbc.update("INSERT INTO users VALUES (1,7,?,?,?,?)",old.encrypt("synthetic-first"),old.encrypt("synthetic-last"),old.encrypt("synthetic-email"),old.encrypt("synthetic-phone"));
        jdbc.update("INSERT INTO check_in_instructions VALUES (1,7,?,?,?)",old.encrypt("synthetic-access"),old.encrypt("synthetic-wifi"),old.encrypt("[]"));
        tenant=mock(TenantContext.class);when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        service=new BaitlyFieldRotationService(jdbc,codec,tenant,new DataSourceTransactionManager(source));
    }
    @AfterEach void cleanup() { if(admin!=null) admin.execute("DROP SCHEMA "+schema+" CASCADE"); }
    @Test void exactJpaMappingsAreEnforcedAndEveryWhitelistedColumnCanBeRewrappedAndResumed() {
        for(var target:Target.values()) {
            assertThat(service.rotate(target,1)).isEqualTo(Outcome.REWRAPPED);
            assertThat(service.rotate(target,1)).isEqualTo(Outcome.ALREADY_CURRENT);
        }
        assertThat(codec.decrypt(jdbc.queryForObject("SELECT first_name FROM users WHERE id=1",String.class))).isEqualTo("synthetic-first");
    }
    @Test void foreignOrganizationAndAbsentRowsCannotRotate() {
        when(tenant.getRequiredOrganizationId()).thenReturn(8L);
        assertThat(service.rotate(Target.USER_FIRST_NAME,1)).isEqualTo(Outcome.ABSENT);
        assertThat(service.rotate(Target.USER_FIRST_NAME,99)).isEqualTo(Outcome.ABSENT);
        assertThat(jdbc.queryForObject("SELECT first_name FROM users WHERE id=1",String.class)).doesNotStartWith("BTF");
    }
    @Test void corruptAuthenticatedSourceNeverBecomesPlaintextOrGetsWrappedAgain() {
        jdbc.update("UPDATE users SET first_name='BTF1:1:corrupt'");
        assertThat(service.rotate(Target.USER_FIRST_NAME,1)).isEqualTo(Outcome.UNCERTAIN);
        assertThat(jdbc.queryForObject("SELECT first_name FROM users WHERE id=1",String.class)).isEqualTo("BTF1:1:corrupt");
    }
    @Test void parallelRotationsHaveOneWriteAndNoLostUpdate() throws Exception {
        var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try {
            Callable<Outcome> work=()->{gate.await();return service.rotate(Target.USER_FIRST_NAME,1);};
            var a=pool.submit(work);var b=pool.submit(work);gate.countDown();
            var outcomes=List.of(a.get(30,TimeUnit.SECONDS),b.get(30,TimeUnit.SECONDS));
            assertThat(outcomes).contains(Outcome.REWRAPPED);
            assertThat(outcomes.stream().filter(o->o==Outcome.REWRAPPED).count()).isEqualTo(1);
            assertThat(outcomes).allMatch(o->Set.of(Outcome.REWRAPPED,Outcome.CONFLICT,Outcome.ALREADY_CURRENT).contains(o));
            assertThat(service.rotate(Target.USER_FIRST_NAME,1)).isEqualTo(Outcome.ALREADY_CURRENT);
        } finally {pool.shutdownNow();}
    }
    @Test void lateCommitFailureRollsBackAndReturnsUncertaintyWithoutSourceOrKey() {
        String original=jdbc.queryForObject("SELECT first_name FROM users WHERE id=1",String.class);
        var observed=spy(jdbc);
        doAnswer(call->{
            Object changed=call.callRealMethod();
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
                @Override public void beforeCommit(boolean readOnly){throw new IllegalStateException("synthetic-private-diagnostic");}
            });return changed;
        }).when(observed).update(anyString(),any(Object[].class));
        var failing=new BaitlyFieldRotationService(observed,codec,tenant,new DataSourceTransactionManager(source));
        assertThat(failing.rotate(Target.USER_FIRST_NAME,1)).isEqualTo(Outcome.UNCERTAIN);
        assertThat(jdbc.queryForObject("SELECT first_name FROM users WHERE id=1",String.class)).isEqualTo(original);
        assertThat(service.rotate(Target.USER_FIRST_NAME,1)).isEqualTo(Outcome.REWRAPPED);
    }
}
