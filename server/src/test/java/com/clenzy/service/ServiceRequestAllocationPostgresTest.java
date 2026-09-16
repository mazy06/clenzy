package com.clenzy.service;

import com.clenzy.repository.ServiceRequestMutationRepositoryImpl;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

/** Vérifie le verrou et les requêtes natifs dans un schéma PostgreSQL temporaire. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class ServiceRequestAllocationPostgresTest {
    static SessionFactory sessions;
    static JdbcTemplate jdbc;
    static String schema;
    static String restrictedRole;
    static final LocalDateTime START = LocalDateTime.of(2026, 9, 15, 9, 0);

    @BeforeAll
    static void setup() throws Exception {
        jdbc = new JdbcTemplate(new DriverManagerDataSource(System.getProperty("baitly.test.jdbc"), System.getProperty("baitly.test.user", "postgres"), ""));
        schema = "baitly_allocation_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.execute("CREATE SCHEMA " + schema);
        jdbc.execute("CREATE TABLE " + schema + ".team_members (team_id bigint, user_id bigint)");
        jdbc.execute("CREATE TABLE " + schema + ".service_requests (id bigint PRIMARY KEY, assigned_to_type varchar(10), assigned_to_id bigint, status varchar(30), desired_date timestamp, estimated_duration_hours integer)");
        jdbc.execute("CREATE TABLE " + schema + ".interventions (id bigint PRIMARY KEY, team_id bigint, assigned_user_id bigint, service_request_id bigint, status varchar(30), scheduled_date timestamp, estimated_duration_hours integer)");
        jdbc.execute("ALTER TABLE " + schema + ".service_requests ADD COLUMN organization_id bigint DEFAULT 1");
        try (var sql = ServiceRequestAllocationPostgresTest.class.getResourceAsStream("/db/changelog/changes/0441__assignment_availability_rls.sql")) {
            jdbc.execute(new String(sql.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)
                    .replace("public.", schema + ".").replace("pg_catalog, public", "pg_catalog, " + schema));
        }
        restrictedRole = schema + "_reader";
        jdbc.execute("CREATE ROLE " + restrictedRole + " NOLOGIN NOSUPERUSER NOBYPASSRLS");
        jdbc.execute("GRANT USAGE ON SCHEMA " + schema + " TO " + restrictedRole);
        jdbc.execute("GRANT SELECT ON ALL TABLES IN SCHEMA " + schema + " TO " + restrictedRole);
        jdbc.execute("ALTER TABLE " + schema + ".service_requests ENABLE ROW LEVEL SECURITY");
        jdbc.execute("ALTER TABLE " + schema + ".service_requests FORCE ROW LEVEL SECURITY");
        jdbc.execute("CREATE POLICY tenant_isolation ON " + schema + ".service_requests USING ("
                + "current_setting(" + "'app.bypass_rls', true) = 'on' OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint)");
        sessions = new Configuration()
                .setProperty("hibernate.connection.url", System.getProperty("baitly.test.jdbc"))
                .setProperty("hibernate.connection.username", System.getProperty("baitly.test.user", "postgres"))
                .buildSessionFactory();
    }

    @AfterAll
    static void cleanup() {
        if (sessions != null) sessions.close();
        if (jdbc != null && schema != null) jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
        if (jdbc != null && restrictedRole != null) jdbc.execute("DROP ROLE " + restrictedRole);
    }

    @BeforeEach
    void reset() {
        jdbc.execute("TRUNCATE " + schema + ".service_requests, " + schema + ".interventions, " + schema + ".team_members");
        jdbc.execute("INSERT INTO " + schema + ".team_members VALUES (7,9),(8,9),(8,10)");
    }

    static EntityManager begin() {
        EntityManager em = sessions.createEntityManager();
        em.getTransaction().begin();
        em.createNativeQuery("SET LOCAL search_path TO " + schema).executeUpdate();
        return em;
    }

    static boolean conflict(EntityManager em, long requestId, String type, long target, LocalDateTime start) {
        return new ServiceRequestMutationRepositoryImpl(em).assignmentConflicts(requestId, type, target, start, 3);
    }

    static void reserve(EntityManager em, long id, String type, long target) {
        em.createNativeQuery("INSERT INTO service_requests VALUES (:id,:kind,:target,'ASSIGNED',:start,3)")
                .setParameter("id", id).setParameter("kind", type).setParameter("target", target)
                .setParameter("start", START).executeUpdate();
    }

    @Test
    void secondRequestWaitsForFirstCommitThenSeesReservation() throws Exception {
        try (var first = begin()) {
            assertThat(conflict(first, 1, "team", 7, START)).isFalse();
            reserve(first, 1, "team", 7);
            var started = new CountDownLatch(1);
            var executor = Executors.newSingleThreadExecutor();
            try {
                var second = executor.submit(() -> {
                    try (var em = begin()) {
                        started.countDown();
                        boolean occupied = conflict(em, 2, "team", 8, START.plusHours(1));
                        em.getTransaction().rollback();
                        return occupied;
                    }
                });
                assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> second.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
                first.getTransaction().commit();
                assertThat(second.get(10, TimeUnit.SECONDS)).isTrue();
            } finally {
                if (first.getTransaction().isActive()) first.getTransaction().rollback();
                executor.shutdownNow();
            }
        }
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {true, false})
    void availabilityEditsAndAssignmentsShareTheTransactionLock(boolean editFirst) {
        try (var first = begin()) {
            if (editFirst) new ServiceRequestMutationRepositoryImpl(first).lockTeamAvailability(7L);
            else assertThat(conflict(first, 1, "team", 7, START)).isFalse();
            try {
                try (var second = begin()) {
                    second.createNativeQuery("SET LOCAL lock_timeout = '150ms'").executeUpdate();
                    try {
                        assertThatThrownBy(() -> {
                            if (editFirst) conflict(second, 2, "team", 7, START);
                            else new ServiceRequestMutationRepositoryImpl(second).lockTeamAvailability(7L);
                        }).hasStackTraceContaining("lock timeout");
                    } finally {
                        second.getTransaction().rollback();
                    }
                }
                first.getTransaction().commit();
                try (var after = begin()) {
                    after.createNativeQuery("SET LOCAL lock_timeout = '150ms'").executeUpdate();
                    new ServiceRequestMutationRepositoryImpl(after).lockTeamAvailability(7L);
                    assertThat(conflict(after, 2, "team", 7, START)).isFalse();
                    after.getTransaction().rollback();
                }
            } finally {
                if (first.getTransaction().isActive()) first.getTransaction().rollback();
            }
        }
    }

    @Test void personalAbsenceEditAlsoLocksIndividualAssignments() {
        try (var edit = begin(); var assignment = begin()) {
            new ServiceRequestMutationRepositoryImpl(edit).lockTeamAvailability(7L);
            assignment.createNativeQuery("SET LOCAL lock_timeout = '150ms'").executeUpdate();
            try {
                assertThatThrownBy(() -> conflict(assignment, 2, "user", 9, START))
                        .hasStackTraceContaining("lock timeout");
            } finally {
                assignment.getTransaction().rollback();
                edit.getTransaction().rollback();
            }
        }
    }

    @Test
    void memberAndTeamShareReservationButAdjacentSlotRemainsFree() {
        try (var em = begin()) {
            reserve(em, 1, "user", 9);
            assertThat(conflict(em, 2, "team", 7, START.plusHours(1))).isTrue();
            assertThat(conflict(em, 2, "user", 9, START.plusHours(3))).isFalse();
            assertThat(conflict(em, 1, "user", 9, START)).isFalse();
            em.getTransaction().rollback();
        }
    }

    @Test
    void existingInterventionBlocksOtherRequestButNotItsSource() {
        try (var em = begin()) {
            em.createNativeQuery("INSERT INTO interventions VALUES (1,7,9,11,'IN_PROGRESS',:start,3)")
                    .setParameter("start", START).executeUpdate();
            assertThat(conflict(em, 12, "user", 9, START.plusHours(1))).isTrue();
            assertThat(conflict(em, 11, "team", 7, START)).isFalse();
            em.getTransaction().rollback();
        }
    }

    @Test
    void cancelledRequestDoesNotReserveSlot() {
        try (var em = begin()) {
            reserve(em, 1, "team", 7);
            em.createNativeQuery("UPDATE service_requests SET status='CANCELLED'").executeUpdate();
            assertThat(conflict(em, 2, "team", 8, START)).isFalse();
            em.getTransaction().rollback();
        }
    }

    @Test
    void interventionUpdateExcludesItselfButStillSeesAnotherRequest() {
        try (var em = begin()) {
            em.createNativeQuery("INSERT INTO interventions VALUES (12,7,9,NULL,'PENDING',:start,3)")
                    .setParameter("start", START).executeUpdate();
            var guard = new ServiceRequestMutationRepositoryImpl(em);
            assertThat(guard.interventionAssignmentConflicts(null, 12L, "user", 9L, START, 3)).isFalse();
            reserve(em, 1, "team", 8);
            assertThat(guard.interventionAssignmentConflicts(null, 12L, "user", 9L, START, 3)).isTrue();
            em.getTransaction().rollback();
        }
    }

    @Test
    void rlsHidesOtherOrganizationsButAvailabilityStillDetectsTheirReservations() {
        try (var em = begin()) {
            reserve(em, 1, "team", 7);
            em.createNativeQuery("UPDATE service_requests SET organization_id=2").executeUpdate();
            em.createNativeQuery("SET LOCAL app.current_org='1'").executeUpdate();
            em.createNativeQuery("SET LOCAL app.bypass_rls='off'").executeUpdate();
            em.createNativeQuery("SET LOCAL ROLE " + restrictedRole).executeUpdate();
            assertThat(((Number) em.createNativeQuery("SELECT COUNT(*) FROM service_requests").getSingleResult()).longValue()).isZero();
            assertThat(conflict(em, 2, "user", 9, START)).isTrue();
            assertThat(new ServiceRequestMutationRepositoryImpl(em).teamHasActiveAssignments(7L)).isTrue();
            assertThat(em.createNativeQuery("SELECT current_setting('app.bypass_rls')").getSingleResult()).isEqualTo("off");
            assertThat(((Number) em.createNativeQuery("SELECT COUNT(*) FROM service_requests").getSingleResult()).longValue()).isZero();
            em.getTransaction().rollback();
        }
    }

    @Test
    void allocationReadsNewMembersAfterWaitingForCompositionChange() throws Exception {
        try (var edit = begin(); var memberBooking = begin()) {
            edit.createNativeQuery("SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('baitly:assignment:team:7',0))").getSingleResult();
            edit.createNativeQuery("UPDATE team_members SET user_id=10 WHERE team_id=7").executeUpdate();
            assertThat(conflict(memberBooking, 1, "user", 10, START)).isFalse();
            reserve(memberBooking, 1, "user", 10);
            var started = new CountDownLatch(1);
            var executor = Executors.newSingleThreadExecutor();
            try {
                var booking = executor.submit(() -> {
                    try (var em = begin()) {
                        started.countDown();
                        boolean occupied = conflict(em, 2, "team", 7, START);
                        em.getTransaction().rollback();
                        return occupied;
                    }
                });
                assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> booking.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
                edit.getTransaction().commit();
                assertThatThrownBy(() -> booking.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
                memberBooking.getTransaction().commit();
                assertThat(booking.get(10, TimeUnit.SECONDS)).isTrue();
            } finally {
                if (edit.getTransaction().isActive()) edit.getTransaction().rollback();
                if (memberBooking.getTransaction().isActive()) memberBooking.getTransaction().rollback();
                executor.shutdownNow();
            }
        }
    }

    @Test
    void previewWorksInReadOnlyTransactionWithoutTakingReservationLocks() {
        try (var seed = begin()) {
            reserve(seed, 1, "team", 7);
            seed.createNativeQuery("UPDATE service_requests SET organization_id=2").executeUpdate();
            seed.getTransaction().commit();
        }
        try (var em = begin()) {
            em.createNativeQuery("SET TRANSACTION READ ONLY").executeUpdate();
            em.createNativeQuery("SET LOCAL app.current_org='1'").executeUpdate();
            em.createNativeQuery("SET LOCAL app.bypass_rls='off'").executeUpdate();
            em.createNativeQuery("SET LOCAL ROLE " + restrictedRole).executeUpdate();
            var repository = new ServiceRequestMutationRepositoryImpl(em);
            assertThat(repository.previewAssignmentConflicts(null, null, "team", 8L, START, 3)).isTrue();
            assertThat(repository.previewAssignmentConflicts(1L, null, "team", 8L, START, 3)).isFalse();
            assertThat(repository.previewAssignmentConflicts(null, null, "team", 8L, START.plusHours(3), 3)).isFalse();
            assertThat(((Number) em.createNativeQuery("SELECT COUNT(*) FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory'")
                    .getSingleResult()).longValue()).isZero();
            assertThat(em.createNativeQuery("SELECT current_setting('app.bypass_rls')").getSingleResult()).isEqualTo("off");
            em.getTransaction().rollback();
        }
    }
}
