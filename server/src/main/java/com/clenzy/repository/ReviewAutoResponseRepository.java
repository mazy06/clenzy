package com.clenzy.repository;

import com.clenzy.model.ReviewAutoResponse;
import com.clenzy.model.SentimentLabel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReviewAutoResponseRepository extends JpaRepository<ReviewAutoResponse, Long> {

    @Query("SELECT r FROM ReviewAutoResponse r WHERE r.organizationId = :orgId AND r.isActive = true")
    List<ReviewAutoResponse> findActiveByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT r FROM ReviewAutoResponse r WHERE r.organizationId = :orgId AND r.isActive = true " +
           "AND r.minRating <= :rating AND r.maxRating >= :rating " +
           "AND (r.sentimentFilter IS NULL OR r.sentimentFilter = :sentiment)")
    List<ReviewAutoResponse> findMatchingTemplates(@Param("orgId") Long orgId,
        @Param("rating") int rating, @Param("sentiment") SentimentLabel sentiment);
}
