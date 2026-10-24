package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Real SQL locally and on dedicated PostgreSQL CI, no provider, person or Docker. */
class BaitlyNoiseDeliveryOutboxTest {
    JdbcTemplate db,observer,admin;
    DriverManagerDataSource source;
    DataSourceTransactionManager manager;
    BaitlyNoiseDeliveryOutbox outbox;
    BaitlyNoiseAlertAdmission admission;
    String schema;
    LocalDateTime guestVersion=LocalDateTime.of(2026,10,20,12,0);
    @BeforeEach void start() {
        String jdbc=System.getProperty("baitly.test.jdbc");
        if(jdbc==null) {
            source=new DriverManagerDataSource("jdbc:h2:mem:baitlydelivery"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
        } else {
            if(!jdbc.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]*(?:test|recipe|ci)[a-zA-Z0-9_]*"))
                throw new IllegalArgumentException("Base de recette dediee requise");
            admin=new JdbcTemplate(new DriverManagerDataSource(jdbc,"postgres",""));
            schema="baitly_delivery_"+UUID.randomUUID().toString().replace("-","");
            admin.execute("CREATE SCHEMA "+schema);
            source=new DriverManagerDataSource(jdbc+"?currentSchema="+schema,"postgres","");
        }
        db=new JdbcTemplate(source); observer=new JdbcTemplate(source);

        db.execute("CREATE TABLE properties (id BIGINT PRIMARY KEY,organization_id BIGINT,owner_id BIGINT,updated_at TIMESTAMP)");
        db.execute("CREATE TABLE users (id BIGINT PRIMARY KEY,organization_id BIGINT,role VARCHAR(30),status VARCHAR(30),updated_at TIMESTAMP)");
        db.execute("CREATE TABLE guests (id BIGINT PRIMARY KEY,organization_id BIGINT,updated_at TIMESTAMP)");
        db.execute("CREATE TABLE reservations (id BIGINT PRIMARY KEY,organization_id BIGINT,property_id BIGINT,guest_id BIGINT,check_in DATE,check_out DATE,status VARCHAR(30))");
        db.execute("CREATE TABLE noise_alert_configs (id BIGINT PRIMARY KEY,organization_id BIGINT,property_id BIGINT,enabled BOOLEAN,cooldown_minutes INTEGER,notify_in_app BOOLEAN,notify_email BOOLEAN,notify_guest_message BOOLEAN,email_recipients VARCHAR(1000),updated_at TIMESTAMP)");
        db.execute("CREATE TABLE noise_alert_time_windows (id BIGINT PRIMARY KEY,config_id BIGINT,start_time TIME,end_time TIME,warning_threshold_db INTEGER,critical_threshold_db INTEGER,label VARCHAR(100))");
        db.execute("CREATE TABLE noise_alerts (id BIGINT PRIMARY KEY,organization_id BIGINT,property_id BIGINT,measured_db DOUBLE PRECISION,threshold_db INTEGER,severity VARCHAR(20),created_at TIMESTAMP DEFAULT LOCALTIMESTAMP,notified_guest BOOLEAN DEFAULT false,notified_whatsapp BOOLEAN DEFAULT false,notified_in_app BOOLEAN DEFAULT false,notified_email BOOLEAN DEFAULT false,acknowledged BOOLEAN DEFAULT false,notes VARCHAR(255))");
        db.execute("CREATE TABLE local_notifications (id INTEGER)");
        db.update("INSERT INTO properties VALUES (91,7,80,NULL),(92,8,81,NULL)");
        db.update("INSERT INTO users VALUES (80,7,'HOST','ACTIVE',NULL),(81,8,'HOST','ACTIVE',NULL)");
        db.update("INSERT INTO guests VALUES (70,7,?)",Timestamp.valueOf(guestVersion));
        db.update("INSERT INTO reservations VALUES (100,7,91,70,?,?,'confirmed')",LocalDate.now().minusDays(1),LocalDate.now().plusDays(1));
        db.update("INSERT INTO noise_alert_configs VALUES (1,7,91,true,30,true,true,true,?,NULL)", "one@example.invalid,two@example.invalid;one@example.invalid three@example.invalid");
        db.update("INSERT INTO noise_alert_time_windows VALUES (1,1,'00:00:00','00:00:00',70,90,'Synthetic')");
        alert(10);
        migrate(); migrate();
        alert(11);alert(12);
        manager=new DataSourceTransactionManager(source);outbox=new BaitlyNoiseDeliveryOutbox(db,manager);admission=new BaitlyNoiseAlertAdmission(db);
    }

    void migrate() {
        try(var connection=source.getConnection()) {
            var database=liquibase.database.DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new liquibase.database.jvm.JdbcConnection(connection));
            var resources=new liquibase.resource.ClassLoaderResourceAccessor();
            try(var master=new liquibase.Liquibase("db/changelog/db.changelog-master.yaml",resources,database)) {
                var selected=new liquibase.changelog.DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(set -> java.util.Set.of("0600-baitly-noise-warning-attempts","0601-baitly-noise-delivery-outbox","0602-baitly-noise-alert-cooldown-index").contains(set.getId())).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(3);
                new liquibase.Liquibase(selected,resources,database).update("");
            }
        } catch(Exception failure) { throw new IllegalStateException("Migration de recette avertissements echouee",failure); }
    }
    @AfterEach void close() {
        if(schema!=null) admin.execute("DROP SCHEMA "+schema+" CASCADE");
        else if(db!=null) db.execute("DROP ALL OBJECTS");
    }
    void alert(long id) {
        db.update("INSERT INTO noise_alerts (id,organization_id,property_id,measured_db,threshold_db,severity) VALUES (?,7,91,82.5,70,'WARNING')",id);
    }
    void queue(long id) {new TransactionTemplate(manager).executeWithoutResult(s -> outbox.enqueue(id,7L,1L));}
    BaitlyNoiseDeliveryOutbox.Work work(String channel,int ordinal) {return new BaitlyNoiseDeliveryOutbox.Work(11L,7L,channel,ordinal);}
    String state(String channel,int ordinal) {return db.queryForObject("SELECT state FROM baitly_noise_delivery_items WHERE alert_id=11 AND channel=? AND ordinal=?",String.class,channel,ordinal);}
    long count(String table) {return observer.queryForObject("SELECT COUNT(*) FROM "+table,Long.class);}
    NoiseAlert model() {var a=new NoiseAlert();a.setId(11L);a.setOrganizationId(7L);a.setPropertyId(91L);a.setMeasuredDb(82.5);a.setThresholdDb(70);a.setSeverity(NoiseAlert.AlertSeverity.WARNING);return a;}
    BaitlyNoiseDeliveryWorker worker(BaitlyNoiseDeliveryOutbox store,NoiseAlertNotificationService notifications) {
        var alerts=mock(NoiseAlertRepository.class);var configs=mock(NoiseAlertConfigRepository.class);var properties=mock(PropertyRepository.class);
        when(alerts.findById(11L)).thenReturn(Optional.of(model()));
        var c=new NoiseAlertConfig();c.setId(1L);c.setOrganizationId(7L);c.setPropertyId(91L);
        when(configs.findById(1L)).thenReturn(Optional.of(c));
        var p=new Property();p.setId(91L);p.setOrganizationId(7L);
        when(properties.findById(91L)).thenReturn(Optional.of(p));
        return new BaitlyNoiseDeliveryWorker(store,notifications,alerts,configs,properties,manager);
    }
    @Test void enqueueAndAlertRollBackTogetherWithoutAnExternalAttempt() {
        assertThatThrownBy(() -> new TransactionTemplate(manager).execute(s -> {
            alert(13);outbox.enqueue(13L,7L,1L);throw new IllegalStateException("Rollback");
        })).hasMessage("Rollback");
        assertThat(count("baitly_noise_deliveries")).isZero();
        assertThat(db.queryForObject("SELECT COUNT(*) FROM noise_alerts WHERE id=13",Long.class)).isZero();
        assertThatThrownBy(() -> outbox.enqueue(11L,7L,1L)).hasMessage("Delegation bruit non confirmee");
    }
    @Test void committedWorkSurvivesRestartAndDeduplicatesRecipientsWithoutStoringAddresses() {
        queue(11);queue(11);
        var restarted=new BaitlyNoiseDeliveryOutbox(db,manager);
        assertThat(restarted.pending()).hasSize(5);
        assertThat(count("baitly_noise_deliveries")).isEqualTo(1);
        assertThat(db.queryForObject("SELECT reservation_id FROM baitly_noise_deliveries",Long.class)).isEqualTo(100L);
        var rows=db.queryForList("SELECT * FROM baitly_noise_deliveries");
        assertThat(rows.toString()).doesNotContain("example.invalid","Synthetic");
        assertThat(db.queryForList("SELECT * FROM baitly_noise_delivery_items").toString()).doesNotContain("example.invalid");
    }
    @Test void migrationNeverQueuesHistoricalAlertsAndDoesNotMoveItsBoundary() {
        queue(10);migrate();
        assertThat(count("baitly_noise_deliveries")).isZero();
        assertThat(db.queryForObject("SELECT last_legacy_alert_id FROM baitly_noise_delivery_boundary",Long.class)).isEqualTo(10L);
    }
    @Test void noActiveGuestAtCreationCannotBecomeANewRecipientLater() {
        db.update("UPDATE reservations SET status='cancelled'");queue(11);
        db.update("UPDATE reservations SET status='confirmed'");
        assertThat(state("GUEST",0)).isEqualTo("SKIPPED");
        assertThat(outbox.pending()).noneMatch(w -> w.channel().equals("GUEST"));
    }
    @ParameterizedTest @ValueSource(strings={"configuration","disabled","property","owner","ownerVersion","inactiveOwner","guest","stay"})
    void changedScopesCannotBeDelegated(String changed) {
        queue(11);
        switch(changed) {
            case "configuration" -> db.update("UPDATE noise_alert_configs SET updated_at=LOCALTIMESTAMP");
            case "disabled" -> db.update("UPDATE noise_alert_configs SET enabled=false");
            case "property" -> db.update("UPDATE properties SET organization_id=8 WHERE id=91");
            case "owner" -> db.update("UPDATE properties SET owner_id=81 WHERE id=91");
            case "ownerVersion" -> db.update("UPDATE users SET updated_at=LOCALTIMESTAMP WHERE id=80");
            case "inactiveOwner" -> db.update("UPDATE users SET status='INACTIVE' WHERE id=80");
            case "guest" -> db.update("UPDATE guests SET updated_at=LOCALTIMESTAMP");
            case "stay" -> db.update("UPDATE reservations SET status='cancelled'");
        }
        String channel=Set.of("guest","stay").contains(changed) ? "GUEST" : "OWNER_EMAIL";
        assertThat(outbox.snapshot(work(channel,0))).isEmpty();
        if(channel.equals("OWNER_EMAIL")) assertThat(outbox.startEmail(work(channel,0))).isEmpty();
    }
    @Test void expiredUnattemptedWorkIsSkippedButUncertaintyNeverExpires() {
        queue(11);
        UUID first=outbox.startEmail(work("OWNER_EMAIL",0)).orElseThrow();
        outbox.finishEmail(work("OWNER_EMAIL",0),first,false);
        db.update("UPDATE baitly_noise_deliveries SET expires_at=CURRENT_TIMESTAMP-INTERVAL '48' HOUR");
        assertThat(outbox.startEmail(work("OWNER_EMAIL",0))).isEmpty();
        assertThat(state("OWNER_EMAIL",0)).isEqualTo("UNKNOWN");
        assertThat(outbox.startEmail(work("OWNER_EMAIL",1))).isEmpty();
        assertThat(state("OWNER_EMAIL",1)).isEqualTo("SKIPPED");
    }
    @Test void wrongAttemptOrOrganizationCannotCompleteOrReleaseEmail() {
        queue(11);var w=work("OWNER_EMAIL",0);UUID ticket=outbox.startEmail(w).orElseThrow();
        assertThatThrownBy(() -> outbox.finishEmail(w,UUID.randomUUID(),true)).hasMessage("Delegation bruit non confirmee");
        assertThatThrownBy(() -> outbox.finishEmail(new BaitlyNoiseDeliveryOutbox.Work(11L,8L,"OWNER_EMAIL",0),ticket,true)).hasMessage("Delegation bruit non confirmee");
        assertThat(state("OWNER_EMAIL",0)).isEqualTo("STARTED");
        outbox.finishEmail(w,ticket,true);outbox.finishEmail(w,ticket,false);
        assertThat(state("OWNER_EMAIL",0)).isEqualTo("ACCEPTED");
    }
    @Test void concurrentEmailWorkersHaveOneCommittedAttempt() throws Exception {
        queue(11);var pool=Executors.newFixedThreadPool(2);
        try {
            var start=new CountDownLatch(1);
            Callable<Boolean> task=() -> {start.await();return outbox.startEmail(work("OWNER_EMAIL",0)).isPresent();};
            var a=pool.submit(task);var b=pool.submit(task);start.countDown();
            assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        } finally {pool.shutdownNow();}
    }
    @Test void inAppNotificationAndProofRollBackTogetherThenCommitOnlyOnce() throws Exception {
        queue(11);var w=work("OWNER_IN_APP",0);
        assertThatThrownBy(() -> outbox.persistInApp(w,() -> {
            db.update("INSERT INTO local_notifications VALUES (1)");throw new IllegalStateException("synthetic-private");
        })).hasMessage("Delegation bruit non confirmee");
        assertThat(count("local_notifications")).isZero();assertThat(state("OWNER_IN_APP",0)).isEqualTo("PENDING");
        var pool=Executors.newFixedThreadPool(2);
        try {
            Runnable task=() -> outbox.persistInApp(w,() -> {assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();db.update("INSERT INTO local_notifications VALUES (1)");return true;});
            var a=pool.submit(task);var b=pool.submit(task);a.get(15,TimeUnit.SECONDS);b.get(15,TimeUnit.SECONDS);
        } finally {pool.shutdownNow();}
        assertThat(count("local_notifications")).isEqualTo(1);
        db.update("UPDATE noise_alerts SET notes='Synthetic note',acknowledged=true WHERE id=11");outbox.repair();
        assertThat(db.queryForObject("SELECT notified_in_app FROM noise_alerts WHERE id=11",Boolean.class)).isTrue();
        assertThat(db.queryForObject("SELECT notes FROM noise_alerts WHERE id=11",String.class)).isEqualTo("Synthetic note");
    }
    @Test void disabledPreferenceIsSkippedWithoutPretendingToNotify() {
        queue(11);outbox.persistInApp(work("OWNER_IN_APP",0),() -> false);outbox.repair();
        assertThat(state("OWNER_IN_APP",0)).isEqualTo("SKIPPED");
        assertThat(db.queryForObject("SELECT notified_in_app FROM noise_alerts WHERE id=11",Boolean.class)).isFalse();
    }
    @Test void partialOwnerFanoutNeverReplaysAcceptedOrUnknownRecipients() {
        queue(11);var notifications=mock(NoiseAlertNotificationService.class);var calls=new AtomicInteger();
        when(notifications.prepareOwnerEmail(any(),any(),any(),anyInt())).thenAnswer(call -> {
            int ordinal=call.getArgument(3);
            return (Runnable)() -> {
                assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
                assertThat(state("OWNER_EMAIL",ordinal)).isEqualTo("STARTED");calls.incrementAndGet();
                if(ordinal==1) throw new IllegalStateException("synthetic-private recipient@example.invalid");
            };
        });
        var worker=worker(outbox,notifications);worker.run();worker(outbox,notifications).run();
        assertThat(calls).hasValue(3);
        assertThat(state("OWNER_EMAIL",0)).isEqualTo("ACCEPTED");
        assertThat(state("OWNER_EMAIL",1)).isEqualTo("UNKNOWN");
        assertThat(state("OWNER_EMAIL",2)).isEqualTo("ACCEPTED");
        assertThat(db.queryForObject("SELECT notified_email FROM noise_alerts WHERE id=11",Boolean.class)).isFalse();
    }
    @Test void lostAcceptanceAcknowledgementCannotDowngradeOrReplayAndFlagsCanBeRepaired() {
        queue(11);var notifications=mock(NoiseAlertNotificationService.class);var store=spy(outbox);var calls=new AtomicInteger();
        when(notifications.prepareOwnerEmail(any(),any(),any(),anyInt())).thenReturn(() -> calls.incrementAndGet());
        doAnswer(c -> {c.callRealMethod();throw new IllegalStateException("synthetic-private");}).when(store).finishEmail(any(),any(),eq(true));
        worker(store,notifications).run();
        assertThat(calls).hasValue(3);
        assertThat(state("OWNER_EMAIL",0)).isEqualTo("ACCEPTED");
        db.update("UPDATE noise_alerts SET notified_email=false WHERE id=11");
        worker(outbox,notifications).run();
        assertThat(calls).hasValue(3);
        assertThat(db.queryForObject("SELECT notified_email FROM noise_alerts WHERE id=11",Boolean.class)).isTrue();
    }
    @Test void purePreparationFailureLeavesUnattemptedWorkAndPrivateDiagnostics() {
        queue(11);var notifications=mock(NoiseAlertNotificationService.class);
        when(notifications.prepareOwnerEmail(any(),any(),any(),anyInt())).thenThrow(new IllegalStateException("synthetic-private owner@example.invalid"));
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(BaitlyNoiseDeliveryWorker.class);
        var logs=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();logs.start();logger.addAppender(logs);
        try {worker(outbox,notifications).run();
            assertThat(logs.list).allSatisfy(e -> {assertThat(e.getFormattedMessage()).doesNotContain("synthetic-private","example.invalid");assertThat(e.getThrowableProxy()).isNull();});
        } finally {logger.detachAppender(logs);logs.stop();}
        assertThat(state("OWNER_EMAIL",0)).isEqualTo("PENDING");
        assertThat(db.queryForObject("SELECT COUNT(*) FROM baitly_noise_delivery_items WHERE attempt IS NOT NULL",Long.class)).isZero();
    }
    @Test void guestAcceptedProofRepairsTheQueueWithoutDelegatingAgain() {
        queue(11);var journal=new BaitlyNoiseWarningJournal(db,manager);
        var ticket=journal.claim(new BaitlyNoiseWarningJournal.Scope(11L,7L,91L,100L,70L,guestVersion,BaitlyNoiseWarningJournal.Channel.WHATSAPP_META,82.5,70,"WARNING")).orElseThrow();
        outbox.finishGuest(work("GUEST",0));assertThat(state("GUEST",0)).isEqualTo("UNKNOWN");
        journal.accepted(ticket,"synthetic-receipt");outbox.repair();
        assertThat(state("GUEST",0)).isEqualTo("ACCEPTED");
        assertThat(outbox.pending()).noneMatch(w -> w.channel().equals("GUEST"));
    }
    @Test void committedGuestWorkResumesBeforeItsFirstAttemptAndNeverSendsTwice() {
        queue(11);assertThat(count("baitly_noise_warning_attempts")).isZero();
        var notifications=mock(NoiseAlertNotificationService.class);var sends=new AtomicInteger();
        when(notifications.sendQueuedGuestWarning(any(),any())).thenAnswer(call -> {
            var expected=(BaitlyNoiseDeliveryOutbox.Snapshot)call.getArgument(1);
            assertThat(expected.reservation()).isEqualTo(100L);assertThat(expected.guest()).isEqualTo(70L);
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            var journal=new BaitlyNoiseWarningJournal(db,manager);
            var ticket=journal.claim(new BaitlyNoiseWarningJournal.Scope(11L,7L,91L,expected.reservation(),expected.guest(),
                expected.guestVersion(),BaitlyNoiseWarningJournal.Channel.WHATSAPP_META,82.5,70,"WARNING")).orElseThrow();
            sends.incrementAndGet();journal.accepted(ticket,"synthetic-receipt");return NoiseAlertNotificationService.GuestWarningOutcome.sentVia("whatsapp");
        });
        var restarted=new BaitlyNoiseDeliveryOutbox(db,manager);
        worker(restarted,notifications).run();worker(restarted,notifications).run();
        assertThat(sends).hasValue(1);assertThat(state("GUEST",0)).isEqualTo("ACCEPTED");
    }
    @Test void ownerUncertaintyIsIncludedInPrivateMetricsWithoutDoubleCountingGuestQueue() {
        queue(11);var ticket=outbox.startEmail(work("OWNER_EMAIL",0)).orElseThrow();
        outbox.finishEmail(work("OWNER_EMAIL",0),ticket,false);
        var registry=new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
        var metrics=new com.clenzy.config.BaitlyNoiseWarningMetrics(db,registry);metrics.refresh();
        assertThat(registry.get("baitly.noise.warning.snapshot.healthy").gauge().value()).isEqualTo(1);
        assertThat(registry.get("baitly.noise.warning.uncertain").gauge().value()).isEqualTo(1);
        registry.getMeters().forEach(m -> assertThat(m.getId().getTags()).isEmpty());
    }
    @Test void emailPlanKeepsTheFirstAddressButDoesNotDuplicateCaseVariants() {
        assertThat(BaitlyNoiseDeliveryOutbox.recipients(" Owner@Example.invalid ;owner@example.invalid second@example.invalid "))
            .containsExactly("Owner@Example.invalid","second@example.invalid");
    }
    @Test void committedQueueFeedsTheRealGuestServiceAndJournalWithoutAnotherSend() {
        queue(11);
        var properties=mock(PropertyRepository.class);var reservations=mock(ReservationRepository.class);
        var configs=mock(WhatsAppConfigRepository.class);
        var resolver=mock(com.clenzy.service.messaging.whatsapp.WhatsAppProviderResolver.class);
        var provider=mock(com.clenzy.service.messaging.whatsapp.WhatsAppProvider.class);
        var property=new Property();property.setId(91L);property.setOrganizationId(7L);property.setName("Synthetic");
        var guest=new Guest();guest.setId(70L);guest.setOrganizationId(7L);guest.setUpdatedAt(guestVersion);guest.setPhone("+33000000000");
        var stay=new Reservation();stay.setId(100L);stay.setGuest(guest);
        when(properties.findById(91L)).thenReturn(Optional.of(property));
        when(reservations.findActiveByPropertyIdAndDate(eq(91L),any(),eq(7L))).thenReturn(Optional.of(stay));
        var wa=new WhatsAppConfig();wa.setEnabled(true);when(configs.findByOrganizationId(7L)).thenReturn(Optional.of(wa));
        when(resolver.resolve(wa)).thenReturn(provider);when(provider.getProviderType()).thenReturn(WhatsAppProviderType.META);
        when(provider.sendTemplateMessage(any(),anyString(),anyString(),anyString(),anyList())).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(observer.queryForObject("SELECT state FROM baitly_noise_warning_attempts WHERE alert_id=11",String.class)).isEqualTo("STARTED");
            return "synthetic-receipt";
        });
        var notifications=new NoiseAlertNotificationService(mock(NotificationService.class),mock(EmailService.class),properties,reservations,
            mock(com.clenzy.service.messaging.SystemEmailTemplateService.class),mock(com.clenzy.service.messaging.TemplateInterpolationService.class),
            new com.clenzy.service.messaging.EmailWrapperService(),resolver,configs,new BaitlyNoiseWarningJournal(db,manager),manager,outbox);
        worker(new BaitlyNoiseDeliveryOutbox(db,manager),notifications).run();
        worker(new BaitlyNoiseDeliveryOutbox(db,manager),notifications).run();
        verify(provider,times(1)).sendTemplateMessage(any(),anyString(),anyString(),anyString(),anyList());
        assertThat(state("GUEST",0)).isEqualTo("ACCEPTED");
        assertThat(db.queryForObject("SELECT notified_whatsapp FROM noise_alerts WHERE id=11",Boolean.class)).isTrue();
    }
    @Test void ownerProofsWaitingForLocalFlagsAreMeasuredOnlyWhenAllRecipientsWereAccepted() {
        queue(11);
        var registry=new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
        var metrics=new com.clenzy.config.BaitlyNoiseWarningMetrics(db,registry);
        var w=work("OWNER_EMAIL",0);outbox.finishEmail(w,outbox.startEmail(w).orElseThrow(),true);
        metrics.refresh();assertThat(registry.get("baitly.noise.warning.repair.pending").gauge().value()).isZero();
        for(int i=1;i<3;i++) {w=work("OWNER_EMAIL",i);outbox.finishEmail(w,outbox.startEmail(w).orElseThrow(),true);}
        metrics.refresh();assertThat(registry.get("baitly.noise.warning.repair.pending").gauge().value()).isEqualTo(1);
        outbox.repair();metrics.refresh();assertThat(registry.get("baitly.noise.warning.repair.pending").gauge().value()).isZero();
    }
    @Test void staleScopeAfterPreparationCannotStartAnEmail() {
        queue(11);var notifications=mock(NoiseAlertNotificationService.class);var calls=new AtomicInteger();
        when(notifications.prepareOwnerEmail(any(),any(),any(),anyInt())).thenAnswer(c -> {
            db.update("UPDATE noise_alert_configs SET updated_at=LOCALTIMESTAMP");return (Runnable)() -> calls.incrementAndGet();
        });
        worker(outbox,notifications).run();assertThat(calls).hasValue(0);
    }
    @Test void concurrentSourcesCreateOnlyOneAlertAndItsCommittedOutbox() throws Exception {
        db.update("DELETE FROM noise_alerts");var pool=Executors.newFixedThreadPool(2);var ids=new AtomicInteger(20);
        try {
            var start=new CountDownLatch(1);
            Callable<Boolean> create=() -> {start.await();return new TransactionTemplate(manager).execute(status -> {
                var decision=admission.admit(7L,91L,82.5);if(decision.isEmpty()) return false;
                long id=ids.incrementAndGet();alert(id);outbox.enqueue(id,7L,decision.orElseThrow().config());return true;
            });};
            var a=pool.submit(create);var b=pool.submit(create);start.countDown();
            assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        } finally {pool.shutdownNow();}
        assertThat(count("noise_alerts")).isEqualTo(1);assertThat(count("baitly_noise_deliveries")).isEqualTo(1);
    }
    @Test void failedOutboxCannotConsumeTheCreationCooldown() {
        db.update("DELETE FROM noise_alerts");
        assertThatThrownBy(() -> new TransactionTemplate(manager).execute(status -> {
            var d=admission.admit(7L,91L,82.5).orElseThrow();alert(20);
            outbox.enqueue(20L,7L,999L);return d;
        })).hasMessage("Delegation bruit non confirmee");
        assertThat(count("noise_alerts")).isZero();assertThat(count("baitly_noise_deliveries")).isZero();
        assertThat(new TransactionTemplate(manager).<Optional<BaitlyNoiseAlertAdmission.Admission>>execute(s -> admission.admit(7L,91L,82.5))).isPresent();
    }
    @Test void cooldownIsScopedByOrganizationPropertyAndSeverityAndReadsCurrentConfiguration() {
        assertThat(new TransactionTemplate(manager).<Optional<BaitlyNoiseAlertAdmission.Admission>>execute(s -> admission.admit(7L,91L,82.5))).isEmpty();
        assertThat(new TransactionTemplate(manager).<Optional<BaitlyNoiseAlertAdmission.Admission>>execute(s -> admission.admit(7L,91L,95))).isPresent();
        assertThat(new TransactionTemplate(manager).<Optional<BaitlyNoiseAlertAdmission.Admission>>execute(s -> admission.admit(8L,91L,95))).isEmpty();
        db.update("DELETE FROM noise_alerts");db.update("UPDATE noise_alert_time_windows SET warning_threshold_db=100,critical_threshold_db=110");
        assertThat(new TransactionTemplate(manager).<Optional<BaitlyNoiseAlertAdmission.Admission>>execute(s -> admission.admit(7L,91L,95))).isEmpty();
        db.update("UPDATE noise_alert_configs SET enabled=false");
        assertThat(new TransactionTemplate(manager).<Optional<BaitlyNoiseAlertAdmission.Admission>>execute(s -> admission.admit(7L,91L,150))).isEmpty();
        assertThatThrownBy(() -> admission.admit(7L,91L,150)).hasMessage("Admission bruit non confirmee");
    }
}
