package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.Immutable;
import java.time.Instant;

/** Historique append-only, protégé aussi par PostgreSQL. Aucun message PSP brut ni secret. */
@Entity @Immutable
@Table(name = "payout_transfer_events")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PayoutTransferEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "organization_id", nullable = false) private Long organizationId;
    @Column(name = "transfer_id", nullable = false) private Long transferId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private PayoutTransfer.State state;
    @Column(name = "external_reference", length = 255) private String externalReference;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(nullable = false, length = 30) private String origin = "AUTOMATIC";
    @Column(name = "actor_subject", length = 255) private String actorSubject;

    protected PayoutTransferEvent() {}
    public PayoutTransferEvent(PayoutTransfer transfer) {
        organizationId = transfer.getOrganizationId(); transferId = transfer.getId();
        state = transfer.getState(); externalReference = transfer.getExternalReference(); createdAt = Instant.now();
    }
    public Long getId() { return id; }
    public static PayoutTransferEvent reconciled(PayoutTransfer transfer, String actorSubject) {
        if (actorSubject == null || actorSubject.isBlank() || actorSubject.length() > 255) {
            throw new IllegalArgumentException("Opérateur authentifié requis.");
        }
        var event = new PayoutTransferEvent(transfer);
        event.origin = "RECONCILIATION";
        event.actorSubject = actorSubject;
        return event;
    }
    public String getOrigin() { return origin; }
    public String getActorSubject() { return actorSubject; }
    public PayoutTransfer.State getState() { return state; }
    public String getExternalReference() { return externalReference; }
    public Instant getCreatedAt() { return createdAt; }
}
