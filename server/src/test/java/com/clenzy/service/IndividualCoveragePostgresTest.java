package com.clenzy.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class IndividualCoveragePostgresTest {
    Connection connection; Statement sql; String schema;
    @BeforeEach void setup() throws Exception {
        schema = "coverage_" + UUID.randomUUID().toString().replace("-", "");
        connection = DriverManager.getConnection(System.getProperty("baitly.test.jdbc"), System.getProperty("baitly.test.user","postgres"),"");
        sql = connection.createStatement();
        sql.execute("CREATE SCHEMA "+schema); sql.execute("SET search_path TO "+schema);
        sql.execute("CREATE TABLE users(id bigint PRIMARY KEY)");
        sql.execute("CREATE TABLE teams(id bigint PRIMARY KEY, personal_user_id bigint, organization_id bigint)");
        sql.execute("CREATE TABLE marketplace_providers(id bigint PRIMARY KEY, user_id bigint)");
        sql.execute("CREATE TABLE team_coverage_zones(id bigserial PRIMARY KEY,team_id bigint,country varchar(2),department varchar(3),arrondissement varchar(5),city varchar(100),organization_id bigint)");
        sql.execute("CREATE TABLE marketplace_provider_zones(id bigserial PRIMARY KEY,provider_id bigint NOT NULL,country_code varchar(2),department varchar(3),city varchar(80),postal_code varchar(10),radius_km integer,is_primary boolean NOT NULL DEFAULT false,created_at timestamp DEFAULT CURRENT_TIMESTAMP)");
        sql.execute("INSERT INTO users VALUES(1),(2),(3),(4)");
        sql.execute("INSERT INTO teams VALUES(11,1,101),(12,1,102),(20,2,101),(30,NULL,101)");
        sql.execute("INSERT INTO marketplace_providers VALUES(1,1),(2,1),(3,2),(4,3),(5,NULL),(6,NULL)");
        sql.execute("INSERT INTO team_coverage_zones(team_id,country,department,arrondissement,city) VALUES (11,'FR','75','75001',NULL),(12,'MA',NULL,NULL,'Marrakech'),(30,'FR','69',NULL,NULL)");
        sql.execute("INSERT INTO marketplace_provider_zones(provider_id,country_code,department,city) VALUES (1,'FR','06','Nice'),(3,'FR','13','Marseille'),(4,'MA',NULL,'Rabat'),(5,'FR','92','Boulogne'),(6,'FR','69','Lyon')");
        connection.setAutoCommit(false);
        sql.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes/0450__canonical_provider_coverage.sql")).replace("public",schema));
        connection.commit(); connection.setAutoCommit(true);
    }
    @AfterEach void cleanup() throws Exception {
        if(connection==null) return;
        if(!connection.getAutoCommit()) connection.rollback();
        connection.setAutoCommit(true); sql.execute("RESET ROLE");
        sql.execute("DROP SCHEMA "+schema+" CASCADE"); sql.close(); connection.close();
    }
    @Test void migrationTransfersZonesAndPreservesEmptyDeclarations() throws Exception {
        assertThat(count("SELECT count(*) FROM marketplace_provider_zones WHERE user_id=1")).isEqualTo(2);
        assertThat(count("SELECT count(*) FROM marketplace_provider_zones WHERE user_id=2")).isZero();
        assertThat(count("SELECT count(*) FROM marketplace_provider_zones WHERE user_id=3 AND city='Rabat'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM team_coverage_zones WHERE team_id<>30")).isZero();
        assertThat(count("SELECT count(*) FROM marketplace_provider_zones WHERE provider_id IN (1,2,3,4)")).isZero();
        assertThat(covers(11,"FR","75","75001",null)).isTrue();
        assertThat(covers(12,"FR","75","75001",null)).isTrue();
        assertThat(covers(11,"FR","75","75002",null)).isFalse();
        assertThat(covers(11,"FR","75",null,null)).isFalse();
        assertThat(covers(12,"MA",null,null,"marrakech")).isTrue();
        assertThat(covers(30,"FR","69",null,null)).isTrue();
    }
    @Test void linkingTransfersDraftOnceAndDoesNotResurrectAnEmptyProfile() throws Exception {
        sql.execute("UPDATE marketplace_providers SET user_id=4 WHERE id=5");
        assertThat(count("SELECT count(*) FROM marketplace_provider_zones WHERE user_id=4 AND city='Boulogne'")).isEqualTo(1);
        sql.execute("DELETE FROM marketplace_provider_zones WHERE user_id=4");
        sql.execute("UPDATE marketplace_providers SET user_id=4 WHERE id=6");
        assertThat(count("SELECT count(*) FROM marketplace_provider_zones WHERE user_id=4 OR provider_id IN (5,6)")).isZero();
        assertThatThrownBy(()->sql.execute("UPDATE marketplace_providers SET user_id=NULL WHERE id=5")).hasMessageContaining("propriétaire");
    }
    @Test void oldWritersCannotRecreateCopies() {
        assertThatThrownBy(()->sql.execute("INSERT INTO team_coverage_zones(team_id,country,department) VALUES(11,'FR','75')")).hasMessageContaining("canoniques");
        assertThatThrownBy(()->sql.execute("INSERT INTO marketplace_provider_zones(provider_id,country_code,department) VALUES(1,'FR','75')")).hasMessageContaining("canoniques");
        assertThatThrownBy(()->sql.execute("INSERT INTO marketplace_provider_zones(user_id,provider_id,country_code) VALUES(1,5,'FR')")).hasMessageContaining("ck_coverage_single_owner");
    }
    @Test void removingPersonalTeamsDoesNotRemoveGlobalCoverage() throws Exception {
        sql.execute("DELETE FROM teams WHERE personal_user_id=1");
        assertThat(count("SELECT count(*) FROM marketplace_provider_zones WHERE user_id=1")).isEqualTo(2);
    }
    @Test void coverageVerdictRestoresTenantContextAndDoesNotExposeOtherTeams() throws Exception {
        String role = schema + "_reader";
        sql.execute("CREATE ROLE " + role + " NOLOGIN");
        try {
            sql.execute("ALTER TABLE teams ENABLE ROW LEVEL SECURITY");
            sql.execute("CREATE POLICY tenant_scope ON teams USING (current_setting('app.bypass_rls',true)='on' OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint)");
            sql.execute("GRANT USAGE ON SCHEMA " + schema + " TO " + role);
            sql.execute("GRANT SELECT ON ALL TABLES IN SCHEMA " + schema + " TO " + role);
            sql.execute("SET ROLE " + role); sql.execute("SET app.current_org='999'"); sql.execute("SET app.bypass_rls='off'");
            assertThat(count("SELECT count(*) FROM teams")).isZero();
            assertThat(covers(11,"FR","75","75001",null)).isTrue();
            assertThat(count("SELECT count(*) FROM teams")).isZero();
            try (var rows=sql.executeQuery("SELECT current_setting('app.bypass_rls')")) {
                rows.next(); assertThat(rows.getString(1)).isEqualTo("off");
            }
        } finally {
            sql.execute("RESET ROLE");
            sql.execute("DROP OWNED BY " + role); sql.execute("DROP ROLE " + role);
        }
    }
    @Test void repositoryProjectsSameZonesForEveryProfileAndReadsChangesImmediately() {
        var config = new Configuration().setProperty("hibernate.connection.url",System.getProperty("baitly.test.jdbc"))
            .setProperty("hibernate.connection.username",System.getProperty("baitly.test.user","postgres"))
            .setProperty("hibernate.default_schema",schema).setProperty("hibernate.hbm2ddl.auto","none")
            .addAnnotatedClass(MarketplaceProvider.class).addAnnotatedClass(MarketplaceProviderOffer.class).addAnnotatedClass(com.clenzy.model.ProviderTariff.class)
            .addAnnotatedClass(MarketplaceServiceCategory.class).addAnnotatedClass(MarketplaceServiceItem.class)
            .addAnnotatedClass(MarketplaceProviderZone.class).addAnnotatedClass(MarketplaceProviderAvailability.class);
        try(var factory=config.buildSessionFactory(); var em=factory.createEntityManager()) {
            em.getTransaction().begin(); em.createNativeQuery("SET search_path TO "+schema).executeUpdate();
            var repo=new JpaRepositoryFactory(em).getRepository(MarketplaceProviderZoneRepository.class);
            var projections=repo.effectiveZones(List.of(1L,2L,4L,5L));
            assertThat(projections).hasSize(6);
            assertThat(projections.stream().filter(z->z.getProviderId().equals(1L))).hasSize(2);
            assertThat(projections.stream().filter(z->z.getProviderId().equals(2L))).hasSize(2);
            repo.lockIndividual(1L); repo.initializeIndividual(1L); repo.deleteIndividualZones(1L);
            var zone=new MarketplaceProviderZone();zone.setUserId(1L);zone.setCountryCode("FR");zone.setDepartment("33");zone.setCity("Bordeaux");
            repo.saveAndFlush(zone);
            assertThat(repo.effectiveZones(List.of(1L,2L))).hasSize(2).allSatisfy(z->assertThat(z.getCity()).isEqualTo("Bordeaux"));
            var query = com.clenzy.repository.TeamCoverageZoneRepository.class;
            try {
                String source=query.getMethod("findTeamIdsByDepartment",String.class,Long.class).getAnnotation(org.springframework.data.jpa.repository.Query.class).value().replace("public",schema);
                assertThat(em.createNativeQuery(source).setParameter("dept","33").setParameter("orgId",101L).getResultList()).hasSize(1);
                assertThat(em.createNativeQuery(source).setParameter("dept","33").setParameter("orgId",102L).getResultList()).hasSize(1);
                assertThat(em.createNativeQuery(source).setParameter("dept","33").setParameter("orgId",999L).getResultList()).isEmpty();
            } catch (ReflectiveOperationException failure) {throw new RuntimeException(failure);}
            em.getTransaction().commit();
        }
    }
    @Test void activationSerializesWithDraftEdits() throws Exception {
        connection.setAutoCommit(false);
        sql.execute("UPDATE marketplace_providers SET user_id=4 WHERE id=5");
        try(var second=DriverManager.getConnection(System.getProperty("baitly.test.jdbc"),System.getProperty("baitly.test.user","postgres"),"");var other=second.createStatement()){
            other.execute("SET search_path TO "+schema);other.execute("SET lock_timeout='200ms'");
            String insert="INSERT INTO marketplace_provider_zones(provider_id,country_code,department) VALUES(5,'FR','75')";
            assertThatThrownBy(()->other.execute(insert)).hasMessageContaining("lock timeout");
            connection.commit();connection.setAutoCommit(true);
            assertThatThrownBy(()->other.execute(insert)).hasMessageContaining("canoniques");
        }
    }
    private long count(String query) throws Exception {try(var result=sql.executeQuery(query)){result.next();return result.getLong(1);}}
    private boolean covers(long team,String country,String department,String arrondissement,String city) throws Exception {
        try(var query=connection.prepareStatement("SELECT baitly_team_covers(?,?,?,?,?)")){
            query.setLong(1,team);query.setString(2,country);query.setString(3,department);query.setString(4,arrondissement);query.setString(5,city);
            try(var result=query.executeQuery()){result.next();return result.getBoolean(1);}
        }
    }
}
