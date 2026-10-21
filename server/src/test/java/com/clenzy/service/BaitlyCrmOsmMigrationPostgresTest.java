package com.clenzy.service;

import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://127\\.0\\.0\\.1:55440/postgres")
class BaitlyCrmOsmMigrationPostgresTest {
    @Test void migratesExistingManualLocationsAndPreservesOrganizationForeignKey() throws Exception {
        String base=System.getProperty("baitly.test.jdbc"),schema="baitly_osm_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()){s.execute("CREATE SCHEMA "+schema);}
        String url=base+"?currentSchema="+schema;
        try{
            try(var c=DriverManager.getConnection(url,"postgres","");var s=c.createStatement()){
                s.execute("CREATE TABLE organizations(id bigint PRIMARY KEY)");
                s.execute("CREATE TABLE prospects(id bigint PRIMARY KEY,organization_id bigint NOT NULL,UNIQUE(organization_id,id))");
                s.execute("INSERT INTO organizations VALUES(10),(20)");s.execute("INSERT INTO prospects VALUES(7,10)");
            }
            migrate(url,"0573-baitly-crm-contact-locations");
            try(var c=DriverManager.getConnection(url,"postgres","");var s=c.createStatement()){
                s.execute("INSERT INTO baitly_crm_contact_locations(organization_id,prospect_id,label,latitude,longitude,precision,recorded_by) VALUES(10,7,'Rabat',34,-6,'CITY','actor')");
            }
            migrate(url,"0575-baitly-crm-osm-provenance");migrate(url,"0575-baitly-crm-osm-provenance");
            try(var c=DriverManager.getConnection(url,"postgres","");var s=c.createStatement()){
                try(var r=s.executeQuery("SELECT label,osm_id FROM baitly_crm_contact_locations")){r.next();assertThat(r.getString(1)).isEqualTo("Rabat");assertThat(r.getObject(2)).isNull();}
                s.execute("UPDATE baitly_crm_contact_locations SET osm_type='node',osm_id=42,osm_query='Atlas, Rabat',osm_confirmed_at=now()");
                assertThatThrownBy(()->s.execute("UPDATE baitly_crm_contact_locations SET osm_type='invalid'")).isInstanceOf(SQLException.class);
                assertThatThrownBy(()->s.execute("UPDATE baitly_crm_contact_locations SET organization_id=20")).isInstanceOf(SQLException.class);
            }
        }finally{try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}}
    }
    private void migrate(String url,String id) throws Exception {
        try(var c=DriverManager.getConnection(url,"postgres","")){
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)){
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");master.getDatabaseChangeLog().getChangeSets().stream().filter(s->s.getId().equals(id)).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);new Liquibase(selected,resources,db).update("");
            }
        }
    }
}
