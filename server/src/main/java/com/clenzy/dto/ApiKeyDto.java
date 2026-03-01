package com.clenzy.dto;

import com.clenzy.model.ApiKey;
import com.clenzy.model.ApiKey.ApiKeyStatus;

import java.time.Instant;

public record ApiKeyDto(
    Long id,
    String keyName,
    String keyPrefix,
    ApiKeyStatus status,
    String scopes,
    Integer rateLimitPerMinute,
    Instant lastUsedAt,
    Instant expiresAt,
    Instant createdAt
) {
    public static ApiKeyDto from(ApiKey k) {
        return new ApiKeyDto(
            k.getId(), k.getKeyName(), k.getKeyPrefix(),
            k.getStatus(), k.getScopes(), k.getRateLimitPerMinute(),
            k.getLastUsedAt(), k.getExpiresAt(), k.getCreatedAt()
        );
    }
}
