package com.clenzy.dto;

import com.clenzy.model.MigrationJob;
import com.clenzy.model.MigrationJob.MigrationDataType;
import com.clenzy.model.MigrationJob.MigrationSource;
import com.clenzy.model.MigrationJob.MigrationStatus;

import java.time.Instant;

public record MigrationJobDto(
    Long id,
    MigrationSource source,
    MigrationStatus status,
    MigrationDataType dataType,
    Integer totalRecords,
    Integer processedRecords,
    Integer failedRecords,
    double progressPercent,
    Instant startedAt,
    Instant completedAt,
    Instant createdAt
) {
    public static MigrationJobDto from(MigrationJob j) {
        double progress = j.getTotalRecords() > 0
            ? (j.getProcessedRecords() * 100.0) / j.getTotalRecords()
            : 0.0;
        return new MigrationJobDto(
            j.getId(), j.getSource(), j.getStatus(), j.getDataType(),
            j.getTotalRecords(), j.getProcessedRecords(), j.getFailedRecords(),
            Math.round(progress * 100.0) / 100.0,
            j.getStartedAt(), j.getCompletedAt(), j.getCreatedAt()
        );
    }
}
