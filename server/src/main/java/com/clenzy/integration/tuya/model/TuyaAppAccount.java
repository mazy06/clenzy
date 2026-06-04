package com.clenzy.integration.tuya.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Compte app Tuya provisionne pour un hote (modele C). L'hote se connecte avec ce compte dans
 * l'app mobile de marque ; les appareils qu'il y appaire atterrissent sur le projet plateforme
 * (le compte est cree sous le schema du projet), donc decouvrables par le PMS.
 *
 * <p>Un compte par hote (UNIQUE {@code user_id} = keycloak subject). Le secret (mot de passe du
 * compte app) est chiffre via {@code TokenEncryptionService}.
 */
@Entity
@Table(name = "tuya_app_account")
public class TuyaAppAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Organisation de l'hote (contexte ; la segmentation reelle passe par le claim registry). */
    @Column(name = "organization_id")
    private Long organizationId;

    /** Keycloak subject de l'hote. */
    @Column(name = "user_id", nullable = false)
    private String userId;

    /** UID du compte app Tuya (renseigne apres provisioning). */
    @Column(name = "tuya_uid")
    private String tuyaUid;

    /** Nom d'utilisateur deterministe du compte app Tuya. */
    @Column(name = "tuya_username")
    private String tuyaUsername;

    /** Mot de passe du compte app, chiffre (le mobile s'y connecte via le SDK). */
    @Column(name = "tuya_secret_encrypted", columnDefinition = "TEXT")
    private String tuyaSecretEncrypted;

    @Column(name = "country_code", length = 8)
    private String countryCode;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getTuyaUid() { return tuyaUid; }
    public void setTuyaUid(String tuyaUid) { this.tuyaUid = tuyaUid; }

    public String getTuyaUsername() { return tuyaUsername; }
    public void setTuyaUsername(String tuyaUsername) { this.tuyaUsername = tuyaUsername; }

    public String getTuyaSecretEncrypted() { return tuyaSecretEncrypted; }
    public void setTuyaSecretEncrypted(String tuyaSecretEncrypted) { this.tuyaSecretEncrypted = tuyaSecretEncrypted; }

    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
