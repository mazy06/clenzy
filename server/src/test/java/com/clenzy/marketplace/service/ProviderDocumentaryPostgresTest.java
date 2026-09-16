package com.clenzy.marketplace.service;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql:.*")
class ProviderDocumentaryPostgresTest {
    SingleConnectionDataSource source; JdbcTemplate db; String schema;
    @BeforeEach void setup() throws Exception {
        source=new SingleConnectionDataSource(System.getProperty("baitly.test.jdbc"),System.getProperty("baitly.test.user","postgres"),"",true);
        db=new JdbcTemplate(source); schema="baitly_docs_"+java.util.UUID.randomUUID().toString().replace("-","");
        db.execute("CREATE SCHEMA "+schema); db.execute("SET search_path TO "+schema);
        db.execute("CREATE TABLE marketplace_providers(id bigint PRIMARY KEY,user_id bigint,email_confirmed_at timestamptz)");
        db.execute("CREATE TABLE provider_documents(id bigint PRIMARY KEY,user_id bigint,marketplace_provider_id bigint,document_type text,status text,expires_at date)");
        try(var sql=getClass().getResourceAsStream("/db/changelog/changes/0460__provider_documentary_reviews.sql")) { db.execute(new String(sql.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8)); }
        db.execute("INSERT INTO marketplace_providers VALUES(1,null,now(),'COMPANY'),(2,8,now(),'COMPANY')");
        db.execute("INSERT INTO provider_documents VALUES(10,null,1,'COMPANY_REGISTRATION','APPROVED',null),(11,null,1,'LIABILITY_INSURANCE','APPROVED',current_date+10),(12,null,1,'OTHER','APPROVED',null)");
    }
    @AfterEach void cleanup() { db.execute("DROP SCHEMA "+schema+" CASCADE"); source.destroy(); }
    boolean eligible(String country,String scope,int days) { return db.queryForObject("SELECT baitly_provider_document_eligible(1,?,?,current_date+?)",Boolean.class,country,scope,days); }
    void review(String scope,String ids) { db.update("INSERT INTO provider_documentary_reviews(provider_id,country,professional_status,service_scope,rule_version,document_ids,regulated,valid_until,note,actor) VALUES(1,'MA','COMPANY',?,0,?,false,current_date+30,'Contrôle manuel','staff')",scope,ids); }
    @Test void unknownCountryNeedsExplicitReviewAndDoesNotImplyAnotherCountryOrService() {
        assertThat(eligible("MA","*",0)).isFalse(); review("*","10");
        assertThat(eligible("MA","*",0)).isTrue();
        assertThat(eligible("FR","*",0)).isFalse(); assertThat(eligible("MA","ITEM:CLEANING",0)).isFalse();
    }
    @Test void onSiteServiceRequiresInsuranceValidOnMissionDate() {
        review("ITEM:CLEANING","10"); assertThat(eligible("MA","ITEM:CLEANING",0)).isFalse();
        review("ITEM:CLEANING","10,11"); assertThat(eligible("MA","ITEM:CLEANING",0)).isTrue();
        assertThat(eligible("MA","ITEM:CLEANING",11)).isFalse();
    }
    @Test void revokedRejectedMissingOrForeignEvidenceStopsEligibility() {
        review("*","10"); db.execute("UPDATE provider_documents SET marketplace_provider_id=null WHERE id=10");
        assertThat(eligible("MA","*",0)).isFalse();
        db.execute("UPDATE provider_documents SET marketplace_provider_id=1,status='REJECTED' WHERE id=10");
        assertThat(eligible("MA","*",0)).isFalse();
        db.execute("UPDATE provider_documents SET status='APPROVED' WHERE id=10");
        db.execute("UPDATE provider_documentary_reviews SET revoked_at=now()");
        assertThat(eligible("MA","*",0)).isFalse();
    }
    @Test void policyChangeRequiresNewReviewAndRegulatedEvidence() {
        review("ITEM:ELECTRIC","10,11"); assertThat(eligible("MA","ITEM:ELECTRIC",0)).isTrue();
        db.execute("INSERT INTO provider_documentary_rules VALUES('MA','COMPANY','ITEM:ELECTRIC','OTHER',true,1,'Licence vérifiée','staff')");
        assertThat(eligible("MA","ITEM:ELECTRIC",0)).isFalse();
        db.execute("UPDATE provider_documentary_reviews SET rule_version=1,document_ids='10,11,12',license_document_id=12");
        assertThat(eligible("MA","ITEM:ELECTRIC",0)).isTrue();
    }
    @Test void accountProvisioningKeepsSameEvidenceButStatusChangeRequiresReview() {
        review("*","10"); db.execute("UPDATE marketplace_providers SET user_id=50 WHERE id=1");
        db.execute("UPDATE provider_documents SET user_id=50,marketplace_provider_id=null WHERE id=10");
        assertThat(eligible("MA","*",0)).isTrue();
        db.execute("UPDATE marketplace_providers SET professional_status='SOLE_TRADER' WHERE id=1");
        assertThat(eligible("MA","*",0)).isFalse();
    }
    @Test void linkedRequestKeepsExactQualificationDespiteGenericMissionType() {
        review("TYPE:ELECTRICAL_REPAIR","10,11");
        var providers=org.mockito.Mockito.mock(com.clenzy.marketplace.repository.MarketplaceProviderRepository.class);
        var provider=new com.clenzy.marketplace.model.MarketplaceProvider(); provider.setId(1L);
        org.mockito.Mockito.when(providers.findByUserId(50L)).thenReturn(java.util.Optional.of(provider));
        org.mockito.Mockito.when(providers.findForErasure(1L)).thenReturn(java.util.Optional.of(provider));
        var service=new ProviderDocumentaryService(db,providers,org.mockito.Mockito.mock(com.clenzy.repository.ProviderDocumentRepository.class),
                org.mockito.Mockito.mock(MarketplaceDecisionJournal.class),java.time.Clock.systemUTC());
        var mission=new com.clenzy.model.Intervention(); mission.setType("PREVENTIVE_MAINTENANCE");
        var user=new com.clenzy.model.User(); user.setId(50L); mission.setAssignedUser(user);
        var property=new com.clenzy.model.Property(); property.setCountryCode("MA"); mission.setProperty(property);
        var request=new com.clenzy.model.ServiceRequest(); request.setServiceType(com.clenzy.model.ServiceType.ELECTRICAL_REPAIR);
        mission.setServiceRequest(request);
        assertThatCode(() -> service.requireAssignment(mission,null)).doesNotThrowAnyException();
        request.setServiceType(com.clenzy.model.ServiceType.PLUMBING_REPAIR);
        assertThatThrownBy(() -> service.requireAssignment(mission,null)).hasMessageContaining("Revue documentaire");
    }

}
