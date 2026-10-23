package com.clenzy.config;

import io.micrometer.core.instrument.MockClock;
import io.micrometer.core.instrument.simple.SimpleConfig;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class BaitlyRecoveryJournalMetricsTest {
    JdbcTemplate db;
    MockClock clock;
    SimpleMeterRegistry registry;
    BaitlyRecoveryJournalMetrics metrics;

    @BeforeEach void start() {
        db = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa",""));
        db.execute("CREATE TABLE baitly_accounting_exports (state varchar, fingerprint varchar(64), created_at timestamp with time zone)");
        db.execute("CREATE TABLE baitly_oauth_refresh_attempts (scope_hash varchar(64), attempt uuid, created_at timestamp with time zone)");
        clock = new MockClock(); registry = new SimpleMeterRegistry(SimpleConfig.DEFAULT,clock);
        metrics = new BaitlyRecoveryJournalMetrics(db,registry);
    }

    double value(String name) { return registry.get("baitly.recovery."+name).gauge().value(); }
    void row(String state, String hash, long age) {
        db.update("INSERT INTO baitly_accounting_exports VALUES (?,?,?)",state,hash,Timestamp.from(Instant.now().minusSeconds(age)));
    }

    @Test void missingFirstSampleCannotBeMistakenForHealthyEmptyJournals() {
        assertThat(value("snapshot.healthy")).isZero();
        assertThat(value("snapshot.last.success.timestamp.seconds")).isZero();
        metrics.refresh();
        assertThat(value("snapshot.healthy")).isEqualTo(1);
        assertThat(value("snapshot.last.success.timestamp.seconds")).isGreaterThan(0);
        assertThat(value("accounting.unknown")).isZero();
        assertThat(value("accounting.oldest.unknown.seconds")).isZero();
    }

    @Test void separatesHistoricalReviewFromNewUnknownAndInflightWithoutCountingConfirmed() {
        row("UNKNOWN","0".repeat(64),99999);
        row("UNKNOWN","a".repeat(64),600);
        row("SENDING","b".repeat(64),300);
        row("CONFIRMED","c".repeat(64),99999);
        metrics.refresh();
        assertThat(value("accounting.historical.review")).isEqualTo(1);
        assertThat(value("accounting.unknown")).isEqualTo(1);
        assertThat(value("accounting.inflight")).isEqualTo(1);
        assertThat(value("accounting.oldest.unknown.seconds")).isBetween(590.0,620.0);
        assertThat(value("accounting.oldest.inflight.seconds")).isBetween(290.0,320.0);
    }

    @Test void durableOAuthFencesAreCountedWithoutPublishingTheirIdentifiersOrTreatingThemAsErrors() {
        db.update("INSERT INTO baitly_oauth_refresh_attempts VALUES (?,?,CURRENT_TIMESTAMP)","d".repeat(64),UUID.randomUUID());
        metrics.refresh();
        assertThat(value("oauth.blocked.scopes")).isEqualTo(1);
        assertThat(registry.getMeters()).allSatisfy(meter -> {
            assertThat(meter.getId().getTags()).isEmpty();
            assertThat(meter.getId().toString()).doesNotContain("d".repeat(64));
        });
        assertThat(registry.get("baitly.recovery.oauth.blocked.scopes").gauge().getId().getDescription())
                .contains("expected disconnected accounts","not an error count");
    }

    @Test void lateReadFailureRetainsWholeSampleAndHeartbeatUntilBothJournalsRecover() {
        row("SENDING","a".repeat(64),300); metrics.refresh();
        double success = value("snapshot.last.success.timestamp.seconds");
        clock.add(Duration.ofMinutes(5));
        db.update("UPDATE baitly_accounting_exports SET state='UNKNOWN'");
        db.execute("DROP TABLE baitly_oauth_refresh_attempts");
        metrics.refresh();
        assertThat(value("snapshot.healthy")).isZero();
        assertThat(value("snapshot.last.success.timestamp.seconds")).isEqualTo(success);
        assertThat(value("accounting.inflight")).isEqualTo(1);
        assertThat(value("accounting.unknown")).isZero();
        db.execute("CREATE TABLE baitly_oauth_refresh_attempts (scope_hash varchar(64))");
        metrics.refresh();
        assertThat(value("snapshot.healthy")).isEqualTo(1);
        assertThat(value("snapshot.last.success.timestamp.seconds")).isGreaterThan(success);
        assertThat(value("accounting.inflight")).isZero();
        assertThat(value("accounting.unknown")).isEqualTo(1);
    }

    @Test void futureDatesAreClampedAndResolvedOrHistoricalRowsCannotLeaveStaleAge() {
        row("SENDING","a".repeat(64),-3600); metrics.refresh();
        assertThat(value("accounting.oldest.inflight.seconds")).isZero();
        db.update("UPDATE baitly_accounting_exports SET state='CONFIRMED'");
        row("UNKNOWN","0".repeat(64),99999); metrics.refresh();
        assertThat(value("accounting.inflight")).isZero();
        assertThat(value("accounting.oldest.inflight.seconds")).isZero();
        assertThat(value("accounting.oldest.unknown.seconds")).isZero();
    }

    @Test void unavailableMigrationDoesNotReportAHealthyZero() {
        db.execute("DROP TABLE baitly_accounting_exports"); metrics.refresh();
        assertThat(value("snapshot.healthy")).isZero();
        assertThat(value("snapshot.last.success.timestamp.seconds")).isZero();
    }

    @Test void prometheusExpositionMatchesRuleNamesWithoutJournalKeysOrCustomerLabels() {
        db.update("INSERT INTO baitly_oauth_refresh_attempts VALUES (?,?,CURRENT_TIMESTAMP)","e".repeat(64),UUID.randomUUID());
        var prometheus = new io.micrometer.prometheusmetrics.PrometheusMeterRegistry(io.micrometer.prometheusmetrics.PrometheusConfig.DEFAULT);
        try {
            new BaitlyRecoveryJournalMetrics(db,prometheus).refresh();
            String text = prometheus.scrape();
            for (String suffix : java.util.List.of("accounting_inflight","accounting_unknown","accounting_historical_review",
                    "accounting_oldest_inflight_seconds","accounting_oldest_unknown_seconds","oauth_blocked_scopes",
                    "snapshot_healthy","snapshot_last_success_timestamp_seconds")) {
                assertThat(text).contains("baitly_recovery_"+suffix);
            }
            assertThat(text).contains("baitly_recovery_oauth_blocked_scopes 1.0","baitly_recovery_snapshot_healthy 1.0")
                    .doesNotContain("e".repeat(64),"organization_id","scope_hash","attempt=");
        } finally { prometheus.close(); }
    }
}
