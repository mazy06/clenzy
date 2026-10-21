package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.Duration;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyProfessionalDataClientLimitsTest {
    @Test @SuppressWarnings("unchecked") void throttledRequestsDoNotConsumeTheDailyRequestBudget(){
        var redis=mock(StringRedisTemplate.class);ValueOperations<String,String> values=mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);when(values.setIfAbsent(anyString(),anyString(),any(Duration.class))).thenReturn(false);
        var client=new BaitlyProfessionalDataClient(new ObjectMapper(),redis,"https://recherche-entreprises.api.gouv.fr/search","https://overpass-api.de/api/interpreter");
        var b=new BaitlyProfessionalData.Business("12345678900011","Atlas","Nantes","Nantes","44000","81.21Z",47.2,-1.5);
        assertThatThrownBy(()->client.match(b)).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(429));
        verify(values,never()).increment(anyString());
    }
}
