package com.clenzy.marketplace.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class MarketplaceAvailabilityBridgePostgresTest {
    @Test void catalogAndAssignmentUseTheSameWeeklySourceWithoutLeakingOtherTenants() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String schema = "availability_bridge_" + suffix;
        String role = "availability_reader_" + suffix;
        try (var c = DriverManager.getConnection(System.getProperty("baitly.test.jdbc"),
                System.getProperty("baitly.test.user", "postgres"), ""); var sql = c.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            sql.execute("CREATE ROLE " + role + " NOLOGIN NOSUPERUSER NOBYPASSRLS");
            try {
                sql.execute("SET search_path TO " + schema);
                sql.execute("CREATE TABLE teams (id bigint PRIMARY KEY, personal_user_id bigint, organization_id bigint)");
                sql.execute("CREATE TABLE team_weekly_availability (team_id bigint, day_of_week smallint, start_time time, end_time time, organization_id bigint)");
                sql.execute("CREATE TABLE team_absences (team_id bigint, start_date date, end_date date, organization_id bigint)");
                sql.execute("CREATE TABLE marketplace_providers (id bigint PRIMARY KEY, user_id bigint)");
                sql.execute("CREATE TABLE marketplace_provider_availability (provider_id bigint, day_of_week smallint, start_time time, end_time time)");
                sql.execute("INSERT INTO marketplace_providers VALUES (1,11),(2,NULL),(3,33),(4,44)");
                sql.execute("INSERT INTO marketplace_provider_availability VALUES (1,1,'09:00','17:00'),(2,1,'09:00','17:00'),(4,1,'09:00','17:00')");
                sql.execute("INSERT INTO teams VALUES (10,44,7),(11,44,8)");
                sql.execute("INSERT INTO team_weekly_availability VALUES (10,2,'09:00','12:00',7),(11,2,'13:00','17:00',8)");
                for (String file : new String[]{"0444__team_declared_availability.sql", "0445__individual_declared_availability.sql", "0448__marketplace_effective_availability.sql"})
                    sql.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes", file)).replace("public", schema));
                // Sans équipe PMS, la candidature limite déjà l'attribution individuelle.
                assertThat(verdict(sql, "baitly_user_declared_available(11, timestamp '2026-09-14 08:00', timestamp '2026-09-14 10:00')")).isFalse();
                assertThat(verdict(sql, "baitly_user_declared_available(11, timestamp '2026-09-14 09:00', timestamp '2026-09-14 17:00')")).isTrue();
                assertThat(verdict(sql, "baitly_provider_available_on_day(2, 1)")).isTrue();
                assertThat(verdict(sql, "baitly_provider_available_on_day(2, 2)")).isFalse();
                assertThat(verdict(sql, "baitly_provider_available_on_day(3, 7)")).isTrue();
                assertThat(verdict(sql, "baitly_provider_available_on_day(3, 8)")).isFalse();
                assertThat(verdict(sql, "baitly_provider_available_on_day(999, 1)")).isFalse();
                // Deux calendriers personnels sans intersection ne rendent pas la personne disponible.
                assertThat(verdict(sql, "baitly_provider_available_on_day(4, 1)")).isFalse();
                assertThat(verdict(sql, "baitly_provider_available_on_day(4, 2)")).isFalse();
                assertThat(verdict(sql, "baitly_team_declared_available(10, timestamp '2026-09-15 09:00', timestamp '2026-09-15 10:00')")).isFalse();
                sql.execute("UPDATE team_weekly_availability SET start_time='11:00' WHERE team_id=11");
                assertThat(verdict(sql, "baitly_provider_available_on_day(4, 2)")).isTrue();
                // Une semaine PMS vidée explicitement signifie disponible, sans résurrection de la candidature.
                sql.execute("DELETE FROM team_weekly_availability");
                assertThat(verdict(sql, "baitly_provider_available_on_day(4, 7)")).isTrue();
                sql.execute("INSERT INTO team_absences VALUES (10,'2026-09-15','2026-09-15',7)");
                for (String table : new String[]{"teams", "team_weekly_availability", "team_absences"}) {
                    sql.execute("ALTER TABLE " + table + " ENABLE ROW LEVEL SECURITY");
                    sql.execute("CREATE POLICY tenant_scope ON " + table + " USING (current_setting('app.bypass_rls',true)='on' OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint)");
                }
                sql.execute("GRANT USAGE ON SCHEMA " + schema + " TO " + role);
                sql.execute("GRANT SELECT ON ALL TABLES IN SCHEMA " + schema + " TO " + role);
                sql.execute("SET ROLE " + role); sql.execute("SET app.current_org='99'"); sql.execute("SET app.bypass_rls='off'");
                assertThat(verdict(sql, "baitly_provider_available_on_day(4, 2)")).isTrue(); // filtre semaine, pas absence datée
                assertThat(verdict(sql, "baitly_user_declared_available(44, timestamp '2026-09-15 09:00', timestamp '2026-09-15 10:00')")).isFalse();
                assertThat(verdict(sql, "baitly_team_declared_available(11, timestamp '2026-09-15 09:00', timestamp '2026-09-15 10:00')")).isFalse();
                try (var rows = sql.executeQuery("SELECT count(*), current_setting('app.bypass_rls') FROM team_absences")) {
                    rows.next(); assertThat(rows.getLong(1)).isZero(); assertThat(rows.getString(2)).isEqualTo("off");
                }
            } finally {
                sql.execute("RESET ROLE"); sql.execute("DROP SCHEMA " + schema + " CASCADE"); sql.execute("DROP ROLE " + role);
            }
        }
    }
    private boolean verdict(Statement sql, String expression) throws Exception {
        try (var rows = sql.executeQuery("SELECT " + expression)) { rows.next(); return rows.getBoolean(1); }
    }
}
