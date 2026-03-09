package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.Filter;

import java.time.LocalDateTime;

@Entity
@Table(name = "wallets", indexes = {
    @Index(name = "idx_wallet_org", columnList = "organization_id"),
    @Index(name = "idx_wallet_owner", columnList = "owner_id")
})
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "wallet_type", nullable = false, length = 30)
    private WalletType walletType;

    @Column(name = "owner_id")
    private Long ownerId;

    @Column(length = 3, nullable = false)
    private String currency = "EUR";

    @Column(length = 20, nullable = false)
    private String status = "ACTIVE";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public WalletType getWalletType() { return walletType; }
    public void setWalletType(WalletType walletType) { this.walletType = walletType; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
