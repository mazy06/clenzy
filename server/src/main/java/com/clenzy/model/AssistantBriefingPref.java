package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Preferences de briefing proactif pour un utilisateur.
 *
 * <p>Une ligne par user (contrainte unique {@code keycloak_id}). Le scheduler
 * horaire matche les pref dont {@link #timeLocal} correspond a l'heure courante
 * dans la {@link #timezone} de l'user.</p>
 *
 * <p>Multi-tenant via filtre Hibernate {@code organizationFilter}.</p>
 */
@Entity
@Table(name = "assistant_briefing_pref")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class AssistantBriefingPref {

    public enum Frequency {
        DAILY_MORNING,
        WEEKLY_SUNDAY,
        ONLY_ALERTS;

        public static Frequency fromString(String raw) {
            if (raw == null || raw.isBlank()) return DAILY_MORNING;
            try { return Frequency.valueOf(raw.trim().toUpperCase()); }
            catch (IllegalArgumentException e) { return DAILY_MORNING; }
        }

        /** Valeur stockee en BDD (lower_case_with_underscores). */
        public String dbValue() {
            return name().toLowerCase();
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "keycloak_id", nullable = false, length = 255)
    private String keycloakId;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(nullable = false, length = 30)
    private String frequency = Frequency.DAILY_MORNING.dbValue();

    /**
     * Array JSON des canaux : {@code ["in_app"]}, {@code ["email"]},
     * {@code ["whatsapp"]} ou combinaisons. Stocke en JSONB Postgres.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "channels", nullable = false, columnDefinition = "jsonb")
    private String channels = "[\"in_app\"]";

    @Column(name = "time_local", nullable = false)
    private LocalTime timeLocal = LocalTime.of(8, 0);

    @Column(nullable = false, length = 50)
    private String timezone = "Europe/Paris";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public AssistantBriefingPref() {}

    public AssistantBriefingPref(Long organizationId, String keycloakId) {
        this.organizationId = organizationId;
        this.keycloakId = keycloakId;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Frequency getFrequencyEnum() {
        return Frequency.fromString(frequency);
    }

    public void setFrequencyEnum(Frequency f) {
        this.frequency = f.dbValue();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getKeycloakId() { return keycloakId; }
    public void setKeycloakId(String keycloakId) { this.keycloakId = keycloakId; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getFrequency() { return frequency; }
    public void setFrequency(String frequency) { this.frequency = frequency; }
    public String getChannels() { return channels; }
    public void setChannels(String channels) { this.channels = channels; }
    public LocalTime getTimeLocal() { return timeLocal; }
    public void setTimeLocal(LocalTime timeLocal) { this.timeLocal = timeLocal; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
