package com.clenzy.marketplace.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class MarketplaceRetentionPostgresTest {
    @Test void migrationRejectsIncompleteHoldsAndIndexesOnlyEligibleRefusals() throws Exception {
        var source = new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),
            System.getProperty("baitly.test.user", "postgres"), "", true);
        var jdbc = new JdbcTemplate(source);
        String schema = "baitly_retention_" + java.util.UUID.randomUUID().toString().replace("-", "");
        try {
            jdbc.execute("CREATE SCHEMA " + schema); jdbc.execute("SET search_path TO " + schema);
            jdbc.execute("CREATE TABLE marketplace_providers (id bigint PRIMARY KEY, user_id bigint, status varchar(30), decision_sent_at timestamp)");
            try (var sql = getClass().getResourceAsStream("/db/changelog/changes/0457__marketplace_application_retention.sql")) {
                jdbc.execute(new String(sql.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
            }
            jdbc.execute("INSERT INTO marketplace_providers(id,status,decision_sent_at) VALUES (1,'REJECTED',CURRENT_TIMESTAMP - INTERVAL '91 days')");
            assertThatThrownBy(() -> jdbc.execute("UPDATE marketplace_providers SET retention_hold_reason='litige'"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            jdbc.execute("UPDATE marketplace_providers SET retention_hold_reason='litige',retention_hold_review_at=CURRENT_TIMESTAMP,retention_hold_actor='manager'");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM marketplace_providers WHERE status='REJECTED' AND user_id IS NULL AND retention_hold_reason IS NULL AND decision_sent_at<=CURRENT_TIMESTAMP-INTERVAL '90 days'", Integer.class)).isZero();
            assertThatThrownBy(() -> jdbc.execute("UPDATE marketplace_providers SET retention_hold_reason=' '"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        } finally { jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE"); source.destroy(); }
    }
}
