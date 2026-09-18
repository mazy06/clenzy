package com.clenzy.marketplace.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.DriverManager;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** SQL réel de production, contraintes et transaction d'avancement sur PostgreSQL isolé. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class MarketplaceRecurrencePostgresTest {
    @Test void migrationAndRollbackProtectTheOccurrence() throws Exception {
        String schema = "recurrence_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = DriverManager.getConnection(System.getProperty("baitly.test.jdbc"),
                System.getProperty("baitly.test.user", "postgres"), ""); var sql = connection.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            try {
                sql.execute("SET search_path TO " + schema);
                for (String table : new String[]{"marketplace_quote_requests", "organizations", "users", "service_requests", "marketplace_providers", "interventions"}) {
                    sql.execute("CREATE TABLE " + table + " (id bigint PRIMARY KEY)");
                    sql.execute("INSERT INTO " + table + " VALUES (1)");
                }
                sql.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes/0446__marketplace_recurrences.sql")));
                sql.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes/0447__marketplace_reviews.sql")));
                sql.execute("INSERT INTO marketplace_reviews VALUES (1,1,1,1,1,5,'Avis réel',CURRENT_TIMESTAMP)");
                assertThatThrownBy(() -> sql.execute("INSERT INTO marketplace_reviews VALUES (1,1,1,1,1,4,NULL,CURRENT_TIMESTAMP)"))
                        .isInstanceOf(java.sql.SQLException.class);
                assertThatThrownBy(() -> sql.execute("UPDATE marketplace_reviews SET rating = 0"))
                        .isInstanceOf(java.sql.SQLException.class);
                sql.execute("INSERT INTO marketplace_recurrences (quote_request_id, organization_id, consent_owner_id, enabled, anchor_date, interval_unit, interval_count, lead_days, next_date) "
                        + "VALUES (1,1,1,true,'2026-10-01','MONTHS',12,14,'2026-10-01')");
                try (var rows = sql.executeQuery("SELECT quote_request_id FROM marketplace_recurrences WHERE enabled AND next_date - lead_days <= DATE '2026-09-17'")) {
                    assertThat(rows.next()).isTrue(); assertThat(rows.getLong(1)).isEqualTo(1);
                }
                assertThatThrownBy(() -> sql.execute("UPDATE marketplace_recurrences SET interval_count = 0"))
                        .isInstanceOf(java.sql.SQLException.class);
                connection.setAutoCommit(false);
                sql.execute("INSERT INTO service_requests VALUES (2)");
                sql.execute("UPDATE marketplace_recurrences SET next_date = '2027-10-01', last_request_id = 2");
                connection.rollback(); connection.setAutoCommit(true);
                try (var rows = sql.executeQuery("SELECT next_date, last_request_id FROM marketplace_recurrences")) {
                    assertThat(rows.next()).isTrue(); assertThat(rows.getString(1)).isEqualTo("2026-10-01");
                    assertThat(rows.getObject(2)).isNull();
                }
            } finally { sql.execute("DROP SCHEMA " + schema + " CASCADE"); }
        }
    }
}
