package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "whatsapp_configs")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class WhatsAppConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false, unique = true)
    private Long organizationId;

    /**
     * Provider WhatsApp actif pour cette org. Default META pour back-compat
     * avec les orgs existantes au moment du deploy de la migration 0153.
     * Le {@code WhatsAppProviderResolver} route les envois vers la bonne
     * implementation (MetaWhatsAppProvider / OpenWaWhatsAppProvider) selon
     * cette valeur.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 16)
    private WhatsAppProviderType provider = WhatsAppProviderType.META;

    // ─── Champs META Cloud API (NULL si provider=OPENWA) ────────────────

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "api_token", length = 1000)
    private String apiToken;

    @Column(name = "phone_number_id", length = 100)
    private String phoneNumberId;

    @Column(name = "business_account_id", length = 100)
    private String businessAccountId;

    @Column(name = "webhook_verify_token")
    private String webhookVerifyToken;

    // ─── Champs OpenWA self-hosted (NULL si provider=META) ──────────────

    /**
     * Identifiant de session sur l'instance OpenWA partagee. Genere par
     * OpenWA au scan du QR code. Format owa-{uuid}. Stocke en clair (n'est
     * pas un secret, ne permet pas d'envoyer sans openwa_api_key).
     */
    @Column(name = "openwa_session_id", length = 128)
    private String openwaSessionId;

    /**
     * Cle API per-session OpenWA (chiffree Jasypt, comme apiToken Meta).
     * Format owa_{32chars}. Sans elle, impossible d'appeler l'instance OpenWA
     * meme avec la session valide.
     */
    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "openwa_api_key", length = 1000)
    private String openwaApiKey;

    @Column(nullable = false)
    private boolean enabled = false;

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

    public WhatsAppProviderType getProvider() { return provider; }
    public void setProvider(WhatsAppProviderType provider) {
        // Null-safe : on retombe sur META (default historique) plutot que NPE
        this.provider = (provider != null) ? provider : WhatsAppProviderType.META;
    }

    public String getApiToken() { return apiToken; }
    public void setApiToken(String apiToken) { this.apiToken = apiToken; }
    public String getPhoneNumberId() { return phoneNumberId; }
    public void setPhoneNumberId(String phoneNumberId) { this.phoneNumberId = phoneNumberId; }
    public String getBusinessAccountId() { return businessAccountId; }
    public void setBusinessAccountId(String businessAccountId) { this.businessAccountId = businessAccountId; }
    public String getWebhookVerifyToken() { return webhookVerifyToken; }
    public void setWebhookVerifyToken(String webhookVerifyToken) { this.webhookVerifyToken = webhookVerifyToken; }

    public String getOpenwaSessionId() { return openwaSessionId; }
    public void setOpenwaSessionId(String openwaSessionId) { this.openwaSessionId = openwaSessionId; }
    public String getOpenwaApiKey() { return openwaApiKey; }
    public void setOpenwaApiKey(String openwaApiKey) { this.openwaApiKey = openwaApiKey; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
