package com.clenzy.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** SQL exact du worker, exécuté uniquement sur une base de test isolée. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyExternalRefundQueryTest {
    @Test void paginationKeepsPendingAndLateFailuresWithoutReopeningSettledRefunds() throws Exception {
        try(var db=DriverManager.getConnection(System.getProperty("baitly.test.jdbc"),System.getProperty("baitly.test.user","postgres"),""); var sql=db.createStatement()) {
            sql.execute("CREATE TEMP TABLE payment_transactions(id bigint,organization_id bigint,transaction_ref text,provider_tx_id text,provider_type text,payment_type text,status text,metadata jsonb,refund_parent_id bigint)");
            sql.execute("""
                INSERT INTO payment_transactions(id,organization_id,transaction_ref,provider_tx_id,provider_type,payment_type,status,metadata) VALUES
                (1,7,'EXT-pending','re_1','STRIPE','REFUND','PROCESSING','{"externalRefund":true}'),
                (2,8,'EXT-review','re_2','STRIPE','REFUND','COMPLETED','{"externalRefund":true,"reviewRequired":true}'),
                (3,7,'EXT-done','re_3','STRIPE','REFUND','COMPLETED','{"externalRefund":true,"reviewRequired":false}'),
                (4,7,'EXT-failed','re_4','STRIPE','REFUND','FAILED','{"externalRefund":true,"reviewRequired":false}'),
                (5,7,'REF-managed','re_5','STRIPE','REFUND','PROCESSING','{"managedRefund":true}'),
                (6,7,'OTHER','other','CMI','REFUND','PROCESSING','{"externalRefund":true}')
                """);
            sql.execute("INSERT INTO payment_transactions VALUES(7,7,'ALLOC-child',null,'STRIPE','REFUND','PROCESSING','{\"externalRefund\":true}',1)");
            assertThat(ids(sql,0)).containsExactly(1L,2L); assertThat(ids(sql,1)).containsExactly(2L); assertThat(ids(sql,2)).isEmpty();
        }
    }
    private List<Long> ids(Statement sql,long after) throws SQLException {
        var ids=new ArrayList<Long>(); try(var rows=sql.executeQuery(BaitlyExternalRefundStore.CANDIDATES_SQL.replace(":after",Long.toString(after)))) {
            while(rows.next()) ids.add(rows.getLong(1));
        } return ids;
    }
}
