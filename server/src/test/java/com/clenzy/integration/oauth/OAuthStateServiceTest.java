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
        when(valueOps.get("oauth:airbnb:state:abc")).thenReturn("10:20");

        Optional<OAuthStateService.StatePayload> result = service.validateAndConsume("airbnb", "abc");

        assertTrue(result.isPresent());
        assertEquals(10L, result.get().userId());
        assertEquals(20L, result.get().orgId());
        verify(redisTemplate).delete("oauth:airbnb:state:abc");
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
        when(valueOps.get(anyString())).thenReturn(null);

        Optional<OAuthStateService.StatePayload> result = service.validateAndConsume("airbnb", "missing");

        assertTrue(result.isEmpty());
        verify(redisTemplate, never()).delete(anyString());
    }

    @Test
    void validateAndConsume_malformedPayload_empty() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(anyString())).thenReturn("only-one-part");

        Optional<OAuthStateService.StatePayload> result = service.validateAndConsume("airbnb", "x");

        assertTrue(result.isEmpty());
    }

    @Test
    void validateAndConsume_nonNumericIds_empty() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(anyString())).thenReturn("abc:def");

        Optional<OAuthStateService.StatePayload> result = service.validateAndConsume("airbnb", "x");

        assertTrue(result.isEmpty());
        // Note: even with bad format, single-use deletes the key
        verify(redisTemplate).delete(anyString());
    }

    @Test
    void statePayload_record_accessors() {
        OAuthStateService.StatePayload p = new OAuthStateService.StatePayload(1L, 2L);
        assertEquals(1L, p.userId());
        assertEquals(2L, p.orgId());
    }
}
