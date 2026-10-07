package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;

/** Preuve PSP append-only. Aucun IBAN, identité bancaire ou montant global du compte connecté. */
@Entity
@Table(name = "stripe_bank_payout_events")
public class BankPayoutObservation {
    public enum Status { PENDING, IN_TRANSIT, PAID, FAILED, CANCELED }
    public record Source(String source, long amountMinor, String currency) {}

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "event_id", nullable = false, unique = true, length = 255) private String eventId;
    @Column(name = "account_id", nullable = false, length = 100) private String accountId;
    @Column(name = "payout_id", nullable = false, length = 255) private String payoutId;
    @Column(nullable = false) private boolean livemode;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Status status;
    @Column(name = "payout_created", nullable = false) private Instant payoutCreated;
    @Column(name = "event_created", nullable = false) private Instant eventCreated;
    @Column(name = "arrival_date") private Instant arrivalDate;
    @Column(name = "failure_code", length = 100) private String failureCode;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb") private List<Source> sources;
    @Column(name = "recorded_at", nullable = false) private Instant recordedAt;
}
