package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "pms_import_batches")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PmsImportBatch {
    @Id private UUID id = UUID.randomUUID();
    @Column(name = "organization_id", nullable = false) private Long organizationId;
    @Column(name = "created_by", nullable = false) private String createdBy;
    @Column(nullable = false, length = 80) private String source;
    @Column(name = "source_account", nullable = false, length = 120) private String sourceAccount;
    @Column(nullable = false, length = 20) private String status = "DRAFT";
    @Convert(converter = EncryptedFieldConverter.class)
    @Column(nullable = false, columnDefinition = "text") private String payload;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
    @Column(name = "completed_at") private Instant completedAt;
    @Version private long version;

    public UUID getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long value) { organizationId = value; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String value) { createdBy = value; }
    public String getSource() { return source; }
    public void setSource(String value) { source = value; }
    public String getSourceAccount() { return sourceAccount; }
    public void setSourceAccount(String value) { sourceAccount = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public String getPayload() { return payload; }
    public void setPayload(String value) { payload = value; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant value) { completedAt = value; }
}
