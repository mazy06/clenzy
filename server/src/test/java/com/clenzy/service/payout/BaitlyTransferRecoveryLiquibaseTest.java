package com.clenzy.service.payout;

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

/** Migration exacte, doubles exécutions, intégrité financière et isolation PostgreSQL réelle. */
@EnabledIfSystemProperty(named="baitly.test.jdbc", matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyTransferRecoveryLiquibaseTest {
    @Test void migrationEnforcesEvidenceAndTenantBoundaries() throws Exception {
        String url=System.getProperty("baitly.test.jdbc"), user=System.getProperty("baitly.test.user","postgres");
        String schema="baitly_refund_recovery_"+UUID.randomUUID().toString().replace("-","");
        String role=schema+"_reader", scoped=url+(url.contains("?")?"&":"?")+"currentSchema="+schema;
        try(var admin=DriverManager.getConnection(url,user,"");var sql=admin.createStatement()) {
            sql.execute("CREATE SCHEMA "+schema); sql.execute("CREATE ROLE "+role);
            try {
                try(var c=DriverManager.getConnection(scoped,user,"");var s=c.createStatement()) {
                    s.execute("CREATE TABLE payout_transfers(id bigint,organization_id bigint,amount numeric(12,2),UNIQUE(id,organization_id))");
                    s.execute("CREATE TABLE payment_transactions(id bigint,organization_id bigint,amount numeric(12,2),UNIQUE(id,organization_id))");
                    s.execute("INSERT INTO payout_transfers VALUES(1,7,30),(2,8,30),(3,7,0.01),(4,7,30)");
                    s.execute("INSERT INTO payment_transactions VALUES(10,7,35),(11,8,35),(12,7,0.01),(13,7,5),(14,7,25)");
                }
                migrate(scoped,user,false);
                try(var c=DriverManager.getConnection(scoped,user,"");var s=c.createStatement()) {
                    s.execute("SET app.bypass_rls='on'");
                    s.execute("INSERT INTO baitly_transfer_recoveries(organization_id,transfer_id,refund_id,amount,currency,state,next_attempt_at,created_at,updated_at) "
                            +"VALUES(7,1,10,30,'EUR','WAITING_REFUND',now(),now(),now()),"
                            +"(7,4,13,5,'EUR','WAITING_REFUND',now(),now(),now())");
                    s.execute("UPDATE baitly_transfer_recoveries SET state='RECOVERED',reversal_reference='trr_legacy' WHERE refund_id=13");
                    s.execute("INSERT INTO baitly_transfer_recoveries(organization_id,transfer_id,refund_id,amount,currency,state,next_attempt_at,created_at,updated_at) "
                            +"VALUES(7,4,14,25,'EUR','WAITING_REFUND',now(),now(),now())");
                }
                migrate(scoped,user,true); migrate(scoped,user,true);
                try(var c=DriverManager.getConnection(scoped,user,"");var s=c.createStatement()) {
                    s.execute("SET app.bypass_rls='on'");
                    try(var r=s.executeQuery("SELECT commission_refund_amount,gross_basis FROM baitly_transfer_recoveries WHERE refund_id=10")) {
                        r.next(); assertThat(r.getBigDecimal(1)).isEqualByComparingTo("5"); assertThat(r.getBigDecimal(2)).isEqualByComparingTo("35");
                    }
                    try(var r=s.executeQuery("SELECT commission_refund_amount,gross_basis FROM baitly_transfer_recoveries WHERE transfer_id=4")) {
                        int count=0; while(r.next()) { count++; assertThat(r.getBigDecimal(1)).isZero(); assertThat(r.getBigDecimal(2)).isEqualByComparingTo("30"); }
                        assertThat(count).isEqualTo(2);
                    }
                    assertThatThrownBy(()->s.execute(insert(7,2,10))).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute(insert(7,1,11))).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute(insert(7,1,10))).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET amount=31")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET commission_refund_amount=0")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET gross_basis=36")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET state='RECOVERED'")).isInstanceOf(SQLException.class);
                    s.execute("UPDATE baitly_transfer_recoveries SET state='RECOVERING',first_attempt_at=now() WHERE refund_id=10");
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET first_attempt_at=now()")).isInstanceOf(SQLException.class);
                    s.execute("UPDATE baitly_transfer_recoveries SET state='RECOVERED',reversal_reference='trr_test' WHERE refund_id=10");
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET state='RECOVERING'")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET reversal_reference='trr_other'")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("DELETE FROM baitly_transfer_recoveries")).isInstanceOf(SQLException.class);
                    s.execute("INSERT INTO baitly_transfer_recoveries(organization_id,transfer_id,refund_id,amount,commission_refund_amount,gross_basis,currency,state,next_attempt_at,created_at,updated_at) "
                            +"VALUES(7,3,12,0,0.01,1,'EUR','WAITING_REFUND',now(),now(),now())");
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET state='RECOVERING',first_attempt_at=now() WHERE refund_id=12")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET state='RECOVERED',reversal_reference='trr_zero' WHERE refund_id=12")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET state='NO_RECOVERY_REQUIRED' WHERE refund_id=14")).isInstanceOf(SQLException.class);
                    s.execute("UPDATE baitly_transfer_recoveries SET state='NO_RECOVERY_REQUIRED' WHERE refund_id=12");
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET state='CANCELLED' WHERE refund_id=12")).isInstanceOf(SQLException.class);
                    assertThatThrownBy(()->s.execute("UPDATE baitly_transfer_recoveries SET reversal_reference='trr_zero' WHERE refund_id=12")).isInstanceOf(SQLException.class);
                }
                sql.execute("GRANT USAGE ON SCHEMA "+schema+" TO "+role);
                sql.execute("GRANT SELECT,INSERT ON "+schema+".baitly_transfer_recoveries TO "+role);
                sql.execute("GRANT USAGE ON ALL SEQUENCES IN SCHEMA "+schema+" TO "+role);
                try(var c=DriverManager.getConnection(scoped,user,"");var s=c.createStatement()) {
                    s.execute("SET ROLE "+role); s.execute("SET app.current_org='8'");
                    try(var r=s.executeQuery("SELECT count(*) FROM baitly_transfer_recoveries")) { r.next(); assertThat(r.getInt(1)).isZero(); }
                    assertThatThrownBy(()->s.execute(insert(7,1,10))).isInstanceOf(SQLException.class);
                    s.execute("SET app.current_org='7'");
                    try(var r=s.executeQuery("SELECT count(*) FROM baitly_transfer_recoveries")) { r.next(); assertThat(r.getInt(1)).isEqualTo(4); }
                }
            } finally { sql.execute("DROP SCHEMA "+schema+" CASCADE");sql.execute("DROP ROLE "+role); }
        }
    }
    private String insert(long org,long transfer,long refund) {
        return "INSERT INTO baitly_transfer_recoveries(organization_id,transfer_id,refund_id,amount,commission_refund_amount,gross_basis,currency,state,next_attempt_at,created_at,updated_at) "
                +"VALUES("+org+","+transfer+","+refund+",30,5,35,'EUR','WAITING_REFUND',now(),now(),now())";
    }
    private void migrate(String url,String user,boolean allocation) throws Exception {
        try(var c=DriverManager.getConnection(url,user,"")) {
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream()
                        .filter(s->s.getId().equals("0505-transfer-refund-recoveries")).findFirst().orElseThrow());
                if(allocation) selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream()
                        .filter(s->s.getId().equals("0508-commission-refund-allocations")).findFirst().orElseThrow());
                new Liquibase(selected,resources,db).update("");
            }
        }
    }
}
