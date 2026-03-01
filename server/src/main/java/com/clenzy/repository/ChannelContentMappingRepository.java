package com.clenzy.repository;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelContentMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChannelContentMappingRepository extends JpaRepository<ChannelContentMapping, Long> {

    @Query("SELECT c FROM ChannelContentMapping c WHERE c.propertyId = :propertyId AND c.organizationId = :orgId")
    List<ChannelContentMapping> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT c FROM ChannelContentMapping c WHERE c.propertyId = :propertyId AND c.channelName = :channel AND c.organizationId = :orgId")
    Optional<ChannelContentMapping> findByPropertyIdAndChannelName(@Param("propertyId") Long propertyId,
                                                                     @Param("channel") ChannelName channel,
                                                                     @Param("orgId") Long orgId);

    @Query("SELECT c FROM ChannelContentMapping c WHERE c.id = :id AND c.organizationId = :orgId")
    Optional<ChannelContentMapping> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Query("SELECT c FROM ChannelContentMapping c WHERE c.organizationId = :orgId")
    List<ChannelContentMapping> findAllByOrgId(@Param("orgId") Long orgId);
}
