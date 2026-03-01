package com.clenzy.repository;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelRateModifier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChannelRateModifierRepository extends JpaRepository<ChannelRateModifier, Long> {

    /**
     * Modifiers actifs pour une propriete et un channel specifique.
     * Inclut les modifiers globaux (property = null) et specifiques a la propriete.
     */
    @Query("SELECT m FROM ChannelRateModifier m WHERE m.channelName = :channel " +
           "AND (m.property.id = :propertyId OR m.property IS NULL) " +
           "AND m.isActive = true AND m.organizationId = :orgId " +
           "ORDER BY m.priority DESC")
    List<ChannelRateModifier> findByPropertyIdAndChannel(
            @Param("propertyId") Long propertyId,
            @Param("channel") ChannelName channel,
            @Param("orgId") Long orgId);

    /**
     * Modifiers globaux (toutes proprietes) pour un channel.
     */
    @Query("SELECT m FROM ChannelRateModifier m WHERE m.channelName = :channel " +
           "AND m.property IS NULL AND m.isActive = true " +
           "AND m.organizationId = :orgId ORDER BY m.priority DESC")
    List<ChannelRateModifier> findGlobalByChannel(
            @Param("channel") ChannelName channel,
            @Param("orgId") Long orgId);

    /**
     * Tous les modifiers actifs pour une propriete (tous channels).
     */
    @Query("SELECT m FROM ChannelRateModifier m WHERE " +
           "(m.property.id = :propertyId OR m.property IS NULL) " +
           "AND m.isActive = true AND m.organizationId = :orgId " +
           "ORDER BY m.channelName, m.priority DESC")
    List<ChannelRateModifier> findActiveByPropertyId(
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);

    /**
     * Tous les modifiers actifs de l'organisation.
     */
    @Query("SELECT m FROM ChannelRateModifier m WHERE m.isActive = true " +
           "AND m.organizationId = :orgId ORDER BY m.channelName, m.priority DESC")
    List<ChannelRateModifier> findActiveByOrganizationId(@Param("orgId") Long orgId);
}
