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

@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyDisputeLiquibaseTest {
    @Test void financialProofsAreBoundToTheSamePaymentAndTenantAndImmutable() throws Exception {
        String url=System.getProperty("baitly.test.jdbc"),user=System.getProperty("baitly.test.user","postgres");
        String schema="baitly_dispute_"+UUID.randomUUID().toString().replace("-","");
        String role=schema+"_reader",scoped=url+(url.contains("?")?"&":"?")+"currentSchema="+schema;
        try(var admin=DriverManager.getConnection(url,user,"");var sql=admin.createStatement()) {
            sql.execute("CREATE SCHEMA "+schema);sql.execute("CREATE ROLE "+role);
            try {
                try(var c=DriverManager.getConnection(scoped,user,"");var s=c.createStatement()) {
                    s.execute("CREATE TABLE payment_transactions(id bigint primary key,organization_id bigint,amount numeric(12,2),UNIQUE(id,organization_id))");
                    s.execute("INSERT INTO payment_transactions VALUES(1,7,35),(2,7,35),(3,8,35)");
                }
                migrate(scoped,user);migrate(scoped,user);
                try(var c=DriverManager.getConnection(scoped,user,"");var s=c.createStatement()) {
                    s.execute("SET app.bypass_rls='on'");
                    s.execute("INSERT INTO payment_disputes(organization_id,provider_dispute_id,payment_transaction_id) VALUES(7,'dp_test',1)");
                    assertThatThrownBy(()->s.execute("INSERT INTO payment_disputes(organization_id,provider_dispute_id,payment_transaction_id) VALUES(8,'dp_foreign',1)"))
                            .isInstanceOf(SQLException.class);
                    s.execute(entry("txn_first",7,1));
                    assertThatThrownBy(()->s.execute(entry("txn_wrong_payment",7,2))).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute(entry("txn_wrong_org",8,3))).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute(entry("txn_first",7,1))).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("UPDATE baitly_dispute_balance_entries SET fee=0,net=amount")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("DELETE FROM baitly_dispute_balance_entries")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("UPDATE payment_transactions SET disputed_amount=36 WHERE id=1")).isInstanceOf(SQLException.class);
                    s.execute("UPDATE payment_transactions SET disputed_amount=35 WHERE id=1");
                    s.execute("ALTER TABLE payment_transactions ADD source_type varchar(40), ADD source_id bigint");
                    s.execute("CREATE TABLE intervention_payment_allocations(organization_id bigint, transaction_id bigint, intervention_id bigint)");
                    s.execute("CREATE TABLE service_requests(id bigint, organization_id bigint, converted_intervention_id bigint)");
                    s.execute("UPDATE payment_transactions SET source_type='BOOKING_CHECKOUT',source_id=101 WHERE id=1");
                    s.execute("UPDATE payment_transactions SET source_type='INTERVENTION',source_id=102 WHERE id=2");
                    s.execute("UPDATE payment_transactions SET source_type='INTERVENTION',source_id=103,disputed_amount=35 WHERE id=3");
                    s.execute("INSERT INTO payment_transactions(id,organization_id,amount,source_type,source_id,disputed_amount) VALUES (4,7,35,'SERVICE_REQUEST',10,35)");
                    s.execute("INSERT INTO intervention_payment_allocations VALUES(7,1,104),(8,3,105)");
                    s.execute("INSERT INTO service_requests VALUES(10,7,106),(11,8,107)");
                    var query=com.clenzy.repository.PaymentTransactionRepository.class
                            .getMethod("findDisputedSources",Long.class,java.util.List.class)
                            .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
                    var rows=new java.util.HashSet<String>();
                    try(var r=s.executeQuery(query.replace(":org","7").replace(":ids","101,102,103,104,105,106,107"))) {
                        while(r.next()) rows.add(r.getString(1)+":"+r.getLong(2));
                    }
                    assertThat(rows).containsExactlyInAnyOrder("RESERVATION:101","INTERVENTION:104","INTERVENTION:106");
                }
                sql.execute("GRANT USAGE ON SCHEMA "+schema+" TO "+role);
                sql.execute("GRANT SELECT ON ALL TABLES IN SCHEMA "+schema+" TO "+role);
                try(var c=DriverManager.getConnection(scoped,user,"");var s=c.createStatement()) {
                    s.execute("SET ROLE "+role);s.execute("SET app.current_org='8'");
                    for(String table:java.util.List.of("payment_disputes","baitly_dispute_balance_entries")) {
                        try(var r=s.executeQuery("SELECT count(*) FROM "+table)) {r.next();assertThat(r.getInt(1)).isZero();}
                    }
                    s.execute("SET app.current_org='7'");
                    try(var r=s.executeQuery("SELECT count(*) FROM baitly_dispute_balance_entries")) {r.next();assertThat(r.getInt(1)).isEqualTo(1);}
                }
            } finally {sql.execute("DROP SCHEMA "+schema+" CASCADE");sql.execute("DROP ROLE "+role);}
        }
    }
    private String entry(String id,long org,long payment) {
        return "INSERT INTO baitly_dispute_balance_entries VALUES('"+id+"',"+org+","+payment+",'dp_test',-35,15,-50,'EUR',now(),now())";
    }
    private void migrate(String url,String user) throws Exception {
        try(var c=DriverManager.getConnection(url,user,"")) {
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream()
                    .filter(s->s.getId().startsWith("0384-")||s.getId().equals("0506-canonical-payment-disputes")).forEach(selected::addChangeSet);
                new Liquibase(selected,resources,db).update("");
            }
        }
    }
}
