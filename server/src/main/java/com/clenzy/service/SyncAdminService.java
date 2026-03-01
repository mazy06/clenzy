package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.dto.syncadmin.SyncAdminDtos.BulkRetryResultDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.CalendarCommandDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.CalendarConflictDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.ConnectionDetailDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.ConnectionSummaryDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.DiagnosticsSummaryDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.MappingSummaryDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.MetricsSnapshotDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.OutboxEventDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.OutboxStatsDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.ReconciliationRunDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.ReconciliationStatsDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.SyncEventStatsDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.SyncLogDto;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.HealthStatus;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.model.ChannelSyncLog;
import com.clenzy.integration.channel.repository.ChannelConnectionRepository;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.channel.repository.ChannelSyncLogRepository;
import com.clenzy.model.CalendarCommand;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.OutboxEvent;
import com.clenzy.model.ReconciliationRun;
import com.clenzy.repository.CalendarCommandRepository;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.OutboxEventRepository;
import com.clenzy.repository.ReconciliationRunRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class SyncAdminService {

    private static final Logger log = LoggerFactory.getLogger(SyncAdminService.class);

    private final ChannelConnectionRepository connectionRepository;
    private final ChannelSyncLogRepository syncLogRepository;
    private final ChannelMappingRepository mappingRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final CalendarCommandRepository calendarCommandRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final ChannelConnectorRegistry connectorRegistry;
    private final SyncMetrics syncMetrics;
    private final ReconciliationRunRepository reconciliationRunRepository;
    private final ReconciliationService reconciliationService;

    public SyncAdminService(ChannelConnectionRepository connectionRepository,
                            ChannelSyncLogRepository syncLogRepository,
                            ChannelMappingRepository mappingRepository,
                            OutboxEventRepository outboxEventRepository,
                            CalendarCommandRepository calendarCommandRepository,
                            CalendarDayRepository calendarDayRepository,
                            ChannelConnectorRegistry connectorRegistry,
                            SyncMetrics syncMetrics,
                            ReconciliationRunRepository reconciliationRunRepository,
                            ReconciliationService reconciliationService) {
        this.connectionRepository = connectionRepository;
        this.syncLogRepository = syncLogRepository;
        this.mappingRepository = mappingRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.calendarCommandRepository = calendarCommandRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.connectorRegistry = connectorRegistry;
        this.syncMetrics = syncMetrics;
        this.reconciliationRunRepository = reconciliationRunRepository;
        this.reconciliationService = reconciliationService;
    }

    // ── 1. Connections ────────────────────────────────────────────────────────

    public List<ConnectionSummaryDto> getConnections() {
        List<ChannelConnection> connections = connectionRepository.findAllCrossOrg();
        return connections.stream().map(cc -> {
            long mappingCount = mappingRepository.countByConnectionId(cc.getId());
            String healthStatus = getHealthStatusForConnection(cc);
            return new ConnectionSummaryDto(
                    cc.getId(),
                    cc.getChannel().name(),
                    cc.getStatus() != null ? cc.getStatus().name() : "ACTIVE",
                    cc.getLastSyncAt() != null ? cc.getLastSyncAt().toString() : null,
                    cc.getLastError(),
                    (int) mappingCount,
                    healthStatus
            );
        }).collect(Collectors.toList());
    }

    public Optional<ConnectionDetailDto> getConnectionDetail(Long id) {
        return connectionRepository.findById(id).map(cc -> {
            long mappingCount = mappingRepository.countByConnectionId(cc.getId());
            String healthStatus = getHealthStatusForConnection(cc);
            return new ConnectionDetailDto(
                    cc.getId(),
                    cc.getOrganizationId(),
                    cc.getChannel().name(),
                    cc.getStatus() != null ? cc.getStatus().name() : "ACTIVE",
                    cc.getCredentialsRef(),
                    cc.getWebhookUrl(),
                    cc.getSyncConfig(),
                    cc.getLastSyncAt() != null ? cc.getLastSyncAt().toString() : null,
                    cc.getLastError(),
                    (int) mappingCount,
                    healthStatus,
                    cc.getCreatedAt() != null ? cc.getCreatedAt().toString() : null,
                    cc.getUpdatedAt() != null ? cc.getUpdatedAt().toString() : null
            );
        });
    }

    public String forceHealthCheck(Long connectionId) {
        ChannelConnection connection = connectionRepository.findById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("Connection not found: " + connectionId));
        Optional<ChannelConnector> connector = connectorRegistry.getConnector(connection.getChannel());
        if (connector.isPresent()) {
            HealthStatus status = connector.get().checkHealth(connectionId);
            log.info("Health check for connection {}: {}", connectionId, status);
            return status.name();
        }
        return HealthStatus.UNKNOWN.name();
    }

    // ── 2. Sync Events ───────────────────────────────────────────────────────

    public Page<SyncLogDto> getSyncEvents(ChannelName channel, String status,
                                          LocalDateTime from, Pageable pageable) {
        Page<ChannelSyncLog> page = syncLogRepository.findFiltered(channel, status, from, pageable);
        return page.map(this::toSyncLogDto);
    }

    public SyncEventStatsDto getSyncEventStats() {
        Map<String, Long> byChannel = new HashMap<>();
        for (ChannelName cn : ChannelName.values()) {
            long count = syncLogRepository.findFiltered(cn, null, null,
                    Pageable.ofSize(1)).getTotalElements();
            if (count > 0) {
                byChannel.put(cn.name(), count);
            }
        }

        Map<String, Long> byStatus = new HashMap<>();
        for (String s : List.of("SUCCESS", "FAILED", "PARTIAL", "SKIPPED")) {
            long count = syncLogRepository.countByStatusStr(s);
            if (count > 0) {
                byStatus.put(s, count);
            }
        }

        LocalDateTime last24h = LocalDateTime.now().minusHours(24);
        long totalLast24h = syncLogRepository.findFiltered(null, null, last24h,
                Pageable.ofSize(1)).getTotalElements();

        return new SyncEventStatsDto(byChannel, byStatus, totalLast24h);
    }

    // ── 3. Outbox ────────────────────────────────────────────────────────────

    public Page<OutboxEventDto> getOutboxEvents(String status, String topic, Pageable pageable) {
        Page<OutboxEvent> page = outboxEventRepository.findFiltered(status, topic, pageable);
        return page.map(this::toOutboxEventDto);
    }

    public OutboxStatsDto getOutboxStats() {
        long pending = outboxEventRepository.countByStatusStr("PENDING");
        long sent = outboxEventRepository.countByStatusStr("SENT");
        long failed = outboxEventRepository.countByStatusStr("FAILED");
        long total = pending + sent + failed;
        return new OutboxStatsDto(pending, sent, failed, total);
    }

    @Transactional
    public BulkRetryResultDto bulkRetryOutbox(List<Long> ids) {
        List<OutboxEvent> events = outboxEventRepository.findAllById(ids);
        List<Long> failedIds = new ArrayList<>();
        int retried = 0;

        for (OutboxEvent event : events) {
            try {
                event.setStatus("PENDING");
                event.setRetryCount(0);
                retried++;
            } catch (Exception e) {
                log.warn("Failed to reset outbox event {}: {}", event.getId(), e.getMessage());
                failedIds.add(event.getId());
            }
        }

        // Detect IDs that were not found
        List<Long> foundIds = events.stream().map(OutboxEvent::getId).collect(Collectors.toList());
        for (Long id : ids) {
            if (!foundIds.contains(id)) {
                failedIds.add(id);
            }
        }

        outboxEventRepository.saveAll(events);
        log.info("Bulk retry outbox: requested={}, retried={}, failed={}", ids.size(), retried, failedIds.size());

        return new BulkRetryResultDto(ids.size(), retried, failedIds);
    }

    // ── 4. Calendar ──────────────────────────────────────────────────────────

    public Page<CalendarCommandDto> getCalendarCommands(Long propertyId, Pageable pageable) {
        Page<CalendarCommand> page;
        if (propertyId != null) {
            page = calendarCommandRepository.findByPropertyIdPaged(propertyId, pageable);
        } else {
            page = calendarCommandRepository.findRecentPaged(pageable);
        }
        return page.map(this::toCalendarCommandDto);
    }

    public List<CalendarConflictDto> getCalendarConflicts() {
        List<CalendarDay> orphaned = calendarDayRepository.findOrphanedBookedDays();
        return orphaned.stream().map(cd -> new CalendarConflictDto(
                cd.getId(),
                cd.getProperty() != null ? cd.getProperty().getId() : null,
                cd.getDate() != null ? cd.getDate().toString() : null,
                cd.getStatus() != null ? cd.getStatus().name() : null,
                cd.getOrganizationId()
        )).collect(Collectors.toList());
    }

    // ── 5. Mappings ──────────────────────────────────────────────────────────

    public Page<MappingSummaryDto> getMappings(Pageable pageable) {
        Page<ChannelMapping> page = mappingRepository.findAllWithConnection(pageable);
        return page.map(this::toMappingSummaryDto);
    }

    public Optional<MappingSummaryDto> getMappingDetail(Long id) {
        return mappingRepository.findById(id).map(this::toMappingSummaryDto);
    }

    // ── 6. Diagnostics ───────────────────────────────────────────────────────

    public DiagnosticsSummaryDto getDiagnostics() {
        List<ChannelConnection> allConnections = connectionRepository.findAllCrossOrg();
        List<ChannelConnection> activeConnections = connectionRepository.findAllActive();

        int totalConnections = allConnections.size();
        int activeCount = activeConnections.size();

        // Count healthy connections
        int healthyCount = 0;
        for (ChannelConnection cc : activeConnections) {
            String health = getHealthStatusForConnection(cc);
            if (HealthStatus.HEALTHY.name().equals(health)) {
                healthyCount++;
            }
        }

        long pendingOutbox = outboxEventRepository.countByStatusStr("PENDING");
        long failedOutbox = outboxEventRepository.countByStatusStr("FAILED");

        // Oldest pending event
        List<OutboxEvent> pendingEvents = outboxEventRepository.findPendingEvents();
        String oldestPendingEvent = null;
        if (!pendingEvents.isEmpty()) {
            OutboxEvent oldest = pendingEvents.get(0);
            oldestPendingEvent = oldest.getCreatedAt() != null ? oldest.getCreatedAt().toString() : null;
        }

        // Sync logs by status
        Map<String, Long> syncLogsByStatus = new HashMap<>();
        for (String s : List.of("SUCCESS", "FAILED", "PARTIAL", "SKIPPED")) {
            long count = syncLogRepository.countByStatusStr(s);
            if (count > 0) {
                syncLogsByStatus.put(s, count);
            }
        }

        return new DiagnosticsSummaryDto(
                totalConnections,
                activeCount,
                healthyCount,
                pendingOutbox,
                failedOutbox,
                oldestPendingEvent,
                syncLogsByStatus
        );
    }

    // ── 7. Metrics ───────────────────────────────────────────────────────────

    public MetricsSnapshotDto getMetrics() {
        MeterRegistry registry = syncMetrics.getRegistry();

        Map<String, Double> syncLatencyP95 = new HashMap<>();
        Map<String, Long> syncSuccessCount = new HashMap<>();
        Map<String, Long> syncFailureCount = new HashMap<>();

        for (ChannelName cn : ChannelName.values()) {
            String channelName = cn.name();

            // Latency P95
            Timer timer = registry.find("pms.sync.latency").tag("channel", channelName).timer();
            double p95 = timer != null ? timer.percentile(0.95, TimeUnit.MILLISECONDS) : 0.0;
            if (p95 > 0.0) {
                syncLatencyP95.put(channelName, p95);
            }

            // Success count
            Counter successCounter = registry.find("pms.sync.success").tag("channel", channelName).counter();
            long successCount = successCounter != null ? (long) successCounter.count() : 0L;
            if (successCount > 0) {
                syncSuccessCount.put(channelName, successCount);
            }

            // Failure count
            Counter failureCounter = registry.find("pms.sync.failure").tag("channel", channelName).counter();
            long failureCount = failureCounter != null ? (long) failureCounter.count() : 0L;
            if (failureCount > 0) {
                syncFailureCount.put(channelName, failureCount);
            }
        }

        // Calendar conflicts
        Counter conflicts = registry.find("pms.calendar.conflict.detected").counter();
        long calendarConflicts = conflicts != null ? (long) conflicts.count() : 0L;

        // Double bookings prevented
        Counter dbPrevented = registry.find("pms.reservation.double_booking.prevented").counter();
        long doubleBookingsPrevented = dbPrevented != null ? (long) dbPrevented.count() : 0L;

        return new MetricsSnapshotDto(
                syncLatencyP95,
                syncSuccessCount,
                syncFailureCount,
                calendarConflicts,
                doubleBookingsPrevented
        );
    }

    // ── 8. Reconciliation ──────────────────────────────────────────────────

    public Page<ReconciliationRunDto> getReconciliationRuns(Long propertyId, String status, Pageable pageable) {
        Page<ReconciliationRun> page = reconciliationRunRepository.findFiltered(propertyId, status, pageable);
        return page.map(this::toReconciliationRunDto);
    }

    public ReconciliationStatsDto getReconciliationStats() {
        long totalRuns = reconciliationRunRepository.count();
        long successRuns = reconciliationRunRepository.countByStatus("SUCCESS");
        long failedRuns = reconciliationRunRepository.countByStatus("FAILED");
        long divergenceRuns = reconciliationRunRepository.countByStatus("DIVERGENCE");

        // Sum discrepancies and fixes from all runs
        Page<ReconciliationRun> recentRuns = reconciliationRunRepository.findRecentPaged(
                org.springframework.data.domain.PageRequest.of(0, 1000));
        long totalDiscrepancies = recentRuns.getContent().stream()
                .mapToLong(ReconciliationRun::getDiscrepanciesFound).sum();
        long totalFixes = recentRuns.getContent().stream()
                .mapToLong(ReconciliationRun::getDiscrepanciesFixed).sum();

        // Last run timestamp
        Page<ReconciliationRun> lastRun = reconciliationRunRepository.findRecentPaged(
                org.springframework.data.domain.PageRequest.of(0, 1));
        String lastRunAt = null;
        if (!lastRun.getContent().isEmpty()) {
            ReconciliationRun latest = lastRun.getContent().get(0);
            lastRunAt = latest.getStartedAt() != null ? latest.getStartedAt().toString() : null;
        }

        return new ReconciliationStatsDto(totalRuns, successRuns, failedRuns, divergenceRuns,
                totalDiscrepancies, totalFixes, lastRunAt);
    }

    public void triggerReconciliation(Long propertyId) {
        reconciliationService.reconcileProperty(propertyId);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private String getHealthStatusForConnection(ChannelConnection cc) {
        try {
            Optional<ChannelConnector> connector = connectorRegistry.getConnector(cc.getChannel());
            if (connector.isPresent()) {
                return connector.get().checkHealth(cc.getId()).name();
            }
        } catch (Exception e) {
            log.warn("Health check failed for connection {}: {}", cc.getId(), e.getMessage());
        }
        return HealthStatus.UNKNOWN.name();
    }

    private SyncLogDto toSyncLogDto(ChannelSyncLog sl) {
        return new SyncLogDto(
                sl.getId(),
                sl.getConnection() != null ? sl.getConnection().getChannel().name() : null,
                sl.getDirection() != null ? sl.getDirection().name() : null,
                sl.getEventType(),
                sl.getStatus(),
                sl.getErrorMessage(),
                sl.getDurationMs() != null ? sl.getDurationMs().longValue() : 0L,
                sl.getCreatedAt() != null ? sl.getCreatedAt().toString() : null
        );
    }

    private OutboxEventDto toOutboxEventDto(OutboxEvent e) {
        return new OutboxEventDto(
                e.getId(),
                e.getAggregateType(),
                e.getAggregateId(),
                e.getEventType(),
                e.getTopic(),
                e.getStatus(),
                e.getRetryCount() != null ? e.getRetryCount() : 0,
                e.getErrorMessage(),
                e.getCreatedAt() != null ? e.getCreatedAt().toString() : null,
                e.getSentAt() != null ? e.getSentAt().toString() : null
        );
    }

    private CalendarCommandDto toCalendarCommandDto(CalendarCommand cc) {
        return new CalendarCommandDto(
                cc.getId(),
                cc.getPropertyId(),
                cc.getCommandType() != null ? cc.getCommandType().name() : null,
                cc.getDateFrom() != null ? cc.getDateFrom().toString() : null,
                cc.getDateTo() != null ? cc.getDateTo().toString() : null,
                cc.getSource(),
                cc.getReservationId(),
                cc.getStatus(),
                cc.getExecutedAt() != null ? cc.getExecutedAt().toString() : null
        );
    }

    private MappingSummaryDto toMappingSummaryDto(ChannelMapping cm) {
        return new MappingSummaryDto(
                cm.getId(),
                cm.getConnection() != null ? cm.getConnection().getChannel().name() : null,
                cm.getEntityType(),
                cm.getInternalId(),
                cm.getExternalId(),
                cm.isSyncEnabled(),
                cm.getLastSyncAt() != null ? cm.getLastSyncAt().toString() : null,
                cm.getLastSyncStatus()
        );
    }

    private ReconciliationRunDto toReconciliationRunDto(ReconciliationRun r) {
        return new ReconciliationRunDto(
                r.getId(),
                r.getChannel(),
                r.getPropertyId(),
                r.getOrganizationId(),
                r.getStartedAt() != null ? r.getStartedAt().toString() : null,
                r.getCompletedAt() != null ? r.getCompletedAt().toString() : null,
                r.getStatus(),
                r.getPmsDaysChecked(),
                r.getChannelDaysChecked(),
                r.getDiscrepanciesFound(),
                r.getDiscrepanciesFixed(),
                r.getDivergencePct() != null ? r.getDivergencePct().toString() : null,
                r.getDetails(),
                r.getErrorMessage()
        );
    }
}
