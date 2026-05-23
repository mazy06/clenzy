package com.clenzy.integration.pricing.dto;

import com.clenzy.integration.pricing.model.PricingConnection;
import com.clenzy.integration.pricing.model.PricingProviderType;

import java.time.Instant;

/** Reponse pour GET /api/integrations/pricing/{providerType}/status. Ne expose JAMAIS l'API key. */
public record PricingConnectionStatusDto(
        boolean connected,
        PricingProviderType providerType,
        String serverUrl,
        String accountIdentifier,
        String status,
        Instant lastTestedAt,
        Instant connectedAt
) {
    public static PricingConnectionStatusDto notConnected(PricingProviderType type) {
        return new PricingConnectionStatusDto(false, type, null, null, null, null, null);
    }

    public static PricingConnectionStatusDto fromEntity(PricingConnection c) {
        return new PricingConnectionStatusDto(
                c.getStatus() == PricingConnection.Status.ACTIVE,
                c.getProviderType(),
                c.getServerUrl(),
                c.getAccountIdentifier(),
                c.getStatus().name(),
                c.getLastTestedAt(),
                c.getCreatedAt()
        );
    }
}
