package com.clenzy.integration.netatmo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Configuration plateforme de l'app Netatmo (credentials OAuth), editable depuis l'UI et stockee
 * en base. Singleton (une seule ligne) : ce sont les credentials PLATEFORME (une app Netatmo pour
 * tout Clenzy ; les utilisateurs connectent leur propre compte via cette app), donc volontairement
 * <b>NON org-scopee</b>. Le client_secret est chiffre (TokenEncryptionService). Meme pattern que
 * {@code TuyaPlatformConfig}.
 */
@Entity
@Table(name = "netatmo_platform_config")
public class NetatmoPlatformConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_id")
    private String clientId;

    @Column(name = "client_secret_encrypted", columnDefinition = "TEXT")
    private String clientSecretEncrypted;

    @Column(name = "redirect_uri", length = 500)
    private String redirectUri;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private String updatedBy;

    @PrePersist
    @PreUpdate
    public void touch() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientSecretEncrypted() { return clientSecretEncrypted; }
    public void setClientSecretEncrypted(String clientSecretEncrypted) { this.clientSecretEncrypted = clientSecretEncrypted; }

    public String getRedirectUri() { return redirectUri; }
    public void setRedirectUri(String redirectUri) { this.redirectUri = redirectUri; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
