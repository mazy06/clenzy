package com.clenzy.service.automation;

import com.clenzy.config.BaitlyExternalEffectMetrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Real migrated journal and aggregate SQL, including manual effects; no real provider. */
class BaitlyExternalEffectMetricsTest extends BaitlyAutomationFixture {
    final SimpleMeterRegistry meters = new SimpleMeterRegistry();
    BaitlyExternalEffectMetrics metrics;
    @BeforeEach void collector() { metrics = new BaitlyExternalEffectMetrics(db, meters, clock); }
    double value(String suffix) { return meters.get("baitly.external.effect." + suffix).gauge().value(); }
    void row(long org, long id, String kind, String state, LocalDateTime at, int progress) {
        db.update("INSERT INTO baitly_external_effect_guards VALUES (?,?,?)", org, kind, id);
        db.update("""
            INSERT INTO baitly_external_effect_attempts(organization_id,kind,resource_id,operation,occurrence,
                attempt_token,state,attempted_at,completed_at,effect_ref_id,completed_count)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """, org, kind, id, kind.equals("LOCK") ? "CREATE" : "SEND", "once", UUID.randomUUID(), state, at,
            state.equals("DONE") ? now : null, state.equals("DONE") ? id : null, progress);
    }
    @Test void partitionsIncludeManualAndOtherOrganizationsWithoutMutatingFences() {
        row(7, 1, "LOCK", "STARTED", now.minusMinutes(6), 0);
        row(8, 2, "LOCK", "UNKNOWN", now.minusYears(20), 0);
        row(7, 3, "REPORT", "STARTED", now.minusMinutes(8), 1);
        row(9, 4, "REPORT", "UNKNOWN", now.minusMinutes(9), 2);
        row(9, 5, "REPORT", "UNKNOWN", now.minusMinutes(2), 0);
        row(7, 6, "LOCK", "DONE", now.minusYears(30), 0);
        row(7, 7, "REPORT", "DONE", now.minusYears(30), 4);
        var before = db.queryForList("SELECT * FROM baitly_external_effect_attempts ORDER BY resource_id");
        metrics.refresh(); metrics.refresh();
        assertThat(value("lock.uncertain")).isEqualTo(2);
        assertThat(value("lock.unknown")).isEqualTo(1);
        assertThat(value("lock.oldest.uncertain.seconds")).isEqualTo(Duration.between(now.minusYears(20), now).getSeconds());
        assertThat(value("report.uncertain")).isEqualTo(3);
        assertThat(value("report.unknown")).isEqualTo(2);
        assertThat(value("report.partial")).isEqualTo(2);
        assertThat(value("report.oldest.uncertain.seconds")).isEqualTo(540);
        assertThat(value("snapshot.healthy")).isEqualTo(1);
        assertThat(db.queryForList("SELECT * FROM baitly_external_effect_attempts ORDER BY resource_id")).isEqualTo(before);
        assertThat(meters.getMeters()).hasSize(9).allSatisfy(m -> assertThat(m.getId().getTags()).isEmpty());
    }
    @Test void startupAndEmptyJournalAreDistinguished() {
        assertThat(value("snapshot.healthy")).isZero();
        assertThat(value("snapshot.last.success.timestamp.seconds")).isZero();
        metrics.refresh();
        assertThat(value("snapshot.healthy")).isEqualTo(1);
        assertThat(value("snapshot.last.success.timestamp.seconds")).isEqualTo(clock.instant().getEpochSecond());
        assertThat(value("lock.uncertain")).isZero();
        assertThat(value("report.partial")).isZero();
    }
    @Test void missingTableRetainsLastSnapshotThenRecoversWithoutRearming() {
        row(7, 1, "REPORT", "UNKNOWN", now.minusMinutes(10), 1);
        metrics.refresh();
        db.execute("ALTER TABLE baitly_external_effect_attempts RENAME TO offline_effects");
        metrics.refresh();
        assertThat(value("snapshot.healthy")).isZero();
        assertThat(value("snapshot.last.success.timestamp.seconds")).isEqualTo(clock.instant().getEpochSecond());
        assertThat(value("report.partial")).isEqualTo(1);
        assertThat(value("report.oldest.uncertain.seconds")).isEqualTo(600);
        db.execute("ALTER TABLE offline_effects RENAME TO baitly_external_effect_attempts");
        metrics.refresh();
        assertThat(value("snapshot.healthy")).isEqualTo(1);
        assertThat(db.queryForObject("SELECT state FROM baitly_external_effect_attempts", String.class)).isEqualTo("UNKNOWN");
    }
    @ParameterizedTest @ValueSource(strings = {"LOCK", "REPORT"})
    void futureAttemptCannotPublishHealthyZero(String kind) {
        row(7, 1, kind, "UNKNOWN", now.minusMinutes(10), 0);
        metrics.refresh();
        db.update("UPDATE baitly_external_effect_attempts SET attempted_at=?", now.plusMinutes(2));
        metrics.refresh();
        assertThat(value("snapshot.healthy")).isZero();
        assertThat(value(kind.toLowerCase(Locale.ROOT) + ".uncertain")).isEqualTo(1);
    }
    @Test void scrapeIsPureMemoryAndContainsNoBusinessFieldsOrLabels() {
        var prom = new io.micrometer.prometheusmetrics.PrometheusMeterRegistry(io.micrometer.prometheusmetrics.PrometheusConfig.DEFAULT);
        try {
            var collector = new BaitlyExternalEffectMetrics(db, prom, clock);
            row(7, 1, "REPORT", "UNKNOWN", now.minusMinutes(10), 1);
            collector.refresh();
            db.execute("DROP TABLE baitly_external_effect_attempts");
            String scrape = prom.scrape();
            for (String suffix : List.of("lock_uncertain", "lock_oldest_uncertain_seconds", "lock_unknown",
                    "report_uncertain", "report_oldest_uncertain_seconds", "report_unknown", "report_partial",
                    "snapshot_healthy", "snapshot_last_success_timestamp_seconds"))
                assertThat(scrape).contains("baitly_external_effect_" + suffix + " ");
            assertThat(scrape).doesNotContain("organization", "resource", "attempt_token", "occurrence", "effect_ref",
                "recipient", "email", "PIN", "Bearer", "{");
        } finally { prom.close(); }
    }
    @Test void staleCollectorClockDoesNotAdvanceOnFailure() {
        metrics.refresh();
        double success = value("snapshot.last.success.timestamp.seconds");
        meters.clear();
        Clock later = Clock.fixed(clock.instant().plusSeconds(180), clock.getZone());
        metrics = new BaitlyExternalEffectMetrics(db, meters, later);
        metrics.refresh();
        assertThat(value("snapshot.last.success.timestamp.seconds")).isEqualTo(success + 180);
        db.execute("DROP TABLE baitly_external_effect_attempts");
        metrics.refresh();
        assertThat(value("snapshot.last.success.timestamp.seconds")).isEqualTo(success + 180);
        assertThat(value("snapshot.healthy")).isZero();
    }
    @Test void timestampWallTimeDoesNotFollowDatabaseSessionZone() throws Exception {
        TimeZone original = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));
            var serverNow = LocalDateTime.ofInstant(clock.instant(), ZoneId.systemDefault());
            row(7, 1, "LOCK", "STARTED", serverNow.minusMinutes(7), 0);
            var scoped = new org.springframework.jdbc.datasource.SingleConnectionDataSource(source.getConnection(), true);
            try {
                var session = new org.springframework.jdbc.core.JdbcTemplate(scoped);
                session.execute("SET TIME ZONE 'America/New_York'");
                meters.clear();
                metrics = new BaitlyExternalEffectMetrics(session, meters, clock);
                metrics.refresh();
            } finally { scoped.destroy(); }
            assertThat(value("snapshot.healthy")).isEqualTo(1);
            assertThat(value("lock.oldest.uncertain.seconds")).isEqualTo(420);
        } finally { TimeZone.setDefault(original); }
    }
    @Test void metricCollectionNeverChangesUnknownAdmission() {
        var effects = new BaitlyExternalEffectJournal(db, manager);
        var scope = new BaitlyExternalEffectJournal.Scope(7, BaitlyExternalEffectJournal.Kind.LOCK, 1,
            BaitlyExternalEffectJournal.Operation.ROTATE, "once");
        var ticket = effects.claim(scope); effects.uncertain(ticket);
        metrics.refresh(); metrics.refresh();
        assertThat(value("lock.unknown")).isEqualTo(1);
        assertThatThrownBy(() -> effects.claim(scope)).hasMessage("EXTERNAL_EFFECT_RECONCILIATION_REQUIRED");
    }
}
