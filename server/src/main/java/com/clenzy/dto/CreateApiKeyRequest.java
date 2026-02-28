package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;

public record CreateApiKeyRequest(
    @NotBlank String keyName,
    String scopes,
    Integer rateLimitPerMinute,
    Instant expiresAt
) {}
