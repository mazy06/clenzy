package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Réserve durable par exécution, libérable une seule fois, avec expiration après interruption. */
@Entity
@Table(name = "baitly_ai_credit_reservations")
public class BaitlyCreditReservation {
    @Id private UUID id;
    @Column(name = "organization_id", nullable = false) private Long organizationId;
    @Column(name = "remaining_millicredits", nullable = false) private long remainingMillicredits;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(nullable = false) private boolean closed;
    protected BaitlyCreditReservation() {}
    public BaitlyCreditReservation(UUID id, Long org, long amount, Instant expiresAt) {
        this.id = id; this.organizationId = org; this.remainingMillicredits = amount; this.expiresAt = expiresAt;
    }
    public Long getOrganizationId() { return organizationId; }
    public long getRemainingMillicredits() { return remainingMillicredits; }
    public boolean isActive(Instant now) { return !closed && expiresAt.isAfter(now); }
    public void extend(long amount, Instant until) {
        remainingMillicredits = Math.addExact(remainingMillicredits, amount); expiresAt = until;
    }
    public void consume(long amount) { remainingMillicredits = Math.max(0, remainingMillicredits - amount); }
    public void close() { remainingMillicredits = 0; closed = true; }
}
