package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.Instant;

@Entity
@Table(name = "review_auto_responses")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ReviewAutoResponse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "template_name", nullable = false)
    private String templateName;

    @Column(name = "min_rating")
    private Integer minRating = 1;

    @Column(name = "max_rating")
    private Integer maxRating = 5;

    @Enumerated(EnumType.STRING)
    @Column(name = "sentiment_filter", length = 20)
    private SentimentLabel sentimentFilter;

    @Column(length = 10)
    private String language;

    @Column(name = "response_template", nullable = false, columnDefinition = "TEXT")
    private String responseTemplate;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getTemplateName() { return templateName; }
    public void setTemplateName(String templateName) { this.templateName = templateName; }
    public Integer getMinRating() { return minRating; }
    public void setMinRating(Integer minRating) { this.minRating = minRating; }
    public Integer getMaxRating() { return maxRating; }
    public void setMaxRating(Integer maxRating) { this.maxRating = maxRating; }
    public SentimentLabel getSentimentFilter() { return sentimentFilter; }
    public void setSentimentFilter(SentimentLabel sentimentFilter) { this.sentimentFilter = sentimentFilter; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public String getResponseTemplate() { return responseTemplate; }
    public void setResponseTemplate(String responseTemplate) { this.responseTemplate = responseTemplate; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public Instant getCreatedAt() { return createdAt; }
}
