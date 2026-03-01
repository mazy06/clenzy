package com.clenzy.repository;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelFee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChannelFeeRepository extends JpaRepository<ChannelFee, Long> {

    @Query("SELECT f FROM ChannelFee f WHERE f.propertyId = :propertyId AND f.organizationId = :orgId")
    List<ChannelFee> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT f FROM ChannelFee f WHERE f.propertyId = :propertyId AND f.channelName = :channel AND f.organizationId = :orgId")
    List<ChannelFee> findByPropertyIdAndChannelName(@Param("propertyId") Long propertyId,
                                                      @Param("channel") ChannelName channel,
                                                      @Param("orgId") Long orgId);

    @Query("SELECT f FROM ChannelFee f WHERE f.id = :id AND f.organizationId = :orgId")
    Optional<ChannelFee> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Query("SELECT f FROM ChannelFee f WHERE f.organizationId = :orgId")
    List<ChannelFee> findAllByOrgId(@Param("orgId") Long orgId);
}
