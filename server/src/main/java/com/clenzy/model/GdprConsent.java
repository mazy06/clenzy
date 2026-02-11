package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Entite JPA stockant les consentements RGPD des utilisateurs.
 * Chaque consentement est versionne et horodate.
 */
@Entity
@Table(name = "gdpr_consents", indexes = {
    @Index(name = "idx_gdpr_consent_user_id", columnList = "user_id"),
    @Index(name = "idx_gdpr_consent_type", columnList = "consent_type")
})
public class GdprConsent {

    public enum ConsentType {
        DATA_PROCESSING,        // Traitement des donnees personnelles
        MARKETING,              // Communications marketing
        ANALYTICS,              // Collecte de donnees d'usage
        THIRD_PARTY_SHARING,    // Partage avec tiers (Airbnb, Stripe)
        COOKIES                 // Cookies non essentiels
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "consent_type", nullable = false, length = 50)
    private ConsentType consentType;

    @Column(name = "granted", nullable = false)
    private boolean granted;

    @Column(name = "version", nullable = false)
    private int version = 1;

    @Column(name = "ip_address", length = 500)
    @Convert(converter = EncryptedFieldConverter.class)
    private String ipAddress;

    @Column(name = "granted_at", nullable = false)
    private LocalDateTime grantedAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // --- Constructors ---
    public GdprConsent() {}

    public GdprConsent(User user, ConsentType consentType, boolean granted, String ipAddress) {
        this.user = user;
        this.consentType = consentType;
        this.granted = granted;
        this.ipAddress = ipAddress;
        this.grantedAt = LocalDateTime.now();
    }

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.grantedAt == null) {
            this.grantedAt = LocalDateTime.now();
        }
    }

    // --- Getters and Setters ---

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public ConsentType getConsentType() {
        return consentType;
    }

    public void setConsentType(ConsentType consentType) {
        this.consentType = consentType;
    }

    public boolean isGranted() {
        return granted;
    }

    public void setGranted(boolean granted) {
        this.granted = granted;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public LocalDateTime getGrantedAt() {
        return grantedAt;
    }

    public void setGrantedAt(LocalDateTime grantedAt) {
        this.grantedAt = grantedAt;
    }

    public LocalDateTime getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(LocalDateTime revokedAt) {
        this.revokedAt = revokedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public String toString() {
        return "GdprConsent{" +
                "id=" + id +
                ", userId=" + userId +
                ", consentType=" + consentType +
                ", granted=" + granted +
                ", version=" + version +
                ", grantedAt=" + grantedAt +
                '}';
    }
}
