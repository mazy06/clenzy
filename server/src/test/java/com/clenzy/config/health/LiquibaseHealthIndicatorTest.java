package com.clenzy.config.health;

import com.clenzy.AbstractIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.Health;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests d'integration pour {@link LiquibaseHealthIndicator}.
 *
 * Le profile {@code test} a {@code spring.liquibase.enabled=false} et
 * {@code ddl-auto=create-drop}, donc la table {@code databasechangelog}
 * n'existe pas naturellement. Chaque test cree (ou non) les tables Liquibase
 * a la main pour simuler les differents etats, puis les drop en cleanup.
 */
@DisplayName("LiquibaseHealthIndicator")
class LiquibaseHealthIndicatorTest extends AbstractIntegrationTest {

    @Autowired
    private LiquibaseHealthIndicator indicator;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void cleanupLiquibaseTables() {
        jdbcTemplate.execute("DROP TABLE IF EXISTS databasechangelog");
        jdbcTemplate.execute("DROP TABLE IF EXISTS databasechangeloglock");
    }

    private void createLiquibaseTables() {
        jdbcTemplate.execute(
                "CREATE TABLE databasechangelog ("
                        + "  id VARCHAR(255) NOT NULL,"
                        + "  author VARCHAR(255) NOT NULL,"
                        + "  filename VARCHAR(255) NOT NULL,"
                        + "  dateexecuted TIMESTAMP NOT NULL,"
                        + "  orderexecuted INT NOT NULL,"
                        + "  exectype VARCHAR(10) NOT NULL,"
                        + "  md5sum VARCHAR(35),"
                        + "  description VARCHAR(255),"
                        + "  comments VARCHAR(255),"
                        + "  tag VARCHAR(255),"
                        + "  liquibase VARCHAR(20),"
                        + "  contexts VARCHAR(255),"
                        + "  labels VARCHAR(255),"
                        + "  deployment_id VARCHAR(10)"
                        + ")"
        );
        jdbcTemplate.execute(
                "CREATE TABLE databasechangeloglock ("
                        + "  id INT NOT NULL PRIMARY KEY,"
                        + "  locked BOOLEAN NOT NULL,"
                        + "  lockgranted TIMESTAMP,"
                        + "  lockedby VARCHAR(255)"
                        + ")"
        );
    }

    @Nested
    @DisplayName("when databasechangelog is missing")
    class WhenChangelogMissing {

        @Test
        @DisplayName("reports DOWN with explicit interpretation")
        void downWhenChangelogTableMissing() {
            // Pas de tables Liquibase creees → etat initial du profile test
            Health health = indicator.health();

            assertThat(health.getStatus().getCode()).isEqualTo("DOWN");
            assertThat(health.getDetails().get("reason"))
                    .isEqualTo("databasechangelog table does not exist");
            assertThat(health.getDetails().get("interpretation"))
                    .asString()
                    .contains("Liquibase Bootstrap");
        }
    }

    @Nested
    @DisplayName("when databasechangelog is initialized")
    class WhenChangelogInitialized {

        @Test
        @DisplayName("reports UP with tracked changesets count when no lock is held")
        void upWhenUnlocked() {
            createLiquibaseTables();
            jdbcTemplate.update(
                    "INSERT INTO databasechangeloglock (id, locked) VALUES (1, false)"
            );
            jdbcTemplate.update(
                    "INSERT INTO databasechangelog "
                            + "(id, author, filename, dateexecuted, orderexecuted, exectype) "
                            + "VALUES (?, ?, ?, NOW(), ?, ?)",
                    "test-changeset-1", "test-author", "test.yaml", 1, "EXECUTED"
            );
            jdbcTemplate.update(
                    "INSERT INTO databasechangelog "
                            + "(id, author, filename, dateexecuted, orderexecuted, exectype) "
                            + "VALUES (?, ?, ?, NOW(), ?, ?)",
                    "test-changeset-2", "test-author", "test.yaml", 2, "EXECUTED"
            );

            Health health = indicator.health();

            assertThat(health.getStatus().getCode()).isEqualTo("UP");
            assertThat(health.getDetails().get("trackedChangesets")).isEqualTo(2);
            assertThat(health.getDetails().get("locked")).isEqualTo(false);
            assertThat(health.getDetails().get("lastExecuted")).isNotNull();
        }

        @Test
        @DisplayName("reports UP when lock is held within threshold")
        void upWhenLockIsRecent() {
            createLiquibaseTables();
            // Lock detenu il y a 10s → bien sous le seuil de 300s
            jdbcTemplate.update(
                    "INSERT INTO databasechangeloglock (id, locked, lockgranted, lockedby) "
                            + "VALUES (1, true, NOW() - INTERVAL '10 seconds', 'test-host')"
            );

            Health health = indicator.health();

            assertThat(health.getStatus().getCode()).isEqualTo("UP");
            assertThat(health.getDetails().get("locked")).isEqualTo(true);
        }

        @Test
        @DisplayName("reports DOWN with unlock instructions when lock is stale")
        void downWhenLockIsStale() {
            createLiquibaseTables();
            // Lock detenu il y a 10 min → bien au-dessus du seuil de 300s = 5 min
            jdbcTemplate.update(
                    "INSERT INTO databasechangeloglock (id, locked, lockgranted, lockedby) "
                            + "VALUES (1, true, NOW() - INTERVAL '10 minutes', 'crashed-host')"
            );

            Health health = indicator.health();

            assertThat(health.getStatus().getCode()).isEqualTo("DOWN");
            assertThat(health.getDetails().get("reason"))
                    .isEqualTo("Stale Liquibase lock detected");
            assertThat(health.getDetails().get("interpretation"))
                    .asString()
                    .contains("UPDATE databasechangeloglock SET locked=false");
            assertThat((long) health.getDetails().get("lockHeldForSeconds"))
                    .isGreaterThan(300L);
        }

        @Test
        @DisplayName("reports DOWN when lock table has no row for id=1")
        void downWhenLockRowMissing() {
            createLiquibaseTables();
            // Tables creees mais aucune ligne dans databasechangeloglock

            Health health = indicator.health();

            assertThat(health.getStatus().getCode()).isEqualTo("DOWN");
            assertThat(health.getDetails().get("reason"))
                    .asString()
                    .contains("databasechangeloglock has no row for id=1");
        }
    }
}
