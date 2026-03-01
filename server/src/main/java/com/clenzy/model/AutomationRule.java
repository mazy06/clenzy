package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "automation_rules")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class AutomationRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_type", nullable = false, length = 40)
    private AutomationTrigger triggerType;

    @Column(name = "trigger_offset_days", nullable = false)
    private int triggerOffsetDays = 0;

    @Column(name = "trigger_time", length = 5)
    private String triggerTime = "09:00";

    @Column(columnDefinition = "JSONB")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private String conditions;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 30)
    private AutomationAction actionType = AutomationAction.SEND_MESSAGE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id")
    private MessageTemplate template;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_channel", length = 20)
    private MessageChannelType deliveryChannel = MessageChannelType.EMAIL;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public AutomationTrigger getTriggerType() { return triggerType; }
    public void setTriggerType(AutomationTrigger triggerType) { this.triggerType = triggerType; }
    public int getTriggerOffsetDays() { return triggerOffsetDays; }
    public void setTriggerOffsetDays(int triggerOffsetDays) { this.triggerOffsetDays = triggerOffsetDays; }
    public String getTriggerTime() { return triggerTime; }
    public void setTriggerTime(String triggerTime) { this.triggerTime = triggerTime; }
    public String getConditions() { return conditions; }
    public void setConditions(String conditions) { this.conditions = conditions; }
    public AutomationAction getActionType() { return actionType; }
    public void setActionType(AutomationAction actionType) { this.actionType = actionType; }
    public MessageTemplate getTemplate() { return template; }
    public void setTemplate(MessageTemplate template) { this.template = template; }
    public MessageChannelType getDeliveryChannel() { return deliveryChannel; }
    public void setDeliveryChannel(MessageChannelType deliveryChannel) { this.deliveryChannel = deliveryChannel; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
