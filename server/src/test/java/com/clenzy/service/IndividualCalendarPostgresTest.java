package com.clenzy.service;

import com.clenzy.repository.IndividualCalendarRepository;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Migration réelle, RLS et accès Hibernate : aucun schéma généré par Hibernate. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class IndividualCalendarPostgresTest {
    Connection connection;
    Statement sql;
    String schema;
    String role;
    @BeforeEach void setup() throws Exception {
        schema = "calendar_" + UUID.randomUUID().toString().replace("-", "");
        role = schema + "_reader";
        connection = DriverManager.getConnection(System.getProperty("baitly.test.jdbc"), System.getProperty("baitly.test.user", "postgres"), "");
        sql = connection.createStatement();
        sql.execute("CREATE SCHEMA " + schema);
        sql.execute("CREATE ROLE " + role + " NOLOGIN");
        sql.execute("SET search_path TO " + schema);
        sql.execute("CREATE TABLE users(id bigint PRIMARY KEY)");
        sql.execute("CREATE TABLE teams(id bigint PRIMARY KEY, personal_user_id bigint, organization_id bigint)");
        sql.execute("CREATE TABLE team_members(team_id bigint, user_id bigint)");
        sql.execute("CREATE TABLE marketplace_providers(id bigint PRIMARY KEY, user_id bigint)");
        sql.execute("CREATE TABLE marketplace_provider_availability(id bigserial PRIMARY KEY, provider_id bigint, day_of_week smallint, start_time time, end_time time)");
        sql.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes/0401__provider_availability.sql")));
        sql.execute("INSERT INTO users VALUES (1),(2),(3),(4),(5),(6)");
        sql.execute("INSERT INTO teams VALUES (11,1,101),(12,1,102),(21,2,101),(22,2,102),(30,NULL,101)");
        sql.execute("INSERT INTO marketplace_providers VALUES (1,1),(2,2),(3,3),(4,NULL),(5,NULL)");
        sql.execute("INSERT INTO team_weekly_availability(team_id, day_of_week, start_time, end_time) VALUES (11,1,'09:00','17:00'),(12,1,'11:00','15:00'),(21,1,'09:00','12:00'),(22,2,'09:00','12:00'),(30,3,'09:00','12:00')");
        sql.execute("INSERT INTO team_absences(team_id,start_date,end_date,reason) VALUES (11,'2026-09-20','2026-09-21','Privé'),(12,'2026-09-22','2026-09-23','Autre'),(30,'2026-09-24','2026-09-24','Équipe')");
        sql.execute("INSERT INTO marketplace_provider_availability(provider_id,day_of_week,start_time,end_time) VALUES (1,7,'01:00','23:00'),(3,4,'10:00','16:00'),(4,5,'10:00','16:00'),(5,7,'10:00','16:00')");
        connection.setAutoCommit(false);
        sql.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes/0449__canonical_individual_calendar.sql")).replace("public", schema));
        connection.commit(); connection.setAutoCommit(true);
    }
    @AfterEach void cleanup() throws Exception {
        if (connection == null) return;
        if (!connection.getAutoCommit()) connection.rollback();
        connection.setAutoCommit(true);
        sql.execute("RESET ROLE");
        sql.execute("DROP SCHEMA " + schema + " CASCADE");
        sql.execute("DROP ROLE " + role);
        sql.close(); connection.close();
    }
    @Test void migrationPreservesIntersectionAndAbsencesWithoutShadowRows() throws Exception {
        assertThat(number("SELECT count(*) FROM individual_weekly_availability WHERE user_id=1 AND day_of_week=1 AND start_time='11:00' AND end_time='15:00'")).isEqualTo(1);
        assertThat(number("SELECT count(*) FROM individual_absences WHERE user_id=1")).isEqualTo(2);
        assertThat(number("SELECT count(*) FROM team_weekly_availability WHERE team_id<>30")).isZero();
        assertThat(number("SELECT count(*) FROM team_absences WHERE team_id<>30")).isZero();
        assertThat(number("SELECT count(*) FROM marketplace_provider_availability WHERE provider_id IN (1,2,3)")).isZero();
        assertThat(verdict("baitly_user_declared_available(1,timestamp '2026-09-14 11:00',timestamp '2026-09-14 15:00')")).isTrue();
        assertThat(verdict("baitly_team_declared_available(12,timestamp '2026-09-14 10:00',timestamp '2026-09-14 15:00')")).isFalse();
        assertThat(verdict("baitly_team_declared_available(11,timestamp '2026-09-21 11:00',timestamp '2026-09-21 12:00')")).isFalse();
        assertThat(verdict("baitly_provider_available_on_day(1,7)")).isFalse();
        assertThat(verdict("baitly_provider_available_on_day(3,4)")).isTrue();
        assertThat(verdict("baitly_team_declared_available(30,timestamp '2026-09-16 10:00',timestamp '2026-09-16 11:00')")).isTrue();
    }
    @Test void removingPersonalTeamsDoesNotRemoveThePersonsCalendar() throws Exception {
        sql.execute("DELETE FROM teams WHERE personal_user_id=1");
        assertThat(verdict("baitly_provider_available_on_day(1,1)")).isTrue();
        assertThat(verdict("baitly_provider_available_on_day(1,7)")).isFalse();
        assertThat(number("SELECT count(*) FROM individual_absences WHERE user_id=1")).isEqualTo(2);
    }
    @Test void contradictorySchedulesStayUnavailableRatherThanBecomingUnrestricted() throws Exception {
        assertThat(verdict("baitly_provider_weekly_restricted(2)")).isTrue();
        assertThat(number("SELECT count(*) FROM individual_weekly_availability WHERE user_id=2")).isZero();
        for (int day=1;day<=7;day++) assertThat(verdict("baitly_provider_available_on_day(2,"+day+")")).isFalse();
        assertThat(verdict("baitly_provider_available_on_day(2,NULL)")).isFalse();
    }
    @Test void linkingTransfersCandidateOnceAndNeverRepopulatesAnExistingCalendar() throws Exception {
        sql.execute("UPDATE marketplace_providers SET user_id=4 WHERE id=4");
        assertThat(number("SELECT count(*) FROM individual_weekly_availability WHERE user_id=4 AND day_of_week=5")).isEqualTo(1);
        assertThat(number("SELECT count(*) FROM marketplace_provider_availability WHERE provider_id=4")).isZero();
        sql.execute("DELETE FROM individual_weekly_availability WHERE user_id=4");
        sql.execute("UPDATE individual_calendars SET weekly_restricted=false WHERE user_id=4");
        sql.execute("UPDATE marketplace_providers SET user_id=4 WHERE id=5");
        assertThat(number("SELECT count(*) FROM individual_weekly_availability WHERE user_id=4")).isZero();
        assertThat(verdict("baitly_provider_available_on_day(5,1)")).isTrue();
        assertThatThrownBy(() -> sql.execute("UPDATE marketplace_providers SET user_id=NULL WHERE id=4")).hasMessageContaining("propriétaire");
    }
    @Test void collectiveTeamAlsoUsesItsMembersCanonicalCalendars() throws Exception {
        sql.execute("INSERT INTO team_members VALUES(30,1)");
        assertThat(verdict("baitly_team_declared_available(30,timestamp '2026-09-16 10:00',timestamp '2026-09-16 11:00')")).isFalse();
        sql.execute("UPDATE individual_calendars SET weekly_restricted=false WHERE user_id=1");
        assertThat(verdict("baitly_team_declared_available(30,timestamp '2026-09-16 10:00',timestamp '2026-09-16 11:00')")).isTrue();
        sql.execute("INSERT INTO individual_absences(user_id,start_date,end_date) VALUES(1,'2026-09-16','2026-09-16')");
        assertThat(verdict("baitly_team_declared_available(30,timestamp '2026-09-16 10:00',timestamp '2026-09-16 11:00')")).isFalse();
    }
    @Test void oldWritersCannotRecreatePersonalOrLinkedCandidateCalendars() {
        assertThatThrownBy(() -> sql.execute("INSERT INTO team_weekly_availability(team_id,day_of_week,start_time,end_time) VALUES(11,1,'09:00','17:00')")).hasMessageContaining("canonique");
        assertThatThrownBy(() -> sql.execute("INSERT INTO team_absences(team_id,start_date,end_date) VALUES(11,'2026-09-20','2026-09-20')")).hasMessageContaining("canonique");
        assertThatThrownBy(() -> sql.execute("INSERT INTO marketplace_provider_availability(provider_id,day_of_week,start_time,end_time) VALUES(1,1,'09:00','17:00')")).hasMessageContaining("canonique");
    }
    @Test void activationAndCandidateWritesCannotLeaveAShadowCalendar() throws Exception {
        connection.setAutoCommit(false);
        sql.execute("UPDATE marketplace_providers SET user_id=4 WHERE id=4");
        try (var other = DriverManager.getConnection(System.getProperty("baitly.test.jdbc"),
                System.getProperty("baitly.test.user", "postgres"), ""); var concurrent = other.createStatement()) {
            concurrent.execute("SET search_path TO " + schema);
            concurrent.execute("SET lock_timeout='200ms'");
            String insert = "INSERT INTO marketplace_provider_availability(provider_id,day_of_week,start_time,end_time) VALUES(4,6,'09:00','17:00')";
            assertThatThrownBy(() -> concurrent.execute(insert)).hasMessageContaining("lock timeout");
            connection.commit(); connection.setAutoCommit(true);
            assertThatThrownBy(() -> concurrent.execute(insert)).hasMessageContaining("canonique");
            assertThat(number("SELECT count(*) FROM marketplace_provider_availability WHERE provider_id=4")).isZero();
        }
    }
    @Test void rlsKeepsPrivateAbsencesHiddenAndPublicVerdictsRestoreContext() throws Exception {
        sql.execute("GRANT USAGE ON SCHEMA "+schema+" TO "+role);
        sql.execute("GRANT SELECT ON ALL TABLES IN SCHEMA "+schema+" TO "+role);
        sql.execute("SET ROLE "+role);
        sql.execute("SET app.bypass_rls='off'");
        sql.execute("SET app.calendar_user='2'");
        assertThat(number("SELECT count(*) FROM individual_absences")).isZero();
        assertThat(verdict("baitly_provider_available_on_day(1,1)")).isTrue();
        assertThat(number("SELECT count(*) FROM baitly_provider_weekly(ARRAY[1,3]::bigint[])")).isEqualTo(2);
        assertThat(number("SELECT count(*) FROM individual_absences")).isZero();
        try (var result=sql.executeQuery("SELECT current_setting('app.bypass_rls'),current_setting('app.calendar_user')")) {
            result.next(); assertThat(result.getString(1)).isEqualTo("off"); assertThat(result.getString(2)).isEqualTo("2");
        }
    }
    @Test void repositoryEditsSameCalendarAcrossOrganizationsAndChecksAbsenceOwner() {
        var config=new Configuration().setProperty("hibernate.connection.url",System.getProperty("baitly.test.jdbc"))
            .setProperty("hibernate.connection.username",System.getProperty("baitly.test.user","postgres"))
            .setProperty("hibernate.hbm2ddl.auto","none")
            .addAnnotatedClass(com.clenzy.marketplace.model.MarketplaceProvider.class)
            .addAnnotatedClass(com.clenzy.marketplace.model.MarketplaceProviderOffer.class).addAnnotatedClass(com.clenzy.model.ProviderTariff.class)
            .addAnnotatedClass(com.clenzy.marketplace.model.MarketplaceServiceCategory.class)
            .addAnnotatedClass(com.clenzy.marketplace.model.MarketplaceServiceItem.class)
            .addAnnotatedClass(com.clenzy.marketplace.model.MarketplaceProviderZone.class)
            .addAnnotatedClass(com.clenzy.marketplace.model.MarketplaceProviderAvailability.class);
        config.setStatementInspector(query -> query.replace("public.baitly_", schema + ".baitly_"));
        try(var factory=config.buildSessionFactory(); var em=factory.createEntityManager()) {
            var repo=new IndividualCalendarRepository(em);
            em.getTransaction().begin();
            em.createNativeQuery("SET search_path TO "+schema).executeUpdate();
            em.createNativeQuery("SET LOCAL app.current_org='101'").executeUpdate();
            repo.replaceWeekly(1L,List.of(new IndividualCalendarRepository.Slot(null,(short)3,LocalTime.of(8,0),LocalTime.of(12,0))));
            try {
                assertThat(verdict("pg_try_advisory_xact_lock(hashtextextended('baitly:assignment:user:1',0))")).isFalse();
            } catch (Exception failure) { throw new RuntimeException(failure); }
            var publicCalendar = new org.springframework.data.jpa.repository.support.JpaRepositoryFactory(em)
                .getRepository(com.clenzy.marketplace.repository.MarketplaceProviderAvailabilityRepository.class);
            assertThat(publicCalendar.effectiveWeekly(new Long[]{1L})).singleElement()
                .satisfies(slot -> {
                    assertThat(slot.getProviderId()).isEqualTo(1L);
                    assertThat(slot.getDayOfWeek()).isEqualTo((short)3);
                    assertThat(slot.getStartTime()).isEqualTo(LocalTime.of(8,0));
                });
            assertThat(publicCalendar.restrictedProviderIds(List.of(1L,2L))).containsExactlyInAnyOrder(1L,2L);
            var absence=repo.addAbsence(1L,LocalDate.of(2026,9,25),LocalDate.of(2026,9,25),"Privé");
            em.createNativeQuery("SET LOCAL app.current_org='102'").executeUpdate();
            assertThat(repo.weekly(1L)).singleElement().satisfies(s -> assertThat(s.dayOfWeek()).isEqualTo((short)3));
            assertThat(repo.restricted(1L)).isTrue();
            repo.removeAbsence(2L,absence.id());
            assertThat(repo.absences(1L)).hasSize(3);
            repo.removeAbsence(1L,absence.id());
            assertThat(repo.absences(1L)).hasSize(2);
            repo.replaceWeekly(1L,List.of());
            assertThat(repo.restricted(1L)).isFalse();
            assertThat(em.createNativeQuery("SELECT current_setting('app.calendar_user')").getSingleResult()).isEqualTo("");
            em.getTransaction().commit();
        }
    }
    private long number(String query) throws Exception { try(var result=sql.executeQuery(query)){result.next();return result.getLong(1);} }
    private boolean verdict(String expression) throws Exception { try(var result=sql.executeQuery("SELECT "+expression)){result.next();return result.getBoolean(1);} }
}
