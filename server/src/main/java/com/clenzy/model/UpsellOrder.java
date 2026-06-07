package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Commande d'un upsell par un guest (liée à une réservation). Snapshot du titre/montant
 * au moment de l'achat. La répartition (part plateforme / part hôte) est calculée à la
 * confirmation du paiement et créditée via le ledger interne (cf. {@code UpsellService}).
 */
@Entity
@Table(name = "upsell_orders", indexes = {
        @Index(name = "idx_upsell_orders_org", columnList = "organization_id"),
        @Index(name = "idx_upsell_orders_reservation", columnList = "reservation_id"),
        @Index(name = "idx_upsell_orders_session", columnList = "stripe_session_id"),
        @Index(name = "idx_upsell_orders_status", columnList = "status")
})
public class UpsellOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "reservation_id", nullable = false)
    private Long reservationId;

    @Column(name = "guide_id")
    private Long guideId;

    /** Offre source (peut devenir null si l'offre est supprimée — le snapshot reste). */
    @Column(name = "offer_id")
    private Long offerId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(name = "platform_fee_amount", precision = 12, scale = 2)
    private BigDecimal platformFeeAmount;

    @Column(name = "host_amount", precision = 12, scale = 2)
    private BigDecimal hostAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UpsellOrderStatus status = UpsellOrderStatus.PENDING;

    @Column(name = "stripe_session_id", length = 255)
    private String stripeSessionId;

    @Column(name = "guest_email", length = 255)
    private String guestEmail;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }
    public Long getGuideId() { return guideId; }
    public void setGuideId(Long guideId) { this.guideId = guideId; }
    public Long getOfferId() { return offerId; }
    public void setOfferId(Long offerId) { this.offerId = offerId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public BigDecimal getPlatformFeeAmount() { return platformFeeAmount; }
    public void setPlatformFeeAmount(BigDecimal platformFeeAmount) { this.platformFeeAmount = platformFeeAmount; }
    public BigDecimal getHostAmount() { return hostAmount; }
    public void setHostAmount(BigDecimal hostAmount) { this.hostAmount = hostAmount; }
    public UpsellOrderStatus getStatus() { return status; }
    public void setStatus(UpsellOrderStatus status) { this.status = status; }
    public String getStripeSessionId() { return stripeSessionId; }
    public void setStripeSessionId(String stripeSessionId) { this.stripeSessionId = stripeSessionId; }
    public String getGuestEmail() { return guestEmail; }
    public void setGuestEmail(String guestEmail) { this.guestEmail = guestEmail; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getPaidAt() { return paidAt; }
    public void setPaidAt(LocalDateTime paidAt) { this.paidAt = paidAt; }
}
