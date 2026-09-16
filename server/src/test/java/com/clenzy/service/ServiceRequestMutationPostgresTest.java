package com.clenzy.service;

import com.clenzy.model.ServiceRequest;
import com.clenzy.model.RequestStatus;
import com.clenzy.repository.ServiceRequestMutationRepositoryImpl;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.lang.reflect.Modifier;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

/** Vrai Hibernate/PostgreSQL ; mapping réduit aux champs de décision, sans graphe PMS. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class ServiceRequestMutationPostgresTest {
    static SessionFactory sessions;
    static JdbcTemplate jdbc;
    static String schema;

    @BeforeAll
    static void setup() {
        jdbc = new JdbcTemplate(new DriverManagerDataSource(System.getProperty("baitly.test.jdbc"), System.getProperty("baitly.test.user", "postgres"), ""));
        schema = "baitly_assignment_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.execute("CREATE SCHEMA " + schema);
        var mapped = Set.of("id", "version", "status", "assignedToId", "organizationId");
        StringBuilder ignored = new StringBuilder();
        for (var field : ServiceRequest.class.getDeclaredFields()) {
            if (!Modifier.isStatic(field.getModifiers()) && !mapped.contains(field.getName())) {
                ignored.append("<transient name=\"").append(field.getName()).append("\"/>");
            }
        }
        String xml = """
                <entity-mappings xmlns="https://jakarta.ee/xml/ns/persistence/orm" version="3.1">
                  <entity class="com.clenzy.model.ServiceRequest" access="FIELD" metadata-complete="true">
                    <table name="request_mutation"/>
                    <attributes>
                      <id name="id"/>
                      <basic name="organizationId"/>
                      <basic name="status"><enumerated>STRING</enumerated></basic>
                      <basic name="assignedToId"/>
                      <version name="version"/>
                """ + ignored + "</attributes></entity></entity-mappings>";
        sessions = new Configuration()
                .addInputStream(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url", System.getProperty("baitly.test.jdbc"))
                .setProperty("hibernate.connection.username", System.getProperty("baitly.test.user", "postgres"))
                .setProperty("hibernate.default_schema", schema)
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("jakarta.persistence.validation.mode", "none")
                .buildSessionFactory();
    }

    @AfterAll
    static void cleanup() {
        if (sessions != null) sessions.close();
        if (jdbc != null && schema != null) jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
    }

    @BeforeEach
    void insert() {
        try (var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            var sr = new ServiceRequest(); sr.setId(1L); sr.setOrganizationId(7L); sr.setStatus(RequestStatus.PENDING);
            em.persist(sr); em.getTransaction().commit();
        }
    }

    @AfterEach
    void remove() {
        try (var em = sessions.createEntityManager()) {
            em.getTransaction().begin(); em.remove(em.find(ServiceRequest.class, 1L)); em.getTransaction().commit();
        }
    }

    @Test
    void staleSessionWaitsForManualDecisionAndThenSeesItsAssignment() throws Exception {
        try (var stale = sessions.createEntityManager(); var manual = sessions.createEntityManager()) {
            stale.getTransaction().begin();
            ServiceRequest cached = stale.find(ServiceRequest.class, 1L);
            manual.getTransaction().begin();
            var first = new ServiceRequestMutationRepositoryImpl(manual).findForMutation(1L).orElseThrow();
            first.setAssignedToId(99L); first.setStatus(RequestStatus.ASSIGNED);
            var started = new CountDownLatch(1);
            try (var executor = Executors.newSingleThreadExecutor()) {
                var retry = executor.submit(() -> {
                    started.countDown();
                    var current = new ServiceRequestMutationRepositoryImpl(stale).findForMutation(1L).orElseThrow();
                    boolean eligible = current.getStatus() == RequestStatus.PENDING && current.getAssignedToId() == null;
                    stale.getTransaction().commit();
                    return eligible;
                });
                assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> retry.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
                manual.getTransaction().commit();
                assertThat(retry.get(10, TimeUnit.SECONDS)).isFalse();
                assertThat(cached.getAssignedToId()).isEqualTo(99L);
            } finally {
                if (manual.getTransaction().isActive()) manual.getTransaction().rollback();
            }
        }
    }

    @Test
    void cancellationIsRefreshedEvenWhenTheSessionAlreadyLoadedPending() {
        try (var stale = sessions.createEntityManager(); var cancel = sessions.createEntityManager()) {
            stale.getTransaction().begin();
            stale.find(ServiceRequest.class, 1L);
            cancel.getTransaction().begin();
            new ServiceRequestMutationRepositoryImpl(cancel).findForMutation(1L).orElseThrow().setStatus(RequestStatus.CANCELLED);
            cancel.getTransaction().commit();
            assertThat(new ServiceRequestMutationRepositoryImpl(stale).findForMutation(1L).orElseThrow().getStatus()).isEqualTo(RequestStatus.CANCELLED);
            stale.getTransaction().commit();
        }
    }
}
