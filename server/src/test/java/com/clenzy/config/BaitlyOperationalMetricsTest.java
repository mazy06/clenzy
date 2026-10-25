package com.clenzy.config;

import io.micrometer.core.instrument.MockClock;
import io.micrometer.core.instrument.simple.SimpleConfig;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class BaitlyOperationalMetricsTest {
    JdbcTemplate jdbc;
    MockClock clock;
    SimpleMeterRegistry registry;
    BaitlyOperationalMetrics metrics;

    @BeforeEach void setup() {
        jdbc = new JdbcTemplate(new DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", ""));
        jdbc.execute("CREATE TABLE outbox_events (status varchar, retry_count int, topic varchar, created_at timestamp)");
        jdbc.execute("CREATE TABLE webhook_deliveries (status varchar, next_attempt_at timestamp with time zone, created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP)");
        jdbc.execute("CREATE TABLE webhook_configs (status varchar)");
        clock = new MockClock();
        registry = new SimpleMeterRegistry(SimpleConfig.DEFAULT, clock);
        metrics = new BaitlyOperationalMetrics(jdbc, registry);
    }

    double value(String suffix) {return registry.get("baitly.ops." + suffix).gauge().value();}

    @Test void emptyQueuesAreHealthyOnlyAfterSuccessfulRefresh() {
        assertThat(value("snapshot.healthy")).isZero();
        assertThat(value("snapshot.last.success.timestamp.seconds")).isZero();
        metrics.refresh();
        assertThat(value("snapshot.healthy")).isEqualTo(1);
        assertThat(value("snapshot.last.success.timestamp.seconds")).isGreaterThan(0);
        assertThat(value("outbox.pending")).isZero();
        assertThat(value("outbox.oldest.age.seconds")).isZero();
        assertThat(value("webhooks.oldest.overdue.seconds")).isZero();
    }

    @Test void detectsBacklogsWithoutMistakingUnlimitedAssignmentRetriesForLostEvents() {
        Timestamp old = Timestamp.from(Instant.now().minusSeconds(1200));
        jdbc.update("INSERT INTO outbox_events VALUES ('PENDING',0,'calendar.updates',?)", old);
        jdbc.update("INSERT INTO outbox_events VALUES ('FAILED',4,'calendar.updates',?)", old);
        jdbc.update("INSERT INTO outbox_events VALUES ('FAILED',5,'calendar.updates',?)", old);
        jdbc.update("INSERT INTO outbox_events VALUES ('FAILED',99,'baitly.assignment.jobs',?)", old);
        jdbc.update("INSERT INTO outbox_events VALUES ('SENT',0,'calendar.updates',?)", Timestamp.from(Instant.now().minusSeconds(99999)));
        jdbc.update("INSERT INTO webhook_deliveries (status,next_attempt_at) VALUES ('PENDING',?)", Timestamp.from(Instant.now().minusSeconds(700)));
        jdbc.update("INSERT INTO webhook_deliveries (status,next_attempt_at) VALUES ('RETRYING',?)", Timestamp.from(Instant.now().plusSeconds(3600)));
        jdbc.update("INSERT INTO webhook_deliveries (status,next_attempt_at) VALUES ('FAILED',?)", old);
        jdbc.update("INSERT INTO webhook_configs VALUES ('FAILED'), ('ACTIVE')");
        metrics.refresh();
        assertThat(value("outbox.pending")).isEqualTo(1);
        assertThat(value("outbox.retryable")).isEqualTo(2);
        assertThat(value("outbox.exhausted")).isEqualTo(1);
        assertThat(value("outbox.oldest.age.seconds")).isBetween(1190.0, 1220.0);
        assertThat(value("webhooks.overdue")).isEqualTo(1);
        assertThat(value("webhooks.oldest.overdue.seconds")).isBetween(690.0, 720.0);
        assertThat(value("webhooks.disabled")).isEqualTo(1);
        assertThat(registry.getMeters()).allSatisfy(meter -> assertThat(meter.getId().getTags()).isEmpty());
    }

    @Test void missingRetryScheduleCannotHideAnUnprocessedWebhook() {
        jdbc.update("INSERT INTO webhook_deliveries (status,created_at) VALUES ('PENDING',?)",
                Timestamp.from(Instant.now().minusSeconds(900)));
        metrics.refresh();
        assertThat(value("webhooks.overdue")).isEqualTo(1);
        assertThat(value("webhooks.oldest.overdue.seconds")).isBetween(890.0, 920.0);
    }

    @Test void databaseFailureKeepsLastSampleButMarksItUnhealthyAndDoesNotAdvanceHeartbeat() {
        jdbc.update("INSERT INTO outbox_events VALUES ('PENDING',0,'topic',CURRENT_TIMESTAMP)");
        metrics.refresh();
        double previousSuccess = value("snapshot.last.success.timestamp.seconds");
        clock.add(Duration.ofMinutes(5));
        jdbc.execute("DROP TABLE webhook_deliveries");
        metrics.refresh();
        assertThat(value("snapshot.healthy")).isZero();
        assertThat(value("outbox.pending")).isEqualTo(1);
        assertThat(value("snapshot.last.success.timestamp.seconds")).isEqualTo(previousSuccess);
    }
}
