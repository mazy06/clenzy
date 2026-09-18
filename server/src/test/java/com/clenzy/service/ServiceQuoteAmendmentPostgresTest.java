package com.clenzy.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.assertj.core.api.Assertions.*;

/** Exécute le changeset réel dans un schéma isolé avec références réduites. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class ServiceQuoteAmendmentPostgresTest {
    @Test void onlyOnePendingProposalAndDecisionMetadataRequired() throws Exception {
        var source = new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),
                System.getProperty("baitly.test.user", "postgres"), "", true);
        var jdbc = new JdbcTemplate(source);
        String schema = "baitly_amendment_" + java.util.UUID.randomUUID().toString().replace("-", "");
        try {
            jdbc.execute("CREATE SCHEMA " + schema);
            jdbc.execute("SET search_path TO " + schema);
            for (String table : java.util.List.of("service_quotes", "interventions", "users")) {
                jdbc.execute("CREATE TABLE " + table + " (id bigint PRIMARY KEY)");
                jdbc.execute("INSERT INTO " + table + " VALUES (1)");
            }
            try (var sql = getClass().getResourceAsStream("/db/changelog/changes/0442__service_quote_amendments.sql")) {
                jdbc.execute(new String(sql.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
            }
            String insert = "INSERT INTO service_quote_amendments (organization_id,quote_id,intervention_id,proposed_by,original_amount,proposed_amount,currency,reason,created_at) VALUES (7,1,1,1,120,150,'EUR','Travaux',now())";
            jdbc.execute(insert);
            assertThatThrownBy(() -> jdbc.execute(insert)).isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
            assertThatThrownBy(() -> jdbc.execute("UPDATE service_quote_amendments SET status='REJECTED'"))
                    .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            jdbc.execute("UPDATE service_quote_amendments SET status='REJECTED', decided_by=1, decided_at=now()");
            jdbc.execute(insert);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM service_quote_amendments", Integer.class)).isEqualTo(2);
            assertThatThrownBy(() -> jdbc.execute("UPDATE service_quote_amendments SET proposed_amount=original_amount WHERE status='PROPOSED'"))
                    .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        } finally {
            jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            source.destroy();
        }
    }
}
