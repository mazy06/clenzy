package com.clenzy.integration.external.dto;

import com.clenzy.integration.external.model.ExternalServiceConnection;
import com.clenzy.service.signature.SignatureProviderType;

import java.time.Instant;

/**
 * Reponse pour GET /api/integrations/external/{providerType}/status.
 * Ne expose JAMAIS l'API key.
 */
public record ExternalConnectionStatusDto(
        boolean connected,
        SignatureProviderType providerType,
        String serverUrl,
        String accountIdentifier,
        String status,
        Instant lastTestedAt,
        Instant connectedAt
) {
    public static ExternalConnectionStatusDto notConnected(SignatureProviderType type) {
        return new ExternalConnectionStatusDto(false, type, null, null, null, null, null);
    }

    public static ExternalConnectionStatusDto fromEntity(ExternalServiceConnection c) {
        return new ExternalConnectionStatusDto(
                c.getStatus() == ExternalServiceConnection.Status.ACTIVE,
                c.getProviderType(),
                c.getServerUrl(),
                c.getAccountIdentifier(),
                c.getStatus().name(),
                c.getLastTestedAt(),
                c.getCreatedAt()
        );
    }
}
