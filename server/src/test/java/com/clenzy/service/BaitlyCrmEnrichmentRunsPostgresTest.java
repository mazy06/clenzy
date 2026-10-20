package com.clenzy.service;

import com.clenzy.marketplace.service.BaitlyProfessionalDirectory.ImportResult;
import com.clenzy.tenant.TenantScopedExecutor;
import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="baitly.directory.test.jdbc",matches="jdbc:postgresql://127\\.0\\.0\\.1:55442/postgres")
class BaitlyCrmEnrichmentRunsPostgresTest {
    JdbcTemplate db;String schema,url;AtomicLong org=new AtomicLong(10);
    BaitlyCrmAccess access=mock(BaitlyCrmAccess.class);BaitlyCrmLocationReview review=mock(BaitlyCrmLocationReview.class);
    BaitlyCrmExactOsmEnrichment enrichment=mock(BaitlyCrmExactOsmEnrichment.class);
    OrganizationService organizations=mock(OrganizationService.class);PermissionService permissions=mock(PermissionService.class);
    TenantScopedExecutor tenants=mock(TenantScopedExecutor.class);
    BaitlyCrmEnrichmentRuns runs;
    BaitlyCrmEnrichmentRuns service(){return new BaitlyCrmEnrichmentRuns(db,access,review,enrichment,organizations,permissions,tenants,new DataSourceTransactionManager(db.getDataSource()));}
    @BeforeEach void setup()throws Exception {
        String base=System.getProperty("baitly.directory.test.jdbc");schema="baitly_runs_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()){s.execute("CREATE SCHEMA "+schema);}
        url=base+"?currentSchema="+schema;db=new JdbcTemplate(new DriverManagerDataSource(url,"postgres",""));
        db.execute("CREATE TABLE organizations(id bigint PRIMARY KEY)");db.execute("INSERT INTO organizations VALUES(10),(20)");
        db.execute("CREATE TABLE prospects(id bigint PRIMARY KEY,organization_id bigint,city text,archived boolean DEFAULT false,UNIQUE(organization_id,id))");
        db.execute("INSERT INTO prospects(id,organization_id,city) VALUES(1,10,'Paris'),(2,10,'Paris'),(3,10,'Lyon'),(4,20,'Nantes')");
        db.execute("CREATE TABLE baitly_crm_professional_imports(organization_id bigint,prospect_id bigint)");
        db.execute("INSERT INTO baitly_crm_professional_imports VALUES(10,1),(10,2),(10,3),(20,4)");
        db.execute("CREATE TABLE baitly_crm_contact_locations(organization_id bigint,prospect_id bigint,contact_city text)");
        try(var c=DriverManager.getConnection(url,"postgres","")){
            var database=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,database)){
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->cs.getId().equals("0582-baitly-crm-enrichment-runs")).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);new Liquibase(selected,resources,database).update("");
            }
        }
        when(access.require(anyString())).thenAnswer(i->org.get());when(access.lock(anyString())).thenAnswer(i->{db.queryForObject("SELECT id FROM organizations WHERE id=? FOR UPDATE",Long.class,org.get());return org.get();});
        when(review.prepareImported("actor")).thenReturn(List.of(new ImportResult("1","A","EXISTING",1L),new ImportResult("2","B","EXISTING",2L),new ImportResult("3","C","EXISTING",3L)));
        when(organizations.canManageOrg(anyString(),anyLong())).thenReturn(true);when(permissions.checkUserPermission(anyString(),anyString())).thenReturn(true);
        when(tenants.callAsOrganization(anyLong(),any())).thenAnswer(i->i.getArgument(1,Supplier.class).get());
        runs=service();
    }
    @AfterEach void cleanup()throws Exception {try(var c=DriverManager.getConnection(System.getProperty("baitly.directory.test.jdbc"),"postgres","");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}}
    void age(){db.update("UPDATE baitly_crm_enrichment_items SET updated_at=now()-interval '1 hour'");}
    void locate(long id){db.update("INSERT INTO baitly_crm_contact_locations SELECT organization_id,id,city FROM prospects WHERE id=?",id);}
    @Test void survivesServiceRecreationAndDoesNotSearchAlreadyLocatedContacts(){
        locate(1);
        var first=runs.start("actor",new BaitlyCrmEnrichmentRuns.Start(List.of(1L,2L),true)).run();
        assertThat(first.confirmed()).isEqualTo(1);assertThat(first.pending()).isEqualTo(1);
        assertThat(service().latest("actor").run().id()).isEqualTo(first.id());
        var appended=runs.start("actor",new BaitlyCrmEnrichmentRuns.Start(List.of(3L),true)).run();
        assertThat(appended.id()).isEqualTo(first.id());assertThat(appended.pending()).isEqualTo(2);
        when(enrichment.enrich("actor",2)).thenAnswer(i->{locate(2);return new BaitlyCrmExactOsmEnrichment.Outcome("CONFIRMED",List.of());});
        when(enrichment.enrich("actor",3)).thenReturn(new BaitlyCrmExactOsmEnrichment.Outcome("REVIEW",List.of()));
        age();service().tick();age();service().tick();var complete=service().latest("actor").run();assertThat(complete.status()).isEqualTo("COMPLETED");assertThat(complete.confirmed()).isEqualTo(2);assertThat(complete.review()).isEqualTo(1);
        var next=runs.start("actor",new BaitlyCrmEnrichmentRuns.Start(List.of(1L,2L),true)).run();assertThat(next.pending()).isZero();assertThat(next.status()).isEqualTo("COMPLETED");
        verify(enrichment,times(1)).enrich("actor",2);verify(enrichment,never()).enrich("actor",1);verify(tenants,times(2)).callAsOrganization(eq(10L),any());
    }
    @Test void recoversAnExpiredLeaseAfterAWorkerCrashWithoutRepeatingTheSuccessfulLookup(){
        runs.start("actor",new BaitlyCrmEnrichmentRuns.Start(List.of(1L),true));
        when(enrichment.enrich("actor",1)).thenAnswer(i->{service().tick();locate(1);throw new AssertionError("simulated process crash after persistence");});
        age();assertThatThrownBy(()->runs.tick()).isInstanceOf(AssertionError.class);
        assertThat(runs.latest("actor").run().pending()).isEqualTo(1);
        db.update("UPDATE baitly_crm_enrichment_items SET available_at=now()-interval '1 minute'");age();
        service().tick();assertThat(runs.latest("actor").run().confirmed()).isEqualTo(1);assertThat(runs.latest("actor").run().status()).isEqualTo("COMPLETED");
        verify(enrichment,times(1)).enrich("actor",1);
    }
    @Test void persistsRetryDelaysAndKeepsAmbiguousMatchesForManualReview(){
        runs.start("actor",new BaitlyCrmEnrichmentRuns.Start(List.of(1L),true));
        when(enrichment.enrich("actor",1)).thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE)).thenReturn(new BaitlyCrmExactOsmEnrichment.Outcome("REVIEW",List.of()));
        age();runs.tick();assertThat(runs.latest("actor").run().pending()).isEqualTo(1);
        service().tick();verify(enrichment,times(1)).enrich("actor",1);
        db.update("UPDATE baitly_crm_enrichment_items SET available_at=now()-interval '1 minute'");age();service().tick();
        assertThat(runs.latest("actor").run().review()).isEqualTo(1);assertThat(runs.latest("actor").run().status()).isEqualTo("COMPLETED");
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_crm_contact_locations",Integer.class)).isZero();
    }
    @Test void enforcesOrganizationAndActorOwnershipAndCancelsWhenPermissionsAreRevoked(){
        assertThatThrownBy(()->runs.start("actor",new BaitlyCrmEnrichmentRuns.Start(List.of(4L),true))).isInstanceOf(AccessDeniedException.class);
        var run=runs.start("actor",new BaitlyCrmEnrichmentRuns.Start(List.of(1L),true)).run();
        assertThat(runs.latest("other").run()).isNull();assertThatThrownBy(()->runs.cancel("other",run.id())).isInstanceOf(AccessDeniedException.class);
        org.set(20);assertThat(runs.latest("actor").run()).isNull();assertThatThrownBy(()->runs.cancel("actor",run.id())).isInstanceOf(AccessDeniedException.class);org.set(10);
        when(permissions.checkUserPermission("actor","baitly-crm:manage")).thenReturn(false);age();runs.tick();
        assertThat(runs.latest("actor").run().status()).isEqualTo("CANCELLED");verifyNoInteractions(enrichment);
    }
}
