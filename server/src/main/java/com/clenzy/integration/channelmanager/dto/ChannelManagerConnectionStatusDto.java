package com.clenzy.integration.channelmanager.dto;

import com.clenzy.integration.channelmanager.model.ChannelManagerConnection;
import com.clenzy.integration.channelmanager.model.ChannelManagerProviderType;

import java.time.Instant;

/** Reponse pour GET /api/integrations/channel-manager/{providerType}/status. */
public record ChannelManagerConnectionStatusDto(
        boolean connected,
        ChannelManagerProviderType providerType,
        String serverUrl,
        String accountIdentifier,
        String status,
        Instant lastTestedAt,
        Instant connectedAt
) {
    public static ChannelManagerConnectionStatusDto notConnected(ChannelManagerProviderType type) {
        return new ChannelManagerConnectionStatusDto(false, type, null, null, null, null, null);
    }

    public static ChannelManagerConnectionStatusDto fromEntity(ChannelManagerConnection c) {
        return new ChannelManagerConnectionStatusDto(
                c.getStatus() == ChannelManagerConnection.Status.ACTIVE,
                c.getProviderType(),
                c.getServerUrl(),
                c.getAccountIdentifier(),
                c.getStatus().name(),
                c.getLastTestedAt(),
                c.getCreatedAt()
        );
    }
}
