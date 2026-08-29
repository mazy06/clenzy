package com.clenzy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Tarif CONVENU entre un intervenant et l'organisation pour un logement.
 *
 * <p>A distinguer du tarif DECLARE — forfait ménage ou prestation travaux —,
 * qui n'engage que l'intervenant. Celui-ci est le prix qu'un gestionnaire a
 * approuvé via un devis : il fait accord.</p>
 *
 * <p>C'est ce qui evite de redemander un devis a chaque mission. Tant que
 * l'intervenant garde le meme tarif sur ce logement, l'accord tient ; s'il le
 * change, l'ecart reapparait et une nouvelle proposition s'impose.</p>
 */
@Entity
@Table(name = "provider_agreed_rates")
public class ProviderAgreedRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "provider_user_id", nullable = false)
    private Long providerUserId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 8)
    private String currency = "EUR";

    /** Devis qui a scelle l'accord — la trace de qui a approuve quoi. */
    @Column(name = "quote_id")
    private Long quoteId;

    @Column(name = "agreed_at", nullable = false)
    private LocalDateTime agreedAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getProviderUserId() { return providerUserId; }
    public void setProviderUserId(Long providerUserId) { this.providerUserId = providerUserId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public Long getQuoteId() { return quoteId; }
    public void setQuoteId(Long quoteId) { this.quoteId = quoteId; }

    public LocalDateTime getAgreedAt() { return agreedAt; }
    public void setAgreedAt(LocalDateTime agreedAt) { this.agreedAt = agreedAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
