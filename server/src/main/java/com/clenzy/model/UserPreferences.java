package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Preferences utilisateur persistees en BDD.
 * Remplace les settings localStorage (timezone, devise, langue, notifications).
 * Une seule ligne par keycloakId (UNIQUE constraint).
 */
@Entity
@Table(name = "user_preferences")
public class UserPreferences {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "keycloak_id", nullable = false, unique = true)
    private String keycloakId;

    @Column(name = "organization_id")
    private Long organizationId;

    // ── Business preferences ─────────────────────────────────────────────

    @Column(nullable = false, length = 50)
    private String timezone = "Europe/Paris";

    @Column(nullable = false, length = 3)
    private String currency = "EUR";

    @Column(nullable = false, length = 5)
    private String language = "fr";

    // ── Notification global toggles ──────────────────────────────────────

    @Column(name = "notify_email", nullable = false)
    private boolean notifyEmail = true;

    @Column(name = "notify_push", nullable = false)
    private boolean notifyPush = false;

    @Column(name = "notify_sms", nullable = false)
    private boolean notifySms = false;

    // ── Audit ────────────────────────────────────────────────────────────

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public UserPreferences() {}

    public UserPreferences(String keycloakId, Long organizationId) {
        this.keycloakId = keycloakId;
        this.organizationId = organizationId;
    }

    // ── Getters / Setters ────────────────────────────────────────────────

    public Long getId() { return id; }

    public String getKeycloakId() { return keycloakId; }
    public void setKeycloakId(String keycloakId) { this.keycloakId = keycloakId; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public boolean isNotifyEmail() { return notifyEmail; }
    public void setNotifyEmail(boolean notifyEmail) { this.notifyEmail = notifyEmail; }

    public boolean isNotifyPush() { return notifyPush; }
    public void setNotifyPush(boolean notifyPush) { this.notifyPush = notifyPush; }

    public boolean isNotifySms() { return notifySms; }
    public void setNotifySms(boolean notifySms) { this.notifySms = notifySms; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
