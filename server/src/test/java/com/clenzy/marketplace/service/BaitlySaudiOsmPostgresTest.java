package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.redis.core.*;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.mock.env.MockEnvironment;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="baitly.directory.test.jdbc",matches="jdbc:postgresql://127\\.0\\.0\\.1:(55442/postgres|5433/baitly_directory_test_[a-f0-9]+)")
class BaitlySaudiOsmPostgresTest {
    @Test
    @EnabledIfSystemProperty(named="baitly.directory.test.sa-osm-folder",matches="/(private/)?tmp/[^\\r\\n]+")
    void verifiedRealEditionPublishesAllRowsInResumableBatches()throws Exception {
        var json=new ObjectMapper().registerModule(new JavaTimeModule());
        Path folder=Path.of(System.getProperty("baitly.directory.test.sa-osm-folder"));
        var manifest=json.treeToValue(json.readTree(Files.readString(folder.resolve("latest.json"))).path("manifest"),BaitlyDirectoryCountryStock.Manifest.class);
        boolean combined=manifest.source().equals("SA_PUBLIC");
        Path file=folder.resolve((combined?"public-":"osm-")+manifest.sha256()+".jsonl");
        assertThat(BaitlyDirectoryOsmStock.digest(file)).isEqualTo(manifest.sha256());
        BaitlyNationalDirectoryPostgresTest.withDatabase((db,manager)->{
            var env=new MockEnvironment();var reader=new BaitlyDirectoryCountryStock(env,json,mock(BaitlyWathqClient.class));
            var source=mock(BaitlyDirectoryCountryStock.class);when(source.open("SA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest)));
            when(source.entry(any(),anyString())).thenAnswer(call->reader.entry(call.getArgument(0),call.getArgument(1)));
            var redis=mock(StringRedisTemplate.class);@SuppressWarnings("unchecked") ValueOperations<String,String> values=mock(ValueOperations.class);
            when(redis.opsForValue()).thenReturn(values);when(values.setIfAbsent(anyString(),anyString(),any(Duration.class))).thenReturn(true);
            when(redis.execute(any(RedisScript.class),anyList(),any(Object[].class))).thenReturn(1L);
            var sync=new BaitlyDirectoryCountrySync(db,manager,redis,source,json,env);
            for(long i=0;i<=manifest.count()/5000+1&&!"COMPLETED".equals(sync.status("SA").get("phase"));i++)sync.synchronize("SA");
            assertThat(sync.status("SA")).containsEntry("phase","COMPLETED").containsEntry("published",manifest.count());
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_professionals WHERE source_active",Long.class)).isEqualTo(manifest.count());
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence WHERE source IN ('OSM','OVERTURE')",Long.class)).isGreaterThanOrEqualTo(manifest.count());
            var directory=new BaitlyProfessionalDirectory(db,null,null,json);
            assertThat(directory.clusters("","","",34,16,56,33,"","SA").total()).isEqualTo(manifest.count());
            assertThat(directory.list("",0,"LAUNDRY","","SA").items()).isNotEmpty();
            assertThat(directory.list("",0,"","","FR").items()).isEmpty();
        });
    }
    @Test void editionsUpsertRetireBySourcePreserveSuppressionAndKeepLastGoodPublication()throws Exception {
        BaitlyNationalDirectoryPostgresTest.withDatabase((db,manager)->{
            db.update("INSERT INTO baitly_directory_professionals(siret,name,address,city,postal_code,activity,sirene_retrieved_at,recorded_by) VALUES('12345678900011','France','','Paris','','81.21Z',now(),'test')");
            db.update("INSERT INTO baitly_directory_professionals(country_code,identifier_type,identifier,base_source,name,address,city,postal_code,activity,sirene_retrieved_at,recorded_by) VALUES('SA','UNN','7000000001','WATHQ','Registry','','Riyadh','','',now(),'test')");
            var json=new ObjectMapper().registerModule(new JavaTimeModule());
            var redis=mock(StringRedisTemplate.class);@SuppressWarnings("unchecked") ValueOperations<String,String> values=mock(ValueOperations.class);
            when(redis.opsForValue()).thenReturn(values);when(values.setIfAbsent(anyString(),anyString(),any(Duration.class))).thenReturn(true);
            when(redis.execute(any(RedisScript.class),anyList(),any(Object[].class))).thenReturn(1L);
            var source=mock(BaitlyDirectoryCountryStock.class);
            var env=new MockEnvironment();var sync=new BaitlyDirectoryCountrySync(db,manager,redis,source,json,env);
            Path file=Files.createTempFile("baitly-sa-fixture-",".jsonl");
            try{
                String first="""
                    {"active":true,"identifierType":"OSM","identifier":"node/42","name":"مغسلة","city":"الرياض","address":"Street","service":"LAUNDRY","latitude":24.7,"longitude":46.7,"email":"first@example.org"}
                    """.strip();
                String second=first.replace("node/42","way/43").replace("مغسلة","Cleaner").replace("LAUNDRY","CLEANING");
                Files.writeString(file,first+"\n"+second+"\n");
                var m=manifest("first",2);when(source.open("SA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,m)));
                when(source.entry(any(),anyString())).thenAnswer(call->{var real=new BaitlyDirectoryCountryStock(env,json,mock(BaitlyWathqClient.class));return real.entry(call.getArgument(0),call.getArgument(1));});
                sync.synchronize("SA");sync.synchronize("SA");
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_professionals",Long.class)).isEqualTo(4);
                var directory=new BaitlyProfessionalDirectory(db,null,null,json);
                assertThat(directory.list("",0,"LAUNDRY","EMAIL","SA").items()).hasSize(1);
                long id=db.queryForObject("SELECT id FROM baitly_directory_professionals WHERE identifier='node/42'",Long.class);
                var reference=directory.referencedSource(id);
                assertThat(reference.identity().business().identifierType()).isEqualTo("OSM");
                assertThat(reference.location().latitude()).isEqualTo(24.7);
                assertThat(reference.contactSources().getFirst().url()).isEqualTo("https://www.openstreetmap.org/node/42");
                assertThat(reference.email()).isEqualTo("first@example.org");
                Files.writeString(file,first.replace("first@example.org","new@example.org")+"\n");
                when(source.open("SA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest("second",1))));
                sync.synchronize("SA");
                assertThat(db.queryForObject("SELECT email FROM baitly_directory_professionals WHERE id=?",String.class,id)).isEqualTo("new@example.org");
                assertThat(db.queryForObject("SELECT source_active FROM baitly_directory_professionals WHERE identifier='way/43'",Boolean.class)).isFalse();
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_professionals WHERE source_active AND base_source IN ('WATHQ','SIRENE')",Long.class)).isEqualTo(2);
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence WHERE professional_id=? AND source='OSM'",Long.class,id)).isEqualTo(1);
                // An incomplete edition stages but never overwrites the published contacts.
                Files.writeString(file,first+"\n");
                when(source.open("SA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest("incomplete",2))));
                when(values.get(anyString())).thenReturn("other-worker");
                assertThatThrownBy(()->sync.synchronize("SA")).hasMessageContaining("Incomplete");
                assertThat(db.queryForObject("SELECT email FROM baitly_directory_professionals WHERE id=?",String.class,id)).isEqualTo("new@example.org");
                directory.suppress(id);
                when(source.open("SA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest("final",1))));
                sync.synchronize("SA");
                assertThat(db.queryForObject("SELECT suppressed FROM baitly_directory_professionals WHERE id=?",Boolean.class,id)).isTrue();
                assertThat(db.queryForObject("SELECT email FROM baitly_directory_professionals WHERE id=?",String.class,id)).isNull();
            }finally{Files.deleteIfExists(file);}
        });
    }
    private static BaitlyDirectoryCountryStock.Manifest manifest(String version,long count){return new BaitlyDirectoryCountryStock.Manifest("SA","OSM","osm",version,"a".repeat(64),count,"https://www.openstreetmap.org/copyright","ODbL 1.0",Instant.now(),true,true);}
}
