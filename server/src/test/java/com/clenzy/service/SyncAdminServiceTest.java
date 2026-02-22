package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.dto.syncadmin.SyncAdminDtos.*;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.HealthStatus;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelConnectionRepository;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.channel.repository.ChannelSyncLogRepository;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.OutboxEvent;
import com.clenzy.repository.CalendarCommandRepository;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.OutboxEventRepository;
import com.clenzy.repository.ReconciliationRunRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
    class GetConnections {

        @Test
        void whenConnectionsExist_thenReturnsSummaries() {
            ChannelConnection cc = new ChannelConnection();
            cc.setId(1L);
            cc.setChannel(ChannelName.AIRBNB);
            cc.setStatus("ACTIVE");

            when(connectionRepository.findAllCrossOrg()).thenReturn(List.of(cc));
            when(mappingRepository.countByConnectionId(1L)).thenReturn(3L);
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

            List<ConnectionSummaryDto> result = service.getConnections();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).channel()).isEqualTo("AIRBNB");
            assertThat(result.get(0).mappingCount()).isEqualTo(3);
        }

        @Test
        void whenNoConnections_thenReturnsEmpty() {
            when(connectionRepository.findAllCrossOrg()).thenReturn(List.of());

            List<ConnectionSummaryDto> result = service.getConnections();

            assertThat(result).isEmpty();
        }
    }

    // ===== GET CONNECTION DETAIL =====

    @Nested
    class GetConnectionDetail {

        @Test
        void whenExists_thenReturnsDetail() {
            ChannelConnection cc = new ChannelConnection();
            cc.setId(1L);
            cc.setChannel(ChannelName.AIRBNB);
            cc.setStatus("ACTIVE");
            cc.setOrganizationId(10L);

            when(connectionRepository.findById(1L)).thenReturn(Optional.of(cc));
            when(mappingRepository.countByConnectionId(1L)).thenReturn(2L);
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

            Optional<ConnectionDetailDto> result = service.getConnectionDetail(1L);

            assertThat(result).isPresent();
            assertThat(result.get().channel()).isEqualTo("AIRBNB");
        }

        @Test
        void whenNotFound_thenReturnsEmpty() {
            when(connectionRepository.findById(99L)).thenReturn(Optional.empty());

            Optional<ConnectionDetailDto> result = service.getConnectionDetail(99L);

            assertThat(result).isEmpty();
        }
    }

    // ===== FORCE HEALTH CHECK =====

    @Nested
    class ForceHealthCheck {

        @Test
        void whenConnectionNotFound_thenThrows() {
            when(connectionRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.forceHealthCheck(99L))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenConnectorPresent_thenReturnsHealthStatus() {
            ChannelConnection cc = new ChannelConnection();
            cc.setId(1L);
            cc.setChannel(ChannelName.AIRBNB);

            ChannelConnector connector = mock(ChannelConnector.class);
            when(connector.checkHealth(1L)).thenReturn(HealthStatus.HEALTHY);

            when(connectionRepository.findById(1L)).thenReturn(Optional.of(cc));
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));

            String result = service.forceHealthCheck(1L);

            assertThat(result).isEqualTo("HEALTHY");
        }

        @Test
        void whenNoConnector_thenReturnsUnknown() {
            ChannelConnection cc = new ChannelConnection();
            cc.setId(1L);
            cc.setChannel(ChannelName.AIRBNB);

            when(connectionRepository.findById(1L)).thenReturn(Optional.of(cc));
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

            String result = service.forceHealthCheck(1L);

            assertThat(result).isEqualTo("UNKNOWN");
        }
    }

    // ===== OUTBOX STATS =====

    @Nested
    class OutboxStats {

        @Test
        void whenCalled_thenAggregatesCounts() {
            when(outboxEventRepository.countByStatusStr("PENDING")).thenReturn(5L);
            when(outboxEventRepository.countByStatusStr("SENT")).thenReturn(100L);
            when(outboxEventRepository.countByStatusStr("FAILED")).thenReturn(2L);

            OutboxStatsDto stats = service.getOutboxStats();

            assertThat(stats.pending()).isEqualTo(5L);
            assertThat(stats.sent()).isEqualTo(100L);
            assertThat(stats.failed()).isEqualTo(2L);
            assertThat(stats.total()).isEqualTo(107L);
        }
    }

    // ===== BULK RETRY OUTBOX =====

    @Nested
    class BulkRetryOutbox {

        @Test
        void whenEventsFound_thenResetsTooPending() {
            OutboxEvent e1 = new OutboxEvent();
            e1.setId(1L);
            e1.setStatus("FAILED");
            e1.setRetryCount(3);

            OutboxEvent e2 = new OutboxEvent();
            e2.setId(2L);
            e2.setStatus("FAILED");
            e2.setRetryCount(1);

            when(outboxEventRepository.findAllById(List.of(1L, 2L))).thenReturn(List.of(e1, e2));

            BulkRetryResultDto result = service.bulkRetryOutbox(List.of(1L, 2L));

            assertThat(result.retried()).isEqualTo(2);
            assertThat(result.failedIds()).isEmpty();
            assertThat(e1.getStatus()).isEqualTo("PENDING");
            assertThat(e1.getRetryCount()).isEqualTo(0);
        }

        @Test
        void whenSomeIdsNotFound_thenReportsFailedIds() {
            OutboxEvent e1 = new OutboxEvent();
            e1.setId(1L);
            e1.setStatus("FAILED");

            when(outboxEventRepository.findAllById(List.of(1L, 99L))).thenReturn(List.of(e1));

            BulkRetryResultDto result = service.bulkRetryOutbox(List.of(1L, 99L));

            assertThat(result.retried()).isEqualTo(1);
            assertThat(result.failedIds()).containsExactly(99L);
        }
    }

    // ===== CALENDAR CONFLICTS =====

    @Nested
    class CalendarConflicts {

        @Test
        void whenOrphanedDays_thenReturnsConflictDtos() {
            CalendarDay cd = new CalendarDay();
            cd.setId(1L);
            cd.setOrganizationId(10L);

            when(calendarDayRepository.findOrphanedBookedDays()).thenReturn(List.of(cd));

            List<CalendarConflictDto> conflicts = service.getCalendarConflicts();

            assertThat(conflicts).hasSize(1);
        }

        @Test
        void whenNoOrphans_thenReturnsEmpty() {
            when(calendarDayRepository.findOrphanedBookedDays()).thenReturn(List.of());

            List<CalendarConflictDto> conflicts = service.getCalendarConflicts();

            assertThat(conflicts).isEmpty();
        }
    }

    // ===== TRIGGER RECONCILIATION =====

    @Nested
    class TriggerReconciliation {

        @Test
        void whenCalled_thenDelegatesToReconciliationService() {
            service.triggerReconciliation(42L);

            verify(reconciliationService).reconcileProperty(42L);
        }
    }
}
