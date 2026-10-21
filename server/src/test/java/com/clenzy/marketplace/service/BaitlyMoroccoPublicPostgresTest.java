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
class BaitlyMoroccoPublicPostgresTest {
    static final String OVERTURE="cd9acfa1-6f6e-40ab-8e0c-8f188d4ea776";
    static String row(String type,String id,String name,String email){
        return """
            {"active":true,"identifierType":"%s","identifier":"%s","baseSource":"%s",
            "sourceUrl":"%s","sourceLicence":"%s","name":"%s","city":"Marrakech","address":"10 Street",
            "postalCode":"40000","activity":"","service":"LAUNDRY","latitude":31.63,"longitude":-7.99,
            "email":"%s","overture":{"confidence":0.9},"identifiers":{"%s":"%s"},
            "sourceEvidence":[{"source":"%s","identifier":"%s","url":"%s","licence":"%s"}]}
            """.formatted(type,id,type,url(type,id),licence(type),name,email,type,id,type,id,url(type,id),licence(type)).strip();
    }
    static String url(String type,String id){return type.equals("OSM")?"https://www.openstreetmap.org/"+id:BaitlyDirectoryCountryStock.OVERTURE_URL;}
    static String licence(String type){return type.equals("OSM")?"ODbL 1.0":"CDLA-Permissive-2.0";}
    static BaitlyDirectoryCountryStock.Manifest manifest(String version,int count){
        return new BaitlyDirectoryCountryStock.Manifest("MA","MA_PUBLIC","ma-public",version,"a".repeat(64),count,
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
            db.update("INSERT INTO baitly_directory_professionals(country_code,identifier_type,identifier,base_source,name,address,city,postal_code,activity,sirene_retrieved_at,recorded_by) VALUES('MA','ICE','000000000000001','OMPIC','Registry','','Marrakech','','',now(),'test')");
            Path file=Files.createTempFile("baitly-public-test-",".jsonl");
            try{
                var osm=json.readTree(row("OSM","node/42","Laundry","osm@example.org"));
                var overture=json.readTree(row("OVERTURE",OVERTURE,"Cleaner","over@example.org"));
                ((com.fasterxml.jackson.databind.node.ObjectNode)osm.path("identifiers")).put("OVERTURE","12345678-1234-1234-1234-123456789abc");
                ((com.fasterxml.jackson.databind.node.ArrayNode)osm.path("sourceEvidence")).add(json.readTree(row("OVERTURE","12345678-1234-1234-1234-123456789abc","Laundry","fill@example.org")).path("sourceEvidence").get(0));
                Files.writeString(file,json.writeValueAsString(osm)+"\n"+json.writeValueAsString(overture)+"\n");
                when(source.open("MA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest("first",2))));
                sync.synchronize("MA");sync.synchronize("MA");
                long id=db.queryForObject("SELECT id FROM baitly_directory_professionals WHERE identifier=?",Long.class,OVERTURE);
                assertThat(sync.status("MA")).containsEntry("phase","COMPLETED").containsEntry("published",2L);
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence",Long.class)).isEqualTo(3);
                var directory=new BaitlyProfessionalDirectory(db,null,null,json);
                assertThat(directory.referencedSource(id).email()).isEqualTo("over@example.org");
                assertThat(directory.referencedSource(id).contactSources().getFirst().source()).isEqualTo("OVERTURE");
                long osmId=db.queryForObject("SELECT id FROM baitly_directory_professionals WHERE identifier='node/42'",Long.class);
                assertThat(directory.referencedSource(osmId).contactSources()).extracting(BaitlyProfessionalDirectory.ContactEvidence::source).containsExactlyInAnyOrder("OSM","OVERTURE");
                when(source.open("MA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest("second",2))));
                sync.synchronize("MA");
                assertThat(db.queryForObject("SELECT id FROM baitly_directory_professionals WHERE identifier=?",Long.class,OVERTURE)).isEqualTo(id);
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence",Long.class)).isEqualTo(3);
                directory.suppress(id);
                // A new OSM canonical identity must not resurrect a suppressed Overture alias.
                ((com.fasterxml.jackson.databind.node.ObjectNode)osm.path("identifiers")).put("OVERTURE",OVERTURE);
                ((com.fasterxml.jackson.databind.node.ObjectNode)osm.path("sourceEvidence").get(1)).put("identifier",OVERTURE);
                Files.writeString(file,json.writeValueAsString(osm)+"\n");
                when(source.open("MA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest("third",1))));
                sync.synchronize("MA");
                assertThat(db.queryForObject("SELECT source_active FROM baitly_directory_professionals WHERE id=?",Boolean.class,id)).isFalse();
                assertThat(db.queryForObject("SELECT suppressed FROM baitly_directory_professionals WHERE id=?",Boolean.class,id)).isTrue();
                assertThat(db.queryForObject("SELECT email FROM baitly_directory_professionals WHERE id=?",String.class,id)).isNull();
                assertThat(db.queryForObject("SELECT source_active FROM baitly_directory_professionals WHERE id=?",Boolean.class,osmId)).isFalse();
                assertThat(db.queryForObject("SELECT source_active FROM baitly_directory_professionals WHERE identifier='000000000000001'",Boolean.class)).isTrue();
                var legacy=new BaitlyDirectoryCountryStock.Manifest("MA","OSM","osm","old","b".repeat(64),1,
                    "https://www.openstreetmap.org/copyright","ODbL 1.0",Instant.now(),true,true);
                when(source.open("MA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,legacy)));
                assertThatCode(()->sync.synchronize("MA")).doesNotThrowAnyException();
                assertThat(sync.status("MA")).containsEntry("phase","COMPLETED");
                assertThat(sync.status("MA")).containsEntry("failures",0);
            }finally{Files.deleteIfExists(file);}
        });
    }
    @Test void unverifiedSourcesAndOvertureInLegacyManifestAreRejected()throws Exception {
        var json=new ObjectMapper().registerModule(new JavaTimeModule());
        var reader=new BaitlyDirectoryCountryStock(new MockEnvironment(),json,mock(BaitlyWathqClient.class));
        String valid=row("OVERTURE",OVERTURE,"Cleaner","over@example.org");
        assertThat(reader.entry(manifest("valid",1),valid).identity().key()).isEqualTo("MA:OVERTURE:"+OVERTURE);
        assertThatThrownBy(()->reader.entry(manifest("bad",1),valid.replace("0.9","0.2"))).hasMessageContaining("position");
        assertThatThrownBy(()->reader.entry(manifest("bad",1),valid.replace("CDLA-Permissive-2.0","Unknown"))).hasMessageContaining("licence");
        var legacy=new BaitlyDirectoryCountryStock.Manifest("MA","OSM","osm","old","a".repeat(64),1,"https://www.openstreetmap.org/copyright","ODbL 1.0",Instant.now(),true,true);
        assertThatThrownBy(()->reader.entry(legacy,valid)).hasMessageContaining("combined");
    }
    @Test void websiteContactsAndServicesKeepIdentityEvidenceAndSuppressionAcrossReplays()throws Exception {
        BaitlyNationalDirectoryPostgresTest.withDatabase((db,manager)->{
            var json=new ObjectMapper().registerModule(new JavaTimeModule());var env=new MockEnvironment();
            var reader=new BaitlyDirectoryCountryStock(env,json,mock(BaitlyWathqClient.class));
            var source=mock(BaitlyDirectoryCountryStock.class);
            when(source.entry(any(),anyString())).thenAnswer(call->reader.entry(call.getArgument(0),call.getArgument(1)));
            var redis=mock(StringRedisTemplate.class);@SuppressWarnings("unchecked") ValueOperations<String,String> values=mock(ValueOperations.class);
            when(redis.opsForValue()).thenReturn(values);when(values.setIfAbsent(anyString(),anyString(),any(Duration.class))).thenReturn(true);
            when(redis.execute(any(RedisScript.class),anyList(),any(Object[].class))).thenReturn(1L);
            var sync=new BaitlyDirectoryCountrySync(db,manager,redis,source,json,env);
            var row=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(row("OSM","node/42","Pressing","contact@example.org"));
            row.put("website","https://example.org/");row.putArray("websiteServices").add("LAUNDRY");
            var proof=row.withArray("sourceEvidence").addObject();
            proof.put("source","WEBSITE").put("identifier","node/42").put("url","https://example.org/")
                .put("licence","Public business facts; reviewed website conditions").put("reuseBasis","REVIEWED_PUBLIC_BUSINESS_FACTS")
                .put("policyId","pressing-test").put("policyRevision","v1").put("retrievedAt",Instant.now().toString())
                .put("reviewedAt",Instant.now().minusSeconds(3600).toString()).put("expiresAt",Instant.now().plusSeconds(86400).toString())
                .put("email","contact@example.org");
            proof.putObject("fields").putObject("email").put("value","contact@example.org").put("url","https://example.org/");
            proof.putObject("services").put("LAUNDRY","https://example.org/");
            proof.putArray("offerings").addObject().put("service","LAUNDRY").put("label","Linge de maison").put("url","https://example.org/");
            proof.putArray("checks").addObject().put("url","https://example.org/").put("sha256","a".repeat(64));
            assertThat(reader.entry(manifest("website",1),row.toString()).email()).isEqualTo("contact@example.org");
            String valid=row.toString();
            assertThatThrownBy(()->reader.entry(manifest("bad",1),valid.replace("REVIEWED_PUBLIC_BUSINESS_FACTS","UNREVIEWED"))).hasMessageContaining("Unreviewed");
            assertThatThrownBy(()->reader.entry(manifest("bad",1),valid.replace("https://example.org/","https://127.0.0.1/"))).hasMessageContaining("URL");
            Path file=Files.createTempFile("baitly-website-test-",".jsonl");
            try{
                Files.writeString(file,valid+"\n");
                when(source.open("MA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest("first-web",1))));
                sync.synchronize("MA");sync.synchronize("MA");
                long id=db.queryForObject("SELECT id FROM baitly_directory_professionals WHERE country_code='MA'",Long.class);
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_professionals",Long.class)).isEqualTo(1);
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence WHERE source='WEBSITE'",Long.class)).isEqualTo(1);
                var reference=new BaitlyProfessionalDirectory(db,null,null,json).referencedSource(id);
                assertThat(reference.contactSources()).extracting(BaitlyProfessionalDirectory.ContactEvidence::source).contains("WEBSITE");
                assertThat(reference.services()).contains("LAUNDRY");
                assertThat(reference.serviceDetails()).extracting(BaitlyProfessionalDirectory.WebsiteOffering::label).containsExactly("Linge de maison");
                new BaitlyProfessionalDirectory(db,null,null,json).suppress(id);
                when(source.open("MA")).thenReturn(Optional.of(new BaitlyDirectoryCountryStock.Stock(file,manifest("next-web",1))));
                sync.synchronize("MA");
                assertThat(db.queryForObject("SELECT email FROM baitly_directory_professionals WHERE id=?",String.class,id)).isNull();
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence WHERE source='WEBSITE'",Long.class)).isZero();
            }finally{Files.deleteIfExists(file);}
        });
    }
}
