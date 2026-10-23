package com.clenzy.integration.minut.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.device.DeviceRealtimePublisher;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static com.clenzy.integration.minut.service.BaitlyMinutEventJournal.*;
import static com.clenzy.integration.minut.service.BaitlyMinutEventParser.*;

/** Real master-selected Liquibase migration, independent connections and restart/concurrency proofs. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql:.*")
class BaitlyMinutRecoveryPostgresTest {
    JdbcTemplate admin,db,observer;
    DriverManagerDataSource source;
    DataSourceTransactionManager manager;
    BaitlyMinutEventJournal journal;
    String schema;
    java.time.Instant eventTime;
    final BaitlyMinutEventParser parser=new BaitlyMinutEventParser(new ObjectMapper());
    final NoiseAlertService noise=mock(NoiseAlertService.class);
    final AutomationEngine automation=mock(AutomationEngine.class);
    final DeviceRealtimePublisher realtime=mock(DeviceRealtimePublisher.class);
    @SuppressWarnings("unchecked") final KafkaTemplate<String,Object> kafka=mock(KafkaTemplate.class);

    @BeforeEach void start() {
        String jdbc=System.getProperty("baitly.test.jdbc");
        if(!jdbc.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]*(?:test|recipe|ci)[a-zA-Z0-9_]*"))
            throw new IllegalArgumentException("Base PostgreSQL de recette dediee requise");
        admin=new JdbcTemplate(new DriverManagerDataSource(jdbc,"postgres",""));
        schema="baitly_minut_"+UUID.randomUUID().toString().replace("-","");admin.execute("CREATE SCHEMA "+schema);
        source=new DriverManagerDataSource(jdbc+"?currentSchema="+schema,"postgres","");
        db=new JdbcTemplate(source);observer=new JdbcTemplate(new DriverManagerDataSource(jdbc+"?currentSchema="+schema,"postgres",""));
        // Names checked against NoiseDevice @Table/@Column and changesets 0036/0037/0186/0561.
        db.execute("""
            CREATE TABLE noise_devices (id BIGINT PRIMARY KEY, organization_id BIGINT NOT NULL, property_id BIGINT NOT NULL,
            name VARCHAR(255),external_device_id VARCHAR(255),device_type VARCHAR(10),status VARCHAR(20),simulation BOOLEAN,
            online BOOLEAN,last_seen_at TIMESTAMP)
            """);
        db.update("INSERT INTO noise_devices (id,organization_id,property_id,name,external_device_id,device_type,status,simulation,online) VALUES (31,7,91,'synthetic-private','d1','MINUT','ACTIVE',false,true),(32,8,92,'other-private','d2','MINUT','ACTIVE',false,true)");
        migrate();migrate();
        eventTime=db.queryForObject("SELECT not_before FROM baitly_minut_recovery_boundary WHERE id=1",java.sql.Timestamp.class).toInstant().plusSeconds(1);
        manager=new DataSourceTransactionManager(source);journal=new BaitlyMinutEventJournal(db,manager);
    }
    void migrate() {
        try(var connection=source.getConnection()) {
            var database=liquibase.database.DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new liquibase.database.jvm.JdbcConnection(connection));
            var resources=new liquibase.resource.ClassLoaderResourceAccessor();
            try(var master=new liquibase.Liquibase("db/changelog/db.changelog-master.yaml",resources,database)) {
                var selected=new liquibase.changelog.DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(set -> set.getId().equals("0599-baitly-minut-event-journal")).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);
                new liquibase.Liquibase(selected,resources,database).update("");
            }
        } catch(Exception failure) {throw new IllegalStateException("Migration Minut de recette echouee",failure);}
    }
    @AfterEach void close() {if(schema!=null) admin.execute("DROP SCHEMA "+schema+" CASCADE");}
    Input input(String id,String type,String device) {
        return parser.parse("{\"id\":\""+id+"\",\"type\":\""+type+"\",\"device_id\":\""+device+"\",\"sound_level\":82.5,\"created_at\":\""+eventTime+"\"}").orElseThrow();
    }
    Input offline() {return input("event-1","device_offline","d1");}
    BaitlyMinutRecoveryWorker worker(BaitlyMinutEventJournal store) {return new BaitlyMinutRecoveryWorker(store,noise,automation,realtime,kafka);}
    String state(UUID id) {return observer.queryForObject("SELECT state FROM baitly_minut_events WHERE id=?",String.class,id);}
    int step(UUID id) {return observer.queryForObject("SELECT next_step FROM baitly_minut_events WHERE id=?",Integer.class,id);}
    long count() {return observer.queryForObject("SELECT count(*) FROM baitly_minut_events",Long.class);}

    @Test void intentAndDeviceMutationAreAtomicAndDurableOutsideCallerRollback() {
        var transaction=new TransactionTemplate(manager);
        assertThatThrownBy(() -> transaction.execute(status -> {journal.admit(offline());throw new IllegalStateException("synthetic rollback");}));
        assertThat(count()).isEqualTo(1);assertThat(observer.queryForObject("SELECT online FROM noise_devices WHERE id=31",Boolean.class)).isFalse();
        assertThat(journal.ready()).hasSize(1);assertThat(state(journal.ready().getFirst())).isEqualTo("READY");
        verifyNoInteractions(noise,automation,realtime,kafka);
    }
    @Test void failedIntentRollsBackTheDeviceAndCursorToo() {
        db.execute("DROP TABLE baitly_minut_device_cursor");
        assertThatThrownBy(() -> journal.admit(offline())).hasNoCause();
        assertThat(count()).isZero();assertThat(observer.queryForObject("SELECT online FROM noise_devices WHERE id=31",Boolean.class)).isTrue();
    }
    @Test void crashAfterOfflineTransitionResumesDespiteOfflineFlag() {
        UUID id=journal.admit(offline());assertThat(state(id)).isEqualTo("READY");
        var restarted=new BaitlyMinutEventJournal(new JdbcTemplate(source),new DataSourceTransactionManager(source));
        worker(restarted).recover();assertThat(state(id)).isEqualTo("DONE");
        verify(realtime,times(1)).publishDeviceChangedConfirmed(7L,"noise",31L,"hors ligne");
        verify(automation,times(1)).fireTrigger(any(),eq(7L),any());
        worker(restarted).process(journal.admit(offline()));verifyNoMoreInteractions(realtime,automation);
    }
    @Test void committedFirstEffectIsNotRepeatedWhenNextClaimFailsThenProcessRestarts() {
        UUID id=journal.admit(offline());var flaky=spy(journal);var claims=new AtomicInteger();
        doAnswer(call -> {if(claims.incrementAndGet()==2) throw new IllegalStateException("synthetic storage");return call.callRealMethod();}).when(flaky).claim(id);
        worker(flaky).process(id);assertThat(state(id)).isEqualTo("READY");assertThat(step(id)).isEqualTo(1);
        worker(new BaitlyMinutEventJournal(db,manager)).process(id);assertThat(state(id)).isEqualTo("DONE");
        verify(realtime,times(1)).publishDeviceChangedConfirmed(anyLong(),anyString(),anyLong(),anyString());
        verify(automation,times(1)).fireTrigger(any(),anyLong(),any());
    }
    @Test void failureAfterAutomationSideEffectIsFencedAcrossRestartAndDuplicateDelivery() {
        UUID id=journal.admit(offline());doThrow(new IllegalStateException("synthetic private response lost")).when(automation).fireTrigger(any(),anyLong(),any());
        worker(journal).process(id);assertThat(state(id)).isEqualTo("UNKNOWN");assertThat(step(id)).isEqualTo(1);
        worker(new BaitlyMinutEventJournal(db,manager)).process(journal.admit(offline()));
        verify(automation,times(1)).fireTrigger(any(),anyLong(),any());
        verify(realtime,times(1)).publishDeviceChangedConfirmed(anyLong(),anyString(),anyLong(),anyString());
    }
    @Test void successWithLostProgressCommitCannotSendAgain() {
        UUID id=journal.admit(offline());var failing=spy(journal);
        doThrow(new IllegalStateException("synthetic commit failure")).when(failing).complete(any());
        worker(failing).process(id);assertThat(state(id)).isEqualTo("UNKNOWN");
        worker(journal).process(id);verify(realtime,times(1)).publishDeviceChangedConfirmed(anyLong(),anyString(),anyLong(),anyString());
        verifyNoInteractions(automation);
    }
    @Test void commitAcknowledgementLossPreservesTheCommittedProofAndResumesOnlyNextStage() {
        UUID id=journal.admit(offline());var flaky=spy(journal);
        doAnswer(call -> {call.callRealMethod();throw new IllegalStateException("synthetic ack lost");}).when(flaky).complete(any());
        worker(flaky).process(id);assertThat(state(id)).isEqualTo("READY");assertThat(step(id)).isEqualTo(1);
        worker(journal).process(id);assertThat(state(id)).isEqualTo("DONE");
        verify(realtime,times(1)).publishDeviceChangedConfirmed(anyLong(),anyString(),anyLong(),anyString());
        verify(automation,times(1)).fireTrigger(any(),anyLong(),any());
    }
    @Test void crashAfterIntentButBeforeCallRemainsStartedWithoutAutomaticRearm() {
        UUID id=journal.admit(offline());assertThat(journal.claim(id)).isPresent();
        worker(new BaitlyMinutEventJournal(db,manager)).recover();worker(journal).process(id);
        assertThat(state(id)).isEqualTo("STARTED");verifyNoInteractions(realtime,automation,noise,kafka);
    }
    @Test void simultaneousAdmissionsAcrossTwoInstancesProduceOneIntentAndOneLocalTransition() throws Exception {
        try(var pool=Executors.newFixedThreadPool(2)) {
            var second=new BaitlyMinutEventJournal(new JdbcTemplate(source),new DataSourceTransactionManager(source));
            var one=pool.submit(() -> journal.admit(offline()));var two=pool.submit(() -> second.admit(offline()));
            assertThat(one.get(10,TimeUnit.SECONDS)).isEqualTo(two.get(10,TimeUnit.SECONDS));assertThat(count()).isEqualTo(1);
        }
    }
    @Test void concurrentWorkersNeverExecuteTheSameStageTwice() throws Exception {
        UUID id=journal.admit(offline());var entered=new CountDownLatch(1);var release=new CountDownLatch(1);
        doAnswer(call -> {entered.countDown();if(!release.await(10,TimeUnit.SECONDS)) throw new IllegalStateException();return null;})
                .when(realtime).publishDeviceChangedConfirmed(anyLong(),anyString(),anyLong(),anyString());
        try(var pool=Executors.newFixedThreadPool(2)) {
            var one=pool.submit(() -> worker(journal).process(id));assertThat(entered.await(10,TimeUnit.SECONDS)).isTrue();
            var second=new BaitlyMinutEventJournal(new JdbcTemplate(source),new DataSourceTransactionManager(source));
            try {pool.submit(() -> worker(second).process(id)).get(5,TimeUnit.SECONDS);}
            finally {release.countDown();}
            one.get(10,TimeUnit.SECONDS);
        } finally {release.countDown();}
        assertThat(state(id)).isEqualTo("DONE");verify(realtime,times(1)).publishDeviceChangedConfirmed(anyLong(),anyString(),anyLong(),anyString());
        verify(automation,times(1)).fireTrigger(any(),anyLong(),any());
    }
    @Test void repeatedOfflineReportsAreOneEpisodeButNewEpisodeCanNotifyOnce() {
        UUID first=journal.admit(offline());worker(journal).process(first);
        UUID repeated=journal.admit(input("event-2","device_offline","d1"));worker(journal).process(repeated);
        assertThat(state(repeated)).isEqualTo("DONE");
        worker(journal).process(journal.admit(input("event-3","device_online","d1")));
        worker(journal).process(journal.admit(input("event-4","device_offline","d1")));
        verify(automation,times(2)).fireTrigger(any(),eq(7L),any());
        verify(realtime,times(2)).publishDeviceChangedConfirmed(7L,"noise",31L,"hors ligne");
        verify(realtime,times(1)).publishDeviceChangedConfirmed(7L,"noise",31L,"de retour en ligne");
    }
    @Test void completedOldEventCannotReopenOfflineAfterReturnOnline() {
        UUID first=journal.admit(offline());worker(journal).process(first);
        UUID online=journal.admit(input("event-2","device_online","d1"));worker(journal).process(online);
        assertThat(journal.admit(offline())).isEqualTo(first);worker(journal).process(first);
        assertThat(observer.queryForObject("SELECT online FROM noise_devices WHERE id=31",Boolean.class)).isTrue();
        verify(automation,times(1)).fireTrigger(any(),anyLong(),any());
    }
    @Test void pendingOldEpisodeIsSupersededInsteadOfNotifyingAfterReturnOnline() {
        UUID old=journal.admit(offline());UUID online=journal.admit(input("event-2","device_online","d1"));
        worker(journal).process(old);assertThat(state(old)).isEqualTo("SUPERSEDED");
        verifyNoInteractions(realtime,automation);worker(journal).process(online);
        verify(realtime).publishDeviceChangedConfirmed(7L,"noise",31L,"de retour en ligne");verifyNoInteractions(automation);
    }
    @Test void pendingOldAutomationIsSupersededByANewerOfflineEpisode() {
        UUID old=journal.admit(offline());var first=journal.claim(old).orElseThrow();journal.complete(first);
        journal.admit(input("event-2","device_online","d1"));UUID fresh=journal.admit(input("event-3","device_offline","d1"));
        worker(journal).process(old);assertThat(state(old)).isEqualTo("SUPERSEDED");
        worker(journal).process(fresh);verify(automation,times(1)).fireTrigger(any(),anyLong(),any());
    }
    @Test void changedPayloadWithSameIdCannotCreateASecondIntentOrMutateTheDevice() {
        UUID id=journal.admit(offline());
        assertThatThrownBy(() -> journal.admit(input("event-1","device_online","d1"))).hasNoCause();
        assertThat(count()).isEqualTo(1);assertThat(state(id)).isEqualTo("READY");
        assertThat(observer.queryForObject("SELECT online FROM noise_devices WHERE id=31",Boolean.class)).isFalse();
    }
    @Test void changedOrganizationDeviceOrPropertyCannotReuseAnEventOrStartAnEffect() {
        UUID id=journal.admit(offline());
        assertThatThrownBy(() -> journal.admit(input("event-1","device_offline","d2"))).hasNoCause();
        db.update("UPDATE noise_devices SET organization_id=8 WHERE id=31");
        assertThatThrownBy(() -> journal.claim(id)).hasNoCause();assertThat(state(id)).isEqualTo("READY");
        verifyNoInteractions(realtime,automation,noise,kafka);
    }
    @ParameterizedTest @ValueSource(strings={"TUYA","inactive","simulation","deleted","ambiguous"})
    void unsupportedOrAmbiguousDeviceCannotBeAdmitted(String variant) {
        switch(variant) {
            case "TUYA" -> db.update("UPDATE noise_devices SET device_type='TUYA' WHERE id=31");
            case "inactive" -> db.update("UPDATE noise_devices SET status='INACTIVE' WHERE id=31");
            case "simulation" -> db.update("UPDATE noise_devices SET simulation=true WHERE id=31");
            case "deleted" -> db.update("DELETE FROM noise_devices WHERE id=31");
            case "ambiguous" -> db.update("UPDATE noise_devices SET external_device_id='d1' WHERE id=32");
        }
        assertThatThrownBy(() -> journal.admit(offline())).hasNoCause();assertThat(count()).isZero();
    }
    @Test void forgedAttemptCannotConfirmOrRearmAnotherWorkersStage() {
        UUID id=journal.admit(offline());var owned=journal.claim(id).orElseThrow();
        var forged=new Ticket(owned.event(),owned.step(),UUID.randomUUID(),null);
        assertThatThrownBy(() -> journal.complete(forged)).hasNoCause();journal.uncertain(forged);
        assertThat(state(id)).isEqualTo("STARTED");journal.complete(owned);assertThat(state(id)).isEqualTo("READY");
    }
    @Test @SuppressWarnings("unchecked") void uncertainNoiseSendCannotRepeatEvaluationOrPublication() throws Exception {
        UUID id=journal.admit(input("noise-1","disturbance","d1"));
        CompletableFuture<SendResult<String,Object>> future=mock(CompletableFuture.class);
        when(kafka.send(eq(KafkaConfig.TOPIC_MINUT_NOISE_EVENTS),eq(id.toString()),any())).thenReturn(future);
        when(future.get(3,TimeUnit.SECONDS)).thenThrow(new TimeoutException("synthetic-private"));
        worker(journal).process(id);assertThat(state(id)).isEqualTo("UNKNOWN");assertThat(step(id)).isEqualTo(1);
        worker(new BaitlyMinutEventJournal(db,manager)).process(journal.admit(input("noise-1","disturbance","d1")));
        verify(noise,times(1)).evaluateNoiseLevel(eq(7L),eq(91L),eq(31L),eq(82.5),any());
        verify(kafka,times(1)).send(anyString(),anyString(),any());verify(future,never()).cancel(anyBoolean());
    }
    @Test @SuppressWarnings("unchecked") void successfulNoiseSendHasStableEventIdentityAndDurableProgress() {
        UUID id=journal.admit(input("noise-1","disturbance","d1"));
        when(kafka.send(anyString(),eq(id.toString()),any())).thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));
        worker(journal).process(id);worker(new BaitlyMinutEventJournal(db,manager)).process(id);
        assertThat(state(id)).isEqualTo("DONE");assertThat(step(id)).isEqualTo(2);
        verify(kafka,times(1)).send(eq(KafkaConfig.TOPIC_MINUT_NOISE_EVENTS),eq(id.toString()),argThat((Object value) -> ((Map<?,?>)value).get("eventId").equals(id.toString())));
    }
    @Test void journalContainsOnlyMinimalDataAndNoProviderIdentityOrPayloadColumn() {
        journal.admit(offline());
        var columns=db.queryForList("SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name='baitly_minut_events'",String.class,schema);
        assertThat(columns).doesNotContain("payload","token","provider_event_id","external_device_id","device_name","error_message");
        assertThat(db.queryForObject("SELECT event_key FROM baitly_minut_events",String.class)).matches("[a-f0-9]{64}");
    }
    @Test void historicalEventsBeforeJournalCutoverAreHeldForReviewWithoutAnyLocalOrExternalEffect() {
        eventTime=eventTime.minusSeconds(2);
        UUID id=journal.admit(offline());assertThat(state(id)).isEqualTo("REVIEW");worker(journal).process(id);
        assertThat(observer.queryForObject("SELECT online FROM noise_devices WHERE id=31",Boolean.class)).isTrue();
        verifyNoInteractions(realtime,automation,noise,kafka);
        assertThat(journal.admit(offline())).isEqualTo(id);
    }
    @Test void delayedOldConnectivityEventCannotReopenTheDeviceAfterANewerTransition() {
        UUID first=journal.admit(offline());worker(journal).process(first);
        eventTime=eventTime.plusSeconds(60);worker(journal).process(journal.admit(input("event-2","device_online","d1")));
        eventTime=eventTime.minusSeconds(30);UUID late=journal.admit(input("event-delayed","device_offline","d1"));
        assertThat(state(late)).isEqualTo("REVIEW");worker(journal).process(late);
        assertThat(observer.queryForObject("SELECT online FROM noise_devices WHERE id=31",Boolean.class)).isTrue();
        verify(automation,times(1)).fireTrigger(any(),anyLong(),any());
    }
}
