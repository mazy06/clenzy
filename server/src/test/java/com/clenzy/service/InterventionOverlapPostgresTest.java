package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.data.jpa.repository.Query;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;

/** Exécute les quatre requêtes de production avec Hibernate/PostgreSQL et un mapping réduit. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class InterventionOverlapPostgresTest {
    static SessionFactory sessions;
    static JdbcTemplate jdbc;
    static String schema;

    static String ignored(Class<?> type, Set<String> mapped) {
        var xml = new StringBuilder();
        for (var field : type.getDeclaredFields()) {
            if (!Modifier.isStatic(field.getModifiers()) && !mapped.contains(field.getName())) {
                xml.append("<transient name=\"").append(field.getName()).append("\"/>");
            }
        }
        return xml.toString();
    }

    @BeforeAll
    static void setup() {
        jdbc = new JdbcTemplate(new DriverManagerDataSource(System.getProperty("baitly.test.jdbc"), System.getProperty("baitly.test.user", "postgres"), ""));
        schema = "baitly_overlap_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.execute("CREATE SCHEMA " + schema);
        String xml = """
            <entity-mappings xmlns="https://jakarta.ee/xml/ns/persistence/orm" version="3.1">
              <entity class="com.clenzy.model.User" access="FIELD" metadata-complete="true">
                <table name="test_user"/><attributes><id name="id"/>
            """ + ignored(User.class, Set.of("id")) + """
              </attributes></entity>
              <entity class="com.clenzy.model.Intervention" access="FIELD" metadata-complete="true">
                <table name="test_intervention"/><attributes>
                  <id name="id"/>
                  <basic name="organizationId"/>
                  <basic name="teamId"/>
                  <basic name="scheduledDate"/>
                  <basic name="estimatedDurationHours"/>
                  <basic name="status"><enumerated>STRING</enumerated></basic>
                  <many-to-one name="assignedUser" target-entity="com.clenzy.model.User" fetch="LAZY"><join-column name="assigned_user_id" referenced-column-name="id"/></many-to-one>
            """ + ignored(Intervention.class, Set.of("id", "organizationId", "teamId", "scheduledDate", "estimatedDurationHours", "status", "assignedUser"))
                + "</attributes></entity></entity-mappings>";
        sessions = new Configuration().addInputStream(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url", System.getProperty("baitly.test.jdbc"))
                .setProperty("hibernate.connection.username", System.getProperty("baitly.test.user", "postgres"))
                .setProperty("hibernate.default_schema", schema)
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("jakarta.persistence.validation.mode", "none").buildSessionFactory();
    }

    @AfterAll
    static void cleanup() {
        if (sessions != null) sessions.close();
        if (jdbc != null && schema != null) jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
    }

    @ParameterizedTest
    @CsvSource(value = {
        "9,3,11,13,PENDING,1",       // commence avant, finit pendant
        "9,5,10,11,PENDING,1",       // englobe le créneau
        "10,1,9,12,PENDING,1",       // inclus dans le créneau
        "9,3,9,12,PENDING,1",        // même créneau
        "9,3,12,13,PENDING,0",       // fin exactement au début
        "12,2,9,12,PENDING,0",       // début exactement à la fin
        "9,NULL,12,13,PENDING,1",    // durée inconnue : quatre heures
        "9,0,12,13,PENDING,1",
        "9,-1,12,13,PENDING,1",
        "9,3,10,11,CANCELLED,0",
        "9,3,10,11,COMPLETED,0"
    }, nullValues = "NULL")
    void allAvailabilityQueriesDetectFullOverlap(int start, Integer duration, int from, int to,
                                                InterventionStatus status, long expected) {
        try (var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            try {
                var user = new User(); user.setId(9L); em.persist(user);
                var mission = new Intervention(); mission.setId(1L); mission.setOrganizationId(1L);
                mission.setAssignedUser(user); mission.setTeamId(7L); mission.setStatus(status);
                mission.setScheduledDate(LocalDateTime.of(2026, 9, 15, start, 0));
                mission.setEstimatedDurationHours(duration); em.persist(mission); em.flush();
                int checked = 0;
                for (var method : InterventionRepository.class.getDeclaredMethods()) {
                    if (!Set.of("countActiveByTeamIdAndDateRange", "countActiveByTeamIdAndDateRangeAnyOrg",
                            "countActiveByUserIdAndDateRange", "countActiveByUserIdsAndDateRange").contains(method.getName())) continue;
                    var query = em.createQuery(method.getAnnotation(Query.class).value());
                    for (var parameter : query.getParameters()) {
                        Object value = switch (parameter.getName()) {
                            case "teamId" -> 7L;
                            case "userId" -> 9L;
                            case "userIds" -> List.of(9L);
                            case "orgId" -> 1L;
                            case "activeStatuses" -> List.of(InterventionStatus.PENDING);
                            case "rangeStart" -> LocalDateTime.of(2026, 9, 15, from, 0);
                            case "rangeEnd" -> LocalDateTime.of(2026, 9, 15, to, 0);
                            default -> throw new AssertionError(parameter.getName());
                        };
                        query.setParameter(parameter.getName(), value);
                    }
                    var rows = query.getResultList();
                    long count = rows.isEmpty() ? 0 : ((Number) (rows.get(0) instanceof Object[] pair ? pair[1] : rows.get(0))).longValue();
                    assertThat(count).as(method.getName()).isEqualTo(expected);
                    checked++;
                }
                assertThat(checked).isEqualTo(4);
            } finally { em.getTransaction().rollback(); }
        }
    }
}
