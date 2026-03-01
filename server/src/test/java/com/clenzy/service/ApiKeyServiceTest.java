package com.clenzy.service;

import com.clenzy.dto.ApiKeyDto;
import com.clenzy.dto.CreateApiKeyRequest;
import com.clenzy.model.ApiKey;
import com.clenzy.model.ApiKey.ApiKeyStatus;
import com.clenzy.repository.ApiKeyRepository;
import com.clenzy.service.ApiKeyService.ApiKeyCreationResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApiKeyServiceTest {

    @Mock private ApiKeyRepository apiKeyRepository;
    @InjectMocks private ApiKeyService service;

    private static final Long ORG_ID = 1L;

    private ApiKey createApiKey() {
        ApiKey key = new ApiKey();
        key.setId(1L);
        key.setOrganizationId(ORG_ID);
        key.setKeyName("Test Key");
        key.setKeyPrefix("abcd1234");
        key.setKeyHash("somehash");
        key.setStatus(ApiKeyStatus.ACTIVE);
        key.setRateLimitPerMinute(60);
        return key;
    }

    @Test
    void createKey_success() {
        CreateApiKeyRequest request = new CreateApiKeyRequest("My API Key", "read,write", 100, null);
        when(apiKeyRepository.save(any())).thenAnswer(inv -> {
            ApiKey saved = inv.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        ApiKeyCreationResult result = service.createKey(request, ORG_ID, 10L);

        assertNotNull(result);
        assertNotNull(result.rawKey());
        assertTrue(result.rawKey().startsWith("ck_"));
        assertEquals("My API Key", result.apiKey().keyName());
        assertEquals(100, result.apiKey().rateLimitPerMinute());
    }

    @Test
    void validateKey_active() {
        String rawKey = "testrawkey12345";
        String hash = service.hashKey(rawKey);
        ApiKey key = createApiKey();
        key.setKeyHash(hash);
        when(apiKeyRepository.findActiveByKeyHash(hash)).thenReturn(Optional.of(key));
        when(apiKeyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Optional<ApiKey> result = service.validateKey(rawKey);

        assertTrue(result.isPresent());
        assertNotNull(result.get().getLastUsedAt());
    }

    @Test
    void validateKey_expired() {
        String rawKey = "testrawkey12345";
        String hash = service.hashKey(rawKey);
        ApiKey key = createApiKey();
        key.setKeyHash(hash);
        key.setExpiresAt(Instant.now().minusSeconds(3600));
        when(apiKeyRepository.findActiveByKeyHash(hash)).thenReturn(Optional.of(key));
        when(apiKeyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Optional<ApiKey> result = service.validateKey(rawKey);

        assertTrue(result.isEmpty());
        assertEquals(ApiKeyStatus.EXPIRED, key.getStatus());
    }

    @Test
    void validateKey_withCkPrefix() {
        String rawKey = "testrawkey12345";
        String hash = service.hashKey(rawKey);
        ApiKey key = createApiKey();
        key.setKeyHash(hash);
        when(apiKeyRepository.findActiveByKeyHash(hash)).thenReturn(Optional.of(key));
        when(apiKeyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Optional<ApiKey> result = service.validateKey("ck_" + rawKey);

        assertTrue(result.isPresent());
    }

    @Test
    void validateKey_notFound() {
        when(apiKeyRepository.findActiveByKeyHash(any())).thenReturn(Optional.empty());

        Optional<ApiKey> result = service.validateKey("invalid");

        assertTrue(result.isEmpty());
    }

    @Test
    void revokeKey_success() {
        ApiKey key = createApiKey();
        when(apiKeyRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(key));
        when(apiKeyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.revokeKey(1L, ORG_ID);

        assertEquals(ApiKeyStatus.REVOKED, key.getStatus());
        assertNotNull(key.getRevokedAt());
    }

    @Test
    void revokeKey_notFound_throws() {
        when(apiKeyRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.revokeKey(1L, ORG_ID));
    }

    @Test
    void hashKey_consistent() {
        String hash1 = service.hashKey("mykey");
        String hash2 = service.hashKey("mykey");
        assertEquals(hash1, hash2);
    }

    @Test
    void hashKey_different_inputs_different_hashes() {
        String hash1 = service.hashKey("key1");
        String hash2 = service.hashKey("key2");
        assertNotEquals(hash1, hash2);
    }
}
