package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Connexion à un fournisseur de données de marché (Airbtics, AirROI) — clé API
 * saisie dans Réglages → Intégrations → Intelligence de marché, chiffrée au repos
 * (Jasypt AES-256, comme les autres connexions {@code integration/}).
 *
 * <p><b>Portée PLATEFORME</b> (pas d'organization_id) : l'abonnement data est
 * celui de Baitly, l'ingestion est globale et les benchmarks servent tous les
 * tenants. Gérée par le staff plateforme uniquement.</p>
 */
@Entity
@Table(name = "market_data_connections",
        uniqueConstraints = @UniqueConstraint(name = "uq_market_data_connections_provider",
                columnNames = "provider"))
public class MarketDataConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "provider", nullable = false, length = 24)
    private String provider;

    @Column(name = "api_key_encrypted", nullable = false, columnDefinition = "TEXT")
    private String apiKeyEncrypted;

    /** Base URL de l'API — null = défaut du provider. */
    @Column(name = "base_url", length = 500)
    private String baseUrl;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public MarketDataConnection() {
    }

    public MarketDataConnection(String provider, String apiKeyEncrypted, String baseUrl) {
        this.provider = provider;
        this.apiKeyEncrypted = apiKeyEncrypted;
        this.baseUrl = baseUrl;
    }

    public Long getId() { return id; }
    public String getProvider() { return provider; }
    public String getApiKeyEncrypted() { return apiKeyEncrypted; }
    public void setApiKeyEncrypted(String apiKeyEncrypted) { this.apiKeyEncrypted = apiKeyEncrypted; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
