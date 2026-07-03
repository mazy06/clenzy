package com.clenzy.dto;

import java.time.LocalDateTime;

/** Lien Constellation Proprietaire genere par la conciergerie (campagne X9 v1). */
public record OwnerPortalLinkDto(
        Long id,
        String url,
        LocalDateTime expiresAt,
        boolean revoked,
        LocalDateTime createdAt
) {}
