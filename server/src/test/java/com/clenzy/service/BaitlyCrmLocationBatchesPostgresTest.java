package com.clenzy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import java.sql.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://127\\.0\\.0\\.1:55440/postgres")
class BaitlyCrmLocationBatchesPostgresTest {
    @Test void queuesAllActiveLeadsPersistsResultsAndEnforcesTenantAndLocationOwnership() throws Exception {
        String base=System.getProperty("baitly.test.jdbc"),schema="baitly_bulk_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()){s.execute("CREATE SCHEMA "+schema);}
        String url=base+"?currentSchema="+schema;
        try{
            var source=new DriverManagerDataSource(url,"postgres","");var db=new JdbcTemplate(source);var tx=new TransactionTemplate(new DataSourceTransactionManager(source));
            db.execute("CREATE TABLE organizations(id bigint PRIMARY KEY)");
            db.execute("CREATE TABLE prospects(id bigint PRIMARY KEY,organization_id bigint NOT NULL,name varchar(255),city varchar(255),website varchar(500),contact_type varchar(40),contact_nature varchar(40),category varchar(40),archived boolean DEFAULT false,UNIQUE(organization_id,id))");
            db.execute("INSERT INTO organizations VALUES(10),(20)");
            db.execute("INSERT INTO prospects(id,organization_id,name,city,contact_type,contact_nature) SELECT i,10,'Entreprise '||i,'Rabat','PROVIDER','PROFESSIONAL' FROM generate_series(1,25) i");
            db.execute("INSERT INTO prospects(id,organization_id,name,city,contact_type,contact_nature,archived) VALUES(26,10,'Propriétaire privé',null,'OWNER','PRIVATE',false),(27,10,'Archivé','Rabat','PROVIDER','PROFESSIONAL',true),(28,20,'Autre organisation','Rabat','PROVIDER','PROFESSIONAL',false),(29,10,'Autre propriétaire','Rabat','OWNER','PRIVATE',false)");
            migrate(url);migrate(url);
            db.execute("INSERT INTO baitly_crm_contact_locations(organization_id,prospect_id,label,latitude,longitude,precision,recorded_by,contact_city) VALUES(10,1,'Position confirmée',34,-6,'ADDRESS','actor','Rabat')");
            var access=mock(BaitlyCrmAccess.class);when(access.lock("actor")).thenReturn(10L);when(access.require("actor")).thenReturn(10L);
            var organizations=mock(OrganizationService.class);when(organizations.canManageOrg("actor",10L)).thenReturn(true);
            var permissions=mock(PermissionService.class);when(permissions.checkUserPermission(eq("actor"),anyString())).thenReturn(true);
            var redis=mock(org.springframework.data.redis.core.StringRedisTemplate.class);
            @SuppressWarnings("unchecked") var values=(org.springframework.data.redis.core.ValueOperations<String,String>)mock(org.springframework.data.redis.core.ValueOperations.class);
            when(redis.opsForValue()).thenReturn(values);
            when(values.get(anyString())).thenReturn("""
                [{"osm_type":"node","osm_id":42,"name":"Atlas Services","display_name":"Atlas Services, Rabat, Maroc","category":"office","lat":"34","lon":"-6","address":{"city":"Rabat","country_code":"ma"}},
                 {"osm_type":"relation","osm_id":43,"name":"Rabat","display_name":"Rabat, Maroc","category":"boundary","addresstype":"city","lat":"34","lon":"-6","address":{"city":"Rabat","country_code":"ma"}}]
                """);
            var matching=spy(new BaitlyCrmOsmMatching(db,access,new BaitlyCrmLocations(db,access),redis,new ObjectMapper(),"https://invalid.example/search"));
            var batches=new BaitlyCrmLocationBatches(db,access,matching,new ObjectMapper(),organizations,permissions,true,"https://geo.example/search");
            UUID id=(UUID)tx.execute(status->batches.start("actor",new BaitlyCrmLocationBatches.Start("MA",true))).get("id");
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_crm_location_batch_items",Integer.class)).isEqualTo(27);
            assertThat(db.queryForList("SELECT prospect_id FROM baitly_crm_location_batch_items WHERE status='NEEDS_DATA'")).extracting(row->row.get("prospect_id")).containsExactly(26L);
            assertThatThrownBy(()->tx.execute(status->batches.start("actor",new BaitlyCrmLocationBatches.Start("MA",true)))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
            for(int n=0;n<25;n++)tx.executeWithoutResult(status->batches.tick());
            assertThat(db.queryForObject("SELECT status FROM baitly_crm_location_batches WHERE id=?",String.class,id)).isEqualTo("COMPLETED");
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_crm_location_batch_items WHERE status='PROPOSED'",Integer.class)).isEqualTo(25);
            verify(matching).prepare(eq(10L),eq("actor"),eq(29L),any(),eq(true));
            verify(matching,never()).prepare(anyLong(),anyString(),eq(28L),any(),anyBoolean());
            assertThat((List<?>)batches.latest("actor",0).get("content")).hasSize(10);
            // Results survive service re-creation and can be confirmed without a Redis ticket.
            var resumed=new BaitlyCrmLocationBatches(db,access,matching,new ObjectMapper(),organizations,permissions,true,"https://geo.example/search");
            tx.executeWithoutResult(status->resumed.confirm("actor",id,2,new BaitlyCrmLocationBatches.Choice(0)));
            verify(matching).confirmPrepared(eq(10L),eq("actor"),eq(2L),any(),eq(0),eq(false));
            assertThat(db.queryForObject("SELECT status FROM baitly_crm_location_batch_items WHERE batch_id=? AND prospect_id=2",String.class,id)).isEqualTo("CONFIRMED");
            assertThat(db.queryForObject("SELECT osm_id FROM baitly_crm_contact_locations WHERE prospect_id=2",Long.class)).isEqualTo(42L);
            tx.executeWithoutResult(status->resumed.confirm("actor",id,29,new BaitlyCrmLocationBatches.Choice(0)));
            assertThat(db.queryForObject("SELECT precision FROM baitly_crm_contact_locations WHERE prospect_id=29",String.class)).isEqualTo("CITY");
            db.update("UPDATE prospects SET city='Salé' WHERE id=3");
            assertThatThrownBy(()->tx.executeWithoutResult(status->resumed.confirm("actor",id,3,new BaitlyCrmLocationBatches.Choice(0)))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
            when(access.lock("actor")).thenReturn(20L);
            assertThatThrownBy(()->tx.executeWithoutResult(status->resumed.confirm("actor",id,3,new BaitlyCrmLocationBatches.Choice(0)))).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
            assertThatThrownBy(()->db.update("INSERT INTO baitly_crm_location_batch_items(organization_id,batch_id,prospect_id,status) VALUES(20,?,28,'QUEUED')",id)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThat(db.queryForObject("SELECT label FROM baitly_crm_contact_locations WHERE prospect_id=1",String.class)).isEqualTo("Position confirmée");
        }finally{try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}}
    }
    private void migrate(String url)throws Exception{
        try(var c=DriverManager.getConnection(url,"postgres","")){
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)){
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");master.getDatabaseChangeLog().getChangeSets().stream().filter(s->List.of("0573-baitly-crm-contact-locations","0575-baitly-crm-osm-provenance","0576-baitly-crm-location-batches").contains(s.getId())).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(3);new Liquibase(selected,resources,db).update("");
            }
        }
    }
}
