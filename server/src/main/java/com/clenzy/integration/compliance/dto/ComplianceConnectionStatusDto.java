package com.clenzy.integration.compliance.dto;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;

import java.time.Instant;

/** Reponse pour GET /api/integrations/compliance/{providerType}/status. Ne expose JAMAIS l'API key. */
public record ComplianceConnectionStatusDto(
        boolean connected,
        ComplianceProviderType providerType,
        String serverUrl,
        String accountIdentifier,
        String status,
        Instant lastTestedAt,
        Instant connectedAt
) {
    public static ComplianceConnectionStatusDto notConnected(ComplianceProviderType type) {
        return new ComplianceConnectionStatusDto(false, type, null, null, null, null, null);
    }

    public static ComplianceConnectionStatusDto fromEntity(ComplianceConnection c) {
        return new ComplianceConnectionStatusDto(
                c.getStatus() == ComplianceConnection.Status.ACTIVE,
                c.getProviderType(),
                c.getServerUrl(),
                c.getAccountIdentifier(),
                c.getStatus().name(),
                c.getLastTestedAt(),
                c.getCreatedAt()
        );
    }
}
