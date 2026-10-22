package com.clenzy.integration.oauth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OAuthStateServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private OAuthStateService service;

    @BeforeEach
    void setUp() {
        service = new OAuthStateService(redisTemplate);
    }

    @Test
    void generate_storesUuidStateWithPayload() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        String state = service.generate("airbnb", 10L, 20L);

        assertNotNull(state);
        assertEquals(36, state.length()); // UUID format
        verify(valueOps).set(eq("oauth:airbnb:state:" + state), eq("10:20"), eq(Duration.ofMinutes(10)));
    }

    @Test
    void generate_lowercasesProviderKey() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        String state = service.generate("MINUT", 1L, 2L);

        verify(valueOps).set(eq("oauth:minut:state:" + state), eq("1:2"), any());
    }

    @Test
    void validateAndConsume_validState_returnsPayloadAndDeletes() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.getAndDelete("oauth:airbnb:state:abc")).thenReturn("10:20");

        Optional<OAuthStateService.StatePayload> result = service.validateAndConsume("airbnb", "abc");

        assertTrue(result.isPresent());
        assertEquals(10L, result.get().userId());
        assertEquals(20L, result.get().orgId());
        verify(valueOps).getAndDelete("oauth:airbnb:state:abc");
        verify(valueOps, never()).get(anyString());
        verify(redisTemplate, never()).delete(anyString());
    }

    @Test
    void validateAndConsume_nullState_empty() {
        Optional<OAuthStateService.StatePayload> result = service.validateAndConsume("airbnb", null);
        assertTrue(result.isEmpty());
    }

    @Test
    void validateAndConsume_blankState_empty() {
        Optional<OAuthStateService.StatePayload> result = service.validateAndConsume("airbnb", "  ");
        assertTrue(result.isEmpty());
    }

    @Test
    void validateAndConsume_unknownState_empty() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.getAndDelete(anyString())).thenReturn(null);

        Optional<OAuthStateService.StatePayload> result = service.validateAndConsume("airbnb", "missing");

        assertTrue(result.isEmpty());
        verify(redisTemplate, never()).delete(anyString());
    }

    @Test
    void validateAndConsume_malformedPayload_empty() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.getAndDelete(anyString())).thenReturn("only-one-part");

        Optional<OAuthStateService.StatePayload> result = service.validateAndConsume("airbnb", "x");

        assertTrue(result.isEmpty());
    }

    @Test
    void validateAndConsume_nonNumericIds_empty() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.getAndDelete(anyString())).thenReturn("abc:def");

        Optional<OAuthStateService.StatePayload> result = service.validateAndConsume("airbnb", "x");

        assertTrue(result.isEmpty());
        // Même mal formée, la valeur est consommée atomiquement.
        verify(valueOps).getAndDelete(anyString());
    }

    @Test
    void statePayload_record_accessors() {
        OAuthStateService.StatePayload p = new OAuthStateService.StatePayload(1L, 2L);
        assertEquals(1L, p.userId());
        assertEquals(2L, p.orgId());
    }

    @Test void concurrentCallbacksAcceptOnlyOneIdentity() throws Exception {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        var stored=new java.util.concurrent.atomic.AtomicReference<>("10:20");
        var barrier=new java.util.concurrent.CyclicBarrier(2);
        when(valueOps.getAndDelete(anyString())).thenAnswer(call -> {
            barrier.await(3,java.util.concurrent.TimeUnit.SECONDS);
            return stored.getAndSet(null);
        });
        var executor=java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var first=executor.submit(() -> service.validateAndConsume("airbnb","one-use"));
            var second=executor.submit(() -> service.validateAndConsume("airbnb","one-use"));
            assertEquals(1,java.util.stream.Stream.of(first.get(4,java.util.concurrent.TimeUnit.SECONDS),
                    second.get(4,java.util.concurrent.TimeUnit.SECONDS)).filter(Optional::isPresent).count());
            verify(valueOps,never()).get(anyString()); verify(redisTemplate,never()).delete(anyString());
        } finally {executor.shutdownNow();}
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"0:20","10:0","-1:20","10:-1","10:20:",":20","10:","9223372036854775808:20"})
    void invalidIdentityNeverReturnsAnAuthenticatedPayload(String payload) {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.getAndDelete(anyString())).thenReturn(payload);
        assertTrue(service.validateAndConsume("airbnb","opaque-state").isEmpty());
    }

    @Test void rejectedStateAndPayloadAreNeverLogged() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.getAndDelete(anyString())).thenReturn(null,"email=synthetic@example.invalid token=private-payload");
        var logger=(ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(OAuthStateService.class);
        var appender=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start();logger.addAppender(appender);
        try {
            service.validateAndConsume("airbnb","private-state");service.validateAndConsume("airbnb","private-state");
            assertEquals(2,appender.list.size());
            for(var event:appender.list) {
                org.assertj.core.api.Assertions.assertThat(event.getFormattedMessage()).doesNotContain("private-","example.invalid");
                assertNull(event.getThrowableProxy());
            }
        } finally {logger.detachAppender(appender);appender.stop();}
    }
}
