package com.clenzy.model;

import jakarta.persistence.*;
import java.util.UUID;

/** A stable source key is scoped to tenant, PMS, source account and entity type. */
@Entity
@Table(name = "pms_import_bindings", uniqueConstraints = @UniqueConstraint(columnNames = {"organization_id", "source_key"}))
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PmsImportBinding {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "organization_id", nullable = false) private Long organizationId;
    @Column(name = "source_key", nullable = false, length = 64) private String sourceKey;
    @Column(nullable = false, length = 64) private String fingerprint;
    @Column(name = "target_id", nullable = false) private Long targetId;
    @Column(name = "batch_id", nullable = false) private UUID batchId;
    public PmsImportBinding() {}
    public PmsImportBinding(Long organizationId, String sourceKey, String fingerprint, Long targetId, UUID batchId) {
        this.organizationId = organizationId; this.sourceKey = sourceKey;
        this.fingerprint = fingerprint; this.targetId = targetId; this.batchId = batchId;
    }
    public String getSourceKey() { return sourceKey; }
    public String getFingerprint() { return fingerprint; }
    public Long getTargetId() { return targetId; }
}
