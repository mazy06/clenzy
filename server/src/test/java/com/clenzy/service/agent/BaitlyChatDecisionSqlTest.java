package com.clenzy.service.agent;

import com.clenzy.model.AgentPendingAction;
import com.clenzy.repository.AgentPendingActionRepository;
import org.hibernate.SessionFactory;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.Query;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;

/** Executes the repository's real HQL against the mapped entity, on isolated SQL. */
class BaitlyChatDecisionSqlTest {
    private SessionFactory factory;
    private JdbcTemplate admin;
    private String schema;
    private String claimQuery;
    @BeforeEach void setup() throws Exception {
        String jdbc = System.getProperty("baitly.test.jdbc");
        DriverManagerDataSource source;
        if (jdbc == null) source = new DriverManagerDataSource("jdbc:h2:mem:chat"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
        else {
            if (!jdbc.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]*(?:test|recipe|ci)[a-zA-Z0-9_]*"))
                throw new IllegalArgumentException("Isolated recipe database required");
            admin = new JdbcTemplate(new DriverManagerDataSource(jdbc,"postgres",""));
            schema = "baitly_chat_"+UUID.randomUUID().toString().replace("-","");
            admin.execute("CREATE SCHEMA "+schema);
            source = new DriverManagerDataSource(jdbc+"?currentSchema="+schema,"postgres","");
        }
        var registry = new StandardServiceRegistryBuilder().applySetting("hibernate.connection.datasource",source)
                .applySetting("hibernate.hbm2ddl.auto","create-drop").build();
        factory = new MetadataSources(registry).addAnnotatedClass(AgentPendingAction.class).buildMetadata().buildSessionFactory();
        claimQuery = AgentPendingActionRepository.class.getMethod("claimDecision",String.class,Long.class,String.class,String.class,Instant.class)
                .getAnnotation(Query.class).value();
        factory.inTransaction(session -> session.persist(new AgentPendingAction("fixture",7L,"synthetic-user",9L,
                "synthetic_tool","{}",null,null,false,"[]",Instant.now().plusSeconds(600))));
    }
    @AfterEach void close() { if(factory!=null) factory.close(); if(schema!=null) admin.execute("DROP SCHEMA "+schema+" CASCADE"); }
    private int claim(String user, long org, String decision) {
        return factory.fromTransaction(session -> session.createMutationQuery(claimQuery).setParameter("id","fixture")
                .setParameter("userId",user).setParameter("orgId",org).setParameter("decision",decision)
                .setParameter("now",Instant.now()).executeUpdate());
    }
    @Test void concurrentConfirmAndRefuseHaveExactlyOneDurableWinner() throws Exception {
        var executor = Executors.newFixedThreadPool(2); var start = new CountDownLatch(1);
        try {
            var first = executor.submit(() -> { start.await(); return claim("synthetic-user",7,"CONFIRMED"); });
            var second = executor.submit(() -> { start.await(); return claim("synthetic-user",7,"REFUSED"); });
            start.countDown();
            assertThat(first.get(10,TimeUnit.SECONDS)+second.get(10,TimeUnit.SECONDS)).isEqualTo(1);
            assertThat(claim("synthetic-user",7,"CONFIRMED")).isZero();
        } finally { executor.shutdownNow(); }
    }
    @Test void foreignScopesCannotClaimOrRemoveOwnersPending() {
        assertThat(claim("foreign",7,"CONFIRMED")).isZero();
        assertThat(claim("synthetic-user",8,"CONFIRMED")).isZero();
        assertThat(claim("synthetic-user",7,"REFUSED")).isEqualTo(1);
    }
    @Test void expiredRowsCannotBeClaimed() {
        factory.inTransaction(session -> session.createMutationQuery("update AgentPendingAction set expiresAt=:expiry")
                .setParameter("expiry",Instant.now().minusSeconds(1)).executeUpdate());
        assertThat(claim("synthetic-user",7,"CONFIRMED")).isZero();
    }
}
