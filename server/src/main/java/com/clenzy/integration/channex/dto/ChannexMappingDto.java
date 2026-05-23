package com.clenzy.integration.channex.dto;

import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * Representation API d'un {@link ChannexPropertyMapping}.
 *
 * <p>Affiche notamment :</p>
 * <ul>
 *   <li>les 3 IDs Channex (property/roomType/ratePlan)</li>
 *   <li>l'etat de sync + message d'erreur eventuel</li>
 *   <li>les timestamps creation / derniere sync</li>
 * </ul>
 */
public record ChannexMappingDto(
    UUID id,
    Long organizationId,
    Long clenzyPropertyId,
    String channexPropertyId,
    String channexRoomTypeId,
    String channexDefaultRatePlanId,
    ChannexSyncStatus syncStatus,
    Instant lastSyncAt,
    String lastSyncError,
    Instant createdAt,
    Instant updatedAt
) {
    public static ChannexMappingDto from(ChannexPropertyMapping m) {
        return new ChannexMappingDto(
            m.getId(),
            m.getOrganizationId(),
            m.getClenzyPropertyId(),
            m.getChannexPropertyId(),
            m.getChannexRoomTypeId(),
            m.getChannexDefaultRatePlanId(),
            m.getSyncStatus(),
            m.getLastSyncAt(),
            m.getLastSyncError(),
            m.getCreatedAt(),
            m.getUpdatedAt()
        );
    }
}
