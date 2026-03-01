package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.Instant;

@Entity
@Table(name = "automation_triggers")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ExternalAutomation {

    public enum AutomationPlatform {
        ZAPIER, MAKE, CUSTOM
    }

    public enum AutomationEvent {
        RESERVATION_CREATED, RESERVATION_UPDATED, RESERVATION_CANCELLED,
        GUEST_CHECKED_IN, GUEST_CHECKED_OUT,
        REVIEW_RECEIVED, MESSAGE_RECEIVED,
        PAYOUT_GENERATED, RATE_UPDATED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "trigger_name", nullable = false, length = 100)
    private String triggerName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AutomationPlatform platform;

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_event", nullable = false, length = 40)
    private AutomationEvent triggerEvent;

    @Column(name = "callback_url", nullable = false)
    private String callbackUrl;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "last_triggered_at")
    private Instant lastTriggeredAt;

    @Column(name = "trigger_count")
    private Long triggerCount = 0L;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getTriggerName() { return triggerName; }
    public void setTriggerName(String triggerName) { this.triggerName = triggerName; }
    public AutomationPlatform getPlatform() { return platform; }
    public void setPlatform(AutomationPlatform platform) { this.platform = platform; }
    public AutomationEvent getTriggerEvent() { return triggerEvent; }
    public void setTriggerEvent(AutomationEvent triggerEvent) { this.triggerEvent = triggerEvent; }
    public String getCallbackUrl() { return callbackUrl; }
    public void setCallbackUrl(String callbackUrl) { this.callbackUrl = callbackUrl; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public Instant getLastTriggeredAt() { return lastTriggeredAt; }
    public void setLastTriggeredAt(Instant lastTriggeredAt) { this.lastTriggeredAt = lastTriggeredAt; }
    public Long getTriggerCount() { return triggerCount; }
    public void setTriggerCount(Long triggerCount) { this.triggerCount = triggerCount; }
    public Instant getCreatedAt() { return createdAt; }
}
