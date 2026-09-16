package com.clenzy.service;

import com.clenzy.repository.PaymentTransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.Query;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Exécute la requête du repository, avec un schéma réduit et isolé. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class InterventionPaymentCoordinationPostgresTest {
    @Test void paymentIntentCannotBeMissedAfterWaitingForMissionLock() throws Exception {
        String url = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String schema = "baitly_lock_" + UUID.randomUUID().toString().replace("-", "");
        try (var writer = java.sql.DriverManager.getConnection(url, user, "");
             var reader = java.sql.DriverManager.getConnection(url, user, "")) {
            try (var setup = writer.createStatement()) {
                setup.execute("CREATE SCHEMA " + schema);
                setup.execute("CREATE TABLE " + schema + ".interventions (id bigint PRIMARY KEY)");
                setup.execute("INSERT INTO " + schema + ".interventions VALUES (1)");
                setup.execute("CREATE TABLE " + schema + ".payment_transactions (organization_id bigint, source_type text, source_id bigint, status text, metadata jsonb)");
            }
            try {
                writer.setAutoCommit(false);
                reader.setAutoCommit(false);
                try (var write = writer.createStatement(); var read = reader.createStatement()) {
                    write.execute("SELECT id FROM " + schema + ".interventions WHERE id=1 FOR UPDATE");
                    write.execute("INSERT INTO " + schema + ".payment_transactions VALUES (7,'INTERVENTION',1,'PENDING',NULL)");
                    read.execute("SET LOCAL lock_timeout='200ms'");
                    assertThatThrownBy(() -> read.execute("SELECT id FROM " + schema + ".interventions WHERE id=1 FOR UPDATE"))
                            .isInstanceOf(java.sql.SQLException.class)
                            .satisfies(error -> assertThat(((java.sql.SQLException) error).getSQLState()).isEqualTo("55P03"));
                    reader.rollback();
                    writer.commit();
                    read.execute("SELECT id FROM " + schema + ".interventions WHERE id=1 FOR UPDATE");
                    read.execute("SET LOCAL search_path TO " + schema);
                    String query = PaymentTransactionRepository.class
                            .getMethod("hasRecordedInterventionPayment", Long.class, Long.class)
                            .getAnnotation(Query.class).value().replace(":orgId", "7").replace(":missionId", "1");
                    try (var rows = read.executeQuery(query)) {
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getBoolean(1)).isTrue();
                    }
                    reader.commit();
                }
            } finally {
                writer.rollback();
                reader.rollback();
                writer.setAutoCommit(true);
                try (var cleanup = writer.createStatement()) { cleanup.execute("DROP SCHEMA " + schema + " CASCADE"); }
            }
        }
    }

    @Test void detectsIndividualAndSecondaryBatchMembersWithoutCrossOrganizationMatches() throws Exception {
        var source = new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),
                System.getProperty("baitly.test.user", "postgres"), "", true);
        var jdbc = new JdbcTemplate(source);
        var named = new NamedParameterJdbcTemplate(source);
        String schema = "baitly_payment_" + UUID.randomUUID().toString().replace("-", "");
        String query = PaymentTransactionRepository.class
                .getMethod("hasRecordedInterventionPayment", Long.class, Long.class)
                .getAnnotation(Query.class).value();
        try {
            jdbc.execute("CREATE SCHEMA " + schema);
            jdbc.execute("SET search_path TO " + schema);
            jdbc.execute("CREATE TABLE payment_transactions (organization_id bigint, source_type text, source_id bigint, status text, metadata jsonb)");
            for (String type : new String[]{"INTERVENTION", DeferredPaymentService.SOURCE_TYPE_HOST,
                    DeferredPaymentService.SOURCE_TYPE_PROPERTY}) {
                jdbc.execute("TRUNCATE payment_transactions");
                String key = type.equals("INTERVENTION") ? "interventionIds" : "intervention_ids";
                jdbc.update("INSERT INTO payment_transactions VALUES (7, ?, 99, 'PENDING', CAST(? AS jsonb))",
                        type, "{\"" + key + "\":\"11, 2,3\"}");
                assertThat(named.queryForObject(query, Map.of("orgId", 7L, "missionId", 2L), Boolean.class)).isTrue();
                assertThat(named.queryForObject(query, Map.of("orgId", 8L, "missionId", 2L), Boolean.class)).isFalse();
                assertThat(named.queryForObject(query, Map.of("orgId", 7L, "missionId", 1L), Boolean.class)).isFalse();
                assertThat(named.queryForObject(query, Map.of("orgId", 7L, "missionId", 99L), Boolean.class))
                        .isEqualTo(type.equals("INTERVENTION"));
                jdbc.execute("UPDATE payment_transactions SET status='COMPLETED'");
                assertThat(named.queryForObject(query, Map.of("orgId", 7L, "missionId", 2L), Boolean.class)).isTrue();
                jdbc.execute("UPDATE payment_transactions SET status='FAILED'");
                assertThat(named.queryForObject(query, Map.of("orgId", 7L, "missionId", 2L), Boolean.class)).isFalse();
            }
            jdbc.execute("INSERT INTO payment_transactions VALUES (7, 'INTERVENTION', 1, 'PROCESSING', NULL)");
            assertThat(named.queryForObject(query, Map.of("orgId", 7L, "missionId", 1L), Boolean.class)).isTrue();
        } finally {
            jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            source.destroy();
        }
    }
}
