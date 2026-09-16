package com.clenzy.marketplace.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Avis unique, traçable à une mission terminée et à son accord marketplace. */
@Entity
@Table(name = "marketplace_reviews")
public class MarketplaceReview {
    @Id @Column(name = "quote_request_id") private Long quoteRequestId;
    @Column(name = "provider_id", nullable = false) private Long providerId;
    @Column(name = "intervention_id", nullable = false, unique = true) private Long interventionId;
    @Column(name = "organization_id", nullable = false) private Long organizationId;
    @Column(name = "author_user_id", nullable = false) private Long authorUserId;
    @Column(nullable = false) private int rating;
    @Column(length = 1000) private String feedback;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    public MarketplaceReview() {}
    public MarketplaceReview(Long quoteId, Long providerId, Long interventionId, Long orgId,
            Long authorId, int rating, String feedback, LocalDateTime now) {
        this.quoteRequestId = quoteId; this.providerId = providerId; this.interventionId = interventionId;
        this.organizationId = orgId; this.authorUserId = authorId; this.rating = rating;
        this.feedback = feedback; this.createdAt = now;
    }
    public int getRating() { return rating; }
    public String getFeedback() { return feedback; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
