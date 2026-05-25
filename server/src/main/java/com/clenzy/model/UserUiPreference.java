package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Preference UI generique d'un utilisateur (key-value JSONB).
 *
 * <p>Remplace les usages de localStorage pour les hooks frontend
 * (filtres planning, zoom, density, largeur de colonnes, etc.) afin que
 * les preferences traversent les devices et les navigateurs.</p>
 *
 * <p>Scope = {@code keycloak_id} (et non {@code users.id}) pour decoupler
 * la persistance des preferences UI des entites users metier — un utilisateur
 * peut avoir des prefs UI avant d'avoir une entite users.id (ex: SSO first
 * login). Le couple (keycloak_id, pref_key) est UNIQUE.</p>
 *
 * <p>La valeur est stockee en JSONB Postgres ; le frontend valide / shape
 * via TypeScript.</p>
 *
 * @see com.clenzy.controller.UserUiPreferencesController
 */
@Entity
@Table(name = "user_ui_preferences", uniqueConstraints = @UniqueConstraint(
        name = "user_ui_pref_keycloak_key_unique",
        columnNames = {"keycloak_id", "pref_key"}))
public class UserUiPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "keycloak_id", nullable = false)
    private String keycloakId;

    @Column(name = "pref_key", nullable = false, length = 120)
    private String prefKey;

    /**
     * Valeur JSON serializee (objet, tableau, primitive, null).
     * Le frontend desserialize via {@code JSON.parse} cote client.
     */
    @Column(name = "pref_value", nullable = false, columnDefinition = "jsonb")
    private String prefValue;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public UserUiPreference() {}

    public UserUiPreference(String keycloakId, String prefKey, String prefValue) {
        this.keycloakId = keycloakId;
        this.prefKey = prefKey;
        this.prefValue = prefValue;
    }

    public Long getId() { return id; }

    public String getKeycloakId() { return keycloakId; }
    public void setKeycloakId(String keycloakId) { this.keycloakId = keycloakId; }

    public String getPrefKey() { return prefKey; }
    public void setPrefKey(String prefKey) { this.prefKey = prefKey; }

    public String getPrefValue() { return prefValue; }
    public void setPrefValue(String prefValue) { this.prefValue = prefValue; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
