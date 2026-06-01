package com.clenzy.config.health;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.actuate.health.Health;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link LiquibaseHealthIndicator} avec un JdbcTemplate
 * mocke (pas de DB reelle, pas de Testcontainers).
 *
 * <p>Le test d'integration historique est marque @Disabled. Ces tests unitaires
 * couvrent la totalite des branches sans dependance externe.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("LiquibaseHealthIndicator (unit)")
class LiquibaseHealthIndicatorUnitTest {

    @Mock private JdbcTemplate jdbcTemplate;

    private LiquibaseHealthIndicator indicator(boolean liquibaseEnabled) {
        return new LiquibaseHealthIndicator(jdbcTemplate, 300L, liquibaseEnabled);
    }

    private LiquibaseHealthIndicator indicator(boolean liquibaseEnabled, long threshold) {
        return new LiquibaseHealthIndicator(jdbcTemplate, threshold, liquibaseEnabled);
    }

    @Test
    @DisplayName("UP not configured when liquibase disabled and table missing")
    void upNotConfigured_whenLiquibaseDisabled() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class))).thenReturn(false);

        Health health = indicator(false).health();

        assertThat(health.getStatus().getCode()).isEqualTo("UP");
        assertThat(health.getDetails().get("status")).isEqualTo("not configured");
        assertThat(health.getDetails().get("interpretation"))
            .asString()
            .contains("spring.liquibase.enabled=false");
    }

    @Test
    @DisplayName("DOWN when liquibase enabled but databasechangelog table missing")
    void down_whenLiquibaseEnabledAndTableMissing() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class))).thenReturn(false);

        Health health = indicator(true).health();

        assertThat(health.getStatus().getCode()).isEqualTo("DOWN");
        assertThat(health.getDetails().get("reason"))
            .isEqualTo("databasechangelog table does not exist");
        assertThat(health.getDetails().get("interpretation"))
            .asString()
            .contains("Liquibase is enabled");
    }

    @Test
    @DisplayName("UP with stats when table present, no lock held")
    void up_whenUnlocked() {
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class))).thenReturn(true);
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class))).thenReturn(42);
        Timestamp ts = Timestamp.valueOf(LocalDateTime.of(2025, 1, 15, 12, 30));
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Timestamp.class))).thenReturn(ts);

        Map<String, Object> lockRow = new HashMap<>();
        lockRow.put("locked", Boolean.FALSE);
        lockRow.put("lockgranted", null);
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of(lockRow));

        Health health = indicator(true).health();

        assertThat(health.getStatus().getCode()).isEqualTo("UP");
        assertThat(health.getDetails().get("trackedChangesets")).isEqualTo(42);
        assertThat(health.getDetails().get("locked")).isEqualTo(false);
        assertThat(health.getDetails().get("lastExecuted"))
            .asString()
            .contains("2025-01-15");
    }

    @Test
    @DisplayName("UP when lock is held but recent (< threshold)")
    void up_whenLockIsRecent() {
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class))).thenReturn(true);
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class))).thenReturn(5);
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Timestamp.class))).thenReturn(null);

        Map<String, Object> lockRow = new HashMap<>();
        lockRow.put("locked", Boolean.TRUE);
        lockRow.put("lockgranted", Timestamp.from(Instant.now().minusSeconds(10)));
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of(lockRow));

        Health health = indicator(true).health();

        assertThat(health.getStatus().getCode()).isEqualTo("UP");
        assertThat(health.getDetails().get("locked")).isEqualTo(true);
    }

    @Test
    @DisplayName("DOWN when lock is stale (> threshold)")
    void down_whenLockIsStale() {
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class))).thenReturn(true);
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class))).thenReturn(100);
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Timestamp.class))).thenReturn(null);

        Map<String, Object> lockRow = new HashMap<>();
        lockRow.put("locked", Boolean.TRUE);
        lockRow.put("lockgranted", Timestamp.from(Instant.now().minusSeconds(600))); // 10 min ago
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of(lockRow));

        Health health = indicator(true, 300L).health();

        assertThat(health.getStatus().getCode()).isEqualTo("DOWN");
        assertThat(health.getDetails().get("reason")).isEqualTo("Stale Liquibase lock detected");
        assertThat((long) health.getDetails().get("lockHeldForSeconds")).isGreaterThan(300L);
        assertThat(health.getDetails().get("thresholdSeconds")).isEqualTo(300L);
        assertThat(health.getDetails().get("interpretation"))
            .asString()
            .contains("UPDATE databasechangeloglock");
    }

    @Test
    @DisplayName("DOWN when lock row for id=1 is missing (table corrupted)")
    void down_whenLockRowMissing() {
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class))).thenReturn(true);
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class))).thenReturn(0);
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Timestamp.class))).thenReturn(null);
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of());

        Health health = indicator(true).health();

        assertThat(health.getStatus().getCode()).isEqualTo("DOWN");
        assertThat(health.getDetails().get("reason"))
            .asString().contains("databasechangeloglock has no row for id=1");
        assertThat(health.getDetails().get("interpretation"))
            .asString()
            .contains("INSERT INTO databasechangeloglock");
    }

    @Test
    @DisplayName("DOWN when an unexpected exception occurs (DB error swallowed)")
    void down_whenJdbcExceptionThrown() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class)))
            .thenThrow(new RuntimeException("boom"));

        Health health = indicator(true).health();

        assertThat(health.getStatus().getCode()).isEqualTo("DOWN");
        assertThat(health.getDetails().get("error")).isEqualTo("RuntimeException");
        assertThat(health.getDetails().get("message")).isEqualTo("boom");
    }

    @Test
    @DisplayName("UP with locked=true and no lockgranted set (locked but unknown time)")
    void up_whenLockedButNoLockGrantedTimestamp() {
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class))).thenReturn(true);
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class))).thenReturn(7);
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Timestamp.class))).thenReturn(null);

        Map<String, Object> lockRow = new HashMap<>();
        lockRow.put("locked", Boolean.TRUE);
        lockRow.put("lockgranted", null);
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of(lockRow));

        Health health = indicator(true).health();

        // No timestamp → stale check skipped → still UP
        assertThat(health.getStatus().getCode()).isEqualTo("UP");
        assertThat(health.getDetails().get("locked")).isEqualTo(true);
    }

    @Test
    @DisplayName("UP with null count and null lastExecuted defaults to 0 / 'n/a'")
    void up_whenNullCountAndLastExec() {
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class))).thenReturn(true);
        // Pas de stub Integer / Timestamp -> renvoient null par defaut Mockito
        Map<String, Object> lockRow = new HashMap<>();
        lockRow.put("locked", Boolean.FALSE);
        lockRow.put("lockgranted", null);
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of(lockRow));

        Health health = indicator(true).health();

        assertThat(health.getStatus().getCode()).isEqualTo("UP");
        assertThat(health.getDetails().get("trackedChangesets")).isEqualTo(0);
        assertThat(health.getDetails().get("lastExecuted")).isEqualTo("n/a");
    }
}
