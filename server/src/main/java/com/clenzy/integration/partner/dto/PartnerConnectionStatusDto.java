package com.clenzy.integration.partner.dto;

import com.clenzy.integration.partner.model.PartnerServiceConnection;
import com.clenzy.integration.partner.model.PartnerServiceType;

import java.time.Instant;

/** Reponse pour GET /api/integrations/partner/{providerType}/status. N'expose JAMAIS l'API key. */
public record PartnerConnectionStatusDto(
        boolean connected,
        PartnerServiceType providerType,
        String serverUrl,
        String accountIdentifier,
        String status,
        Instant lastTestedAt,
        Instant connectedAt
) {
    public static PartnerConnectionStatusDto notConnected(PartnerServiceType type) {
        return new PartnerConnectionStatusDto(false, type, null, null, null, null, null);
    }

    public static PartnerConnectionStatusDto fromEntity(PartnerServiceConnection c) {
        return new PartnerConnectionStatusDto(
                c.getStatus() == PartnerServiceConnection.Status.ACTIVE,
                c.getProviderType(),
                c.getServerUrl(),
                c.getAccountIdentifier(),
                c.getStatus().name(),
                c.getLastTestedAt(),
                c.getCreatedAt()
        );
    }
}
