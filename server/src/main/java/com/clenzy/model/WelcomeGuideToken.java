package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "welcome_guide_tokens")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class WelcomeGuideToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guide_id", nullable = false)
    private WelcomeGuide guide;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id")
    private Reservation reservation;

    @Column(nullable = false, unique = true)
    private UUID token = UUID.randomUUID();

    @Column(name = "valid_from")
    private LocalDateTime validFrom;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private boolean revoked = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public WelcomeGuide getGuide() { return guide; }
    public void setGuide(WelcomeGuide guide) { this.guide = guide; }
    public Reservation getReservation() { return reservation; }
    public void setReservation(Reservation reservation) { this.reservation = reservation; }
    public UUID getToken() { return token; }
    public void setToken(UUID token) { this.token = token; }
    public LocalDateTime getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDateTime validFrom) { this.validFrom = validFrom; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public boolean isRevoked() { return revoked; }
    public void setRevoked(boolean revoked) { this.revoked = revoked; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    /**
     * Validite a l'instant present : non revoque, dans la fenetre
     * [validFrom, expiresAt], et reservation (si liee) non annulee.
     */
    public boolean isCurrentlyValid() {
        LocalDateTime now = LocalDateTime.now();
        if (revoked) {
            return false;
        }
        if (validFrom != null && validFrom.isAfter(now)) {
            return false;
        }
        if (expiresAt != null && !expiresAt.isAfter(now)) {
            return false;
        }
        return reservation == null || !"cancelled".equalsIgnoreCase(reservation.getStatus());
    }
}
