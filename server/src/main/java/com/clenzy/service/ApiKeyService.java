package com.clenzy.service;

import com.clenzy.dto.ApiKeyDto;
import com.clenzy.dto.CreateApiKeyRequest;
import com.clenzy.model.ApiKey;
import com.clenzy.model.ApiKey.ApiKeyStatus;
import com.clenzy.repository.ApiKeyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class ApiKeyService {

    private static final Logger log = LoggerFactory.getLogger(ApiKeyService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int KEY_LENGTH = 32;

    private final ApiKeyRepository apiKeyRepository;

    public ApiKeyService(ApiKeyRepository apiKeyRepository) {
        this.apiKeyRepository = apiKeyRepository;
    }

    public List<ApiKeyDto> getAllKeys(Long orgId) {
        return apiKeyRepository.findAllByOrgId(orgId).stream()
            .map(ApiKeyDto::from)
            .toList();
    }

    public ApiKeyDto getById(Long id, Long orgId) {
        return apiKeyRepository.findByIdAndOrgId(id, orgId)
            .map(ApiKeyDto::from)
            .orElseThrow(() -> new IllegalArgumentException("API key not found: " + id));
    }

    /**
     * Cree une nouvelle API key. Retourne la cle en clair une seule fois.
     * Seul le hash est stocke en base.
     */
    @Transactional
    public ApiKeyCreationResult createKey(CreateApiKeyRequest request, Long orgId, Long userId) {
        String rawKey = generateRawKey();
        String prefix = rawKey.substring(0, 8);
        String hash = hashKey(rawKey);

        ApiKey key = new ApiKey();
        key.setOrganizationId(orgId);
        key.setKeyName(request.keyName());
        key.setKeyPrefix(prefix);
        key.setKeyHash(hash);
        key.setStatus(ApiKeyStatus.ACTIVE);
        key.setScopes(request.scopes());
        key.setRateLimitPerMinute(request.rateLimitPerMinute() != null ? request.rateLimitPerMinute() : 60);
        key.setExpiresAt(request.expiresAt());
        key.setCreatedBy(userId);

        ApiKey saved = apiKeyRepository.save(key);
        log.info("Created API key '{}' (prefix: {}) for org {}", request.keyName(), prefix, orgId);

        return new ApiKeyCreationResult(ApiKeyDto.from(saved), "ck_" + rawKey);
    }

    /**
     * Valide une API key et retourne l'entite si valide.
     */
    @Transactional
    public Optional<ApiKey> validateKey(String rawKey) {
        String keyWithoutPrefix = rawKey.startsWith("ck_") ? rawKey.substring(3) : rawKey;
        String hash = hashKey(keyWithoutPrefix);
        Optional<ApiKey> keyOpt = apiKeyRepository.findActiveByKeyHash(hash);

        if (keyOpt.isPresent()) {
            ApiKey key = keyOpt.get();
            // Verifier expiration
            if (key.getExpiresAt() != null && key.getExpiresAt().isBefore(Instant.now())) {
                key.setStatus(ApiKeyStatus.EXPIRED);
                apiKeyRepository.save(key);
                return Optional.empty();
            }
            // Mettre a jour last used
            key.setLastUsedAt(Instant.now());
            apiKeyRepository.save(key);
        }

        return keyOpt;
    }

    @Transactional
    public void revokeKey(Long id, Long orgId) {
        ApiKey key = apiKeyRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("API key not found: " + id));
        key.setStatus(ApiKeyStatus.REVOKED);
        key.setRevokedAt(Instant.now());
        apiKeyRepository.save(key);
        log.info("Revoked API key '{}' (prefix: {}) for org {}", key.getKeyName(), key.getKeyPrefix(), orgId);
    }

    private String generateRawKey() {
        byte[] bytes = new byte[KEY_LENGTH];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    String hashKey(String rawKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawKey.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    public record ApiKeyCreationResult(ApiKeyDto apiKey, String rawKey) {}
}
