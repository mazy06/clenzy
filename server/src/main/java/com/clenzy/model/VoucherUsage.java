package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Audit row : trace chaque application d'un {@link BookingVoucher} sur une
 * {@link Reservation}.
 *
 * <p>Insere par {@code BookingVoucherService.recordUsage} au moment de la
 * confirmation du booking (apres validation de l'eligibilite et incrementation
 * atomique du compteur {@code usageCount} sur le voucher).</p>
 *
 * <h3>Usage</h3>
 * <ul>
 *   <li>Analytics : CA brut/net, ROI par campagne, distribution par canal</li>
 *   <li>Detection d'abus : meme {@code guest_email} > N usages d'un voucher</li>
 *   <li>Reconciliation comptable : montants au moment de l'application</li>
 * </ul>
 *
 * <p><b>Lifecycle :</b> {@code voucher_id} en RESTRICT (preservation de
 * l'historique meme si le voucher est supprime), {@code reservation_id} en
 * CASCADE (l'audit n'a plus de sens si la reservation disparait).</p>
 */
@Entity
@Table(name = "voucher_usage")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class VoucherUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "voucher_id", nullable = false)
    private Long voucherId;

    @Column(name = "reservation_id", nullable = false)
    private Long reservationId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    /**
     * Email guest denormalise pour la detection d'abus sans depender du
     * {@code guest_id} qui peut etre NULL pour les bookings externes.
     */
    @Column(name = "guest_email", length = 255)
    private String guestEmail;

    @Column(name = "applied_at", nullable = false)
    private Instant appliedAt = Instant.now();

    @Column(name = "original_total", nullable = false, precision = 10, scale = 2)
    private BigDecimal originalTotal;

    @Column(name = "discount_applied", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountApplied;

    @Column(name = "final_total", nullable = false, precision = 10, scale = 2)
    private BigDecimal finalTotal;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "EUR";

    /**
     * Canal d'origine de l'application reelle (peut etre plus precis que
     * le {@code channel_scope} du voucher qui est juste une restriction).
     */
    @Column(name = "applied_via", nullable = false, length = 20)
    private String appliedVia = "BOOKING_ENGINE";

    public VoucherUsage() {}

    @PrePersist
    void onCreate() {
        if (this.appliedAt == null) this.appliedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getVoucherId() { return voucherId; }
    public void setVoucherId(Long voucherId) { this.voucherId = voucherId; }
    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public String getGuestEmail() { return guestEmail; }
    public void setGuestEmail(String guestEmail) { this.guestEmail = guestEmail; }
    public Instant getAppliedAt() { return appliedAt; }
    public void setAppliedAt(Instant appliedAt) { this.appliedAt = appliedAt; }
    public BigDecimal getOriginalTotal() { return originalTotal; }
    public void setOriginalTotal(BigDecimal originalTotal) { this.originalTotal = originalTotal; }
    public BigDecimal getDiscountApplied() { return discountApplied; }
    public void setDiscountApplied(BigDecimal discountApplied) { this.discountApplied = discountApplied; }
    public BigDecimal getFinalTotal() { return finalTotal; }
    public void setFinalTotal(BigDecimal finalTotal) { this.finalTotal = finalTotal; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getAppliedVia() { return appliedVia; }
    public void setAppliedVia(String appliedVia) { this.appliedVia = appliedVia; }
}
