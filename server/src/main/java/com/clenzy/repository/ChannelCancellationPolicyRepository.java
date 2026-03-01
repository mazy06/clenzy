package com.clenzy.repository;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelCancellationPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChannelCancellationPolicyRepository extends JpaRepository<ChannelCancellationPolicy, Long> {

    @Query("SELECT p FROM ChannelCancellationPolicy p WHERE p.propertyId = :propertyId AND p.organizationId = :orgId")
    List<ChannelCancellationPolicy> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT p FROM ChannelCancellationPolicy p WHERE p.propertyId = :propertyId AND p.channelName = :channel AND p.organizationId = :orgId")
    Optional<ChannelCancellationPolicy> findByPropertyIdAndChannelName(@Param("propertyId") Long propertyId,
                                                                        @Param("channel") ChannelName channel,
                                                                        @Param("orgId") Long orgId);

    @Query("SELECT p FROM ChannelCancellationPolicy p WHERE p.id = :id AND p.organizationId = :orgId")
    Optional<ChannelCancellationPolicy> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Query("SELECT p FROM ChannelCancellationPolicy p WHERE p.organizationId = :orgId")
    List<ChannelCancellationPolicy> findAllByOrgId(@Param("orgId") Long orgId);
}
