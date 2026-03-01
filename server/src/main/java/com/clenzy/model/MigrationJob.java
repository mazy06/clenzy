package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.Instant;

@Entity
@Table(name = "migration_jobs")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class MigrationJob {

    public enum MigrationSource {
        LODGIFY, GUESTY, HOSTAWAY, BEDS24, SMOOBU, HOSPITABLE, CSV_IMPORT
    }

    public enum MigrationStatus {
        PENDING, IN_PROGRESS, COMPLETED, FAILED, PARTIALLY_COMPLETED
    }

    public enum MigrationDataType {
        PROPERTIES, RESERVATIONS, GUESTS, RATES, AVAILABILITY, ALL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MigrationSource source;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MigrationStatus status = MigrationStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "data_type", nullable = false, length = 20)
    private MigrationDataType dataType = MigrationDataType.ALL;

    @Column(name = "total_records")
    private Integer totalRecords = 0;

    @Column(name = "processed_records")
    private Integer processedRecords = 0;

    @Column(name = "failed_records")
    private Integer failedRecords = 0;

    @Column(name = "error_log", columnDefinition = "TEXT")
    private String errorLog;

    @Column(name = "source_api_key")
    private String sourceApiKey;

    @Column(name = "source_config", columnDefinition = "jsonb")
    private String sourceConfig;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public MigrationSource getSource() { return source; }
    public void setSource(MigrationSource source) { this.source = source; }
    public MigrationStatus getStatus() { return status; }
    public void setStatus(MigrationStatus status) { this.status = status; }
    public MigrationDataType getDataType() { return dataType; }
    public void setDataType(MigrationDataType dataType) { this.dataType = dataType; }
    public Integer getTotalRecords() { return totalRecords; }
    public void setTotalRecords(Integer totalRecords) { this.totalRecords = totalRecords; }
    public Integer getProcessedRecords() { return processedRecords; }
    public void setProcessedRecords(Integer processedRecords) { this.processedRecords = processedRecords; }
    public Integer getFailedRecords() { return failedRecords; }
    public void setFailedRecords(Integer failedRecords) { this.failedRecords = failedRecords; }
    public String getErrorLog() { return errorLog; }
    public void setErrorLog(String errorLog) { this.errorLog = errorLog; }
    public String getSourceApiKey() { return sourceApiKey; }
    public void setSourceApiKey(String sourceApiKey) { this.sourceApiKey = sourceApiKey; }
    public String getSourceConfig() { return sourceConfig; }
    public void setSourceConfig(String sourceConfig) { this.sourceConfig = sourceConfig; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
