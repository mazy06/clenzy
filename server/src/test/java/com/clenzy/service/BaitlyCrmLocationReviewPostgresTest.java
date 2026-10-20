package com.clenzy.service;

import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="baitly.directory.test.jdbc",matches="jdbc:postgresql://127\\.0\\.0\\.1:55442/postgres")
class BaitlyCrmLocationReviewPostgresTest {
    JdbcTemplate db;TransactionTemplate tx;BaitlyCrmAccess access;BaitlyCrmImportedOsmSearch osm;
    BaitlyCrmLocationReview review;String schema,url;AtomicLong org=new AtomicLong(10);
    @BeforeEach void setup() throws Exception {
        String base=System.getProperty("baitly.directory.test.jdbc");schema="baitly_review_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()){s.execute("CREATE SCHEMA "+schema);}
        url=base+"?currentSchema="+schema;var ds=new DriverManagerDataSource(url,"postgres","");db=new JdbcTemplate(ds);tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
        db.execute("CREATE TABLE prospects(id bigint PRIMARY KEY,organization_id bigint,city text,archived boolean DEFAULT false,name text DEFAULT 'Import',contact_type text DEFAULT 'PROVIDER',contact_nature text DEFAULT 'PROFESSIONAL',email text,phone text,website text,UNIQUE(organization_id,id))");
        db.execute("CREATE TABLE baitly_crm_professional_imports(organization_id bigint,prospect_id bigint,snapshot jsonb DEFAULT '{}',siret varchar(14) DEFAULT '12345678900011')");
        db.execute("CREATE TABLE baitly_crm_contact_locations(organization_id bigint,prospect_id bigint,contact_city text,label text,latitude double precision,longitude double precision,precision text,recorded_by text,osm_type text,osm_id bigint,osm_query text,osm_confirmed_at timestamptz,UNIQUE(organization_id,prospect_id))");
        db.execute("CREATE TABLE baitly_directory_professionals(siret text,suppressed boolean)");
        db.execute("INSERT INTO prospects(id,organization_id,city) VALUES(1,10,'Nantes'),(2,10,'Paris'),(3,10,NULL),(4,10,'Lyon'),(5,20,'Lyon')");
        db.execute("INSERT INTO baitly_crm_professional_imports(organization_id,prospect_id) VALUES(10,1),(10,2),(10,3),(10,4),(20,5)");
        try(var c=DriverManager.getConnection(url,"postgres","")){
            var database=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,database)){
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->cs.getId().equals("0579-baitly-crm-location-review")).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);new Liquibase(selected,resources,database).update("");
            }
        }
        access=mock(BaitlyCrmAccess.class);when(access.require(anyString())).thenAnswer(i->org.get());when(access.lock(anyString())).thenAnswer(i->org.get());
        osm=mock(BaitlyCrmImportedOsmSearch.class);review=new BaitlyCrmLocationReview(db,access,osm);
    }
    @AfterEach void cleanup() throws Exception {
        try(var c=DriverManager.getConnection(System.getProperty("baitly.directory.test.jdbc"),"postgres","");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}
    }
    @Test void resumesPendingOnlyAndKeepsExclusiveTotalsAfterServiceRecreation(){
        tx.execute(s->review.enqueue("alice",List.of(1L,2L,3L,4L)));
        db.update("INSERT INTO baitly_crm_contact_locations(organization_id,prospect_id,contact_city) VALUES(10,1,'Nantes')");
        tx.execute(s->review.skip("alice",2));
        when(osm.search("alice",3)).thenReturn(new BaitlyCrmOsmMatching.Results(UUID.randomUUID(),List.of()));review.search("alice",3);
        var reloaded=new BaitlyCrmLocationReview(db,access,osm);var progress=tx.execute(s->reloaded.progress("alice"));
        assertThat(progress.remaining()).isEqualTo(1);assertThat(progress.confirmed()).isEqualTo(1);assertThat(progress.skipped()).isEqualTo(1);assertThat(progress.notFound()).isEqualTo(1);
        assertThat(progress.items().stream().filter(i->i.status().equals("PENDING")).map(BaitlyCrmLocationReview.Item::id)).containsExactly(4L);
        var unchanged=tx.execute(s->review.enqueue("alice",List.of(1L,2L,3L,4L)));assertThat(unchanged).isEqualTo(progress);
        verify(osm,times(1)).search("alice",3);
        // Invalidated coordinates become pending again; archived/deleted contacts do not block the file.
        db.update("UPDATE prospects SET city='Rennes' WHERE id=1");db.update("UPDATE prospects SET archived=true WHERE id=4");db.update("DELETE FROM prospects WHERE id=2");
        var changed=tx.execute(s->review.progress("alice"));assertThat(changed.remaining()).isEqualTo(1);assertThat(changed.confirmed()).isZero();assertThat(changed.skipped()).isZero();
    }
    @Test void isolatesUsersAndOrganizationsAndRollsBackAnInvalidSelection(){
        tx.execute(s->review.enqueue("alice",List.of(1L)));
        assertThat(tx.execute(s->review.progress("bob")).items()).isEmpty();
        assertThatThrownBy(()->tx.execute(s->review.skip("bob",1))).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(()->review.search("bob",1)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(()->tx.execute(s->review.enqueue("alice",List.of(2L,5L)))).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThat(tx.execute(s->review.progress("alice")).items()).hasSize(1);
        org.set(20);assertThat(tx.execute(s->review.progress("alice")).items()).isEmpty();
        assertThatThrownBy(()->review.search("alice",1)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);verifyNoInteractions(osm);
    }
    @Test void searchFailureRemainsPendingAndLateEmptyResultCannotOverwriteASkip(){
        tx.execute(s->review.enqueue("alice",List.of(1L,2L)));
        when(osm.search("alice",1)).thenThrow(new IllegalStateException("unavailable"));
        assertThatThrownBy(()->review.search("alice",1)).hasMessage("unavailable");assertThat(tx.execute(s->review.progress("alice")).remaining()).isEqualTo(2);
        when(osm.search("alice",2)).thenAnswer(i->{tx.execute(s->review.skip("alice",2));return new BaitlyCrmOsmMatching.Results(UUID.randomUUID(),List.of());});
        review.search("alice",2);var progress=tx.execute(s->review.progress("alice"));assertThat(progress.skipped()).isEqualTo(1);assertThat(progress.notFound()).isZero();assertThat(progress.remaining()).isEqualTo(1);
    }
    @Test void preparesOlderImportsWithoutDuplicatingContactsOrIncludingOtherTenantsAndSkippedContacts(){
        tx.execute(s->review.enqueue("alice",List.of(2L)));tx.execute(s->review.skip("alice",2));
        db.update("UPDATE prospects SET contact_nature='PRIVATE' WHERE id=3");db.update("UPDATE prospects SET archived=true WHERE id=4");
        db.update("INSERT INTO prospects(id,organization_id,city) VALUES(6,10,'Nantes')");
        var first=tx.execute(s->review.prepareImported("alice"));assertThat(first).extracting(i->i.id()).containsExactly(1L);
        var again=tx.execute(s->review.prepareImported("alice"));assertThat(again).isEqualTo(first);
        db.update("UPDATE baitly_crm_location_review SET status='NOT_FOUND' WHERE organization_id=10 AND actor='alice' AND prospect_id=1");
        var retried=tx.execute(s->review.prepareImported("alice"));assertThat(retried).isEqualTo(first);
        assertThat(tx.execute(s->review.progress("alice")).remaining()).isEqualTo(1);
        assertThat(tx.execute(s->review.progress("alice")).skipped()).isEqualTo(1);
        assertThat(db.queryForObject("SELECT count(*) FROM prospects",Integer.class)).isEqualTo(6);
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_crm_location_review WHERE organization_id=10 AND actor='alice'",Integer.class)).isEqualTo(2);
        assertThat(tx.execute(s->review.progress("bob")).items()).isEmpty();
        org.set(20);var other=tx.execute(s->review.prepareImported("alice"));assertThat(other).extracting(i->i.id()).containsExactly(5L);
        verifyNoInteractions(osm);
    }
    @Test void repairsStoredSireneCoordinatesBeforeAnyOsmRequestWithoutReplacingLocations(){
        String snapshot="""
            {"siret":"12345678900011","name":"Import","city":"Paris",
             "address":"110 RUE DE L'OURCQ 75019 PARIS","latitude":48.894656608,"longitude":2.3716350002}
            """;
        db.update("UPDATE baitly_crm_professional_imports SET snapshot=CAST(? AS jsonb)",snapshot);
        tx.execute(s->review.prepareImported("alice"));
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_crm_contact_locations",Integer.class)).isEqualTo(1);
        assertThat(db.queryForObject("SELECT latitude FROM baitly_crm_contact_locations WHERE prospect_id=2",Double.class)).isEqualTo(48.894656608);
        assertThat(tx.execute(s->review.progress("alice")).confirmed()).isEqualTo(1);
        db.update("UPDATE baitly_crm_contact_locations SET latitude=47 WHERE prospect_id=2");
        tx.execute(s->review.prepareImported("alice"));
        assertThat(db.queryForObject("SELECT latitude FROM baitly_crm_contact_locations WHERE prospect_id=2",Double.class)).isEqualTo(47);
        db.update("DELETE FROM baitly_crm_contact_locations WHERE prospect_id=2");
        db.update("UPDATE baitly_crm_professional_imports SET snapshot=CAST(? AS jsonb)",snapshot.replace("48.894656608","999"));
        tx.execute(s->review.prepareImported("alice"));
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_crm_contact_locations",Integer.class)).isZero();
        db.update("UPDATE baitly_crm_professional_imports SET snapshot=CAST(? AS jsonb)",snapshot);
        db.update("INSERT INTO baitly_directory_professionals VALUES('12345678900011',true)");
        tx.execute(s->review.prepareImported("alice"));
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_crm_contact_locations",Integer.class)).isZero();
        db.update("DELETE FROM baitly_directory_professionals");
        tx.execute(s->review.skip("alice",2));
        tx.execute(s->review.prepareImported("alice"));
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_crm_contact_locations",Integer.class)).isZero();
        assertThat(tx.execute(s->review.progress("alice")).skipped()).isEqualTo(1);
        verifyNoInteractions(osm);
    }
}
