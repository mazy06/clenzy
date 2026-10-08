package com.clenzy.service;

import liquibase.*;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Exécute les quatre migrations finales dans PostgreSQL, avec relecture idempotente et refus des incohérences. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyRefundCompletionLiquibaseTest {
    @Test void migrationsPreserveProofIdentityTenantAndFrozenBases() throws Exception {
        String jdbc=System.getProperty("baitly.test.jdbc"),user=System.getProperty("baitly.test.user","postgres");
        String schema="baitly_refund_completion_"+UUID.randomUUID().toString().replace("-","");
        String scoped=jdbc+(jdbc.contains("?")?"&":"?")+"currentSchema="+schema;
        try(var admin=DriverManager.getConnection(jdbc,user,"");var sql=admin.createStatement()) {
            sql.execute("CREATE SCHEMA "+schema);
            try {
                try(var c=DriverManager.getConnection(scoped,user,"");var s=c.createStatement()) {
                    s.execute("CREATE TABLE payment_transactions(id bigint primary key,organization_id bigint,provider_tx_id varchar(255),payment_type varchar(30),provider_type varchar(30),source_type varchar(30),source_id bigint,amount numeric(12,2),currency varchar(3) default 'EUR',metadata jsonb default '{}',UNIQUE(id,organization_id))");
                    s.execute("CREATE TABLE owner_payout_reservations(id bigint primary key,collected_amount numeric(12,2))");
                    s.execute("CREATE TABLE baitly_transfer_recoveries(id bigint primary key,gross_basis numeric(12,2),amount numeric(12,2))");
                    s.execute("CREATE TABLE guest_credit_transactions(id bigint primary key,organization_id bigint)");
                    s.execute("CREATE TABLE invoices(id bigint primary key,organization_id bigint,original_invoice_id bigint,refund_transaction_id bigint,invoice_type varchar(30),status varchar(30),total_ttc numeric(12,2))");
                }
                for(int pass=0;pass<2;pass++) try(var c=DriverManager.getConnection(scoped,user,"")) {
                    var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));var resources=new ClassLoaderResourceAccessor();
                    try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)) {
                        var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                        master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->Set.of("0512-refund-allocations","0513-owner-refund-bases","0514-loyalty-refund-rewards","0515-owner-refund-credit-notes").contains(cs.getId())).forEach(selected::addChangeSet);
                        assertThat(selected.getChangeSets()).hasSize(4);new Liquibase(selected,resources,db).update("");
                    }
                }
                try(var c=DriverManager.getConnection(scoped,user,"");var s=c.createStatement()) {
                    s.execute("INSERT INTO payment_transactions(id,organization_id,provider_tx_id,payment_type,provider_type,source_type,source_id,amount) VALUES(1,7,'re_once','REFUND','STRIPE','INTERVENTION_BATCH',10,50),(2,8,'re_foreign','REFUND','STRIPE','INTERVENTION_BATCH',20,50)");
                    String insert="INSERT INTO payment_transactions(id,organization_id,provider_tx_id,payment_type,provider_type,source_type,source_id,amount,refund_parent_id) VALUES";
                    s.execute(insert+"(3,7,null,'REFUND','STRIPE','INTERVENTION',10,20,1),(4,7,null,'REFUND','STRIPE','INTERVENTION',20,30,1)");
                    assertThatThrownBy(()->s.execute(insert+"(5,8,null,'REFUND','STRIPE','INTERVENTION',30,10,1)")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute(insert+"(5,7,'re_duplicate','REFUND','STRIPE','INTERVENTION',30,10,1)")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute(insert+"(5,7,null,'REFUND','STRIPE','INTERVENTION',10,10,1)")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("UPDATE payment_transactions SET amount=21 WHERE id=3")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("UPDATE payment_transactions SET refund_parent_id=null WHERE id=3")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("DELETE FROM payment_transactions WHERE id=3")).isInstanceOf(SQLException.class);
                    s.execute("UPDATE payment_transactions SET metadata='{\"externalBatchDistributed\":true,\"refundAssignments\":{\"10\":\"20.00\",\"20\":\"30.00\"}}' WHERE id=1");
                    assertThatThrownBy(()->s.execute("UPDATE payment_transactions SET metadata='{}' WHERE id=1")).isInstanceOf(SQLException.class);
                    s.execute("INSERT INTO guest_credit_transactions VALUES(1,7,null),(2,7,1)");
                    assertThatThrownBy(()->s.execute("INSERT INTO guest_credit_transactions VALUES(3,8,1)")).isInstanceOf(SQLException.class);
                    s.execute("INSERT INTO owner_payout_reservations VALUES(1,45,30)");
                    assertThatThrownBy(()->s.execute("UPDATE owner_payout_reservations SET net_amount=29 WHERE id=1")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("INSERT INTO owner_payout_reservations VALUES(2,45,46)")).isInstanceOf(SQLException.class);
                    s.execute("INSERT INTO baitly_transfer_recoveries VALUES(1,45,3.33,30)");
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET net_basis=31 WHERE id=1")).isInstanceOf(SQLException.class);
                    s.execute("INSERT INTO invoices VALUES(1,7,10,null,'COMMISSION','CREDIT_NOTE',-5,1)");
                    assertThatThrownBy(()->s.execute("INSERT INTO invoices VALUES(2,8,10,null,'COMMISSION','CREDIT_NOTE',-5,1)")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("INSERT INTO invoices VALUES(2,7,10,null,'COMMISSION','CREDIT_NOTE',-5,1)")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("INSERT INTO invoices VALUES(2,7,11,null,'COMMISSION','PAID',5,1)")).isInstanceOf(SQLException.class);
                }
            } finally {sql.execute("DROP SCHEMA "+schema+" CASCADE");}
        }
    }
}
