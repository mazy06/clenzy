package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Configuration de l'automatisation de la messagerie pour une organisation.
 * Unique par organisation. Controle l'envoi automatique des instructions
 * check-in/check-out et le push automatique des prix.
 */
@Entity
@Table(name = "messaging_automation_config")
public class MessagingAutomationConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false, unique = true)
    private Long organizationId;

    @Column(name = "auto_send_check_in", nullable = false)
    private boolean autoSendCheckIn = false;

    @Column(name = "auto_send_check_out", nullable = false)
    private boolean autoSendCheckOut = false;

    @Column(name = "hours_before_check_in", nullable = false)
    private int hoursBeforeCheckIn = 24;

    @Column(name = "hours_before_check_out", nullable = false)
    private int hoursBeforeCheckOut = 12;

    @Column(name = "check_in_template_id")
    private Long checkInTemplateId;

    @Column(name = "check_out_template_id")
    private Long checkOutTemplateId;

    @Column(name = "auto_push_pricing_enabled", nullable = false)
    private boolean autoPushPricingEnabled = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Constructeurs

    public MessagingAutomationConfig() {}

    public MessagingAutomationConfig(Long organizationId) {
        this.organizationId = organizationId;
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public boolean isAutoSendCheckIn() { return autoSendCheckIn; }
    public void setAutoSendCheckIn(boolean autoSendCheckIn) { this.autoSendCheckIn = autoSendCheckIn; }

    public boolean isAutoSendCheckOut() { return autoSendCheckOut; }
    public void setAutoSendCheckOut(boolean autoSendCheckOut) { this.autoSendCheckOut = autoSendCheckOut; }

    public int getHoursBeforeCheckIn() { return hoursBeforeCheckIn; }
    public void setHoursBeforeCheckIn(int hoursBeforeCheckIn) { this.hoursBeforeCheckIn = hoursBeforeCheckIn; }

    public int getHoursBeforeCheckOut() { return hoursBeforeCheckOut; }
    public void setHoursBeforeCheckOut(int hoursBeforeCheckOut) { this.hoursBeforeCheckOut = hoursBeforeCheckOut; }

    public Long getCheckInTemplateId() { return checkInTemplateId; }
    public void setCheckInTemplateId(Long checkInTemplateId) { this.checkInTemplateId = checkInTemplateId; }

    public Long getCheckOutTemplateId() { return checkOutTemplateId; }
    public void setCheckOutTemplateId(Long checkOutTemplateId) { this.checkOutTemplateId = checkOutTemplateId; }

    public boolean isAutoPushPricingEnabled() { return autoPushPricingEnabled; }
    public void setAutoPushPricingEnabled(boolean autoPushPricingEnabled) { this.autoPushPricingEnabled = autoPushPricingEnabled; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
