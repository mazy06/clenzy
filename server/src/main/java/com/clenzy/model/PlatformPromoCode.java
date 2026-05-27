package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Code promo / cooptation valide a l'inscription.
 *
 * <p>Au lancement, seul le type {@link DiscountType#PERCENTAGE} est applique
 * (validation cote service + ecart Stripe coupon). Le type {@code FIXED} est
 * accepte par le schema mais l'application Stripe necessitera un coupon dedie.</p>
 *
 * <p>Le compteur {@link #usedCount} est incremente via UPDATE atomique dans
 * {@code PlatformPromoCodeService} (pas de @Version necessaire — un UPDATE conditionnel
 * sur (id, used_count < max_uses) garantit la non-double-consommation).</p>
 */
@Entity
@Table(name = "platform_promo_codes")
public class PlatformPromoCode {

    public enum DiscountType {
        /** Reduction en pourcentage (1-100). */
        PERCENTAGE,
        /** Reduction fixe en centimes (non encore appliquee a Stripe). */
        FIXED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Code en majuscules, unique. Lookup case-insensitive. */
    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", nullable = false, length = 20)
    private DiscountType discountType = DiscountType.PERCENTAGE;

    /** PERCENTAGE : 1-100. FIXED : centimes. */
    @Column(name = "discount_value", nullable = false)
    private Integer discountValue;

    /** Nombre maximum d'utilisations. NULL = illimite. */
    @Column(name = "max_uses")
    private Integer maxUses;

    @Column(name = "used_count", nullable = false)
    private Integer usedCount = 0;

    @Column(name = "valid_from")
    private LocalDateTime validFrom;

    @Column(name = "valid_until")
    private LocalDateTime validUntil;

    @Column(nullable = false)
    private boolean active = true;

    /** Contexte interne (ex: "campagne Q3 2026"). */
    @Column(length = 255)
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "created_by")
    private String createdBy;

    // ─── Constructeurs ──────────────────────────────────────────────────────

    public PlatformPromoCode() {}

    public PlatformPromoCode(String code, DiscountType type, Integer value) {
        this.code = code != null ? code.trim().toUpperCase() : null;
        this.discountType = type;
        this.discountValue = value;
    }

    // ─── Logique metier ─────────────────────────────────────────────────────

    /**
     * Vrai si le code est utilisable au moment {@code now} (actif, dans la
     * fenetre de validite, quota non epuise).
     *
     * <p>Note : le check de quota ici est <em>indicatif</em>. La consommation
     * reelle doit utiliser un UPDATE atomique (PlatformPromoCodeService.tryConsume).</p>
     */
    public boolean isUsableAt(LocalDateTime now) {
        if (!active) return false;
        if (validFrom != null && now.isBefore(validFrom)) return false;
        if (validUntil != null && now.isAfter(validUntil)) return false;
        return maxUses == null || usedCount < maxUses;
    }

    /**
     * Applique la reduction au montant {@code amountCents} et retourne le
     * nouveau montant en centimes (toujours >= 0).
     */
    public int applyTo(int amountCents) {
        if (discountType == DiscountType.PERCENTAGE) {
            int discount = Math.round(amountCents * (discountValue / 100f));
            return Math.max(0, amountCents - discount);
        }
        // FIXED
        return Math.max(0, amountCents - discountValue);
    }

    // ─── Getters & Setters ──────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) {
        this.code = code != null ? code.trim().toUpperCase() : null;
    }

    public DiscountType getDiscountType() { return discountType; }
    public void setDiscountType(DiscountType discountType) { this.discountType = discountType; }

    public Integer getDiscountValue() { return discountValue; }
    public void setDiscountValue(Integer discountValue) { this.discountValue = discountValue; }

    public Integer getMaxUses() { return maxUses; }
    public void setMaxUses(Integer maxUses) { this.maxUses = maxUses; }

    public Integer getUsedCount() { return usedCount; }
    public void setUsedCount(Integer usedCount) { this.usedCount = usedCount; }

    public LocalDateTime getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDateTime validFrom) { this.validFrom = validFrom; }

    public LocalDateTime getValidUntil() { return validUntil; }
    public void setValidUntil(LocalDateTime validUntil) { this.validUntil = validUntil; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PlatformPromoCode that)) return false;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
