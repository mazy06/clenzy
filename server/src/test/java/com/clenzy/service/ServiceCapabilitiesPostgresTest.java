package com.clenzy.service;

import com.clenzy.service.catalog.ServiceCapabilityPolicy;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named="baitly.test.jdbc", matches="jdbc:postgresql:.*")
class ServiceCapabilitiesPostgresTest {
    SingleConnectionDataSource source;
    JdbcTemplate db;
    String schema;
    ServiceCapabilityPolicy policy;
    @BeforeEach void setup() throws Exception {
        source = new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),
            System.getProperty("baitly.test.user","postgres"), "", true);
        db=new JdbcTemplate(source);
        schema="baitly_cap_"+UUID.randomUUID().toString().replace("-", "");
        db.execute("CREATE SCHEMA "+schema);
        db.execute("SET search_path TO "+schema);
        db.execute("CREATE TABLE marketplace_service_categories(id bigint PRIMARY KEY,active boolean)");
        db.execute("INSERT INTO marketplace_service_categories VALUES(1,true)");
        db.execute("CREATE TABLE marketplace_service_items(code varchar(60) PRIMARY KEY,category_id bigint,active boolean)");
        db.execute("INSERT INTO marketplace_service_items VALUES('cleaning-turnover',1,true),('photo',1,true),('electrical',1,true)");
        db.execute("CREATE TABLE users(id bigint PRIMARY KEY,organization_id bigint)");
        db.execute("INSERT INTO users VALUES(9,8)");
        db.execute("CREATE TABLE teams(id bigint PRIMARY KEY,organization_id bigint,intervention_type text,personal_user_id bigint)");
        db.execute("INSERT INTO teams VALUES(1,7,'CLEANING',null),(2,7,'MAINTENANCE',null),(3,8,'TECHNICIAN',9),(5,8,'OTHER',77)");
        db.execute("CREATE TABLE property_teams(id bigint PRIMARY KEY,organization_id bigint,property_id bigint UNIQUE,team_id bigint)");
        db.execute("INSERT INTO property_teams VALUES(1,7,100,1),(2,7,200,2)");
        try(var sql=getClass().getResourceAsStream("/db/changelog/changes/0462__team_service_capabilities.sql")) {
            db.execute(new String(sql.readAllBytes(),StandardCharsets.UTF_8));
        }
        try(var sql=getClass().getResourceAsStream("/db/changelog/changes/0469__personal_capability_owner.sql")) {
            db.execute(new String(sql.readAllBytes(),StandardCharsets.UTF_8));
        }
        policy=new ServiceCapabilityPolicy(db,org.mockito.Mockito.mock(com.clenzy.marketplace.repository.MarketplaceProviderRepository.class),org.mockito.Mockito.mock(com.clenzy.marketplace.service.MarketplaceExposureService.class));
    }
    @AfterEach void cleanup() { db.execute("DROP SCHEMA "+schema+" CASCADE"); source.destroy(); }

    @Test void migrationDoesNotTurnBroadCategoriesOrRolesIntoQualifications() {
        assertThat(db.queryForObject("SELECT count(*) FROM personal_capability_owners",Integer.class)).isEqualTo(1);
        assertThat(policy.supports("team",1L,"cleaning-turnover")).isTrue();
        assertThat(policy.supports("team",2L,"electrical")).isFalse();
        assertThat(policy.supports("user",9L,"electrical")).isFalse();
        assertThat(db.queryForObject("SELECT active FROM property_teams WHERE id=2",Boolean.class)).isFalse();
    }

    @Test void anyNewCatalogueServiceCanBeExplicitlyDeclaredWithoutChangingJava() {
        db.execute("INSERT INTO team_service_capabilities VALUES(2,'photo'),(3,'electrical')");
        assertThat(policy.supports("team",2L,"photo")).isTrue();
        assertThat(policy.supports("user",9L,"electrical")).isTrue();
        assertThat(policy.supports("user",9L,"photo")).isFalse();
        assertThatThrownBy(() -> policy.require("team",2L,null)).hasMessageContaining("qualifiée");
        db.execute("UPDATE marketplace_service_items SET active=false WHERE code='photo'");
        assertThatThrownBy(() -> policy.require("team",2L,"photo")).hasMessageContaining("capacité");
    }

    @Test void propertyKeepsDifferentServicesAndSeveralCandidatesButRejectsExactDuplicates() {
        db.execute("INSERT INTO property_teams VALUES(3,7,100,2,'photo',10,true),(4,7,100,3,'photo',20,true)");
        assertThat(db.queryForObject("SELECT count(*) FROM property_teams WHERE property_id=100",Integer.class)).isEqualTo(3);
        assertThatThrownBy(() -> db.execute("INSERT INTO property_teams VALUES(5,7,100,2,'photo',30,true)"))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        db.execute("DELETE FROM property_teams WHERE id=3 AND organization_id=7");
        assertThat(db.queryForObject("SELECT count(*) FROM property_teams WHERE property_id=100",Integer.class)).isEqualTo(2);
    }
    @Test void activeIndividualMissionProtectsItsPersonalCapabilities() throws Exception {
        db.execute("CREATE TABLE service_requests(assigned_to_type text,assigned_to_id bigint,status text,id bigserial)");
        db.execute("CREATE TABLE interventions(team_id bigint,assigned_user_id bigint,status text,service_request_id bigint)");
        try(var sql=getClass().getResourceAsStream("/db/changelog/changes/0463__capability_assignment_lock.sql")) {
            db.execute(new String(sql.readAllBytes(),StandardCharsets.UTF_8)
                .replace("public.",schema+".").replace("pg_catalog, public","pg_catalog, "+schema));
        }
        assertThat(db.queryForObject("SELECT baitly_team_has_active_assignments(3)",Boolean.class)).isFalse();
        db.execute("INSERT INTO interventions(team_id,assigned_user_id,status) VALUES(null,9,'IN_PROGRESS')");
        assertThat(db.queryForObject("SELECT baitly_team_has_active_assignments(3)",Boolean.class)).isTrue();
        assertThat(db.queryForObject("SELECT baitly_team_has_active_assignments(2)",Boolean.class)).isFalse();
        db.execute("UPDATE interventions SET status='COMPLETED'");
        assertThat(db.queryForObject("SELECT baitly_team_has_active_assignments(3)",Boolean.class)).isFalse();
        db.execute("INSERT INTO service_requests(assigned_to_type,assigned_to_id,status) VALUES('user',9,'ASSIGNED')");
        assertThat(db.queryForObject("SELECT baitly_team_has_active_assignments(3)",Boolean.class)).isTrue();
        db.execute("UPDATE interventions SET service_request_id=1");
        assertThat(db.queryForObject("SELECT baitly_team_has_active_assignments(3)",Boolean.class)).isFalse();
        db.execute("INSERT INTO teams VALUES(4,12,'OTHER',9)");
        db.execute("INSERT INTO interventions(team_id,status) VALUES(4,'IN_PROGRESS')");
        assertThat(db.queryForObject("SELECT baitly_team_has_active_assignments(3)",Boolean.class)).isTrue();
    }

    @Test void documentaryAliasesPreserveProofsButNeverOverrideAPreciseRule() throws Exception {
        db.execute("CREATE TABLE service_catalog_legacy_aliases(legacy_type text,service_item_code text)");
        db.execute("INSERT INTO service_catalog_legacy_aliases VALUES('CLEANING','cleaning-turnover')");
        db.execute("""
            CREATE TABLE provider_documentary_rules(country text,professional_status text,service_scope text,
            required_types text,regulated boolean,version bigint,reason text,actor text,
            PRIMARY KEY(country,professional_status,service_scope))
            """);
        db.execute("""
            CREATE TABLE provider_documentary_reviews(id bigint PRIMARY KEY,provider_id bigint,country text,
            professional_status text,service_scope text,rule_version bigint,document_ids text)
            """);
        db.execute("""
            INSERT INTO provider_documentary_rules VALUES
            ('FR','COMPANY','TYPE:CLEANING','INSURANCE',false,2,'Checked','reviewer'),
            ('MA','COMPANY','TYPE:CLEANING','INSURANCE',false,2,'Checked','reviewer'),
            ('MA','COMPANY','ITEM:cleaning-turnover','LICENSE',true,3,'Precise','reviewer')
            """);
        db.execute("""
            INSERT INTO provider_documentary_reviews VALUES
            (1,8,'FR','COMPANY','TYPE:CLEANING',2,'4,5'),
            (2,9,'MA','COMPANY','TYPE:CLEANING',2,'6,7'),
            (3,10,'FR','COMPANY','TYPE:CLEANING',2,'8,9'),
            (4,10,'FR','COMPANY','ITEM:cleaning-turnover',2,'10,11')
            """);
        String migration;
        try(var sql=getClass().getResourceAsStream("/db/changelog/changes/0464__canonical_documentary_scopes.sql")) {
            migration=new String(sql.readAllBytes(),StandardCharsets.UTF_8);
        }
        db.execute(migration);
        db.execute(migration);
        assertThat(db.queryForObject("SELECT service_scope FROM provider_documentary_reviews WHERE id=1",String.class)).isEqualTo("ITEM:cleaning-turnover");
        assertThat(db.queryForObject("SELECT document_ids FROM provider_documentary_reviews WHERE id=1",String.class)).isEqualTo("4,5");
        assertThat(db.queryForObject("SELECT service_scope FROM provider_documentary_reviews WHERE id=2",String.class)).isEqualTo("TYPE:CLEANING");
        assertThat(db.queryForObject("SELECT service_scope FROM provider_documentary_reviews WHERE id=3",String.class)).isEqualTo("TYPE:CLEANING");
        assertThat(db.queryForObject("SELECT count(*) FROM provider_documentary_reviews",Integer.class)).isEqualTo(4);
    }

    @Test void aCapabilityDoesNotAuthorizeAnUnrelatedOrganization() {
        db.execute("CREATE TABLE organizations(id bigint PRIMARY KEY,type text)");
        db.execute("INSERT INTO organizations VALUES(7,'CONCIERGE'),(8,'CLEANING_COMPANY'),(10,'SYSTEM')");
        db.execute("CREATE TABLE organization_members(organization_id bigint,user_id bigint)");
        db.execute("CREATE TABLE marketplace_providers(id bigint PRIMARY KEY,user_id bigint)");
        db.execute("CREATE TABLE team_members(team_id bigint,user_id bigint)");
        assertThat(policy.contextAllowed("team",1L,"cleaning-turnover",7L)).isTrue();
        assertThat(policy.candidateTeamIds("cleaning-turnover",7L)).containsExactly(1L);
        db.execute("INSERT INTO team_service_capabilities VALUES(3,'electrical')");
        assertThat(policy.candidateTeamIds("electrical",7L)).isEmpty();
        assertThat(policy.contextAllowed("team",3L,"electrical",7L)).isFalse();
        assertThatThrownBy(() -> policy.requireContext("team",3L,"electrical",7L)).hasMessageContaining("organisation");
        var property = new com.clenzy.model.Property(); property.setOrganizationId(8L);
        assertThatThrownBy(() -> policy.requireResourceContext(7L,property)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test void personalCapabilitiesHaveOneOwnerAcrossOrganizationAttachments() {
        db.execute("INSERT INTO teams VALUES(4,12,'OTHER',9)");
        db.execute("INSERT INTO team_service_capabilities VALUES(3,'electrical'),(4,'photo')");
        assertThat(policy.supports("team",4L,"electrical")).isTrue();
        assertThat(policy.supports("team",4L,"photo")).isFalse();
        assertThat(policy.supports("user",9L,"photo")).isFalse();
        assertThatThrownBy(() -> db.execute("INSERT INTO personal_capability_owners VALUES(9,4)"))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

}
