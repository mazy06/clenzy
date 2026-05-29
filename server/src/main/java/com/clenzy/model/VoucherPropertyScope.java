package com.clenzy.model;

import jakarta.persistence.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/**
 * Liaison many-to-many entre un voucher et les properties auxquelles il
 * s'applique.
 *
 * <p>Convention metier : si AUCUNE row n'existe pour un voucher_id donne,
 * le voucher est applicable a TOUTES les properties de l'organisation
 * creatrice (cf. {@code BookingVoucherService.resolveApplicableProperties}).</p>
 *
 * <p>Entite avec cle composite (id_voucher + id_property) car pas de besoin
 * de tracker d'identite ailleurs.</p>
 */
@Entity
@Table(name = "voucher_property_scope")
@IdClass(VoucherPropertyScope.PK.class)
public class VoucherPropertyScope {

    @Id
    @Column(name = "voucher_id")
    private Long voucherId;

    @Id
    @Column(name = "property_id")
    private Long propertyId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public VoucherPropertyScope() {}

    public VoucherPropertyScope(Long voucherId, Long propertyId) {
        this.voucherId = voucherId;
        this.propertyId = propertyId;
    }

    public Long getVoucherId() { return voucherId; }
    public void setVoucherId(Long voucherId) { this.voucherId = voucherId; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    /** Cle composite serializable requise par JPA pour {@code @IdClass}. */
    public static class PK implements Serializable {
        private Long voucherId;
        private Long propertyId;

        public PK() {}

        public PK(Long voucherId, Long propertyId) {
            this.voucherId = voucherId;
            this.propertyId = propertyId;
        }

        public Long getVoucherId() { return voucherId; }
        public void setVoucherId(Long voucherId) { this.voucherId = voucherId; }
        public Long getPropertyId() { return propertyId; }
        public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof PK pk)) return false;
            return Objects.equals(voucherId, pk.voucherId)
                && Objects.equals(propertyId, pk.propertyId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(voucherId, propertyId);
        }
    }
}
