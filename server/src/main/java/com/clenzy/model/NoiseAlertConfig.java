package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "noise_alert_configs",
       uniqueConstraints = @UniqueConstraint(columnNames = {"organization_id", "property_id"}))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class NoiseAlertConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "notify_in_app", nullable = false)
    private boolean notifyInApp = true;

    @Column(name = "notify_email", nullable = false)
    private boolean notifyEmail = true;

    @Column(name = "notify_guest_message", nullable = false)
    private boolean notifyGuestMessage = false;

    @Column(name = "notify_whatsapp", nullable = false)
    private boolean notifyWhatsapp = false;

    @Column(name = "notify_sms", nullable = false)
    private boolean notifySms = false;

    @Column(name = "cooldown_minutes", nullable = false)
    private int cooldownMinutes = 30;

    @Column(name = "email_recipients", length = 1000)
    private String emailRecipients;

    @OneToMany(mappedBy = "config", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<NoiseAlertTimeWindow> timeWindows = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", insertable = false, updatable = false)
    private Property property;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // ── Getters / Setters ────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public boolean isNotifyInApp() { return notifyInApp; }
    public void setNotifyInApp(boolean notifyInApp) { this.notifyInApp = notifyInApp; }

    public boolean isNotifyEmail() { return notifyEmail; }
    public void setNotifyEmail(boolean notifyEmail) { this.notifyEmail = notifyEmail; }

    public boolean isNotifyGuestMessage() { return notifyGuestMessage; }
    public void setNotifyGuestMessage(boolean notifyGuestMessage) { this.notifyGuestMessage = notifyGuestMessage; }

    public boolean isNotifyWhatsapp() { return notifyWhatsapp; }
    public void setNotifyWhatsapp(boolean notifyWhatsapp) { this.notifyWhatsapp = notifyWhatsapp; }

    public boolean isNotifySms() { return notifySms; }
    public void setNotifySms(boolean notifySms) { this.notifySms = notifySms; }

    public int getCooldownMinutes() { return cooldownMinutes; }
    public void setCooldownMinutes(int cooldownMinutes) { this.cooldownMinutes = cooldownMinutes; }

    public String getEmailRecipients() { return emailRecipients; }
    public void setEmailRecipients(String emailRecipients) { this.emailRecipients = emailRecipients; }

    public List<NoiseAlertTimeWindow> getTimeWindows() { return timeWindows; }
    public void setTimeWindows(List<NoiseAlertTimeWindow> timeWindows) { this.timeWindows = timeWindows; }

    public Property getProperty() { return property; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
