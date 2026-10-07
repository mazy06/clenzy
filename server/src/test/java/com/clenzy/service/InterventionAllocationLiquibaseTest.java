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

/** Vrai PostgreSQL : migration rejouable, contraintes inter-organisations et RLS. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class InterventionAllocationLiquibaseTest {
    @Test void exactMigrationAndPaymentGuardsOnIsolatedSchema() throws Exception {
        String url = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String schema = "baitly_alloc_" + UUID.randomUUID().toString().replace("-", "");
        String role = schema + "_role";
        String scoped = url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema;
        try (Connection admin=DriverManager.getConnection(url,user,""); Statement sql=admin.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            sql.execute("CREATE ROLE " + role + " NOLOGIN");
            try {
                sql.execute("SET search_path TO " + schema);
                sql.execute("CREATE TABLE payment_transactions(id bigint PRIMARY KEY,organization_id bigint,status varchar(30),source_type varchar(50),source_id bigint,metadata jsonb)");
                sql.execute("CREATE TABLE interventions(id bigint PRIMARY KEY,organization_id bigint)");
                sql.execute("INSERT INTO payment_transactions VALUES(1,7,'PROCESSING','INTERVENTION_BATCH',11,'{\"interventionIds\":\"11,12\"}'),(2,8,'PROCESSING','INTERVENTION_BATCH',21,'{}')");
                sql.execute("INSERT INTO interventions VALUES(11,7),(12,7),(21,8)");
                for (int pass=0; pass<2; pass++) {
                    try (Connection connection=DriverManager.getConnection(scoped,user,"")) {
                        var database=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
                        var resources=new ClassLoaderResourceAccessor();
                        try (var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,database)) {
                            var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                            selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream()
                                    .filter(c->c.getId().equals("0502-intervention-payment-allocations")).findFirst().orElseThrow());
                            new Liquibase(selected,resources,database).update("");
                        }
                    }
                }
                assertThat(count(sql,"SELECT count(*) FROM databasechangelog WHERE id='0502-intervention-payment-allocations'")).isEqualTo(1);
                sql.execute("INSERT INTO intervention_payment_allocations(organization_id,transaction_id,intervention_id,amount,currency) VALUES(7,1,11,30,'EUR'),(7,1,12,50,'EUR')");
                rejects(sql,"INSERT INTO intervention_payment_allocations(organization_id,transaction_id,intervention_id,amount,currency) VALUES(7,1,21,10,'EUR')","23503");
                rejects(sql,"INSERT INTO intervention_payment_allocations(organization_id,transaction_id,intervention_id,amount,currency) VALUES(8,1,21,10,'EUR')","23503");
                rejects(sql,"INSERT INTO intervention_payment_allocations(organization_id,transaction_id,intervention_id,amount,currency) VALUES(7,1,11,30,'EUR')","23505");
                rejects(sql,"UPDATE intervention_payment_allocations SET amount=0","23514");
                rejects(sql,"UPDATE intervention_payment_allocations SET currency='eur'","23514");

                // Exécuter les VRAIES requêtes repository : membre secondaire + échec ambigu.
                String guard=com.clenzy.repository.PaymentTransactionRepository.class
                        .getMethod("hasOpenInterventionPayment",Long.class,Long.class)
                        .getAnnotation(org.springframework.data.jpa.repository.Query.class).value()
                        .replace(":orgId","7").replace(":missionId","12");
                assertThat(exists(sql,guard)).isTrue();
                sql.execute("UPDATE payment_transactions SET status='FAILED' WHERE id=1");
                assertThat(exists(sql,guard)).isTrue();
                sql.execute("UPDATE payment_transactions SET metadata=metadata || '{\"batchRetryAllowed\":true}'::jsonb WHERE id=1");
                assertThat(exists(sql,guard)).isFalse();

                sql.execute("GRANT USAGE ON SCHEMA " + schema + " TO " + role);
                sql.execute("GRANT SELECT,INSERT,UPDATE ON intervention_payment_allocations TO " + role);
                sql.execute("GRANT USAGE ON ALL SEQUENCES IN SCHEMA " + schema + " TO " + role);
                sql.execute("SET ROLE " + role);
                sql.execute("SET app.bypass_rls='off'");
                sql.execute("SET app.current_org='8'");
                assertThat(count(sql,"SELECT count(*) FROM intervention_payment_allocations")).isZero();
                rejects(sql,"INSERT INTO intervention_payment_allocations(organization_id,transaction_id,intervention_id,amount,currency) VALUES(7,1,11,30,'EUR')","42501");
                sql.execute("SET app.current_org='7'");
                assertThat(count(sql,"SELECT count(*) FROM intervention_payment_allocations")).isEqualTo(2);
                sql.execute("SET app.current_org=''");
                assertThat(count(sql,"SELECT count(*) FROM intervention_payment_allocations")).isZero();
            } finally {
                sql.execute("RESET ROLE");
                sql.execute("DROP SCHEMA " + schema + " CASCADE");
                sql.execute("DROP ROLE " + role);
            }
        }
    }
    private static long count(Statement sql,String query) throws SQLException {
        try(var r=sql.executeQuery(query)) { r.next(); return r.getLong(1); }
    }
    private static boolean exists(Statement sql,String query) throws SQLException {
        try(var r=sql.executeQuery(query)) { r.next(); return r.getBoolean(1); }
    }
    private static void rejects(Statement sql,String query,String state) {
        assertThatThrownBy(()->sql.execute(query)).isInstanceOf(SQLException.class)
                .satisfies(ex->assertThat(((SQLException)ex).getSQLState()).isEqualTo(state));
    }
}
