package com.clenzy.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class ServiceQuoteCancellationPostgresTest {
    @Test void realMigrationKeepsOneDecisionAndRequiresItsReasonAndExistingAgreement() throws Exception {
        var source = new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),
                System.getProperty("baitly.test.user", "postgres"), "", true);
        var jdbc = new JdbcTemplate(source);
        String schema = "baitly_cancellation_" + java.util.UUID.randomUUID().toString().replace("-", "");
        try {
            jdbc.execute("CREATE SCHEMA " + schema);
            jdbc.execute("SET search_path TO " + schema);
            for (String table : java.util.List.of("service_quotes", "interventions")) {
                jdbc.execute("CREATE TABLE " + table + " (id bigint PRIMARY KEY)");
                jdbc.execute("INSERT INTO " + table + " VALUES (1)");
            }
            try (var sql = getClass().getResourceAsStream("/db/changelog/changes/0456__service_quote_cancellations.sql")) {
                jdbc.execute(new String(sql.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
            }
            String insert = "INSERT INTO service_quote_cancellations VALUES (1,7,1,'manager','Motif',now(),150,'EUR')";
            jdbc.execute(insert);
            assertThatThrownBy(() -> jdbc.execute(insert)).isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
            assertThatThrownBy(() -> jdbc.execute("UPDATE service_quote_cancellations SET reason=' '"))
                    .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbc.execute("UPDATE service_quote_cancellations SET quote_id=2"))
                    .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThat(jdbc.queryForObject("SELECT reason FROM service_quote_cancellations", String.class)).isEqualTo("Motif");
            jdbc.execute("CREATE TABLE marketplace_quote_requests (id bigint PRIMARY KEY)");
            try (var sql = getClass().getResourceAsStream("/db/changelog/changes/0458__service_quote_replacements.sql")) {
                jdbc.execute(new String(sql.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
            }
            jdbc.execute("UPDATE service_quote_cancellations SET intervention_id=NULL");
            jdbc.execute("INSERT INTO marketplace_quote_requests(id,replaces_quote_id,requested_start_time,requested_duration_minutes) VALUES(10,1,'14:30',90)");
            assertThatThrownBy(() -> jdbc.execute("UPDATE marketplace_quote_requests SET replaces_quote_id=2"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbc.execute("UPDATE marketplace_quote_requests SET requested_duration_minutes=0"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        } finally {
            jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            source.destroy();
        }
    }
}
