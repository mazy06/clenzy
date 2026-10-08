package com.clenzy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="baitly_commerce_recoveries")
public class BaitlyCommerceRecovery {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id", nullable=false) private Long organizationId;
    @Column(name="payout_id", nullable=false) private Long payoutId;
    @Column(name="transfer_id", nullable=false) private Long transferId;
    @Column(name="amount", nullable=false,precision=12,scale=2) private BigDecimal amount;
    @Column(name="cause", nullable=false,length=255) private String cause;
    @Column(name="state", nullable=false,length=30) private String state="PENDING";
    @Column(name="reference", nullable=true,length=255) private String reference;
    @Column(name="failure", nullable=true,length=80) private String failure;
    @Column(name="first_attempt_at", nullable=true) private Instant firstAttemptAt;
    @Column(name="next_attempt_at", nullable=false) private Instant nextAttemptAt=Instant.now();
    @Column(name="created_at", nullable=false) private Instant createdAt=Instant.now();
    protected BaitlyCommerceRecovery() {}
    public BaitlyCommerceRecovery(Long org,Long payoutId,Long transferId,BigDecimal amount,String cause) {this.organizationId=org;this.payoutId=payoutId;this.transferId=transferId;this.amount=amount;this.cause=cause;}
    public void claim(){if(firstAttemptAt==null)firstAttemptAt=Instant.now();state="PROCESSING";nextAttemptAt=Instant.now().plusSeconds(300);}
    public void review(String code){state="REVIEW_REQUIRED";failure=code;nextAttemptAt=Instant.now().plusSeconds(3600);}
    public void confirm(String ref){if(reference!=null && !reference.equals(ref))throw new IllegalStateException("Preuve différente");reference=ref;state="RECOVERED";failure=null;}
    public Long getId() {return id;}
    public Long getOrganizationId() {return organizationId;}
    public Long getPayoutId() {return payoutId;}
    public Long getTransferId() {return transferId;}
    public BigDecimal getAmount() {return amount;}
    public String getCause() {return cause;}
    public String getState() {return state;}
    public String getReference() {return reference;}
    public String getFailure() {return failure;}
    public Instant getFirstAttemptAt() {return firstAttemptAt;}
    public Instant getNextAttemptAt() {return nextAttemptAt;}
    public Instant getCreatedAt() {return createdAt;}
}
