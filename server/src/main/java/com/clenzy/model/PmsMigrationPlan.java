package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Cutover plan for leaving a previous PMS: contract dates and the checklist ticked by the host. */
@Entity
@Table(name = "pms_migration_plans")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PmsMigrationPlan {
    @Id private UUID id = UUID.randomUUID();
    @Column(name = "organization_id", nullable = false) private Long organizationId;
    @Column(name = "created_by", nullable = false) private String createdBy;
    @Column(name = "source_pms", length = 80) private String sourcePms;
    @Column(name = "contract_end_date") private LocalDate contractEndDate;
    @Column(name = "notice_days") private Integer noticeDays;
    @Column(nullable = false, columnDefinition = "text") private String checklist = "{}";
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();
    @Version private long version;

    public UUID getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long value) { organizationId = value; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String value) { createdBy = value; }
    public String getSourcePms() { return sourcePms; }
    public void setSourcePms(String value) { sourcePms = value; }
    public LocalDate getContractEndDate() { return contractEndDate; }
    public void setContractEndDate(LocalDate value) { contractEndDate = value; }
    public Integer getNoticeDays() { return noticeDays; }
    public void setNoticeDays(Integer value) { noticeDays = value; }
    public String getChecklist() { return checklist; }
    public void setChecklist(String value) { checklist = value; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant value) { updatedAt = value; }
}
