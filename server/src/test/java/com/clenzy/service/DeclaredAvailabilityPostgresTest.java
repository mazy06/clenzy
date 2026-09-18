package com.clenzy.service;

import com.clenzy.model.TeamAbsence;
import com.clenzy.model.TeamWeeklyAvailability;
import com.clenzy.repository.TeamAbsenceRepository;
import com.clenzy.repository.TeamWeeklyAvailabilityRepository;
import com.clenzy.tenant.TenantContext;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

/** Migration de fonction réelle, tables Hibernate isolées, filtre Hibernate et rôle soumis à RLS. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class DeclaredAvailabilityPostgresTest {
    @Test void externalAvailabilityRemainsCorrectWithoutExposingRowsOrChangingTenantContext() throws Exception {
        String url = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String schema = "baitly_avail_" + suffix; String role = "baitly_avail_role_" + suffix;
        try (var connection = DriverManager.getConnection(url, user, ""); var sql = connection.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            try {
                sql.execute("CREATE ROLE " + role + " NOLOGIN NOSUPERUSER NOBYPASSRLS");
                try {
                    var config = new Configuration().addPackage("com.clenzy.model")
                        .addAnnotatedClass(TeamAbsence.class).addAnnotatedClass(TeamWeeklyAvailability.class)
                        .setProperty("hibernate.connection.url", url).setProperty("hibernate.connection.username", user)
                        .setProperty("hibernate.default_schema", schema).setProperty("hibernate.hbm2ddl.auto", "create-drop");
                    // La requête de production reste identique, seul son schéma est isolé pour ce test.
                    config.setStatementInspector(query -> query.replace("public.baitly_team_declared_available", schema + ".baitly_team_declared_available")
                            .replace("public.baitly_user_declared_available", schema + ".baitly_user_declared_available"));
                    try (var sessions = config.buildSessionFactory(); var em = sessions.createEntityManager()) {
                        String migration = Files.readString(Path.of("src/main/resources/db/changelog/changes/0444__team_declared_availability.sql"));
                        sql.execute(migration.replace("public", schema));
                        sql.execute("CREATE TABLE " + schema + ".teams (id bigint PRIMARY KEY, organization_id bigint, personal_user_id bigint)");
                        sql.execute("INSERT INTO " + schema + ".teams VALUES (1,1,11),(2,1,22)");
                        sql.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes/0445__individual_declared_availability.sql"))
                                .replace("public", schema));
                        for (String table : new String[]{"team_absences", "team_weekly_availability", "teams"}) {
                            sql.execute("ALTER TABLE " + schema + "." + table + " ENABLE ROW LEVEL SECURITY");
                            sql.execute("CREATE POLICY tenant_isolation ON " + schema + "." + table
                                + " USING (current_setting('app.bypass_rls', true) = 'on' OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint)");
                        }
                        sql.execute("GRANT USAGE ON SCHEMA " + schema + " TO " + role);
                        sql.execute("GRANT SELECT ON ALL TABLES IN SCHEMA " + schema + " TO " + role);
                        var monday = LocalDate.of(2026, 9, 14);
                        em.getTransaction().begin();
                        var weekly = new TeamWeeklyAvailability(1L, (short) 1, LocalTime.of(9, 0), LocalTime.of(17, 0));
                        weekly.setOrganizationId(1L); em.persist(weekly);
                        var absence = new TeamAbsence(2L, monday.plusDays(1), monday.plusDays(2), "Privé");
                        absence.setOrganizationId(1L); em.persist(absence);
                        em.getTransaction().commit(); em.clear();
                        em.unwrap(org.hibernate.Session.class).enableFilter("organizationFilter").setParameter("orgId", 99L);
                        em.getTransaction().begin();
                        try {
                            em.createNativeQuery("SET LOCAL ROLE " + role).executeUpdate();
                            em.createNativeQuery("SET LOCAL app.current_org='99'").executeUpdate();
                            em.createNativeQuery("SET LOCAL app.bypass_rls='off'").executeUpdate();
                            var repositories = new JpaRepositoryFactory(em);
                            var weeks = repositories.getRepository(TeamWeeklyAvailabilityRepository.class);
                            var absences = repositories.getRepository(TeamAbsenceRepository.class);
                            assertThat(weeks.findByTeamIdOrderByDayOfWeekAscStartTimeAsc(1L)).isEmpty();
                            assertThat(absences.findCovering(2L, monday.plusDays(1))).isEmpty();
                            var service = new ProviderAvailabilityService(weeks, absences, new TenantContext(),
                                    org.mockito.Mockito.mock(com.clenzy.repository.ServiceRequestRepository.class));
                            assertThat(service.isAvailable(1L, monday.atTime(9, 0), monday.atTime(17, 0))).isTrue();
                            assertThat(service.isAvailable(1L, monday.atTime(8, 0), monday.atTime(17, 0))).isFalse();
                            assertThat(service.isAvailable(1L, monday.plusDays(1).atTime(9, 0), monday.plusDays(1).atTime(10, 0))).isFalse();
                            assertThat(service.isAvailable(1L, monday.atTime(9, 0), monday.plusDays(1).atTime(10, 0))).isFalse();
                            assertThat(service.isAvailable(2L, monday.atTime(22, 0), monday.plusDays(1).atTime(2, 0))).isFalse();
                            assertThat(service.isAvailable(2L, monday.atTime(22, 0), monday.plusDays(1).atStartOfDay())).isTrue();
                            assertThat(service.isAvailable(2L, monday.plusDays(2).atStartOfDay(), monday.plusDays(2).atTime(2, 0))).isFalse();
                            assertThat(service.isAvailable(3L, monday.atTime(22, 0), monday.plusDays(2).atTime(2, 0))).isTrue();
                            assertThat(service.isUserAvailable(11L, monday.atTime(9, 0), monday.atTime(17, 0))).isTrue();
                            assertThat(service.isUserAvailable(11L, monday.atTime(8, 0), monday.atTime(17, 0))).isFalse();
                            assertThat(service.isUserAvailable(22L, monday.atTime(22, 0), monday.plusDays(1).atTime(2, 0))).isFalse();
                            assertThat(service.isUserAvailable(33L, monday.atTime(22, 0), monday.plusDays(1).atTime(2, 0))).isTrue();
                            assertThat(em.createNativeQuery("SELECT current_setting('app.bypass_rls')").getSingleResult()).isEqualTo("off");
                            assertThat(em.createNativeQuery("SELECT current_setting('app.current_org')").getSingleResult()).isEqualTo("99");
                            assertThat(em.createNativeQuery("SELECT count(*) FROM " + schema + ".team_absences").getSingleResult()).isEqualTo(0L);
                            assertThat(em.unwrap(org.hibernate.Session.class).getEnabledFilter("organizationFilter")).isNotNull();
                        } finally {
                            em.getTransaction().rollback();
                        }
                    }
                } finally {
                    sql.execute("DROP SCHEMA " + schema + " CASCADE");
                    sql.execute("DROP ROLE " + role);
                }
            } finally {
                sql.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            }
        }
    }
}
