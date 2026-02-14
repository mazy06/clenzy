package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Preference utilisateur pour activer/desactiver une notification specifique.
 * Si aucune row n'existe pour un couple (userId, notificationKey),
 * la valeur par defaut vient de NotificationKey.isEnabledByDefault().
 */
@Entity
@Table(name = "notification_preferences",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_notif_pref_user_key",
        columnNames = {"user_id", "notification_key"}
    ),
    indexes = {
        @Index(name = "idx_notif_pref_user_id", columnList = "user_id")
    }
)
public class NotificationPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Keycloak ID de l'utilisateur */
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_key", nullable = false, length = 60)
    private NotificationKey notificationKey;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // ─── Constructeurs ──────────────────────────────────────────────────────────

    public NotificationPreference() {}

    public NotificationPreference(String userId, NotificationKey notificationKey, boolean enabled) {
        this.userId = userId;
        this.notificationKey = notificationKey;
        this.enabled = enabled;
    }

    // ─── Getters & Setters ──────────────────────────────────────────────────────

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public NotificationKey getNotificationKey() {
        return notificationKey;
    }

    public void setNotificationKey(NotificationKey notificationKey) {
        this.notificationKey = notificationKey;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Override
    public String toString() {
        return "NotificationPreference{" +
                "id=" + id +
                ", userId='" + userId + '\'' +
                ", notificationKey=" + notificationKey +
                ", enabled=" + enabled +
                '}';
    }
}
