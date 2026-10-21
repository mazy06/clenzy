package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.redis.core.*;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.mock.env.MockEnvironment;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="baitly.directory.test.jdbc",matches="jdbc:postgresql:.*baitly_directory_test_.*")
class BaitlyDirectoryCountryRecoveryPostgresTest {
    @Test void failedRemoteRefreshRetainsPublicationAndEvidenceThenRecoversWithoutReimport()throws Exception {
        BaitlyNationalDirectoryPostgresTest.withDatabase((db,manager)->{
            var json=new ObjectMapper().registerModule(new JavaTimeModule());var env=new MockEnvironment();
            var reader=new BaitlyDirectoryCountryStock(env,json,mock(BaitlyWathqClient.class));
            var source=mock(BaitlyDirectoryCountryStock.class);
            when(source.entry(any(),anyString())).thenAnswer(call->reader.entry(call.getArgument(0),call.getArgument(1)));
            var redis=mock(StringRedisTemplate.class);@SuppressWarnings("unchecked") ValueOperations<String,String> values=mock(ValueOperations.class);
            var tokens=new HashMap<String,String>();when(redis.opsForValue()).thenReturn(values);
            when(values.setIfAbsent(anyString(),anyString(),any(Duration.class))).thenAnswer(call->{tokens.put(call.getArgument(0),call.getArgument(1));return true;});
            when(values.get(anyString())).thenAnswer(call->tokens.get(call.getArgument(0)));
            when(redis.execute(any(RedisScript.class),anyList(),any(Object[].class))).thenReturn(1L);
            var sync=new BaitlyDirectoryCountrySync(db,manager,redis,source,json,env);
            Path file=Files.createTempFile("baitly-source-recovery-",".jsonl");
            try{
                Files.writeString(file,json.writeValueAsString(json.readTree(BaitlyMoroccoPublicPostgresTest.row("OVERTURE",BaitlyMoroccoPublicPostgresTest.OVERTURE,"Laundry","contact@example.org")))+"\n");
                var edition=new BaitlyDirectoryCountryStock.Stock(file,BaitlyMoroccoPublicPostgresTest.manifest("recovery",1));
                when(source.open("MA")).thenReturn(Optional.of(edition));sync.synchronize("MA");
                var before=db.queryForList("SELECT * FROM baitly_directory_professionals");
                var evidence=db.queryForList("SELECT * FROM baitly_directory_source_evidence");
                clearInvocations(source);
                when(source.open("MA")).thenThrow(new BaitlyPublicCountryStock.SourceUnavailable(403,"latest.json"));
                assertThatThrownBy(()->sync.synchronize("MA")).isInstanceOf(BaitlyPublicCountryStock.SourceUnavailable.class);
                assertThat(sync.status("MA")).containsEntry("phase","COMPLETED").containsEntry("published",1L).containsEntry("source_error","PUBLIC_HTTP_403").containsEntry("failures",1);
                assertThat(db.queryForObject("SELECT retry_at>now() FROM baitly_directory_sync WHERE country_code='MA'",Boolean.class)).isTrue();
                sync.synchronize("MA");verify(source,times(1)).open("MA");
                assertThat(db.queryForList("SELECT * FROM baitly_directory_professionals")).isEqualTo(before);
                assertThat(db.queryForList("SELECT * FROM baitly_directory_source_evidence")).isEqualTo(evidence);
                doReturn(Optional.of(edition)).when(source).open("MA");sync.synchronize("MA",true);
                assertThat(sync.status("MA")).containsEntry("phase","COMPLETED").containsEntry("failures",0).containsEntry("source_error",null).containsEntry("retry_at",null);
                assertThat(db.queryForList("SELECT * FROM baitly_directory_professionals")).isEqualTo(before);
                assertThat(db.queryForList("SELECT * FROM baitly_directory_source_evidence")).isEqualTo(evidence);
            }finally{Files.deleteIfExists(file);}
        });
    }
}
