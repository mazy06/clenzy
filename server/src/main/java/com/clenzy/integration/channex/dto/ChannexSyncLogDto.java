package com.clenzy.integration.channex.dto;

import com.clenzy.integration.channex.model.ChannexSyncLog;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO public d'une entree d'historique sync Channex.
 *
 * <p>Tronque {@code errorMessage} a 500 chars pour l'UI (le full est en DB
 * pour les besoins debug ops, mais l'UI affiche un resume).</p>
 */
public record ChannexSyncLogDto(
    Long id,
    Long clenzyPropertyId,
    UUID mappingId,
    ChannexSyncLog.SyncType syncType,
    ChannexSyncLog.Status status,
    int recordCount,
    long durationMs,
    String errorMessage,
    Instant startedAt,
    Instant finishedAt
) {
    public static ChannexSyncLogDto from(ChannexSyncLog log) {
        String err = log.getErrorMessage();
        if (err != null && err.length() > 500) {
            err = err.substring(0, 500) + "…";
        }
        return new ChannexSyncLogDto(
            log.getId(),
            log.getClenzyPropertyId(),
            log.getMappingId(),
            log.getSyncType(),
            log.getStatus(),
            log.getRecordCount(),
            log.getDurationMs(),
            err,
            log.getStartedAt(),
            log.getFinishedAt()
        );
    }
}
