package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyWathqClientTest {
    @Test void apiIsDisabledByDefaultAndBudgetReservationPrecedesEveryRequest()throws Exception {
        var env=new MockEnvironment();var redis=mock(StringRedisTemplate.class);var calls=new ArrayList<String>();
        var client=new BaitlyWathqClient(env,redis,new ObjectMapper()){
            @Override protected JsonNode fetch(String url,String key){calls.add(url);return new ObjectMapper().createObjectNode();}
        };
        var id=new BaitlyDirectoryCountry.Identity("SA","UNN","7001272475");
        assertThatThrownBy(()->client.lookup(id)).hasMessageContaining("disabled");verifyNoInteractions(redis);
        env.withProperty("baitly.directory.sa.wathq.enabled","true").withProperty("baitly.directory.sa.reuse-authorized","true")
            .withProperty("baitly.directory.sa.wathq.sandbox-api-key","test-only").withProperty("baitly.directory.sa.wathq.daily-request-limit","5");
        when(redis.execute(any(RedisScript.class),anyList(),any(Object[].class))).thenReturn(0L);
        assertThatThrownBy(()->client.lookup(id)).isInstanceOf(BaitlyWathqClient.SourceFailure.class);assertThat(calls).isEmpty();
        when(redis.execute(any(RedisScript.class),anyList(),any(Object[].class))).thenReturn(1L);
        var sandbox=client.lookup(id);assertThat(sandbox.environment()).isEqualTo("sandbox");
        assertThat(calls).containsExactly("https://api.wathq.sa/sandbox/commercial-registration/info/7001272475");
        env.withProperty("baitly.directory.sa.wathq.environment","production");
        assertThatThrownBy(()->client.lookup(id)).hasMessageContaining("disabled");
        env.withProperty("baitly.directory.sa.wathq.production-authorized","true").withProperty("baitly.directory.sa.wathq.production-url","https://internal.example/api");
        assertThatThrownBy(()->client.lookup(id)).hasMessageContaining("origin");assertThat(calls).hasSize(1);
    }
}
