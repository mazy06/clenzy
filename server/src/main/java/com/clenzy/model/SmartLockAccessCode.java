package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Code d'acces (mot de passe temporaire Tuya) d'une serrure connectee.
 *
 * Genere automatiquement a chaque reservation (fenetre check-in -> check-out)
 * ou manuellement depuis le hub. Le {@code code} (PIN 6 chiffres) est CHIFFRE au
 * repos (comme la PII Guest) : c'est un secret d'acces physique. Aucune recherche
 * par valeur n'est faite (lookup par device / reservation / status), donc le
 * chiffrement n'a aucun cout fonctionnel.
 *
 * <p>{@code tuyaPasswordId} = identifiant du mot de passe cote Tuya, requis pour
 * la revocation ({@code DELETE .../door-lock/temp-passwords/{id}}).
 */
@Entity
@Table(name = "smart_lock_access_code", indexes = {
    @Index(name = "idx_slac_org", columnList = "organization_id"),
    @Index(name = "idx_slac_device", columnList = "device_id"),
    @Index(name = "idx_slac_reservation", columnList = "reservation_id"),
    @Index(name = "idx_slac_property", columnList = "property_id"),
    @Index(name = "idx_slac_status", columnList = "status"),
    @Index(name = "idx_slac_created", columnList = "created_at DESC")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class SmartLockAccessCode {

    public enum CodeStatus {
        ACTIVE, REVOKED, EXPIRED, FAILED
    }

    public enum CodeSource {
        AUTO_RESERVATION, MANUAL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "device_id", nullable = false)
    private Long deviceId;

    @Column(name = "reservation_id")
    private Long reservationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    /** PIN 6 chiffres — chiffre au repos (secret d'acces physique). Null si echec. */
    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "code", columnDefinition = "TEXT")
    private String code;

    /** Identifiant du mot de passe cote Tuya (pour revocation). */
    @Column(name = "tuya_password_id", length = 64)
    private String tuyaPasswordId;

    @Column(name = "name")
    private String name;

    @Column(name = "valid_from")
    private LocalDateTime validFrom;

    @Column(name = "valid_until")
    private LocalDateTime validUntil;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CodeStatus status = CodeStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20)
    private CodeSource source = CodeSource.AUTO_RESERVATION;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // ─── Getters / Setters ──────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }

    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getTuyaPasswordId() { return tuyaPasswordId; }
    public void setTuyaPasswordId(String tuyaPasswordId) { this.tuyaPasswordId = tuyaPasswordId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public LocalDateTime getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDateTime validFrom) { this.validFrom = validFrom; }

    public LocalDateTime getValidUntil() { return validUntil; }
    public void setValidUntil(LocalDateTime validUntil) { this.validUntil = validUntil; }

    public CodeStatus getStatus() { return status; }
    public void setStatus(CodeStatus status) { this.status = status; }

    public CodeSource getSource() { return source; }
    public void setSource(CodeSource source) { this.source = source; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public LocalDateTime getRevokedAt() { return revokedAt; }
    public void setRevokedAt(LocalDateTime revokedAt) { this.revokedAt = revokedAt; }
}
