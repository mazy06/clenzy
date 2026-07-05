package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entite representant une reservation (sejour d'un voyageur).
 * Creee lors de l'import iCal, Airbnb, Booking, ou manuellement.
 */
@Entity
@Table(name = "reservations")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Column(name = "guest_name", length = 200)
    private String guestName;

    @Column(name = "guest_count")
    private Integer guestCount = 1;

    // Ventilation adultes/enfants (0314). NULL = ventilation inconnue → le calcul
    // de taxe de sejour retombe sur guestCount. guestCount reste le total autoritaire.
    @Column(name = "adults_count")
    private Integer adultsCount;

    @Column(name = "children_count")
    private Integer childrenCount;

    @Column(name = "check_in", nullable = false)
    private LocalDate checkIn;

    @Column(name = "check_out", nullable = false)
    private LocalDate checkOut;

    @Column(name = "check_in_time", length = 5)
    private String checkInTime;

    @Column(name = "check_out_time", length = 5)
    private String checkOutTime;

    @Column(nullable = false, length = 30)
    private String status = "confirmed";

    @Column(nullable = false, length = 30)
    private String source = "other";

    @Column(name = "source_name", length = 100)
    private String sourceName;

    @Column(name = "total_price", precision = 10, scale = 2)
    private BigDecimal totalPrice = BigDecimal.ZERO;

    // --- Multi-currency & fiscal breakdown (V84) ---
    @Column(name = "currency", nullable = false, length = 3, columnDefinition = "varchar(3) default 'EUR'")
    private String currency = "EUR";

    @Column(name = "room_revenue", precision = 10, scale = 2)
    private BigDecimal roomRevenue;

    @Column(name = "cleaning_fee", precision = 10, scale = 2)
    private BigDecimal cleaningFee;

    @Column(name = "tax_amount", precision = 10, scale = 2)
    private BigDecimal taxAmount;

    @Column(name = "tourist_tax_amount", precision = 10, scale = 2)
    private BigDecimal touristTaxAmount;

    /**
     * Frais perçus par l'OTA sur cette réservation (ex. host fee Airbnb).
     * Renseigné si connu (saisie ou futur webhook API canal) ; sinon null.
     * Sert de base au calcul de commission NET_OF_OTA_FEE ; à null on retombe sur le brut.
     */
    @Column(name = "ota_fee_amount", precision = 10, scale = 2)
    private BigDecimal otaFeeAmount;

    /** Crédit fidélité (2.8) appliqué à cette réservation au checkout (réduit le montant Stripe). NULL = aucun. */
    @Column(name = "credit_applied", precision = 10, scale = 2)
    private BigDecimal creditApplied;

    // --- Booking voucher / promo (migration 0157) ---
    // {@code totalPrice} contient le montant FINAL (apres voucher). Les
    // colonnes ci-dessous tracent l'application du voucher pour facturation,
    // analytics, et reconciliation. Toutes NULL si aucun voucher applique.

    /** Total AVANT application du voucher (NULL si pas de voucher). */
    @Column(name = "original_total", precision = 10, scale = 2)
    private BigDecimal originalTotal;

    /** Montant du discount voucher applique (NULL si pas de voucher). */
    @Column(name = "discount_amount", precision = 10, scale = 2)
    private BigDecimal discountAmount;

    /**
     * Code texte du voucher applique. Denormalise pour audit meme si le
     * voucher est supprime (le {@link #bookingVoucherId} sera alors NULL).
     */
    @Column(name = "voucher_code", length = 64)
    private String voucherCode;

    /**
     * FK vers le {@link BookingVoucher} applique. SET NULL si le voucher est
     * supprime ulterieurement (preservation du voucherCode pour audit).
     */
    @Column(name = "booking_voucher_id")
    private Long bookingVoucherId;

    @Column(name = "confirmation_code", length = 100)
    private String confirmationCode;

    @Column(name = "external_uid", length = 500)
    private String externalUid;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "intervention_id")
    private Intervention intervention;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_id")
    private Guest guest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ical_feed_id")
    private ICalFeed icalFeed;

    // --- Payment link tracking ---
    @Column(name = "payment_link_sent_at")
    private LocalDateTime paymentLinkSentAt;

    @Column(name = "payment_link_email", length = 255)
    private String paymentLinkEmail;

    @Column(name = "stripe_session_id", length = 255)
    private String stripeSessionId;

    /** Customer Stripe (carte enregistrée au checkout) — réutilisé pour le hold de caution off-session. */
    @Column(name = "stripe_customer_id", length = 255)
    private String stripeCustomerId;

    /** Payment method Stripe (carte enregistrée) — réutilisé pour le hold de caution off-session. */
    @Column(name = "stripe_payment_method_id", length = 255)
    private String stripePaymentMethodId;

    /** Acompte : montant déjà encaissé (NULL si paiement intégral). */
    @Column(name = "amount_paid", precision = 10, scale = 2)
    private BigDecimal amountPaid;

    /** Acompte : solde restant à encaisser (0 une fois soldé). */
    @Column(name = "amount_due", precision = 10, scale = 2)
    private BigDecimal amountDue;

    /** Acompte : date à laquelle le solde devient dû (check-in − balanceDueDays). */
    @Column(name = "balance_due_date")
    private LocalDate balanceDueDate;

    @Column(name = "payment_status", length = 20)
    @Enumerated(EnumType.STRING)
    private PaymentStatus paymentStatus;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version = 0;

    @Column(name = "hidden_from_planning", nullable = false)
    private Boolean hiddenFromPlanning = false;

    @Column(name = "service_options_total", precision = 10, scale = 2)
    private BigDecimal serviceOptionsTotal = BigDecimal.ZERO;

    @OneToMany(mappedBy = "reservation", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ReservationServiceItem> serviceItems = new ArrayList<>();

    // Constructeurs
    public Reservation() {}

    public Reservation(Property property, String guestName, LocalDate checkIn, LocalDate checkOut,
                       String status, String source) {
        this.property = property;
        this.guestName = guestName;
        this.checkIn = checkIn;
        this.checkOut = checkOut;
        this.status = status;
        this.source = source;
    }

    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public String getGuestName() { return guestName; }
    public void setGuestName(String guestName) { this.guestName = guestName; }

    public Integer getGuestCount() { return guestCount; }
    public void setGuestCount(Integer guestCount) { this.guestCount = guestCount; }

    public Integer getAdultsCount() { return adultsCount; }
    public void setAdultsCount(Integer adultsCount) { this.adultsCount = adultsCount; }

    public Integer getChildrenCount() { return childrenCount; }
    public void setChildrenCount(Integer childrenCount) { this.childrenCount = childrenCount; }

    /**
     * Nombre de personnes taxables a la taxe de sejour selon que les mineurs sont
     * exoneres. Si la ventilation est connue (adultsCount non nul) et l'exoneration
     * active, seuls les adultes sont taxes ; sinon repli sur guestCount (total) —
     * comportement historique preserve quand la ventilation est inconnue.
     */
    public int taxablePersons(boolean exemptMinors) {
        if (exemptMinors && adultsCount != null && adultsCount >= 0) {
            return adultsCount;
        }
        return guestCount != null && guestCount > 0 ? guestCount : 1;
    }

    public LocalDate getCheckIn() { return checkIn; }
    public void setCheckIn(LocalDate checkIn) { this.checkIn = checkIn; }

    public LocalDate getCheckOut() { return checkOut; }
    public void setCheckOut(LocalDate checkOut) { this.checkOut = checkOut; }

    public String getCheckInTime() { return checkInTime; }
    public void setCheckInTime(String checkInTime) { this.checkInTime = checkInTime; }

    public String getCheckOutTime() { return checkOutTime; }
    public void setCheckOutTime(String checkOutTime) { this.checkOutTime = checkOutTime; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getSourceName() { return sourceName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }

    public BigDecimal getCreditApplied() { return creditApplied; }
    public void setCreditApplied(BigDecimal creditApplied) { this.creditApplied = creditApplied; }

    public BigDecimal getTotalPrice() { return totalPrice; }
    public void setTotalPrice(BigDecimal totalPrice) { this.totalPrice = totalPrice; }

    public String getConfirmationCode() { return confirmationCode; }
    public void setConfirmationCode(String confirmationCode) { this.confirmationCode = confirmationCode; }

    public String getExternalUid() { return externalUid; }
    public void setExternalUid(String externalUid) { this.externalUid = externalUid; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Intervention getIntervention() { return intervention; }
    public void setIntervention(Intervention intervention) { this.intervention = intervention; }

    public Guest getGuest() { return guest; }
    public void setGuest(Guest guest) { this.guest = guest; }

    public ICalFeed getIcalFeed() { return icalFeed; }
    public void setIcalFeed(ICalFeed icalFeed) { this.icalFeed = icalFeed; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public BigDecimal getRoomRevenue() { return roomRevenue; }
    public void setRoomRevenue(BigDecimal roomRevenue) { this.roomRevenue = roomRevenue; }

    public BigDecimal getCleaningFee() { return cleaningFee; }
    public void setCleaningFee(BigDecimal cleaningFee) { this.cleaningFee = cleaningFee; }

    public BigDecimal getOtaFeeAmount() { return otaFeeAmount; }
    public void setOtaFeeAmount(BigDecimal otaFeeAmount) { this.otaFeeAmount = otaFeeAmount; }

    public BigDecimal getTaxAmount() { return taxAmount; }
    public void setTaxAmount(BigDecimal taxAmount) { this.taxAmount = taxAmount; }

    public BigDecimal getTouristTaxAmount() { return touristTaxAmount; }
    public void setTouristTaxAmount(BigDecimal touristTaxAmount) { this.touristTaxAmount = touristTaxAmount; }

    public BigDecimal getOriginalTotal() { return originalTotal; }
    public void setOriginalTotal(BigDecimal originalTotal) { this.originalTotal = originalTotal; }

    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }

    public String getVoucherCode() { return voucherCode; }
    public void setVoucherCode(String voucherCode) { this.voucherCode = voucherCode; }

    public Long getBookingVoucherId() { return bookingVoucherId; }
    public void setBookingVoucherId(Long bookingVoucherId) { this.bookingVoucherId = bookingVoucherId; }

    public LocalDateTime getPaymentLinkSentAt() { return paymentLinkSentAt; }
    public void setPaymentLinkSentAt(LocalDateTime paymentLinkSentAt) { this.paymentLinkSentAt = paymentLinkSentAt; }

    public String getPaymentLinkEmail() { return paymentLinkEmail; }
    public void setPaymentLinkEmail(String paymentLinkEmail) { this.paymentLinkEmail = paymentLinkEmail; }

    public String getStripeSessionId() { return stripeSessionId; }
    public void setStripeSessionId(String stripeSessionId) { this.stripeSessionId = stripeSessionId; }

    public String getStripeCustomerId() { return stripeCustomerId; }
    public void setStripeCustomerId(String stripeCustomerId) { this.stripeCustomerId = stripeCustomerId; }

    public String getStripePaymentMethodId() { return stripePaymentMethodId; }
    public void setStripePaymentMethodId(String stripePaymentMethodId) { this.stripePaymentMethodId = stripePaymentMethodId; }

    public BigDecimal getAmountPaid() { return amountPaid; }
    public void setAmountPaid(BigDecimal amountPaid) { this.amountPaid = amountPaid; }

    public BigDecimal getAmountDue() { return amountDue; }
    public void setAmountDue(BigDecimal amountDue) { this.amountDue = amountDue; }

    public LocalDate getBalanceDueDate() { return balanceDueDate; }
    public void setBalanceDueDate(LocalDate balanceDueDate) { this.balanceDueDate = balanceDueDate; }

    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(PaymentStatus paymentStatus) { this.paymentStatus = paymentStatus; }

    public LocalDateTime getPaidAt() { return paidAt; }
    public void setPaidAt(LocalDateTime paidAt) { this.paidAt = paidAt; }

    public Boolean getHiddenFromPlanning() { return hiddenFromPlanning; }
    public void setHiddenFromPlanning(Boolean hiddenFromPlanning) { this.hiddenFromPlanning = hiddenFromPlanning; }

    public BigDecimal getServiceOptionsTotal() { return serviceOptionsTotal; }
    public void setServiceOptionsTotal(BigDecimal serviceOptionsTotal) { this.serviceOptionsTotal = serviceOptionsTotal; }

    public List<ReservationServiceItem> getServiceItems() { return serviceItems; }
    public void setServiceItems(List<ReservationServiceItem> serviceItems) { this.serviceItems = serviceItems; }

    @Override
    public String toString() {
        return "Reservation{id=" + id + ", guestName='" + guestName + "', checkIn=" + checkIn
                + ", checkOut=" + checkOut + ", status='" + status + "', source='" + source + "'}";
    }
}
