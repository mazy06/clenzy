package com.clenzy.dto.syncadmin;

import java.util.List;
import java.util.Map;

/**
 * DTOs pour le dashboard Sync & Diagnostics (Niveau 12).
 * Records compacts — aucune logique metier.
 */
public final class SyncAdminDtos {

    private SyncAdminDtos() {}

    // ── Connexions ──────────────────────────────────────────────────────────────

    public record ConnectionSummaryDto(
            Long id,
            String channel,
            String status,
            String lastSyncAt,
            String lastError,
            int mappingCount,
            String healthStatus
    ) {}

    public record ConnectionDetailDto(
            Long id,
            Long organizationId,
            String channel,
            String status,
            String credentialsRef,
            String webhookUrl,
            String syncConfig,
            String lastSyncAt,
            String lastError,
            int mappingCount,
            String healthStatus,
            String createdAt,
            String updatedAt
    ) {}

    // ── Sync Events (logs) ──────────────────────────────────────────────────────

    public record SyncLogDto(
            Long id,
            String channel,
            String direction,
            String eventType,
            String status,
            String errorMessage,
            long durationMs,
            String createdAt
    ) {}

    public record SyncEventStatsDto(
            Map<String, Long> byChannel,
            Map<String, Long> byStatus,
            long totalLast24h
    ) {}

    // ── Outbox ──────────────────────────────────────────────────────────────────

    public record OutboxEventDto(
            Long id,
            String aggregateType,
            String aggregateId,
            String eventType,
            String topic,
            String status,
            int retryCount,
            String errorMessage,
            String createdAt,
            String sentAt
    ) {}

    public record OutboxStatsDto(
            long pending,
            long sent,
            long failed,
            long total
    ) {}

    public record BulkRetryRequestDto(
            List<Long> ids
    ) {}

    public record BulkRetryResultDto(
            int requested,
            int retried,
            List<Long> failedIds
    ) {}

    // ── Calendar Audit ──────────────────────────────────────────────────────────

    public record CalendarCommandDto(
            Long id,
            Long propertyId,
            String commandType,
            String dateFrom,
            String dateTo,
            String source,
            Long reservationId,
            String status,
            String executedAt
    ) {}

    public record CalendarConflictDto(
            Long id,
            Long propertyId,
            String date,
            String status,
            Long organizationId
    ) {}

    // ── Mappings ────────────────────────────────────────────────────────────────

    public record MappingSummaryDto(
            Long id,
            String channel,
            String entityType,
            Long internalId,
            String externalId,
            boolean syncEnabled,
            String lastSyncAt,
            String lastSyncStatus
    ) {}

    // ── Diagnostics ─────────────────────────────────────────────────────────────

    public record DiagnosticsSummaryDto(
            int totalConnections,
            int activeConnections,
            int healthyConnections,
            long pendingOutbox,
            long failedOutbox,
            String oldestPendingEvent,
            Map<String, Long> syncLogsByStatus
    ) {}

    public record MetricsSnapshotDto(
            Map<String, Double> syncLatencyP95,
            Map<String, Long> syncSuccessCount,
            Map<String, Long> syncFailureCount,
            long calendarConflicts,
            long doubleBookingsPrevented
    ) {}

    // ── Reconciliation ────────────────────────────────────────────────────────

    public record ReconciliationRunDto(
            Long id,
            String channel,
            Long propertyId,
            Long organizationId,
            String startedAt,
            String completedAt,
            String status,
            int pmsDaysChecked,
            int channelDaysChecked,
            int discrepanciesFound,
            int discrepanciesFixed,
            String divergencePct,
            String details,
            String errorMessage
    ) {}

    public record ReconciliationStatsDto(
            long totalRuns,
            long successRuns,
            long failedRuns,
            long divergenceRuns,
            long totalDiscrepancies,
            long totalFixes,
            String lastRunAt
    ) {}

    public record ReconciliationTriggerRequestDto(
            Long propertyId
    ) {}
}
