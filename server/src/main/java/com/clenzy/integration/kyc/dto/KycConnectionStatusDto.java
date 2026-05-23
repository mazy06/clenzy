package com.clenzy.integration.kyc.dto;

import com.clenzy.integration.kyc.model.KycConnection;
import com.clenzy.integration.kyc.model.KycProviderType;

import java.time.Instant;

/** Reponse pour GET /api/integrations/kyc/{providerType}/status. Ne expose JAMAIS l'API key. */
public record KycConnectionStatusDto(
        boolean connected,
        KycProviderType providerType,
        String serverUrl,
        String accountIdentifier,
        String status,
        Instant lastTestedAt,
        Instant connectedAt
) {
    public static KycConnectionStatusDto notConnected(KycProviderType type) {
        return new KycConnectionStatusDto(false, type, null, null, null, null, null);
    }

    public static KycConnectionStatusDto fromEntity(KycConnection c) {
        return new KycConnectionStatusDto(
                c.getStatus() == KycConnection.Status.ACTIVE,
                c.getProviderType(),
                c.getServerUrl(),
                c.getAccountIdentifier(),
                c.getStatus().name(),
                c.getLastTestedAt(),
                c.getCreatedAt()
        );
    }
}
