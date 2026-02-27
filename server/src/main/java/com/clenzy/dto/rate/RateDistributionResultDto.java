package com.clenzy.dto.rate;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;

import java.util.Map;

/**
 * Resultat de la distribution des tarifs vers les channels.
 */
public record RateDistributionResultDto(
    Long propertyId,
    Map<ChannelName, ChannelSyncStatus> channelResults
) {
    /**
     * Statut de synchronisation pour un channel individuel.
     */
    public record ChannelSyncStatus(
        String status,
        String message
    ) {
        public static ChannelSyncStatus from(SyncResult result) {
            return new ChannelSyncStatus(
                result.getStatus().name(),
                result.getMessage()
            );
        }
    }
}
