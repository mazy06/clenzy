package com.clenzy.marketplace.repository;

import com.clenzy.marketplace.model.MarketplaceReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MarketplaceReviewRepository extends JpaRepository<MarketplaceReview, Long> {
    interface RatingSummary { Double getAverage(); Long getTotal(); }
    @Query("SELECT AVG(r.rating) AS average, COUNT(r) AS total FROM MarketplaceReview r WHERE r.providerId = :providerId")
    RatingSummary summarize(@Param("providerId") Long providerId);
}
