package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.dto.syncadmin.SyncAdminDtos.*;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.HealthStatus;
import com.clenzy.integration.channel.SyncDirection;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.model.ChannelSyncLog;
import com.clenzy.integration.channel.repository.ChannelConnectionRepository;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.channel.repository.ChannelSyncLogRepository;
import com.clenzy.model.*;
import com.clenzy.repository.CalendarCommandRepository;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.OutboxEventRepository;
import com.clenzy.repository.ReconciliationRunRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SyncAdminServiceTest {

    @Mock private ChannelConnectionRepository connectionRepository;
    @Mock private ChannelSyncLogRepository syncLogRepository;
    @Mock private ChannelMappingRepository mappingRepository;
    @Mock private OutboxEventRepository outboxEventRepository;
    @Mock private CalendarCommandRepository calendarCommandRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private ChannelConnectorRegistry connectorRegistry;
    @Mock private SyncMetrics syncMetrics;
    @Mock private ReconciliationRunRepository reconciliationRunRepository;
    @Mock private ReconciliationService reconciliationService;

    private SyncAdminService service;

    @BeforeEach
    void setUp() {
        service = new SyncAdminService(connectionRepository, syncLogRepository, mappingRepository,
                outboxEventRepository, calendarCommandRepository, calendarDayRepository,
                connectorRegistry, syncMetrics, reconciliationRunRepository, reconciliationService);
    }

    // ===== GET CONNECTIONS =====

    @Nested
    @DisplayName("getConnections")
    class GetConnections {

        @Test
        @DisplayName("returns summaries when connections exist")
        void whenConnectionsExist_thenReturnsSummaries() {
            // Arrange
            ChannelConnection cc = new ChannelConnection();
            cc.setId(1L);
            cc.setChannel(ChannelName.AIRBNB);
            cc.setStatus("ACTIVE");

            when(connectionRepository.findAllCrossOrg()).thenReturn(List.of(cc));
            when(mappingRepository.countByConnectionId(1L)).thenReturn(3L);
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

            // Act
            List<ConnectionSummaryDto> result = service.getConnections();

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).channel()).isEqualTo("AIRBNB");
            assertThat(result.get(0).mappingCount()).isEqualTo(3);
        }

        @Test
        @DisplayName("returns empty list when no connections")
        void whenNoConnections_thenReturnsEmpty() {
            // Arrange
            when(connectionRepository.findAllCrossOrg()).thenReturn(List.of());

            // Act
            List<ConnectionSummaryDto> result = service.getConnections();

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("includes health status from connector")
        void whenConnectorReturnsHealthy_thenStatusIncluded() {
            // Arrange
            ChannelConnection cc = new ChannelConnection();
            cc.setId(1L);
            cc.setChannel(ChannelName.AIRBNB);
            cc.setStatus("ACTIVE");

            ChannelConnector connector = mock(ChannelConnector.class);
            when(connector.checkHealth(1L)).thenReturn(HealthStatus.HEALTHY);
            when(connectionRepository.findAllCrossOrg()).thenReturn(List.of(cc));
            when(mappingRepository.countByConnectionId(1L)).thenReturn(0L);
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));

            // Act
            List<ConnectionSummaryDto> result = service.getConnections();

            // Assert
            assertThat(result.get(0).healthStatus()).isEqualTo("HEALTHY");
        }
    }

    // ===== GET CONNECTION DETAIL =====

    @Nested
    @DisplayName("getConnectionDetail")
    class GetConnectionDetail {

        @Test
        @DisplayName("returns detail when connection exists")
        void whenExists_thenReturnsDetail() {
            // Arrange
            ChannelConnection cc = new ChannelConnection();
            cc.setId(1L);
            cc.setChannel(ChannelName.AIRBNB);
            cc.setStatus("ACTIVE");
            cc.setOrganizationId(10L);

            when(connectionRepository.findById(1L)).thenReturn(Optional.of(cc));
            when(mappingRepository.countByConnectionId(1L)).thenReturn(2L);
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

            // Act
            Optional<ConnectionDetailDto> result = service.getConnectionDetail(1L);

            // Assert
            assertThat(result).isPresent();
            assertThat(result.get().channel()).isEqualTo("AIRBNB");
            assertThat(result.get().organizationId()).isEqualTo(10L);
        }

        @Test
        @DisplayName("returns empty when connection not found")
        void whenNotFound_thenReturnsEmpty() {
            // Arrange
            when(connectionRepository.findById(99L)).thenReturn(Optional.empty());

            // Act
            Optional<ConnectionDetailDto> result = service.getConnectionDetail(99L);

            // Assert
            assertThat(result).isEmpty();
        }
    }

    // ===== FORCE HEALTH CHECK =====

    @Nested
    @DisplayName("forceHealthCheck")
    class ForceHealthCheck {

        @Test
        @DisplayName("throws when connection not found")
        void whenConnectionNotFound_thenThrows() {
            // Arrange
            when(connectionRepository.findById(99L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.forceHealthCheck(99L))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("returns HEALTHY when connector is present and healthy")
        void whenConnectorPresent_thenReturnsHealthStatus() {
            // Arrange
            ChannelConnection cc = new ChannelConnection();
            cc.setId(1L);
            cc.setChannel(ChannelName.AIRBNB);

            ChannelConnector connector = mock(ChannelConnector.class);
            when(connector.checkHealth(1L)).thenReturn(HealthStatus.HEALTHY);
            when(connectionRepository.findById(1L)).thenReturn(Optional.of(cc));
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));

            // Act
            String result = service.forceHealthCheck(1L);

            // Assert
            assertThat(result).isEqualTo("HEALTHY");
        }

        @Test
        @DisplayName("returns UNKNOWN when no connector registered")
        void whenNoConnector_thenReturnsUnknown() {
            // Arrange
            ChannelConnection cc = new ChannelConnection();
            cc.setId(1L);
            cc.setChannel(ChannelName.AIRBNB);

            when(connectionRepository.findById(1L)).thenReturn(Optional.of(cc));
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

            // Act
            String result = service.forceHealthCheck(1L);

            // Assert
            assertThat(result).isEqualTo("UNKNOWN");
        }
    }

    // ===== GET SYNC EVENTS =====

    @Nested
    @DisplayName("getSyncEvents")
    class GetSyncEvents {

        @Test
        @DisplayName("returns mapped page of sync log DTOs")
        void whenEventsExist_thenReturnsMappedPage() {
            // Arrange
            ChannelConnection conn = new ChannelConnection();
            conn.setChannel(ChannelName.AIRBNB);

            ChannelSyncLog log = new ChannelSyncLog();
            log.setId(1L);
            log.setConnection(conn);
            log.setDirection(SyncDirection.INBOUND);
            log.setEventType("RESERVATION_CREATED");
            log.setStatus("SUCCESS");
            log.setDurationMs(150);

            Page<ChannelSyncLog> page = new PageImpl<>(List.of(log));
            when(syncLogRepository.findFiltered(eq(ChannelName.AIRBNB), eq("SUCCESS"), any(), any()))
                    .thenReturn(page);

            // Act
            Page<SyncLogDto> result = service.getSyncEvents(ChannelName.AIRBNB, "SUCCESS", null, PageRequest.of(0, 20));

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).channel()).isEqualTo("AIRBNB");
            assertThat(result.getContent().get(0).status()).isEqualTo("SUCCESS");
        }
    }

    // ===== GET SYNC EVENT STATS =====

    @Nested
    @DisplayName("getSyncEventStats")
    class GetSyncEventStats {

        @Test
        @DisplayName("aggregates stats by channel and status")
        void whenCalled_thenAggregatesStats() {
            // Arrange: stub each channel individually - AIRBNB has 5, others have 0
            for (ChannelName cn : ChannelName.values()) {
                long total = cn == ChannelName.AIRBNB ? 5L : 0L;
                when(syncLogRepository.findFiltered(eq(cn), isNull(), isNull(), any()))
                        .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 1), total));
            }

            when(syncLogRepository.countByStatusStr("SUCCESS")).thenReturn(10L);
            when(syncLogRepository.countByStatusStr("FAILED")).thenReturn(2L);
            when(syncLogRepository.countByStatusStr("PARTIAL")).thenReturn(0L);
            when(syncLogRepository.countByStatusStr("SKIPPED")).thenReturn(0L);

            when(syncLogRepository.findFiltered(isNull(), isNull(), any(LocalDateTime.class), any()))
                    .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 1), 3));

            // Act
            SyncEventStatsDto stats = service.getSyncEventStats();

            // Assert
            assertThat(stats.byChannel()).containsEntry("AIRBNB", 5L);
            assertThat(stats.byStatus()).containsEntry("SUCCESS", 10L);
            assertThat(stats.byStatus()).containsEntry("FAILED", 2L);
        }
    }

    // ===== GET OUTBOX EVENTS =====

    @Nested
    @DisplayName("getOutboxEvents")
    class GetOutboxEvents {

        @Test
        @DisplayName("returns mapped page of outbox events")
        void whenEventsExist_thenReturnsMappedPage() {
            // Arrange
            OutboxEvent event = new OutboxEvent();
            event.setId(1L);
            event.setAggregateType("CALENDAR");
            event.setAggregateId("42");
            event.setEventType("CALENDAR_BOOKED");
            event.setTopic("calendar.events");
            event.setStatus("PENDING");
            event.setRetryCount(0);

            Page<OutboxEvent> page = new PageImpl<>(List.of(event));
            when(outboxEventRepository.findFiltered("PENDING", null, PageRequest.of(0, 20)))
                    .thenReturn(page);

            // Act
            Page<OutboxEventDto> result = service.getOutboxEvents("PENDING", null, PageRequest.of(0, 20));

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).aggregateType()).isEqualTo("CALENDAR");
            assertThat(result.getContent().get(0).status()).isEqualTo("PENDING");
        }
    }

    // ===== OUTBOX STATS =====

    @Nested
    @DisplayName("getOutboxStats")
    class OutboxStats {

        @Test
        @DisplayName("aggregates pending, sent, failed counts")
        void whenCalled_thenAggregatesCounts() {
            // Arrange
            when(outboxEventRepository.countByStatusStr("PENDING")).thenReturn(5L);
            when(outboxEventRepository.countByStatusStr("SENT")).thenReturn(100L);
            when(outboxEventRepository.countByStatusStr("FAILED")).thenReturn(2L);

            // Act
            OutboxStatsDto stats = service.getOutboxStats();

            // Assert
            assertThat(stats.pending()).isEqualTo(5L);
            assertThat(stats.sent()).isEqualTo(100L);
            assertThat(stats.failed()).isEqualTo(2L);
            assertThat(stats.total()).isEqualTo(107L);
        }
    }

    // ===== BULK RETRY OUTBOX =====

    @Nested
    @DisplayName("bulkRetryOutbox")
    class BulkRetryOutbox {

        @Test
        @DisplayName("resets found events to PENDING with retryCount=0")
        void whenEventsFound_thenResetsToPending() {
            // Arrange
            OutboxEvent e1 = new OutboxEvent();
            e1.setId(1L);
            e1.setStatus("FAILED");
            e1.setRetryCount(3);

            OutboxEvent e2 = new OutboxEvent();
            e2.setId(2L);
            e2.setStatus("FAILED");
            e2.setRetryCount(1);

            when(outboxEventRepository.findAllById(List.of(1L, 2L))).thenReturn(List.of(e1, e2));

            // Act
            BulkRetryResultDto result = service.bulkRetryOutbox(List.of(1L, 2L));

            // Assert
            assertThat(result.retried()).isEqualTo(2);
            assertThat(result.failedIds()).isEmpty();
            assertThat(e1.getStatus()).isEqualTo("PENDING");
            assertThat(e1.getRetryCount()).isEqualTo(0);
        }

        @Test
        @DisplayName("reports not-found IDs as failed")
        void whenSomeIdsNotFound_thenReportsFailedIds() {
            // Arrange
            OutboxEvent e1 = new OutboxEvent();
            e1.setId(1L);
            e1.setStatus("FAILED");

            when(outboxEventRepository.findAllById(List.of(1L, 99L))).thenReturn(List.of(e1));

            // Act
            BulkRetryResultDto result = service.bulkRetryOutbox(List.of(1L, 99L));

            // Assert
            assertThat(result.retried()).isEqualTo(1);
            assertThat(result.failedIds()).containsExactly(99L);
        }
    }

    // ===== GET CALENDAR COMMANDS =====

    @Nested
    @DisplayName("getCalendarCommands")
    class GetCalendarCommands {

        @Test
        @DisplayName("filters by propertyId when provided")
        void whenPropertyIdProvided_thenFilters() {
            // Arrange
            CalendarCommand cmd = new CalendarCommand();
            cmd.setId(1L);
            cmd.setPropertyId(42L);
            cmd.setCommandType(CalendarCommandType.BOOK);
            cmd.setDateFrom(LocalDate.of(2026, 3, 1));
            cmd.setDateTo(LocalDate.of(2026, 3, 5));
            cmd.setSource("MANUAL");
            cmd.setStatus("EXECUTED");

            Page<CalendarCommand> page = new PageImpl<>(List.of(cmd));
            when(calendarCommandRepository.findByPropertyIdPaged(eq(42L), any())).thenReturn(page);

            // Act
            Page<CalendarCommandDto> result = service.getCalendarCommands(42L, PageRequest.of(0, 20));

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).propertyId()).isEqualTo(42L);
            verify(calendarCommandRepository).findByPropertyIdPaged(eq(42L), any());
        }

        @Test
        @DisplayName("returns recent commands when propertyId is null")
        void whenPropertyIdNull_thenReturnsRecent() {
            // Arrange
            Page<CalendarCommand> page = new PageImpl<>(List.of());
            when(calendarCommandRepository.findRecentPaged(any())).thenReturn(page);

            // Act
            Page<CalendarCommandDto> result = service.getCalendarCommands(null, PageRequest.of(0, 20));

            // Assert
            verify(calendarCommandRepository).findRecentPaged(any());
        }
    }

    // ===== CALENDAR CONFLICTS =====

    @Nested
    @DisplayName("getCalendarConflicts")
    class CalendarConflicts {

        @Test
        @DisplayName("maps orphaned booked days to conflict DTOs")
        void whenOrphanedDays_thenReturnsConflictDtos() {
            // Arrange
            CalendarDay cd = new CalendarDay();
            cd.setId(1L);
            cd.setOrganizationId(10L);

            when(calendarDayRepository.findOrphanedBookedDays()).thenReturn(List.of(cd));

            // Act
            List<CalendarConflictDto> conflicts = service.getCalendarConflicts();

            // Assert
            assertThat(conflicts).hasSize(1);
        }

        @Test
        @DisplayName("returns empty list when no orphans")
        void whenNoOrphans_thenReturnsEmpty() {
            // Arrange
            when(calendarDayRepository.findOrphanedBookedDays()).thenReturn(List.of());

            // Act
            List<CalendarConflictDto> conflicts = service.getCalendarConflicts();

            // Assert
            assertThat(conflicts).isEmpty();
        }
    }

    // ===== GET MAPPINGS =====

    @Nested
    @DisplayName("getMappings")
    class GetMappings {

        @Test
        @DisplayName("returns page of mapping summaries")
        void whenMappingsExist_thenReturnsPage() {
            // Arrange
            ChannelConnection conn = new ChannelConnection();
            conn.setChannel(ChannelName.AIRBNB);

            ChannelMapping mapping = new ChannelMapping();
            mapping.setId(1L);
            mapping.setConnection(conn);
            mapping.setEntityType("PROPERTY");
            mapping.setInternalId(42L);
            mapping.setExternalId("listing-abc");
            mapping.setSyncEnabled(true);

            Page<ChannelMapping> page = new PageImpl<>(List.of(mapping));
            when(mappingRepository.findAllWithConnection(any())).thenReturn(page);

            // Act
            Page<MappingSummaryDto> result = service.getMappings(PageRequest.of(0, 20));

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).channel()).isEqualTo("AIRBNB");
            assertThat(result.getContent().get(0).externalId()).isEqualTo("listing-abc");
        }
    }

    // ===== GET MAPPING DETAIL =====

    @Nested
    @DisplayName("getMappingDetail")
    class GetMappingDetail {

        @Test
        @DisplayName("returns mapping summary when found")
        void whenFound_thenReturnsSummary() {
            // Arrange
            ChannelConnection conn = new ChannelConnection();
            conn.setChannel(ChannelName.ICAL);

            ChannelMapping mapping = new ChannelMapping();
            mapping.setId(1L);
            mapping.setConnection(conn);
            mapping.setEntityType("PROPERTY");
            mapping.setInternalId(42L);
            mapping.setExternalId("http://ical-feed");
            mapping.setSyncEnabled(true);

            when(mappingRepository.findById(1L)).thenReturn(Optional.of(mapping));

            // Act
            Optional<MappingSummaryDto> result = service.getMappingDetail(1L);

            // Assert
            assertThat(result).isPresent();
            assertThat(result.get().channel()).isEqualTo("ICAL");
        }

        @Test
        @DisplayName("returns empty when not found")
        void whenNotFound_thenReturnsEmpty() {
            // Arrange
            when(mappingRepository.findById(99L)).thenReturn(Optional.empty());

            // Act
            Optional<MappingSummaryDto> result = service.getMappingDetail(99L);

            // Assert
            assertThat(result).isEmpty();
        }
    }

    // ===== GET DIAGNOSTICS =====

    @Nested
    @DisplayName("getDiagnostics")
    class GetDiagnostics {

        @Test
        @DisplayName("aggregates connection, outbox, and sync log stats")
        void whenCalled_thenAggregatesDiagnostics() {
            // Arrange
            ChannelConnection activeConn = new ChannelConnection();
            activeConn.setId(1L);
            activeConn.setChannel(ChannelName.AIRBNB);
            activeConn.setStatus("ACTIVE");

            when(connectionRepository.findAllCrossOrg()).thenReturn(List.of(activeConn));
            when(connectionRepository.findAllActive()).thenReturn(List.of(activeConn));
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

            when(outboxEventRepository.countByStatusStr("PENDING")).thenReturn(3L);
            when(outboxEventRepository.countByStatusStr("FAILED")).thenReturn(1L);
            when(outboxEventRepository.findPendingEvents()).thenReturn(List.of());

            when(syncLogRepository.countByStatusStr("SUCCESS")).thenReturn(50L);
            when(syncLogRepository.countByStatusStr("FAILED")).thenReturn(5L);
            when(syncLogRepository.countByStatusStr("PARTIAL")).thenReturn(0L);
            when(syncLogRepository.countByStatusStr("SKIPPED")).thenReturn(0L);

            // Act
            DiagnosticsSummaryDto diagnostics = service.getDiagnostics();

            // Assert
            assertThat(diagnostics.totalConnections()).isEqualTo(1);
            assertThat(diagnostics.activeConnections()).isEqualTo(1);
            assertThat(diagnostics.pendingOutbox()).isEqualTo(3L);
            assertThat(diagnostics.failedOutbox()).isEqualTo(1L);
            assertThat(diagnostics.syncLogsByStatus()).containsEntry("SUCCESS", 50L);
        }

        @Test
        @DisplayName("includes oldest pending event timestamp")
        void whenPendingEventsExist_thenIncludesOldestTimestamp() {
            // Arrange
            when(connectionRepository.findAllCrossOrg()).thenReturn(List.of());
            when(connectionRepository.findAllActive()).thenReturn(List.of());

            OutboxEvent oldEvent = new OutboxEvent();
            oldEvent.setCreatedAt(LocalDateTime.of(2026, 1, 15, 10, 0));
            when(outboxEventRepository.countByStatusStr("PENDING")).thenReturn(1L);
            when(outboxEventRepository.countByStatusStr("FAILED")).thenReturn(0L);
            when(outboxEventRepository.findPendingEvents()).thenReturn(List.of(oldEvent));

            when(syncLogRepository.countByStatusStr(anyString())).thenReturn(0L);

            // Act
            DiagnosticsSummaryDto diagnostics = service.getDiagnostics();

            // Assert
            assertThat(diagnostics.oldestPendingEvent()).contains("2026-01-15");
        }
    }

    // ===== GET METRICS =====

    @Nested
    @DisplayName("getMetrics")
    class GetMetrics {

        @Test
        @DisplayName("returns snapshot with empty maps when no metrics recorded")
        void whenNoMetrics_thenReturnsEmptyMaps() {
            // Arrange
            MeterRegistry registry = new SimpleMeterRegistry();
            when(syncMetrics.getRegistry()).thenReturn(registry);

            // Act
            MetricsSnapshotDto snapshot = service.getMetrics();

            // Assert
            assertThat(snapshot.syncLatencyP95()).isEmpty();
            assertThat(snapshot.syncSuccessCount()).isEmpty();
            assertThat(snapshot.syncFailureCount()).isEmpty();
            assertThat(snapshot.calendarConflicts()).isEqualTo(0L);
            assertThat(snapshot.doubleBookingsPrevented()).isEqualTo(0L);
        }
    }

    // ===== GET RECONCILIATION RUNS =====

    @Nested
    @DisplayName("getReconciliationRuns")
    class GetReconciliationRuns {

        @Test
        @DisplayName("returns page of reconciliation run DTOs")
        void whenRunsExist_thenReturnsMappedPage() {
            // Arrange
            ReconciliationRun run = new ReconciliationRun();
            run.setId(1L);
            run.setChannel("AIRBNB");
            run.setPropertyId(42L);
            run.setOrganizationId(10L);
            run.setStatus("SUCCESS");
            run.setPmsDaysChecked(30);
            run.setChannelDaysChecked(30);
            run.setDiscrepanciesFound(0);
            run.setDiscrepanciesFixed(0);

            Page<ReconciliationRun> page = new PageImpl<>(List.of(run));
            when(reconciliationRunRepository.findFiltered(eq(42L), eq("SUCCESS"), any()))
                    .thenReturn(page);

            // Act
            Page<ReconciliationRunDto> result = service.getReconciliationRuns(42L, "SUCCESS", PageRequest.of(0, 20));

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).channel()).isEqualTo("AIRBNB");
            assertThat(result.getContent().get(0).status()).isEqualTo("SUCCESS");
        }
    }

    // ===== GET RECONCILIATION STATS =====

    @Nested
    @DisplayName("getReconciliationStats")
    class GetReconciliationStats {

        @Test
        @DisplayName("aggregates run counts and discrepancy totals")
        void whenCalled_thenAggregatesStats() {
            // Arrange
            when(reconciliationRunRepository.count()).thenReturn(50L);
            when(reconciliationRunRepository.countByStatus("SUCCESS")).thenReturn(40L);
            when(reconciliationRunRepository.countByStatus("FAILED")).thenReturn(5L);
            when(reconciliationRunRepository.countByStatus("DIVERGENCE")).thenReturn(5L);

            ReconciliationRun run1 = new ReconciliationRun();
            run1.setDiscrepanciesFound(10);
            run1.setDiscrepanciesFixed(8);
            ReconciliationRun run2 = new ReconciliationRun();
            run2.setDiscrepanciesFound(5);
            run2.setDiscrepanciesFixed(3);

            when(reconciliationRunRepository.findRecentPaged(PageRequest.of(0, 1000)))
                    .thenReturn(new PageImpl<>(List.of(run1, run2)));

            ReconciliationRun latest = new ReconciliationRun();
            latest.setStartedAt(LocalDateTime.of(2026, 2, 20, 14, 0));
            when(reconciliationRunRepository.findRecentPaged(PageRequest.of(0, 1)))
                    .thenReturn(new PageImpl<>(List.of(latest)));

            // Act
            ReconciliationStatsDto stats = service.getReconciliationStats();

            // Assert
            assertThat(stats.totalRuns()).isEqualTo(50L);
            assertThat(stats.successRuns()).isEqualTo(40L);
            assertThat(stats.failedRuns()).isEqualTo(5L);
            assertThat(stats.divergenceRuns()).isEqualTo(5L);
            assertThat(stats.totalDiscrepancies()).isEqualTo(15L);
            assertThat(stats.totalFixes()).isEqualTo(11L);
            assertThat(stats.lastRunAt()).contains("2026-02-20");
        }

        @Test
        @DisplayName("returns null lastRunAt when no runs exist")
        void whenNoRuns_thenLastRunAtIsNull() {
            // Arrange
            when(reconciliationRunRepository.count()).thenReturn(0L);
            when(reconciliationRunRepository.countByStatus(anyString())).thenReturn(0L);
            when(reconciliationRunRepository.findRecentPaged(PageRequest.of(0, 1000)))
                    .thenReturn(new PageImpl<>(List.of()));
            when(reconciliationRunRepository.findRecentPaged(PageRequest.of(0, 1)))
                    .thenReturn(new PageImpl<>(List.of()));

            // Act
            ReconciliationStatsDto stats = service.getReconciliationStats();

            // Assert
            assertThat(stats.lastRunAt()).isNull();
        }
    }

    // ===== TRIGGER RECONCILIATION =====

    @Nested
    @DisplayName("triggerReconciliation")
    class TriggerReconciliation {

        @Test
        @DisplayName("delegates to reconciliation service")
        void whenCalled_thenDelegatesToReconciliationService() {
            // Act
            service.triggerReconciliation(42L);

            // Assert
            verify(reconciliationService).reconcileProperty(42L);
        }
    }
}
