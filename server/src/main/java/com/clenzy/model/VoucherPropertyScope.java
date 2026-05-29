package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

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
 *
 * <p><b>Multi-tenant</b> : porte {@code organization_id} denormalise depuis
 * {@code booking_voucher} (migration 0158, fix C-NEW-3 review pass 2) +
 * {@link Filter} {@code organizationFilter} applique automatiquement par
 * le {@code TenantFilter}. Defense en profondeur — les queries restent
 * toujours scopees a l'org meme si un voucher_id leak entre tenants.</p>
 */
@Entity
@Table(name = "voucher_property_scope")
@IdClass(VoucherPropertyScope.PK.class)
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class VoucherPropertyScope {

    @Id
    @Column(name = "voucher_id")
    private Long voucherId;

    @Id
    @Column(name = "property_id")
    private Long propertyId;

    /** Denormalise depuis booking_voucher.organization_id. NOT NULL en DB. */
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public VoucherPropertyScope() {}

    public VoucherPropertyScope(Long voucherId, Long propertyId, Long organizationId) {
        this.voucherId = voucherId;
        this.propertyId = propertyId;
        this.organizationId = organizationId;
    }

    public Long getVoucherId() { return voucherId; }
    public void setVoucherId(Long voucherId) { this.voucherId = voucherId; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
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
