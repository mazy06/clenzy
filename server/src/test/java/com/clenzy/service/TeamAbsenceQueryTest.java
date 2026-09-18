package com.clenzy.service;

import com.clenzy.model.TeamAbsence;
import com.clenzy.repository.TeamAbsenceRepository;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.time.LocalDate;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

/** Requête JPA réelle sur H2 et PostgreSQL, schéma Hibernate sans migrations ni RLS. */
class TeamAbsenceQueryTest {
    @Test void overlapIncludesBoundaryDaysAndExcludesOtherTeams() {
        verifyOverlap(new Configuration().setProperty("hibernate.connection.url", "jdbc:h2:mem:" + UUID.randomUUID()));
    }

    @Test
    @org.junit.jupiter.api.condition.EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
    void postgresOverlapIncludesBoundaryDaysAndExcludesOtherTeams() throws Exception {
        String url = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String schema = "baitly_absences_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = java.sql.DriverManager.getConnection(url, user, ""); var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
            try {
                verifyOverlap(new Configuration().setProperty("hibernate.connection.url", url)
                    .setProperty("hibernate.connection.username", user).setProperty("hibernate.default_schema", schema));
            } finally {
                statement.execute("DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }

    private void verifyOverlap(Configuration config) {
        try (var sessions = config.addPackage("com.clenzy.model").addAnnotatedClass(TeamAbsence.class)
                .setProperty("hibernate.hbm2ddl.auto", "create-drop").buildSessionFactory();
             var em = sessions.createEntityManager()) {
            var start = LocalDate.of(2026, 9, 15); var end = start.plusDays(2);
            em.getTransaction().begin();
            var absence = new TeamAbsence(7L, start, end, "Congés"); absence.setOrganizationId(1L);
            em.persist(absence); em.getTransaction().commit(); em.clear();
            var repository = new JpaRepositoryFactory(em).getRepository(TeamAbsenceRepository.class);
            assertThat(repository.overlaps(7L, start.minusDays(2), start.minusDays(1))).isFalse();
            assertThat(repository.overlaps(7L, end.plusDays(1), end.plusDays(2))).isFalse();
            assertThat(repository.overlaps(7L, start.minusDays(2), start)).isTrue();
            assertThat(repository.overlaps(7L, end, end.plusDays(2))).isTrue();
            assertThat(repository.overlaps(7L, start.plusDays(1), start.plusDays(1))).isTrue();
            assertThat(repository.overlaps(7L, start.minusDays(2), end.plusDays(2))).isTrue();
            assertThat(repository.overlaps(8L, start, end)).isFalse();
        }
    }
}
