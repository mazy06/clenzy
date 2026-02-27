package com.clenzy.repository;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelCommission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChannelCommissionRepository extends JpaRepository<ChannelCommission, Long> {

    @Query("SELECT c FROM ChannelCommission c WHERE c.organizationId = :orgId")
    List<ChannelCommission> findByOrganizationId(@Param("orgId") Long orgId);

    @Query("SELECT c FROM ChannelCommission c WHERE c.channelName = :channel AND c.organizationId = :orgId")
    Optional<ChannelCommission> findByChannelAndOrgId(@Param("channel") ChannelName channel, @Param("orgId") Long orgId);
}
