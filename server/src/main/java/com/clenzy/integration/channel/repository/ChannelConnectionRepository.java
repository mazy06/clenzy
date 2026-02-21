package com.clenzy.integration.channel.repository;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChannelConnectionRepository extends JpaRepository<ChannelConnection, Long> {

    /**
     * Connexion pour une organisation et un channel specifique.
     */
    @Query("SELECT cc FROM ChannelConnection cc " +
           "WHERE cc.organizationId = :orgId AND cc.channel = :channel")
    Optional<ChannelConnection> findByOrganizationIdAndChannel(
            @Param("orgId") Long orgId,
            @Param("channel") ChannelName channel);

    /**
     * Toutes les connexions actives d'une organisation.
     */
    @Query("SELECT cc FROM ChannelConnection cc " +
           "WHERE cc.organizationId = :orgId AND cc.status = 'ACTIVE'")
    List<ChannelConnection> findActiveByOrganizationId(@Param("orgId") Long orgId);

    /**
     * Toutes les connexions actives (cross-org, pour scheduler de sync).
     */
    @Query("SELECT cc FROM ChannelConnection cc WHERE cc.status = 'ACTIVE'")
    List<ChannelConnection> findAllActive();
}
