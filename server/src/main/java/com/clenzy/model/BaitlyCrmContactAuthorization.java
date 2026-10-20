package com.clenzy.model;
import jakarta.persistence.*;

/** Append-only contact assertions, never granted by CSV imports. */
@Entity
@Table(name="baitly_crm_contact_authorizations")
public class BaitlyCrmContactAuthorization {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    @Column(name="id")
    private Long id;
    public Long getId() { return id; }
    public void setId(Long value) { id=value; }
    @Column(name="organization_id")
    private Long organizationId;
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long value) { organizationId=value; }
    @Column(name="prospect_id")
    private Long prospectId;
    public Long getProspectId() { return prospectId; }
    public void setProspectId(Long value) { prospectId=value; }
    @Column(name="channel")
    private String channel;
    public String getChannel() { return channel; }
    public void setChannel(String value) { channel=value; }
    @Column(name="purpose")
    private String purpose;
    public String getPurpose() { return purpose; }
    public void setPurpose(String value) { purpose=value; }
    @Column(name="basis")
    private String basis;
    public String getBasis() { return basis; }
    public void setBasis(String value) { basis=value; }
    @Column(name="decision")
    private String decision;
    public String getDecision() { return decision; }
    public void setDecision(String value) { decision=value; }
    @Column(name="evidence", columnDefinition="TEXT")
    private String evidence;
    public String getEvidence() { return evidence; }
    public void setEvidence(String value) { evidence=value; }
    @Column(name="destination_hash")
    private String destinationHash;
    public String getDestinationHash() { return destinationHash; }
    public void setDestinationHash(String value) { destinationHash=value; }
    @Column(name="identity_version")
    private int identityVersion;
    public int getIdentityVersion() { return identityVersion; }
    public void setIdentityVersion(int value) { identityVersion=value; }
    @Column(name="occurred_at")
    private java.time.Instant occurredAt;
    public java.time.Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(java.time.Instant value) { occurredAt=value; }
    @Column(name="recorded_at")
    private java.time.Instant recordedAt;
    public java.time.Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(java.time.Instant value) { recordedAt=value; }
    @Column(name="expires_at")
    private java.time.Instant expiresAt;
    public java.time.Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(java.time.Instant value) { expiresAt=value; }
    @Column(name="recorded_by")
    private String recordedBy;
    public String getRecordedBy() { return recordedBy; }
    public void setRecordedBy(String value) { recordedBy=value; }
}
