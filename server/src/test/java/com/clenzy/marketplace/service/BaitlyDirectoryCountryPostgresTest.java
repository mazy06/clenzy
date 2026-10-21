package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.redis.core.*;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.mock.env.MockEnvironment;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="baitly.directory.test.jdbc",matches="jdbc:postgresql://127\\.0\\.0\\.1:(55442/postgres|5433/baitly_directory_test_[a-f0-9]+)")
class BaitlyDirectoryCountryPostgresTest {
    @Test void independentCountryPublicationRetainsFranceAndMatchesTypedIdentities()throws Exception {
        BaitlyNationalDirectoryPostgresTest.withDatabase((db,manager)->{
            db.update("INSERT INTO baitly_directory_professionals(siret,name,address,city,postal_code,activity,sirene_retrieved_at,recorded_by) VALUES('12345678900011','France','Rue test','Paris','75001','81.21Z',now(),'test')");
            var json=new ObjectMapper().registerModule(new JavaTimeModule());
            var redis=mock(StringRedisTemplate.class);@SuppressWarnings("unchecked") ValueOperations<String,String> values=mock(ValueOperations.class);
            when(redis.opsForValue()).thenReturn(values);when(values.setIfAbsent(anyString(),anyString(),any(java.time.Duration.class))).thenReturn(true);
            when(redis.execute(any(RedisScript.class),anyList(),any(Object[].class))).thenReturn(1L);
            var source=mock(BaitlyDirectoryCountryStock.class);var env=new MockEnvironment().withProperty("baitly.directory.ma.enabled","true");
            var manifest=new BaitlyDirectoryCountryStock.Manifest("MA","OMPIC","projection","test","a".repeat(64),1,"https://www.directinfo.ma/","Contrat test",Instant.now(),true,true);
            Path file=Files.createTempFile("baitly-ma-test-",".jsonl");
            try{
                Files.writeString(file,"fixture\n");when(source.open("MA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest)));
                var entry=BaitlyDirectoryCountryStock.projection("MA",json.readTree("""
                    {"active":true,"identifierType":"ICE","identifier":"001234567890123","name":"Maroc","address":"Rue test","city":"Rabat","service":"CLEANING","latitude":34.02,"longitude":-6.84,"email":"contact@example.org"}
                    """));when(source.entry(manifest,"fixture")).thenReturn(entry);
                var sync=new BaitlyDirectoryCountrySync(db,manager,redis,source,json,env);sync.synchronize("MA");sync.synchronize("MA");
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_professionals",Long.class)).isEqualTo(2);
                assertThat(db.queryForObject("SELECT source_active FROM baitly_directory_professionals WHERE country_code='FR'",Boolean.class)).isTrue();
                assertThat(db.queryForObject("SELECT siret FROM baitly_directory_professionals WHERE country_code='MA'",String.class)).isNull();
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence WHERE source='OMPIC'",Long.class)).isEqualTo(1);
                var directory=new BaitlyProfessionalDirectory(db,null,null,json);
                assertThat(directory.list("",0,"CLEANING","EMAIL","MA").items()).extracting(row->row.get("name")).containsExactly("Maroc");
                assertThat(directory.list("",0).items()).extracting(row->row.get("name")).containsExactly("France");
                assertThat(directory.clusters("","CLEANING","",-180,-90,180,90,"","MA").total()).isEqualTo(1);
                long id=db.queryForObject("SELECT id FROM baitly_directory_professionals WHERE country_code='MA'",Long.class);
                assertThat(directory.referencedSource(id).identity().business().country()).isEqualTo("MA");
                assertThat(directory.referencedSource(id).contactSources()).extracting(BaitlyProfessionalDirectory.ContactEvidence::source).containsExactly("OMPIC");
                assertThatThrownBy(()->directory.map("","","",-180,-90,180,90,0,"","XX")).isInstanceOf(IllegalArgumentException.class);
                try(var connection=db.getDataSource().getConnection()){
                    var database=liquibase.database.DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new liquibase.database.jvm.JdbcConnection(connection));
                    var resources=new liquibase.resource.ClassLoaderResourceAccessor();
                    try(var master=new liquibase.Liquibase("db/changelog/db.changelog-master.yaml",resources,database)){
                        var changes=new liquibase.changelog.DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                        master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->Set.of("0587-baitly-directory-search-index","0588-baitly-directory-postgis","0591-baitly-directory-country-cells").contains(cs.getId())).forEach(changes::addChangeSet);
                        assertThat(changes.getChangeSets()).hasSize(3);new liquibase.Liquibase(changes,resources,database).update("");
                    }
                }
                var index=new BaitlyDirectoryMapIndex(db,redis,json,new io.micrometer.core.instrument.simple.SimpleMeterRegistry(),manager);
                assertThat(index.rebuild()).isTrue();directory.mapIndex(index);
                assertThat(index.coverage("CLEANING","EMAIL",-180,-90,180,90,"MA").total()).isEqualTo(1);
                assertThat(index.coverage("CLEANING","EMAIL",-180,-90,180,90,"FR").total()).isZero();
                assertThat(index.coverage("","",-180,-90,180,90,"SA").total()).isZero();
                assertThat(directory.rankedMap("","CLEANING","",-180,-90,180,90,0,"","PROXIMITY",-6.84,34.02,"MA").items()).extracting(row->row.get("country_code")).containsExactly("MA");
                assertThat(index.tile(0,0,0,"CLEANING","EMAIL",index.state().revision(),"MA")).isNotEmpty();
                assertThat(index.tile(0,0,0,"CLEANING","EMAIL",index.state().revision(),"SA")).isEmpty();
                db.update("UPDATE baitly_directory_professionals SET osm_key='node/42',latitude=34.01,longitude=-6.83,osm_confirmed_at=now(),osm_confirmed_by='staff',phone='0102030405' WHERE id=?",id);
                var nextManifest=new BaitlyDirectoryCountryStock.Manifest("MA","OMPIC","projection","next","a".repeat(64),1,manifest.sourceUrl(),manifest.licence(),manifest.retrievedAt(),true,true);
                when(source.open("MA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,nextManifest)));
                var changed=BaitlyDirectoryCountryStock.projection("MA",json.readTree("""
                    {"active":true,"identifierType":"ICE","identifier":"001234567890123","name":"Maroc","address":"Autre rue","city":"Rabat","service":"CLEANING","latitude":34.03,"longitude":-6.85,"phone":"+212537000000"}
                    """));when(source.entry(nextManifest,"fixture")).thenReturn(changed);
                sync.synchronize("MA");
                assertThat(db.queryForObject("SELECT osm_key FROM baitly_directory_professionals WHERE id=?",String.class,id)).isNull();
                assertThat(db.queryForObject("SELECT phone FROM baitly_directory_professionals WHERE id=?",String.class,id)).isEqualTo("+212537000000");
                directory.suppress(id);
                var finalManifest=new BaitlyDirectoryCountryStock.Manifest("MA","OMPIC","projection","final","a".repeat(64),1,manifest.sourceUrl(),manifest.licence(),manifest.retrievedAt(),true,true);
                when(source.open("MA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,finalManifest)));
                when(source.entry(finalManifest,"fixture")).thenReturn(changed);sync.synchronize("MA");
                assertThat(db.queryForObject("SELECT suppressed FROM baitly_directory_professionals WHERE id=?",Boolean.class,id)).isTrue();
                assertThat(db.queryForObject("SELECT phone FROM baitly_directory_professionals WHERE id=?",String.class,id)).isNull();
                assertThat(sync.status("MA")).containsEntry("published",0L);
            }finally{Files.deleteIfExists(file);}
        });
    }
}
