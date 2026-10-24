package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.messaging.*;
import com.clenzy.service.messaging.whatsapp.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static com.clenzy.service.BaitlyNoiseWarningJournal.*;

/** Vraie migration choisie depuis le master ; H2 local, PostgreSQL dedie en CI. */
class BaitlyNoiseWarningJournalTest {
    JdbcTemplate db,admin,observer;
    DriverManagerDataSource source;
    DataSourceTransactionManager manager;
    BaitlyNoiseWarningJournal journal;
    String schema;
    LocalDateTime guestVersion=LocalDateTime.of(2026,10,20,12,0);
    final WhatsAppProvider provider=mock(WhatsAppProvider.class);
    final PropertyRepository properties=mock(PropertyRepository.class);
    final ReservationRepository reservations=mock(ReservationRepository.class);
    final WhatsAppConfigRepository configs=mock(WhatsAppConfigRepository.class);
    final WhatsAppProviderResolver resolver=mock(WhatsAppProviderResolver.class);

    @BeforeEach void start() {
        String jdbc=System.getProperty("baitly.test.jdbc");
        if(jdbc==null) {
            source=new DriverManagerDataSource("jdbc:h2:mem:baitlywarning"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
        } else {
            if(!jdbc.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]*(?:test|recipe|ci)[a-zA-Z0-9_]*"))
                throw new IllegalArgumentException("Base de recette dediee requise");
            admin=new JdbcTemplate(new DriverManagerDataSource(jdbc,"postgres",""));
            schema="baitly_warning_"+UUID.randomUUID().toString().replace("-","");
            admin.execute("CREATE SCHEMA "+schema);
            source=new DriverManagerDataSource(jdbc+"?currentSchema="+schema,"postgres","");
        }
        db=new JdbcTemplate(source); observer=new JdbcTemplate(source);
        db.execute("CREATE TABLE properties (id BIGINT PRIMARY KEY,organization_id BIGINT)");
        db.execute("CREATE TABLE guests (id BIGINT PRIMARY KEY,organization_id BIGINT,updated_at TIMESTAMP)");
        db.execute("""
            CREATE TABLE reservations (id BIGINT PRIMARY KEY,organization_id BIGINT,property_id BIGINT,guest_id BIGINT,
                check_in DATE,check_out DATE,status VARCHAR(30))
            """);
        db.execute("""
            CREATE TABLE noise_alerts (id BIGINT PRIMARY KEY,organization_id BIGINT,property_id BIGINT,
                measured_db DOUBLE PRECISION,threshold_db INTEGER,severity VARCHAR(20),created_at TIMESTAMP DEFAULT LOCALTIMESTAMP,
                notified_guest BOOLEAN DEFAULT false,notified_whatsapp BOOLEAN DEFAULT false,
                acknowledged BOOLEAN DEFAULT false,notes VARCHAR(255),notified_email BOOLEAN DEFAULT false,notified_in_app BOOLEAN DEFAULT false)
            """);
        // Full delivery schema/migration is covered by BaitlyNoiseDeliveryOutboxTest.
        db.execute("CREATE TABLE baitly_noise_delivery_items (alert_id BIGINT,channel VARCHAR(20),state VARCHAR(20),attempt UUID,expired_unattempted BOOLEAN DEFAULT false,created_at TIMESTAMP WITH TIME ZONE,updated_at TIMESTAMP WITH TIME ZONE)");
        db.execute("CREATE TABLE baitly_noise_deliveries (alert_id BIGINT,organization_id BIGINT,property_id BIGINT,expires_at TIMESTAMP WITH TIME ZONE)");
        db.update("INSERT INTO properties VALUES (91,7),(92,8)");
        db.update("INSERT INTO guests VALUES (70,7,?)",Timestamp.valueOf(guestVersion));
        db.update("INSERT INTO reservations VALUES (100,7,91,70,?,?,'confirmed')",LocalDate.now().minusDays(1),LocalDate.now().plusDays(1));
        alert(10);
        migrate(); migrate();
        alert(11); alert(12);
        manager=new DataSourceTransactionManager(source);journal=new BaitlyNoiseWarningJournal(db,manager);
    }

    void migrate() {
        try(var connection=source.getConnection()) {
            var database=liquibase.database.DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new liquibase.database.jvm.JdbcConnection(connection));
            var resources=new liquibase.resource.ClassLoaderResourceAccessor();
            try(var master=new liquibase.Liquibase("db/changelog/db.changelog-master.yaml",resources,database)) {
                var selected=new liquibase.changelog.DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(set -> set.getId().equals("0600-baitly-noise-warning-attempts")).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);
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
    Scope scope(long id) { return new Scope(id,7L,91L,100L,70L,guestVersion,Channel.WHATSAPP_META,82.5,70,"WARNING"); }
    String state(long id) { return observer.queryForObject("SELECT state FROM baitly_noise_warning_attempts WHERE alert_id=?",String.class,id); }
    long attempts() { return observer.queryForObject("SELECT count(*) FROM baitly_noise_warning_attempts",Long.class); }

    @Test void migrationDoesNotMoveTheHistoricalBoundaryWhenReplayed() {
        assertThat(db.queryForObject("SELECT last_legacy_alert_id FROM baitly_noise_warning_boundary WHERE id=1",Long.class)).isEqualTo(10);
        migrate();
        assertThat(db.queryForObject("SELECT last_legacy_alert_id FROM baitly_noise_warning_boundary WHERE id=1",Long.class)).isEqualTo(10);
        assertThat(journal.claim(scope(10))).isEmpty();
        assertThat(state(10)).isEqualTo("REVIEW");
        assertThat(journal.claim(scope(11))).isPresent();
    }

    @Test void intentSurvivesOuterRollbackBeforeAnyProviderEffect() {
        assertThatThrownBy(() -> new TransactionTemplate(manager).execute(status -> {
            journal.claim(scope(11)).orElseThrow();
            assertThat(state(11)).isEqualTo("STARTED");
            throw new IllegalStateException("synthetic-rollback");
        })).hasMessage("synthetic-rollback");
        assertThat(state(11)).isEqualTo("STARTED");
        assertThat(new BaitlyNoiseWarningJournal(observer,manager).claim(scope(11))).isEmpty();
    }

    @ParameterizedTest @ValueSource(strings={"STARTED","UNKNOWN"})
    void uncertaintyDoesNotExpireOrReleaseTheStayBudget(String value) {
        var ticket=journal.claim(scope(11)).orElseThrow();
        if(value.equals("UNKNOWN")) journal.uncertain(ticket);
        db.update("UPDATE baitly_noise_warning_attempts SET created_at=CURRENT_TIMESTAMP-INTERVAL '48' HOUR,updated_at=CURRENT_TIMESTAMP-INTERVAL '48' HOUR");
        assertThat(new BaitlyNoiseWarningJournal(observer,manager).claim(scope(12))).isEmpty();
        assertThat(journal.claim(scope(11))).isEmpty();
        assertThat(state(11)).isEqualTo(value);
    }

    @Test void acceptedProofRepairsOnlyNotificationFlags() {
        var ticket=journal.claim(scope(11)).orElseThrow();
        journal.accepted(ticket,"synthetic-private-receipt");
        db.update("UPDATE noise_alerts SET acknowledged=true,notes='new note' WHERE id=11");
        assertThat(journal.repairAccepted(7L,11L)).contains(Channel.WHATSAPP_META);
        assertThat(db.queryForMap("SELECT notified_whatsapp,acknowledged,notes FROM noise_alerts WHERE id=11"))
            .containsEntry("notified_whatsapp",true).containsEntry("acknowledged",true).containsEntry("notes","new note");
        assertThat(db.queryForObject("SELECT receipt_hash FROM baitly_noise_warning_attempts",String.class))
            .matches("[a-f0-9]{64}").doesNotContain("synthetic");
        assertThat(journal.claim(scope(11))).isEmpty();
    }

    @Test void unknownMarkCannotDowngradeAnAcceptedProof() {
        var ticket=journal.claim(scope(11)).orElseThrow();
        journal.accepted(ticket,"synthetic-receipt");
        journal.uncertain(ticket);
        assertThat(state(11)).isEqualTo("ACCEPTED");
    }

    @Test void acceptedOldAlertIsNeverResentButNewAlertAfter24HoursCanBeAdmitted() {
        var ticket=journal.claim(scope(11)).orElseThrow();
        journal.accepted(ticket,"synthetic-receipt");
        assertThat(journal.claim(scope(12))).isEmpty();
        db.update("UPDATE baitly_noise_warning_attempts SET accepted_at=CURRENT_TIMESTAMP-INTERVAL '25' HOUR WHERE alert_id=11");
        db.update("UPDATE noise_alerts SET created_at=LOCALTIMESTAMP-INTERVAL '26' HOUR WHERE id=11");
        assertThat(journal.claim(scope(11))).isEmpty();
        assertThat(journal.claim(scope(12))).isPresent();
    }

    @Test void legacyNotificationMarkerSuppressesNewWarningDuringTheWindow() {
        db.update("UPDATE noise_alerts SET notified_guest=true WHERE id=10");
        assertThat(journal.claim(scope(11))).isEmpty();
        assertThat(attempts()).isZero();
    }

    @Test void concurrentSourcesShareOneDurableClaim() throws Exception {
        var start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try {
            var a=pool.submit(() -> {start.await();return journal.claim(scope(11)).isPresent();});
            var b=pool.submit(() -> {start.await();return journal.claim(scope(12)).isPresent();});
            start.countDown();
            assertThat((a.get(20,TimeUnit.SECONDS)?1:0)+(b.get(20,TimeUnit.SECONDS)?1:0)).isEqualTo(1);
            assertThat(attempts()).isEqualTo(1);
        } finally {pool.shutdownNow();}
    }

    @ParameterizedTest @ValueSource(strings={"organization","property","guest","guestOrganization","guestVersion","cancelled","dates","alertMeaning","deleted"})
    void changedOwnershipOrMeaningRefusesBeforeIntent(String change) {
        switch(change) {
            case "organization" -> db.update("UPDATE reservations SET organization_id=8");
            case "property" -> db.update("UPDATE properties SET organization_id=8 WHERE id=91");
            case "guest" -> db.update("UPDATE reservations SET guest_id=71");
            case "guestOrganization" -> db.update("UPDATE guests SET organization_id=8");
            case "guestVersion" -> db.update("UPDATE guests SET updated_at=?",Timestamp.valueOf(guestVersion.plusSeconds(1)));
            case "cancelled" -> db.update("UPDATE reservations SET status='cancelled'");
            case "dates" -> db.update("UPDATE reservations SET check_out=?",LocalDate.now().minusDays(1));
            case "alertMeaning" -> db.update("UPDATE noise_alerts SET measured_db=90 WHERE id=11");
            case "deleted" -> db.update("DELETE FROM noise_alerts WHERE id=11");
        }
        assertThatThrownBy(() -> journal.claim(scope(11))).hasNoCause();
        assertThat(attempts()).isZero();
    }

    @Test void wrongAttemptCannotConfirmOrRelease() {
        var ticket=journal.claim(scope(11)).orElseThrow();
        var wrong=new Ticket(ticket.scope(),UUID.randomUUID());
        assertThatThrownBy(() -> journal.accepted(wrong,"synthetic-receipt")).hasNoCause();
        journal.uncertain(wrong);
        assertThat(state(11)).isEqualTo("STARTED");
    }

    NoiseAlertNotificationService service(BaitlyNoiseWarningJournal store) {
        Property property=new Property();property.setId(91L);property.setOrganizationId(7L);property.setName("synthetic-property");
        Guest guest=new Guest();guest.setId(70L);guest.setOrganizationId(7L);guest.setFirstName("Synthetic");guest.setPhone("+33000000000");guest.setUpdatedAt(guestVersion);
        Reservation reservation=new Reservation();reservation.setId(100L);reservation.setOrganizationId(7L);reservation.setProperty(property);reservation.setGuest(guest);
        when(properties.findById(91L)).thenReturn(Optional.of(property));
        when(reservations.findActiveByPropertyIdAndDate(eq(91L),any(),eq(7L))).thenReturn(Optional.of(reservation));
        WhatsAppConfig config=new WhatsAppConfig();config.setEnabled(true);
        when(configs.findByOrganizationId(7L)).thenReturn(Optional.of(config));
        when(resolver.resolve(config)).thenReturn(provider);
        when(provider.getProviderType()).thenReturn(WhatsAppProviderType.META);
        doAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(attempts()).isEqualTo(1);
            assertThat(state(11)).isEqualTo("STARTED");
            return "synthetic-receipt";
        }).when(provider).sendTemplateMessage(any(),anyString(),anyString(),anyString(),anyList());
        return new NoiseAlertNotificationService(mock(NotificationService.class),mock(EmailService.class),properties,reservations,
            mock(SystemEmailTemplateService.class),mock(TemplateInterpolationService.class),new EmailWrapperService(),resolver,configs,store,manager,mock(BaitlyNoiseDeliveryOutbox.class));
    }
    NoiseAlert model() {
        NoiseAlert a=new NoiseAlert();a.setId(11L);a.setOrganizationId(7L);a.setPropertyId(91L);a.setMeasuredDb(82.5);
        a.setThresholdDb(70);a.setSeverity(NoiseAlert.AlertSeverity.WARNING);return a;
    }

    @Test void providerRunsOutsideCallerTransactionAndRestartNeverResends() {
        var service=service(journal);
        assertThatThrownBy(() -> new TransactionTemplate(manager).execute(status -> {
            assertThat(service.sendGuestWarning(model()).sent()).isTrue();
            throw new IllegalStateException("synthetic-rollback");
        })).hasMessage("synthetic-rollback");
        assertThat(state(11)).isEqualTo("ACCEPTED");
        assertThat(service(new BaitlyNoiseWarningJournal(db,manager)).sendGuestWarning(model()).sent()).isFalse();
        verify(provider,times(1)).sendTemplateMessage(any(),anyString(),anyString(),anyString(),anyList());
    }

    @Test void lostCommitAcknowledgementKeepsAcceptedProofAndNeverSendsAgain() {
        var store=spy(journal);
        doAnswer(call -> {call.callRealMethod();throw new IllegalStateException("synthetic-private");})
            .when(store).accepted(any(),any());
        var service=service(store);
        assertThat(service.sendGuestWarning(model()).sent()).isFalse();
        assertThat(state(11)).isEqualTo("ACCEPTED");
        assertThat(service.sendGuestWarning(model()).skipReason()).isEqualTo("avertissement deja delegue");
        verify(provider,times(1)).sendTemplateMessage(any(),anyString(),anyString(),anyString(),anyList());
    }

    @Test void providerTimeoutStaysBlockedAfterRestartWithoutRedis() {
        var service=service(journal);
        doThrow(new IllegalStateException("synthetic-private"))
            .when(provider).sendTemplateMessage(any(),anyString(),anyString(),anyString(),anyList());
        assertThat(service.sendGuestWarning(model()).sent()).isFalse();
        assertThat(state(11)).isEqualTo("UNKNOWN");
        assertThat(service(new BaitlyNoiseWarningJournal(db,manager)).sendGuestWarning(model()).sent()).isFalse();
        verify(provider,times(1)).sendTemplateMessage(any(),anyString(),anyString(),anyString(),anyList());
    }
    @Test void queuedWarningCannotTargetAnotherReservation() {
        var service=service(journal);
        assertThat(service.sendQueuedGuestWarning(model(),new BaitlyNoiseDeliveryOutbox.Snapshot(1L,999L,70L,guestVersion)).sent()).isFalse();
        assertThat(attempts()).isZero();
        verify(provider,never()).sendTemplateMessage(any(),anyString(),anyString(),anyString(),anyList());
    }


    @Test void queuedWarningCannotTargetAChangedGuestVersion() {
        var service=service(journal);
        assertThat(service.sendQueuedGuestWarning(model(),new BaitlyNoiseDeliveryOutbox.Snapshot(1L,100L,70L,guestVersion.minusDays(1))).sent()).isFalse();
        assertThat(attempts()).isZero();
        verify(provider,never()).sendTemplateMessage(any(),anyString(),anyString(),anyString(),anyList());
    }


    @Test void failedLocalRepairKeepsProofForRecoveryWithoutAnotherSend() {
        var store=spy(journal);
        var counter=new java.util.concurrent.atomic.AtomicInteger();
        doAnswer(call -> {
            if(counter.incrementAndGet()==2) throw new IllegalStateException("synthetic-private");
            return call.callRealMethod();
        }).when(store).repairAccepted(7L,11L);
        var service=service(store);
        assertThat(service.sendGuestWarning(model()).sent()).isFalse();
        assertThat(state(11)).isEqualTo("ACCEPTED");
        assertThat(db.queryForObject("SELECT notified_whatsapp FROM noise_alerts WHERE id=11",Boolean.class)).isFalse();
        assertThat(service.sendGuestWarning(model()).sent()).isFalse();
        assertThat(db.queryForObject("SELECT notified_whatsapp FROM noise_alerts WHERE id=11",Boolean.class)).isTrue();
        verify(provider,times(1)).sendTemplateMessage(any(),anyString(),anyString(),anyString(),anyList());
    }

    @Test void warningFromAnOldStayCannotTargetTheNewGuest() {
        db.update("UPDATE noise_alerts SET created_at=LOCALTIMESTAMP-INTERVAL '10' DAY WHERE id=11");
        assertThatThrownBy(() -> journal.claim(scope(11))).hasNoCause();
        assertThat(attempts()).isZero();
    }

    @Test void whatsappAcceptanceNeedsReceiptAndCannotHaveNullProof() {
        var ticket=journal.claim(scope(11)).orElseThrow();
        assertThatThrownBy(() -> journal.accepted(ticket," ")).hasNoCause();
        assertThat(state(11)).isEqualTo("STARTED");
        assertThatThrownBy(() -> db.update("UPDATE baitly_noise_warning_attempts SET state='ACCEPTED',accepted_at=CURRENT_TIMESTAMP WHERE alert_id=11"));
        assertThat(state(11)).isEqualTo("STARTED");
    }

    @Test void emailReturnRecordsDelegationWithoutInventingReceipt() {
        Scope original=scope(11);
        var email=new Scope(original.alert(),original.organization(),original.property(),original.reservation(),original.guest(),
            original.guestVersion(),Channel.EMAIL,82.5,70,"WARNING");
        var ticket=journal.claim(email).orElseThrow();
        journal.accepted(ticket,null);
        assertThat(journal.repairAccepted(7L,11L)).contains(Channel.EMAIL);
        assertThat(db.queryForObject("SELECT receipt_hash FROM baitly_noise_warning_attempts",String.class)).isNull();
        assertThat(db.queryForObject("SELECT notified_guest FROM noise_alerts WHERE id=11",Boolean.class)).isTrue();
    }
    @Test void repairQueueOnlyContainsAcceptedMissingFlagsAndNeverRearmsUncertainty() {
        var ticket=journal.claim(scope(11)).orElseThrow();
        assertThat(journal.repairQueue()).isEmpty();
        journal.accepted(ticket,"synthetic-receipt");
        assertThat(journal.repairQueue()).containsExactly(new Repair(7L,11L));
        new BaitlyNoiseWarningRepairWorker(journal).repair();
        assertThat(journal.repairQueue()).isEmpty();
        assertThat(state(11)).isEqualTo("ACCEPTED");
        verifyNoInteractions(provider);
    }

    @Test void metricsRetainPreviousValuesAndTimestampOnFailure() {
        var registry=new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
        var metrics=new com.clenzy.config.BaitlyNoiseWarningMetrics(db,registry);
        journal.claim(scope(11)).orElseThrow();
        metrics.refresh();
        assertThat(registry.get("baitly.noise.warning.uncertain").gauge().value()).isEqualTo(1);
        assertThat(registry.get("baitly.noise.warning.snapshot.healthy").gauge().value()).isEqualTo(1);
        double previous=registry.get("baitly.noise.warning.snapshot.last.success.timestamp.seconds").gauge().value();
        db.execute("ALTER TABLE baitly_noise_warning_attempts RENAME TO warning_unavailable");
        metrics.refresh();
        assertThat(registry.get("baitly.noise.warning.uncertain").gauge().value()).isEqualTo(1);
        assertThat(registry.get("baitly.noise.warning.snapshot.healthy").gauge().value()).isZero();
        assertThat(registry.get("baitly.noise.warning.snapshot.last.success.timestamp.seconds").gauge().value()).isEqualTo(previous);
        assertThat(registry.getMeters()).allSatisfy(meter -> assertThat(meter.getId().getTags()).isEmpty());
        registry.close();
    }

    @Test void acceptedProofAwaitingLocalRepairIsVisibleAsAggregate() {
        var ticket=journal.claim(scope(11)).orElseThrow();
        journal.accepted(ticket,"synthetic-receipt");
        var registry=new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
        var metrics=new com.clenzy.config.BaitlyNoiseWarningMetrics(db,registry);
        metrics.refresh();
        assertThat(registry.get("baitly.noise.warning.uncertain").gauge().value()).isZero();
        assertThat(registry.get("baitly.noise.warning.repair.pending").gauge().value()).isEqualTo(1);
        journal.repairAccepted(7L,11L);
        metrics.refresh();
        assertThat(registry.get("baitly.noise.warning.repair.pending").gauge().value()).isZero();
        registry.close();
    }
    @Test void guestTimestampUsesTheSameDatabasePrecisionAsJpaStorage() {
        guestVersion=guestVersion.withNano(123456789);
        db.update("UPDATE guests SET updated_at=?",Timestamp.valueOf(guestVersion));
        assertThat(journal.claim(scope(11))).isPresent();
    }
}
