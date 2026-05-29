package com.clenzy.model;

import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherCreatorOrgType;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.model.voucher.VoucherType;
import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Voucher / promo applicable aux nuitees de location.
 *
 * <h3>Architecture</h3>
 * Distinct de {@link PlatformPromoCode} qui gere les codes pour les abonnements
 * PMS via Stripe. Ce voucher s'applique sur le total d'une reservation guest
 * (calcule par le {@code PriceEngine} 9 niveaux) avant la confirmation du
 * booking.
 *
 * <h3>Pricing chain</h3>
 * <pre>
 * PriceEngine (RateOverride > Promotional > Event > Weekend > Seasonal >
 *              EarlyBird > LastMinute > Base > nightlyPrice)
 *   -> prix publie (ex: 167 EUR/nuit x 3 = 501 EUR)
 * VoucherEngine.apply(voucher, quote)
 *   -> discount applique selon discount_type (ex: -20 % = 100 EUR)
 * Quote final = 401 EUR + audit row dans {@link VoucherUsage}
 * </pre>
 *
 * <h3>Permissions creation</h3>
 * <ul>
 *   <li>HOST : autorise sur SES properties (verifie par
 *       {@code property.owner_id == requester.id})</li>
 *   <li>MANAGEMENT_ORG : autorise UNIQUEMENT si :
 *     <ol>
 *       <li>{@code organization.has_voucher_contract = true} (contrat signe)</li>
 *       <li>{@code property.org_can_create_vouchers = true} pour CHAQUE
 *           property cible (consentement explicite host)</li>
 *     </ol>
 *   </li>
 * </ul>
 *
 * @see VoucherType
 * @see VoucherDiscountType
 * @see VoucherStatus
 * @see VoucherUsage
 * @see VoucherPropertyScope
 */
@Entity
@Table(name = "booking_voucher")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class BookingVoucher {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Organisation creatrice (host ou conciergerie). Multi-tenant. */
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /**
     * Code texte saisi par le guest dans le booking engine.
     * Stocke en UPPER pour comparaison case-insensitive.
     * NULL pour les {@link VoucherType#AUTO_CAMPAIGN}.
     */
    @Column(name = "code", length = 64)
    private String code;

    /** Type de declenchement (saisie manuelle ou auto). */
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private VoucherType type;

    /** Type de remise (la semantique de discountValue depend de ce type). */
    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", nullable = false, length = 20)
    private VoucherDiscountType discountType;

    /**
     * Valeur de la remise. Semantique selon {@link #discountType} :
     * <ul>
     *   <li>{@link VoucherDiscountType#PERCENTAGE} : 1-100 (%)</li>
     *   <li>{@link VoucherDiscountType#FIXED_AMOUNT} : montant en euros</li>
     *   <li>{@link VoucherDiscountType#FREE_NIGHTS} : nombre de nuits</li>
     * </ul>
     */
    @Column(name = "discount_value", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountValue;

    /** Periode d'eligibilite. NULL valid_from = effectif immediatement. */
    @Column(name = "valid_from")
    private Instant validFrom;

    /** NULL valid_until = pas d'expiration (rare). */
    @Column(name = "valid_until")
    private Instant validUntil;

    /** Nombre minimum de nuits eligibles (anti-abuse). */
    @Column(name = "min_stay_nights")
    private Integer minStayNights;

    /** Montant minimum du sejour avant discount (anti-abuse). */
    @Column(name = "min_total_amount", precision = 10, scale = 2)
    private BigDecimal minTotalAmount;

    /** Nombre maximum de nuits eligibles (cap pour eviter discount excessif). */
    @Column(name = "max_stay_nights")
    private Integer maxStayNights;

    /** Plafond total d'utilisations (tous guests confondus). NULL = illimite. */
    @Column(name = "max_uses_total")
    private Integer maxUsesTotal;

    /** Plafond d'utilisations par guest. NULL = illimite. Default 1 (one-shot). */
    @Column(name = "max_uses_per_guest")
    private Integer maxUsesPerGuest = 1;

    /** Compteur atomique (incremente via UPDATE conditionnel cote service). */
    @Column(name = "usage_count", nullable = false)
    private Integer usageCount = 0;

    /** Canal autorise pour l'application (sert pour analytics + restriction). */
    @Enumerated(EnumType.STRING)
    @Column(name = "channel_scope", nullable = false, length = 20)
    private VoucherChannelScope channelScope = VoucherChannelScope.ALL;

    /** Statut du cycle de vie. */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private VoucherStatus status = VoucherStatus.DRAFT;

    /** HOST ou MANAGEMENT_ORG (impacte les regles d'autorisation creation). */
    @Enumerated(EnumType.STRING)
    @Column(name = "created_by_org_type", nullable = false, length = 20)
    private VoucherCreatorOrgType createdByOrgType = VoucherCreatorOrgType.HOST;

    /** User qui a cree le voucher (UI display + audit). */
    @Column(name = "created_by_user_id")
    private Long createdByUserId;

    /** Nom interne identifiant la campagne (ex: "Black Friday 2026"). */
    @Column(name = "name", nullable = false, length = 150)
    private String name;

    /** Description optionnelle (contexte, raisons, conditions). */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public BookingVoucher() {}

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // Getters & Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public VoucherType getType() { return type; }
    public void setType(VoucherType type) { this.type = type; }
    public VoucherDiscountType getDiscountType() { return discountType; }
    public void setDiscountType(VoucherDiscountType discountType) { this.discountType = discountType; }
    public BigDecimal getDiscountValue() { return discountValue; }
    public void setDiscountValue(BigDecimal discountValue) { this.discountValue = discountValue; }
    public Instant getValidFrom() { return validFrom; }
    public void setValidFrom(Instant validFrom) { this.validFrom = validFrom; }
    public Instant getValidUntil() { return validUntil; }
    public void setValidUntil(Instant validUntil) { this.validUntil = validUntil; }
    public Integer getMinStayNights() { return minStayNights; }
    public void setMinStayNights(Integer minStayNights) { this.minStayNights = minStayNights; }
    public BigDecimal getMinTotalAmount() { return minTotalAmount; }
    public void setMinTotalAmount(BigDecimal minTotalAmount) { this.minTotalAmount = minTotalAmount; }
    public Integer getMaxStayNights() { return maxStayNights; }
    public void setMaxStayNights(Integer maxStayNights) { this.maxStayNights = maxStayNights; }
    public Integer getMaxUsesTotal() { return maxUsesTotal; }
    public void setMaxUsesTotal(Integer maxUsesTotal) { this.maxUsesTotal = maxUsesTotal; }
    public Integer getMaxUsesPerGuest() { return maxUsesPerGuest; }
    public void setMaxUsesPerGuest(Integer maxUsesPerGuest) { this.maxUsesPerGuest = maxUsesPerGuest; }
    public Integer getUsageCount() { return usageCount; }
    public void setUsageCount(Integer usageCount) { this.usageCount = usageCount; }
    public VoucherChannelScope getChannelScope() { return channelScope; }
    public void setChannelScope(VoucherChannelScope channelScope) { this.channelScope = channelScope; }
    public VoucherStatus getStatus() { return status; }
    public void setStatus(VoucherStatus status) { this.status = status; }
    public VoucherCreatorOrgType getCreatedByOrgType() { return createdByOrgType; }
    public void setCreatedByOrgType(VoucherCreatorOrgType createdByOrgType) { this.createdByOrgType = createdByOrgType; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
