package com.clenzy.service;

import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Migration exacte et requête de reprise exécutées sur PostgreSQL, dans un schéma jetable. */
@EnabledIfSystemProperty(named="baitly.test.jdbc", matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class RefundCreditNoteLiquibaseTest {
    @Test void migrationPreservesHistoryEnforcesTenantLinksAndResumesMissingDocuments() throws Exception {
        String url = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String schema = "baitly_notes_" + UUID.randomUUID().toString().replace("-", "");
        String scoped = url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema;
        try (var admin=DriverManager.getConnection(url,user,""); var sql=admin.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            try {
                sql.execute("SET search_path TO " + schema);
                sql.execute("CREATE TABLE payment_transactions(id bigint PRIMARY KEY, organization_id bigint NOT NULL, transaction_ref varchar(100), payment_type varchar(30), status varchar(30), provider_type varchar(30), source_type varchar(50), source_id bigint, metadata jsonb, updated_at timestamp, UNIQUE(id,organization_id))");
                sql.execute("CREATE TABLE invoices(id bigint PRIMARY KEY, organization_id bigint NOT NULL, status varchar(30), total_ttc numeric(12,2), duplicate_of_id bigint, intervention_id bigint)");
                sql.execute("INSERT INTO invoices VALUES(1,7,'PAID',45,NULL,364),(2,8,'PAID',45,NULL,365),(3,7,'CREDIT_NOTE',-10,NULL,NULL)");
                sql.execute("INSERT INTO payment_transactions VALUES(41,7,'REF-test','REFUND','COMPLETED','STRIPE','INTERVENTION',364,'{\"managedRefund\":true}',now()),(42,8,'REF-other','REFUND','COMPLETED','STRIPE','INTERVENTION',365,'{\"managedRefund\":true}',now()),(43,7,'REF-pending','REFUND','PROCESSING','STRIPE','INTERVENTION',364,'{\"managedRefund\":true}',now()),(44,7,'REF-legacy','REFUND','COMPLETED','STRIPE','INTERVENTION',364,'{}',now()),(45,7,'REF-late','REFUND','COMPLETED','STRIPE','INTERVENTION',366,'{\"managedRefund\":true}',now())");
                for (int pass=0;pass<2;pass++) {
                    try (var connection=DriverManager.getConnection(scoped,user,"")) {
                        var database=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
                        var resources=new ClassLoaderResourceAccessor();
                        try (var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,database)) {
                            var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                            selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream()
                                .filter(c->c.getId().equals("0503-refund-credit-note-links")).findFirst().orElseThrow());
                            new Liquibase(selected,resources,database).update("");
                        }
                    }
                }
                assertThat(count(sql,"SELECT count(*) FROM databasechangelog WHERE id='0503-refund-credit-note-links'")).isEqualTo(1);
                assertThat(count(sql,"SELECT count(*) FROM invoices WHERE original_invoice_id IS NULL AND refund_transaction_id IS NULL")).isEqualTo(3);
                sql.execute("ALTER TABLE invoices ADD COLUMN reservation_id bigint, ADD COLUMN invoice_type varchar(30) DEFAULT 'GUEST'");
                assertThat(candidates(sql)).containsExactly("REF-test", "REF-other");
                sql.execute("INSERT INTO invoices VALUES(4,7,'CREDIT_NOTE',-45,NULL,364,1,41,NULL,'GUEST')");
                assertThat(candidates(sql)).containsExactly("REF-other");
                rejects(sql,"INSERT INTO invoices VALUES(5,7,'CREDIT_NOTE',-45,NULL,364,1,41,NULL,'GUEST')","23505");
                rejects(sql,"INSERT INTO invoices VALUES(5,7,'CREDIT_NOTE',-45,NULL,364,2,NULL,NULL,'GUEST')","23503");
                rejects(sql,"INSERT INTO invoices VALUES(5,7,'CREDIT_NOTE',-45,NULL,364,1,42,NULL,'GUEST')","23503");
                rejects(sql,"INSERT INTO invoices VALUES(5,7,'CREDIT_NOTE',45,NULL,364,1,NULL,NULL,'GUEST')","23514");
                rejects(sql,"INSERT INTO invoices VALUES(5,7,'CREDIT_NOTE',0,NULL,364,1,43,NULL,'GUEST')","23514");
                rejects(sql,"INSERT INTO invoices VALUES(5,7,'PAID',-45,NULL,364,1,NULL,NULL,'GUEST')","23514");
                rejects(sql,"INSERT INTO invoices VALUES(5,7,'CREDIT_NOTE',-45,NULL,364,5,NULL,NULL,'GUEST')","23514");
                rejects(sql,"INSERT INTO invoices VALUES(5,7,'CREDIT_NOTE',-45,NULL,364,NULL,41,NULL,'GUEST')","23514");
                // Une facture arrivée après le webhook redevient candidate sans refaire le remboursement.
                sql.execute("INSERT INTO invoices VALUES(6,7,'PAID',45,NULL,366,NULL,NULL,NULL,'GUEST')");
                assertThat(candidates(sql)).containsExactly("REF-other", "REF-late");
                assertThat(count(sql,"SELECT count(*) FROM invoices WHERE id=1 AND status='PAID' AND total_ttc=45")).isEqualTo(1);
                // Conserver l'annulation manuelle d'une facture sans montant, sans prétendre rembourser.
                sql.execute("INSERT INTO invoices VALUES(7,7,'CREDIT_NOTE',0,NULL,NULL,1,NULL,NULL,'GUEST')");
                // Le worker retrouve les séjours, jamais une commission seule ou une facture étrangère.
                sql.execute("INSERT INTO payment_transactions VALUES(46,7,'BCR-test','REFUND','COMPLETED','STRIPE','BOOKING_CANCELLATION',549,'{\"cancellationRefund\":true}',now()),(47,7,'BCR-pending','REFUND','PROCESSING','STRIPE','BOOKING_CANCELLATION',549,'{\"cancellationRefund\":true}',now()),(48,7,'BCR-legacy','REFUND','COMPLETED','STRIPE','BOOKING_CANCELLATION',549,'{}',now())");
                sql.execute("INSERT INTO invoices(id,organization_id,status,total_ttc,reservation_id,invoice_type) VALUES(20,7,'PAID',200,549,'COMMISSION')");
                assertThat(candidates(sql)).doesNotContain("BCR-test", "BCR-pending", "BCR-legacy");
                sql.execute("INSERT INTO invoices(id,organization_id,status,total_ttc,reservation_id,invoice_type) VALUES(21,8,'PAID',200,549,'GUEST')");
                assertThat(candidates(sql)).doesNotContain("BCR-test");
                sql.execute("INSERT INTO payment_transactions VALUES(51,7,'EXT-confirmed','REFUND','COMPLETED','STRIPE','INTERVENTION',366,'{\"externalRefund\":true,\"externalRefundConfirmed\":true,\"stripeStatus\":\"succeeded\",\"reviewRequired\":false}',now()),(52,7,'EXT-review','REFUND','PROCESSING','STRIPE','INTERVENTION',366,'{\"externalRefund\":true}',now())");
                assertThat(candidates(sql)).contains("EXT-confirmed").doesNotContain("EXT-review");
                sql.execute("UPDATE payment_transactions SET metadata=metadata || '{\"stripeStatus\":\"failed\",\"reviewRequired\":true}'::jsonb WHERE id=51");
                assertThat(candidates(sql)).doesNotContain("EXT-confirmed");
                // Une facture émise après le règlement groupé peut être rapprochée par sa part confirmée.
                sql.execute("INSERT INTO payment_transactions VALUES(49,7,'REF-part','REFUND','COMPLETED','STRIPE','INTERVENTION',367,'{\"managedRefund\":true,\"batchAllocationId\":\"3\"}',now()),(50,7,'REF-part-pending','REFUND','PROCESSING','STRIPE','INTERVENTION',367,'{\"managedRefund\":true,\"batchAllocationId\":\"3\"}',now())");
                sql.execute("INSERT INTO invoices(id,organization_id,status,total_ttc,intervention_id,invoice_type) VALUES(24,7,'ISSUED',35,367,'GUEST')");
                assertThat(candidates(sql)).contains("REF-part").doesNotContain("REF-part-pending");
                sql.execute("INSERT INTO invoices(id,organization_id,status,total_ttc,reservation_id,invoice_type) VALUES(22,7,'PAID',200,549,'GUEST')");
                assertThat(candidates(sql)).contains("BCR-test").doesNotContain("BCR-pending", "BCR-legacy");
                sql.execute("INSERT INTO invoices(id,organization_id,status,total_ttc,reservation_id,invoice_type,original_invoice_id,refund_transaction_id) VALUES(23,7,'CREDIT_NOTE',-100,549,'GUEST',22,46)");
                assertThat(candidates(sql)).doesNotContain("BCR-test");
            } finally { sql.execute("DROP SCHEMA " + schema + " CASCADE"); }
        }
    }
    private static java.util.List<String> candidates(Statement sql) throws SQLException {
        var refs=new java.util.ArrayList<String>();
        try(var r=sql.executeQuery(RefundCreditNoteService.CANDIDATES_SQL)) { while(r.next()) refs.add(r.getString(1)); }
        return refs;
    }
    private static long count(Statement sql,String query) throws SQLException {
        try(var r=sql.executeQuery(query)) { r.next(); return r.getLong(1); }
    }
    private static void rejects(Statement sql,String query,String state) {
        assertThatThrownBy(()->sql.execute(query)).isInstanceOf(SQLException.class)
            .satisfies(ex->assertThat(((SQLException)ex).getSQLState()).isEqualTo(state));
    }
}
