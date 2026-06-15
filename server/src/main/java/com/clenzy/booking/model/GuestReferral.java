package com.clenzy.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Lien de parrainage voyageur (2.11) : rattache un filleul ({@code refereeEmail}) à un parrain
 * ({@code referrerEmail}, via {@code referralCode}) sur une réservation directe. Quand le séjour du
 * filleul est terminé, les deux côtés sont crédités (statut {@code GRANTED}). Un filleul ne peut être
 * parrainé qu'une fois par org (contrainte unique). Scopé par {@code organizationId}.
 */
@Entity
@Table(name = "guest_referrals",
    uniqueConstraints = @UniqueConstraint(name = "uq_guest_referral_referee", columnNames = {"organization_id", "referee_email"}))
public class GuestReferral {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "referee_email", nullable = false, length = 255)
    private String refereeEmail;

    @Column(name = "referrer_email", nullable = false, length = 255)
    private String referrerEmail;

    @Column(name = "referral_code", nullable = false, length = 32)
    private String referralCode;

    @Column(name = "reservation_code", nullable = false, length = 100)
    private String reservationCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private GuestReferralStatus status = GuestReferralStatus.PENDING;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "granted_at")
    private LocalDateTime grantedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getRefereeEmail() { return refereeEmail; }
    public void setRefereeEmail(String refereeEmail) { this.refereeEmail = refereeEmail; }

    public String getReferrerEmail() { return referrerEmail; }
    public void setReferrerEmail(String referrerEmail) { this.referrerEmail = referrerEmail; }

    public String getReferralCode() { return referralCode; }
    public void setReferralCode(String referralCode) { this.referralCode = referralCode; }

    public String getReservationCode() { return reservationCode; }
    public void setReservationCode(String reservationCode) { this.reservationCode = reservationCode; }

    public GuestReferralStatus getStatus() { return status; }
    public void setStatus(GuestReferralStatus status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public LocalDateTime getGrantedAt() { return grantedAt; }
    public void setGrantedAt(LocalDateTime grantedAt) { this.grantedAt = grantedAt; }
}
