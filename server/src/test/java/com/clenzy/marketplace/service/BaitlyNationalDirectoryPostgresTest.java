package com.clenzy.marketplace.service;

import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import java.io.*;
import java.sql.*;
import java.util.*;
import java.nio.file.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="baitly.directory.test.jdbc",matches="jdbc:postgresql://127\\.0\\.0\\.1:55442/postgres")
class BaitlyNationalDirectoryPostgresTest {
    @Test void contactFiltersUseEffectiveAdemeAndOsmValuesBeforeCountingAndPaging()throws Exception {
        withDatabase((db,manager)->{
            db.update("""
                INSERT INTO baitly_directory_professionals(siret,name,address,city,postal_code,activity,sirene_latitude,sirene_longitude,sirene_retrieved_at,recorded_by,phone,rge_email,website)
                VALUES('12345678900011','A Both','Paris','Paris','75001','81.21Z',48,2,now(),'stock','0102030405','a@example.com',null),
                ('22345678900022','B Email','Paris','Paris','75001','81.21Z',48,2,now(),'stock',null,'b@example.com',null),
                ('32345678900033','C Phone','Paris','Paris','75001','81.21Z',48,2,now(),'stock','0203040506',null,null),
                ('42345678900044','D Website','Paris','Paris','75001','81.21Z',48,2,now(),'stock',null,null,'https://example.com'),
                ('52345678900055','E Blank','Paris','Paris','75001','81.21Z',48,2,now(),'stock','  ',null,null)
                """);
            var directory=new BaitlyProfessionalDirectory(db,null,null,new ObjectMapper());
            for(var entry:Map.of("ANY",3,"EMAIL",2,"PHONE",2,"BOTH",1,"NONE",2).entrySet()){
                var list=directory.list("",0,"",entry.getKey());
                assertThat(list.total()).isEqualTo(entry.getValue().longValue());
                assertThat(list.items()).hasSize(entry.getValue());
                assertThat(directory.map("","","",-180,-90,180,90,0,entry.getKey()).items()).hasSize(entry.getValue());
            }
            assertThat(directory.list("",0,"","ANY").items()).extracting(row->row.get("name")).doesNotContain("D Website","E Blank");
            assertThat(directory.list("",1,"","ANY").items()).isEmpty();
            assertThatThrownBy(()->directory.list("",0,"","untrusted")).isInstanceOf(IllegalArgumentException.class);
        });
    }
    private static final String ETAB="siret,statutDiffusionEtablissement,etatAdministratifEtablissement,activitePrincipaleEtablissement,nomenclatureActivitePrincipaleEtablissement,numeroVoieEtablissement,typeVoieEtablissement,libelleVoieEtablissement,codePostalEtablissement,libelleCommuneEtablissement,enseigne1Etablissement,coordonneeLambertAbscisseEtablissement,coordonneeLambertOrdonneeEtablissement\n";
    private static final String UNIT="siren,statutDiffusionUniteLegale,etatAdministratifUniteLegale,denominationUniteLegale,nomUniteLegale\n";
    @Test void sharedNationalRefreshDeduplicatesWithdrawsAndPreservesPrivateEdits() throws Exception {
        withDatabase((db,manager)->{
            var source=mock(BaitlyNationalDirectorySource.class);
            when(source.resolve()).thenReturn(new BaitlyNationalDirectorySource.Resources("etab-v1","units-v1"));
            when(source.open("etab-v1")).thenAnswer(i->csv(ETAB+
                "12345678900011,O,A,81.21Z,NAFRev2,1,RUE,DU PORT,75019,PARIS,Atlas,700000,6600000\n"+
                "22345678900022,O,A,80.10Z,NAFRev2,2,RUE,DU PORT,69001,LYON,Security,,\n"+
                "32345678900033,O,A,43.21A,NAFRev2,3,RUE,DU PORT,33000,BORDEAUX,Private,,\n"+
                "42345678900044,O,A,81.30Z,NAFRev2,4,RUE,DU PORT,44000,NANTES,Removed,,\n"+
                "52345678900055,P,A,81.21Z,NAFRev2,5,RUE,DU PORT,59000,LILLE,Hidden,,\n"+
                "62345678900066,O,F,81.21Z,NAF1993,6,RUE,DU PORT,13001,MARSEILLE,Closed,,\n"+
                "72345678900077,O,A,70.2C,NAF1993,7,RUE,DU PORT,75001,PARIS,Historical,,\n"));
            when(source.open("units-v1")).thenAnswer(i->csv(UNIT+"123456789,O,A,Atlas SAS,\n223456789,O,A,Security SAS,\n323456789,P,A,Private,\n423456789,O,A,Removed SAS,\n"));
            seed(db,"92345678900099","Old","old",false);
            seed(db,"42345678900044","Removed","old",true);
            seed(db,"22345678900022","Security","2 RUE DU PORT 69001 LYON",false);
            db.update("UPDATE baitly_directory_professionals SET osm_key='node/42',latitude=45.7,longitude=4.8,osm_confirmed_at=now(),phone='0102030405' WHERE siret='22345678900022'");
            db.execute("CREATE TABLE private_test_crm(organization_id bigint,name text)");db.update("INSERT INTO private_test_crm VALUES(10,'Ma correction'),(20,'Autre organisation')");
            var service=new BaitlyNationalDirectorySync(db,source,manager,true);service.synchronize();
            assertThat(service.status()).containsEntry("phase","COMPLETED");
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_professionals WHERE source_active AND NOT suppressed",Long.class)).isEqualTo(2);
            assertThat(db.queryForObject("SELECT sirene_latitude FROM baitly_directory_professionals WHERE siret='12345678900011'",Double.class)).isCloseTo(46.5,within(.00001));
            assertThat(db.queryForObject("SELECT osm_key FROM baitly_directory_professionals WHERE siret='22345678900022'",String.class)).isEqualTo("node/42");
            assertThat(db.queryForObject("SELECT address FROM baitly_directory_professionals WHERE siret='92345678900099'",String.class)).isEmpty();
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_professionals WHERE siret='32345678900033'",Long.class)).isZero();
            assertThat(db.queryForObject("SELECT suppressed FROM baitly_directory_professionals WHERE siret='42345678900044'",Boolean.class)).isTrue();
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence",Long.class)).isEqualTo(2);
            new BaitlyNationalDirectorySync(db,source,manager,true).synchronize();verify(source,times(1)).open("etab-v1");
            when(source.resolve()).thenReturn(new BaitlyNationalDirectorySource.Resources("etab-v2","units-v2"));
            when(source.open("etab-v2")).thenAnswer(i->csv(ETAB+"22345678900022,O,A,80.10Z,NAFRev2,12,RUE,NOUVELLE,69001,LYON,Security,,\n"));
            when(source.open("units-v2")).thenAnswer(i->csv(UNIT+"223456789,O,A,Security SAS,\n"));
            service.synchronize();
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_professionals WHERE source_active AND NOT suppressed",Long.class)).isEqualTo(1);
            assertThat(db.queryForObject("SELECT osm_key FROM baitly_directory_professionals WHERE siret='22345678900022'",String.class)).isNull();
            assertThat(db.queryForObject("SELECT name FROM private_test_crm WHERE organization_id=10",String.class)).isEqualTo("Ma correction");
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_professionals WHERE siret='22345678900022'",Long.class)).isEqualTo(1);
        });
    }
    @Test void restartResumesCheckpointAndUnknownSchemaNeverPublishesOrRetires() throws Exception {
        withDatabase((db,manager)->{
            var source=mock(BaitlyNationalDirectorySource.class);UUID revision=UUID.randomUUID();
            db.update("INSERT INTO baitly_directory_sync(id,revision,establishments_url,units_url,phase,cursor) VALUES(true,?,'resume','units','ESTABLISHMENTS',1000)",revision);
            var records=new StringBuilder(ETAB);for(int i=0;i<1000;i++)records.append("00000000000000,O,F,81.21Z,NAFRev2,1,RUE,OLD,75001,PARIS,Skip,,\n");
            records.append("12345678900011,O,A,81.21Z,NAFRev2,1,RUE,DU PORT,75001,PARIS,New,,\n");
            when(source.open("resume")).thenAnswer(i->csv(records.toString()));when(source.open("units")).thenThrow(new IOException("network interrupted"));
            var service=new BaitlyNationalDirectorySync(db,source,manager,true);
            assertThatThrownBy(service::synchronize).isInstanceOf(IOException.class);
            assertThat(service.status()).containsEntry("phase","UNITS").containsEntry("failures",1);
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_sync_stage",Long.class)).isEqualTo(1);
            db.update("UPDATE baitly_directory_sync SET retry_at=NULL");
            doAnswer(i->csv(UNIT+"123456789,O,A,New SAS,\n")).when(source).open("units");
            new BaitlyNationalDirectorySync(db,source,manager,true).synchronize();verify(source,times(1)).open("resume");
            assertThat(service.status()).containsEntry("phase","COMPLETED");
            when(source.resolve()).thenReturn(new BaitlyNationalDirectorySource.Resources("future","future-units"));
            when(source.open("future")).thenAnswer(i->csv(ETAB+"12345678900011,O,A,81.21Y,NAF2025,1,RUE,DU PORT,75001,PARIS,New,,\n"));
            assertThatThrownBy(service::synchronize).isInstanceOf(IOException.class).hasMessageContaining("nomenclature");
            assertThat(db.queryForObject("SELECT source_active FROM baitly_directory_professionals WHERE siret='12345678900011'",Boolean.class)).isTrue();
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence",Long.class)).isEqualTo(1);
        });
    }
    @Test void disabledFeedDoesNotContactSource() throws Exception {
        var source=mock(BaitlyNationalDirectorySource.class);
        new BaitlyNationalDirectorySync(mock(JdbcTemplate.class),source,mock(org.springframework.transaction.PlatformTransactionManager.class),false).synchronize();verifyNoInteractions(source);
    }
    @Test void offlineOsmEnrichmentUsesOnlyUniqueExactSiretsAndReplaysWithoutDuplicates() throws Exception {
        withDatabase((db,manager)->{
            seed(db,"12345678900011","Unique","Nantes",false);
            seed(db,"22345678900022","Ambiguous","Paris",false);
            seed(db,"32345678900033","Suppressed","Paris",true);
            seed(db,"42345678900044","Manual","Paris",false);
            seed(db,"52345678900055","Point","Nantes",false);
            db.update("UPDATE baitly_directory_professionals SET osm_key='node/44',osm_confirmed_by='staff',osm_confirmed_at=now(),latitude=48,longitude=2,phone='manual' WHERE siret='42345678900044'");
            db.update("INSERT INTO baitly_directory_sync(id,revision,establishments_url,units_url,phase) VALUES(true,?,'stock','units','COMPLETED')",UUID.randomUUID());
            Path snapshot=Files.createTempFile("baitly-national-osm-",".jsonl");
            try {
                Files.writeString(snapshot,"""
                    {"type":"way","id":11,"tags":{"ref:FR:SIRET":"12345678900011","contact:phone":"0102030405","email":"contact@example.com","website":"https://example.com"}}
                    {"type":"way","id":11,"tags":{"ref:FR:SIRET":"12345678900011","contact:phone":"0102030405","email":"contact@example.com","website":"https://example.com"}}
                    {"type":"node","id":21,"tags":{"ref:FR:SIRET":"22345678900022","phone":"wrong"}}
                    {"type":"way","id":22,"tags":{"ref:FR:SIRET":"22345678900022","phone":"also wrong"}}
                    {"type":"node","id":33,"tags":{"ref:FR:SIRET":"32345678900033","phone":"hidden"}}
                    {"type":"node","id":44,"tags":{"ref:FR:SIRET":"42345678900044","phone":"replace manual"}}
                    {"type":"node","id":55,"lat":47.2,"lon":-1.5,"tags":{"ref:FR:SIRET":"52345678900055","phone":"0200000000"}}
                    """);
                var service=new BaitlyNationalOsmEnrichment(db,new ObjectMapper(),manager);
                var result=service.enrich(snapshot);
                assertThat(result.enriched()).isEqualTo(2);assertThat(result.ambiguous()).isEqualTo(1);
                var row=db.queryForMap("SELECT * FROM baitly_directory_professionals WHERE siret='12345678900011'");
                assertThat(row).containsEntry("phone","0102030405").containsEntry("email","contact@example.com").containsEntry("website","https://example.com");
                assertThat(row.get("osm_key")).isNull();assertThat(row.get("latitude")).isNull(); // No invented OSM geometry for a way.
                assertThat(db.queryForObject("SELECT phone FROM baitly_directory_professionals WHERE siret='22345678900022'",String.class)).isNull();
                assertThat(db.queryForObject("SELECT phone FROM baitly_directory_professionals WHERE siret='42345678900044'",String.class)).isEqualTo("manual");
                assertThat(db.queryForObject("SELECT latitude FROM baitly_directory_professionals WHERE siret='52345678900055'",Double.class)).isEqualTo(47.2);
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence WHERE confirmed_by='baitly:osm-stock'",Long.class)).isEqualTo(2);
                new BaitlyNationalOsmEnrichment(db,new ObjectMapper(),manager).enrich(snapshot);
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence WHERE confirmed_by='baitly:osm-stock'",Long.class)).isEqualTo(2);
                var directory=new BaitlyProfessionalDirectory(db,null,null,new ObjectMapper());
                assertThat(directory.list("Unique",0).items().getFirst()).containsEntry("osm_contact_key","way/11");
                Files.writeString(snapshot,"\nnot-json",StandardOpenOption.APPEND);
                assertThatThrownBy(()->service.enrich(snapshot)).isInstanceOf(IOException.class);
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence WHERE confirmed_by='baitly:osm-stock'",Long.class)).isEqualTo(2);
                Files.writeString(snapshot,"""
                    {"type":"node","id":999,"tags":{"ref:FR:SIRET":"92345678900099"}}
                    """);
                assertThat(service.enrich(snapshot).retired()).isEqualTo(2);
                assertThat(db.queryForObject("SELECT phone FROM baitly_directory_professionals WHERE siret='12345678900011'",String.class)).isNull();
                assertThat(db.queryForObject("SELECT latitude FROM baitly_directory_professionals WHERE siret='52345678900055'",Double.class)).isNull();
                assertThat(db.queryForObject("SELECT phone FROM baitly_directory_professionals WHERE siret='42345678900044'",String.class)).isEqualTo("manual");
            } finally {Files.deleteIfExists(snapshot);}
        });
    }
    private static CSVParser csv(String text)throws IOException{return CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).build().parse(new StringReader(text));}
    private static void seed(JdbcTemplate db,String siret,String name,String address,boolean suppressed){db.update("INSERT INTO baitly_directory_professionals(siret,name,address,city,postal_code,activity,sirene_retrieved_at,recorded_by,suppressed) VALUES(?,?,?,'PARIS','75001','81.21Z',now(),'staff',?)",siret,name,address,suppressed);}
    interface Work {void run(JdbcTemplate db,DataSourceTransactionManager manager)throws Exception;}
    static void withDatabase(Work work)throws Exception {
        String base=System.getProperty("baitly.directory.test.jdbc"),schema="baitly_national_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()){s.execute("CREATE SCHEMA "+schema);}
        String url=base+"?currentSchema="+schema;
        try {
            try(var c=DriverManager.getConnection(url,"postgres","")) {
                var database=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));var resources=new ClassLoaderResourceAccessor();
                try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,database)) {
                    var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                    master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->Set.of("0577-baitly-professional-directory","0583-baitly-national-directory","0585-baitly-directory-ademe-rge").contains(cs.getId())).forEach(selected::addChangeSet);
                    assertThat(selected.getChangeSets()).hasSize(3);new Liquibase(selected,resources,database).update("");
                }
            }
            var ds=new DriverManagerDataSource(url,"postgres","");work.run(new JdbcTemplate(ds),new DataSourceTransactionManager(ds));
        }finally{try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}}
    }
}
