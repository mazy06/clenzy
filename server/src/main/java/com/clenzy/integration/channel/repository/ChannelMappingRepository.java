package com.clenzy.integration.channel.repository;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChannelMappingRepository extends JpaRepository<ChannelMapping, Long> {

    /**
     * Mapping pour une propriete et un channel specifique.
     * Utilise pour resoudre le listing_id cote channel.
     */
    @Query("SELECT cm FROM ChannelMapping cm JOIN cm.connection cc " +
           "WHERE cm.internalId = :propertyId AND cc.channel = :channel " +
           "AND cm.organizationId = :orgId AND cm.syncEnabled = true")
    Optional<ChannelMapping> findByPropertyIdAndChannel(
            @Param("propertyId") Long propertyId,
            @Param("channel") ChannelName channel,
            @Param("orgId") Long orgId);

    /**
     * Tous les mappings actifs pour une propriete (tous channels confondus).
     * Utilise pour le fan-out outbound.
     */
    @Query("SELECT cm FROM ChannelMapping cm JOIN cm.connection cc " +
           "WHERE cm.internalId = :propertyId AND cm.entityType = 'PROPERTY' " +
           "AND cm.syncEnabled = true AND cc.status = 'ACTIVE' " +
           "AND cm.organizationId = :orgId")
    List<ChannelMapping> findActiveByPropertyId(
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);

    /**
     * Tous les mappings d'une connexion.
     */
    @Query("SELECT cm FROM ChannelMapping cm WHERE cm.connection.id = :connectionId " +
           "AND cm.organizationId = :orgId")
    List<ChannelMapping> findByConnectionId(
            @Param("connectionId") Long connectionId,
            @Param("orgId") Long orgId);

    /**
     * Mapping par external_id (lookup inverse : channel → PMS).
     */
    @Query("SELECT cm FROM ChannelMapping cm JOIN cm.connection cc " +
           "WHERE cm.externalId = :externalId AND cc.channel = :channel " +
           "AND cm.organizationId = :orgId")
    Optional<ChannelMapping> findByExternalIdAndChannel(
            @Param("externalId") String externalId,
            @Param("channel") ChannelName channel,
            @Param("orgId") Long orgId);
}
