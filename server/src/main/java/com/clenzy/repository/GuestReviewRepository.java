package com.clenzy.repository;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.GuestReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface GuestReviewRepository extends JpaRepository<GuestReview, Long> {

    @Query("SELECT r FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId ORDER BY r.reviewDate DESC")
    Page<GuestReview> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId, Pageable pageable);

    @Query("SELECT r FROM GuestReview r WHERE r.channelName = :channel AND r.organizationId = :orgId ORDER BY r.reviewDate DESC")
    Page<GuestReview> findByChannelName(@Param("channel") ChannelName channel, @Param("orgId") Long orgId, Pageable pageable);

    @Query("SELECT r FROM GuestReview r WHERE r.organizationId = :orgId ORDER BY r.reviewDate DESC")
    Page<GuestReview> findAllByOrgId(@Param("orgId") Long orgId, Pageable pageable);

    @Query("SELECT r FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId " +
           "AND r.reviewDate BETWEEN :from AND :to ORDER BY r.reviewDate DESC")
    List<GuestReview> findByPropertyIdAndDateRange(@Param("propertyId") Long propertyId,
        @Param("orgId") Long orgId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT r FROM GuestReview r WHERE r.rating < :threshold AND r.hostResponse IS NULL " +
           "AND r.organizationId = :orgId ORDER BY r.reviewDate DESC")
    List<GuestReview> findNegativeWithoutResponse(@Param("threshold") int threshold, @Param("orgId") Long orgId);

    @Query("SELECT AVG(r.rating) FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId")
    Double averageRatingByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(r) FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId")
    long countByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT r.rating, COUNT(r) FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId GROUP BY r.rating")
    List<Object[]> countByPropertyIdGroupByRating(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT r.sentimentLabel, COUNT(r) FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId AND r.sentimentLabel IS NOT NULL GROUP BY r.sentimentLabel")
    List<Object[]> countByPropertyIdGroupBySentiment(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    Optional<GuestReview> findByExternalReviewIdAndOrganizationId(String externalReviewId, Long organizationId);

    @Query("SELECT r FROM GuestReview r WHERE r.id = :id AND r.organizationId = :orgId")
    Optional<GuestReview> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);
}
