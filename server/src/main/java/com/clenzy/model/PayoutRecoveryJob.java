package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;

/** Curseur interne global ; aucune donnée bancaire exposée directement par l'API. */
@Entity @Table(name = "payout_recovery_jobs")
public class PayoutRecoveryJob {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "account_id", nullable = false) private String accountId;
    @Column(nullable = false) private boolean livemode;
    @Column(name = "earliest_at", nullable = false) private Instant earliestAt;
    @Column(name = "window_end") private Instant windowEnd;
    @Column(name = "after_payout_id") private String afterPayoutId;
    @Column(name = "last_completed_at") private Instant lastCompletedAt;
    @Column(name = "last_attempt_at") private Instant lastAttemptAt;
    @Column(name = "next_attempt_at", nullable = false) private Instant nextAttemptAt;
    @Column(nullable = false) private int failures;
    @Column(name = "error_code") private String errorCode;
    @Column(name = "lease_token") private String leaseToken;
    @Column(name = "lease_until") private Instant leaseUntil;
    public Long getId() { return id; }
    public String getAccountId() { return accountId; }
    public boolean isLivemode() { return livemode; }
    public Instant getEarliestAt() { return earliestAt; }
    public Instant getWindowEnd() { return windowEnd; }
    public String getAfterPayoutId() { return afterPayoutId; }
    public Instant getLastCompletedAt() { return lastCompletedAt; }
    public Instant getNextAttemptAt() { return nextAttemptAt; }
    public int getFailures() { return failures; }
    public String getErrorCode() { return errorCode; }
    public String getLeaseToken() { return leaseToken; }
}
