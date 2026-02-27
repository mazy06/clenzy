package com.clenzy.repository;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelPromotion;
import com.clenzy.model.PromotionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ChannelPromotionRepository extends JpaRepository<ChannelPromotion, Long> {

    @Query("SELECT p FROM ChannelPromotion p WHERE p.propertyId = :propertyId AND p.organizationId = :orgId ORDER BY p.createdAt DESC")
    List<ChannelPromotion> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT p FROM ChannelPromotion p WHERE p.channelName = :channel AND p.status = :status AND p.organizationId = :orgId")
    List<ChannelPromotion> findActiveByChannel(@Param("channel") ChannelName channel,
        @Param("status") PromotionStatus status, @Param("orgId") Long orgId);

    @Query("SELECT p FROM ChannelPromotion p WHERE p.status = 'ACTIVE' AND p.endDate < :now AND p.organizationId = :orgId")
    List<ChannelPromotion> findExpired(@Param("now") LocalDate now, @Param("orgId") Long orgId);

    @Query("SELECT p FROM ChannelPromotion p WHERE p.id = :id AND p.organizationId = :orgId")
    Optional<ChannelPromotion> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Query("SELECT p FROM ChannelPromotion p WHERE p.organizationId = :orgId ORDER BY p.createdAt DESC")
    List<ChannelPromotion> findAllByOrgId(@Param("orgId") Long orgId);
}
