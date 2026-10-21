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
class BaitlySaudiPublicPostgresTest {
    static final String OVERTURE="cd9acfa1-6f6e-40ab-8e0c-8f188d4ea776";
    static String row(String type,String id,String name,String email){
        return """
            {"active":true,"identifierType":"%s","identifier":"%s","baseSource":"%s",
            "sourceUrl":"%s","sourceLicence":"%s","name":"%s","city":"Riyadh","address":"10 Street",
            "postalCode":"12211","activity":"","service":"LAUNDRY","latitude":24.7,"longitude":46.7,
            "email":"%s","overture":{"confidence":0.9},"identifiers":{"%s":"%s"},
            "sourceEvidence":[{"source":"%s","identifier":"%s","url":"%s","licence":"%s"}]}
            """.formatted(type,id,type,url(type,id),licence(type),name,email,type,id,type,id,url(type,id),licence(type)).strip();
    }
    static String url(String type,String id){return type.equals("OSM")?"https://www.openstreetmap.org/"+id:BaitlyDirectoryCountryStock.OVERTURE_URL;}
    static String licence(String type){return type.equals("OSM")?"ODbL 1.0":"CDLA-Permissive-2.0";}
    static BaitlyDirectoryCountryStock.Manifest manifest(String version,int count){
        return new BaitlyDirectoryCountryStock.Manifest("SA","SA_PUBLIC","sa-public",version,"a".repeat(64),count,
            BaitlyDirectoryCountryStock.OVERTURE_URL,BaitlyDirectoryCountryStock.PUBLIC_LICENCE,Instant.now(),true,true);
    }
    @Test void stagedMixedEditionPreservesIdsProofsSuppressionAndSourceFencing()throws Exception {
        BaitlyNationalDirectoryPostgresTest.withDatabase((db,manager)->{
            var json=new ObjectMapper().registerModule(new JavaTimeModule());var env=new MockEnvironment();
            var reader=new BaitlyDirectoryCountryStock(env,json,mock(BaitlyWathqClient.class));
            var source=mock(BaitlyDirectoryCountryStock.class);
            when(source.entry(any(),anyString())).thenAnswer(call->reader.entry(call.getArgument(0),call.getArgument(1)));
            var redis=mock(StringRedisTemplate.class);@SuppressWarnings("unchecked") ValueOperations<String,String> values=mock(ValueOperations.class);
            when(redis.opsForValue()).thenReturn(values);when(values.setIfAbsent(anyString(),anyString(),any(Duration.class))).thenReturn(true);
            when(redis.execute(any(RedisScript.class),anyList(),any(Object[].class))).thenReturn(1L);
            var sync=new BaitlyDirectoryCountrySync(db,manager,redis,source,json,env);
            db.update("INSERT INTO baitly_directory_professionals(country_code,identifier_type,identifier,base_source,name,address,city,postal_code,activity,sirene_retrieved_at,recorded_by) VALUES('SA','UNN','7000000001','WATHQ','Registry','','Riyadh','','',now(),'test')");
            Path file=Files.createTempFile("baitly-public-test-",".jsonl");
            try{
                var osm=json.readTree(row("OSM","node/42","Laundry","osm@example.org"));
                var overture=json.readTree(row("OVERTURE",OVERTURE,"Cleaner","over@example.org"));
                ((com.fasterxml.jackson.databind.node.ObjectNode)osm.path("identifiers")).put("OVERTURE","12345678-1234-1234-1234-123456789abc");
                ((com.fasterxml.jackson.databind.node.ArrayNode)osm.path("sourceEvidence")).add(json.readTree(row("OVERTURE","12345678-1234-1234-1234-123456789abc","Laundry","fill@example.org")).path("sourceEvidence").get(0));
                Files.writeString(file,json.writeValueAsString(osm)+"\n"+json.writeValueAsString(overture)+"\n");
                when(source.open("SA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest("first",2))));
                sync.synchronize("SA");sync.synchronize("SA");
                long id=db.queryForObject("SELECT id FROM baitly_directory_professionals WHERE identifier=?",Long.class,OVERTURE);
                assertThat(sync.status("SA")).containsEntry("phase","COMPLETED").containsEntry("published",2L);
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence",Long.class)).isEqualTo(3);
                var directory=new BaitlyProfessionalDirectory(db,null,null,json);
                assertThat(directory.referencedSource(id).email()).isEqualTo("over@example.org");
                assertThat(directory.referencedSource(id).contactSources().getFirst().source()).isEqualTo("OVERTURE");
                long osmId=db.queryForObject("SELECT id FROM baitly_directory_professionals WHERE identifier='node/42'",Long.class);
                assertThat(directory.referencedSource(osmId).contactSources()).extracting(BaitlyProfessionalDirectory.ContactEvidence::source).containsExactlyInAnyOrder("OSM","OVERTURE");
                when(source.open("SA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest("second",2))));
                sync.synchronize("SA");
                assertThat(db.queryForObject("SELECT id FROM baitly_directory_professionals WHERE identifier=?",Long.class,OVERTURE)).isEqualTo(id);
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence",Long.class)).isEqualTo(3);
                directory.suppress(id);
                // A new OSM canonical identity must not resurrect a suppressed Overture alias.
                ((com.fasterxml.jackson.databind.node.ObjectNode)osm.path("identifiers")).put("OVERTURE",OVERTURE);
                ((com.fasterxml.jackson.databind.node.ObjectNode)osm.path("sourceEvidence").get(1)).put("identifier",OVERTURE);
                Files.writeString(file,json.writeValueAsString(osm)+"\n");
                when(source.open("SA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest("third",1))));
                sync.synchronize("SA");
                assertThat(db.queryForObject("SELECT source_active FROM baitly_directory_professionals WHERE id=?",Boolean.class,id)).isFalse();
                assertThat(db.queryForObject("SELECT suppressed FROM baitly_directory_professionals WHERE id=?",Boolean.class,id)).isTrue();
                assertThat(db.queryForObject("SELECT email FROM baitly_directory_professionals WHERE id=?",String.class,id)).isNull();
                assertThat(db.queryForObject("SELECT source_active FROM baitly_directory_professionals WHERE id=?",Boolean.class,osmId)).isFalse();
                assertThat(db.queryForObject("SELECT source_active FROM baitly_directory_professionals WHERE identifier='7000000001'",Boolean.class)).isTrue();
                var legacy=new BaitlyDirectoryCountryStock.Manifest("SA","OSM","osm","old","b".repeat(64),1,
                    "https://www.openstreetmap.org/copyright","ODbL 1.0",Instant.now(),true,true);
                when(source.open("SA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,legacy)));
                assertThatCode(()->sync.synchronize("SA")).doesNotThrowAnyException();
                assertThat(sync.status("SA")).containsEntry("phase","COMPLETED");
                assertThat(sync.status("SA")).containsEntry("failures",0);
            }finally{Files.deleteIfExists(file);}
        });
    }
    @Test void unverifiedSourcesAndOvertureInLegacyManifestAreRejected()throws Exception {
        var json=new ObjectMapper().registerModule(new JavaTimeModule());
        var reader=new BaitlyDirectoryCountryStock(new MockEnvironment(),json,mock(BaitlyWathqClient.class));
        String valid=row("OVERTURE",OVERTURE,"Cleaner","over@example.org");
        assertThat(reader.entry(manifest("valid",1),valid).identity().key()).isEqualTo("SA:OVERTURE:"+OVERTURE);
        assertThatThrownBy(()->reader.entry(manifest("bad",1),valid.replace("0.9","0.2"))).hasMessageContaining("position");
        assertThatThrownBy(()->reader.entry(manifest("bad",1),valid.replace("CDLA-Permissive-2.0","Unknown"))).hasMessageContaining("licence");
        var legacy=new BaitlyDirectoryCountryStock.Manifest("SA","OSM","osm","old","a".repeat(64),1,"https://www.openstreetmap.org/copyright","ODbL 1.0",Instant.now(),true,true);
        assertThatThrownBy(()->reader.entry(legacy,valid)).hasMessageContaining("combined");
    }
}
