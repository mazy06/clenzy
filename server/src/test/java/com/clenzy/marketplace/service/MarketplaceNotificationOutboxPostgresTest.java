package com.clenzy.marketplace.service;

import com.clenzy.service.TokenEncryptionService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql:.*")
class MarketplaceNotificationOutboxPostgresTest {
    JdbcTemplate jdbc; MarketplaceNotificationOutbox outbox; TransactionTemplate tx; String schema;
    @BeforeEach void setup() throws Exception {
        schema="baitly_delivery_"+UUID.randomUUID().toString().replace("-","");
        var ds=new DriverManagerDataSource(System.getProperty("baitly.test.jdbc"),System.getProperty("baitly.test.user","postgres"),"");
        new JdbcTemplate(ds).execute("CREATE SCHEMA "+schema);
        ds.setUrl(System.getProperty("baitly.test.jdbc")+"?currentSchema="+schema);
        jdbc=new JdbcTemplate(ds);
        jdbc.execute("CREATE TABLE marketplace_providers(id bigint PRIMARY KEY,status text,decision_message text,decision_sent_at timestamp)");
        jdbc.execute("INSERT INTO marketplace_providers VALUES(1,'ACTIVE','Bienvenue',NULL)");
        jdbc.execute(java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/db/changelog/changes/0454__marketplace_notification_outbox.sql")));
        var manager=new DataSourceTransactionManager(ds); tx=new TransactionTemplate(manager);
        var proxy=new ProxyFactory(new MarketplaceNotificationOutbox(jdbc,new TokenEncryptionService("test-only-baitly-queue",1,"")));
        proxy.addAdvice(new TransactionInterceptor(manager,new AnnotationTransactionAttributeSource()));
        outbox=(MarketplaceNotificationOutbox)proxy.getProxy();
    }
    @AfterEach void cleanup() { jdbc.execute("DROP SCHEMA "+schema+" CASCADE"); }
    UUID enqueue() {
        tx.executeWithoutResult(status -> outbox.enqueue(1L,"CONFIRMATION","private-token",null,null));
        return outbox.due().getFirst();
    }
    @Test void enqueueRequiresBusinessTransactionAndRollsBackWithIt() {
        assertThatThrownBy(() -> outbox.enqueue(1L,"CONFIRMATION","secret",null,null))
            .isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);
        tx.executeWithoutResult(status -> { outbox.enqueue(1L,"CONFIRMATION","secret",null,null); status.setRollbackOnly(); });
        assertThat(outbox.due()).isEmpty();
    }
    @Test void retriesPreserveTheSecretAndLateWorkersCannotFinishAnotherClaim() {
        UUID id=enqueue();
        assertThat(jdbc.queryForObject("SELECT encrypted_payload FROM marketplace_notification_deliveries",String.class)).doesNotContain("private-token");
        var first=outbox.claim(id); assertThat(first.payload()).isEqualTo("private-token");
        assertThat(outbox.claim(id)).isNull();
        jdbc.update("UPDATE marketplace_notification_deliveries SET next_attempt_at=CURRENT_TIMESTAMP-INTERVAL '1 minute'");
        var next=outbox.claim(id); assertThat(next.token()).isNotEqualTo(first.token());
        outbox.finish(first,"SENT");
        assertThat(outbox.states(1L).getFirst().status()).isEqualTo("RUNNING");
        outbox.finish(next,"PENDING"); assertThat(outbox.due()).isEmpty();
        assertThat(outbox.states(1L).getFirst().attempts()).isEqualTo(2);
    }
    @Test void deliveredDecisionIsDatedAndPayloadPurged() {
        tx.executeWithoutResult(status -> outbox.enqueue(1L,"DECISION","Bienvenue","ACTIVE","moderator"));
        var claim=outbox.claim(outbox.due().getFirst()); outbox.finish(claim,"SENT");
        assertThat(jdbc.queryForObject("SELECT encrypted_payload FROM marketplace_notification_deliveries",String.class)).isNull();
        assertThat(jdbc.queryForObject("SELECT decision_sent_at FROM marketplace_providers",java.sql.Timestamp.class)).isNotNull();
        assertThat(outbox.states(1L).getFirst().actor()).isEqualTo("moderator");
    }
    @Test void erasureAlsoRemovesQueuedTokens() {
        enqueue(); jdbc.update("DELETE FROM marketplace_providers");
        assertThat(outbox.due()).isEmpty();
    }
}
