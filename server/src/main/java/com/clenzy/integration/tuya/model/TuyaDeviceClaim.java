package com.clenzy.integration.tuya.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Reclamation d'un device Tuya par une organisation. Unicite GLOBALE sur {@code tuya_device_id}
 * (cross-org) : un meme device ne peut appartenir qu'a une seule org -> segmente les appareils
 * par tenant meme sur un compte Tuya PARTAGE (compte par defaut Baitly/Clenzy).
 *
 * <p>Volontairement <b>NON org-filtree</b> (@Filter absent) : c'est un registre cross-org dont
 * la requete {@code findByTuyaDeviceId} doit voir toutes les orgs pour faire respecter l'unicite.
 */
@Entity
@Table(name = "tuya_device_claim", indexes = {
    @Index(name = "uq_tuya_claim_device_id", columnList = "tuya_device_id", unique = true),
    @Index(name = "idx_tuya_claim_org_id", columnList = "organization_id")
})
public class TuyaDeviceClaim {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tuya_device_id", nullable = false, length = 64)
    private String tuyaDeviceId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "device_type", nullable = false, length = 20)
    private String deviceType;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) this.createdAt = LocalDateTime.now();
    }

    public TuyaDeviceClaim() {
    }

    public TuyaDeviceClaim(String tuyaDeviceId, Long organizationId, String deviceType) {
        this.tuyaDeviceId = tuyaDeviceId;
        this.organizationId = organizationId;
        this.deviceType = deviceType;
    }

    public Long getId() { return id; }
    public String getTuyaDeviceId() { return tuyaDeviceId; }
    public Long getOrganizationId() { return organizationId; }
    public String getDeviceType() { return deviceType; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
