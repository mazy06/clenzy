package com.clenzy.controller;

import com.clenzy.dto.syncadmin.SyncAdminDtos.*;
import com.clenzy.service.SyncAdminService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SyncAdminControllerTest {

    @Mock private SyncAdminService syncAdminService;

    private SyncAdminController controller;

    @BeforeEach
    void setUp() {
        controller = new SyncAdminController(syncAdminService);
    }

    @Nested
    @DisplayName("connections")
    class Connections {
        @Test
        void whenGetConnections_thenReturnsOk() {
            when(syncAdminService.getConnections()).thenReturn(List.of());

            ResponseEntity<?> response = controller.getConnections();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenGetConnectionDetail_thenReturnsOk() {
            ConnectionDetailDto detail = mock(ConnectionDetailDto.class);
            when(syncAdminService.getConnectionDetail(1L)).thenReturn(Optional.of(detail));

            ResponseEntity<?> response = controller.getConnectionDetail(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenConnectionNotFound_thenReturns404() {
            when(syncAdminService.getConnectionDetail(1L)).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.getConnectionDetail(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        void whenForceHealthCheck_thenReturnsOk() {
            when(syncAdminService.forceHealthCheck(1L)).thenReturn("HEALTHY");

            ResponseEntity<?> response = controller.forceHealthCheck(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenHealthCheckNotFound_thenReturns404() {
            when(syncAdminService.forceHealthCheck(1L)).thenThrow(new IllegalArgumentException("Not found"));

            ResponseEntity<?> response = controller.forceHealthCheck(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("syncEvents")
    class SyncEvents {
        @Test
        void whenGetEvents_thenReturnsOk() {
            when(syncAdminService.getSyncEvents(any(), any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of()));

            ResponseEntity<?> response = controller.getSyncEvents(null, null, null, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenInvalidChannel_thenBadRequest() {
            ResponseEntity<?> response = controller.getSyncEvents("INVALID_CHANNEL", null, null, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenGetEventStats_thenReturnsOk() {
            SyncEventStatsDto stats = mock(SyncEventStatsDto.class);
            when(syncAdminService.getSyncEventStats()).thenReturn(stats);

            ResponseEntity<?> response = controller.getSyncEventStats();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("outbox")
    class Outbox {
        @Test
        void whenGetOutboxEvents_thenReturnsOk() {
            when(syncAdminService.getOutboxEvents(any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of()));

            ResponseEntity<?> response = controller.getOutboxEvents(null, null, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenGetOutboxStats_thenReturnsOk() {
            OutboxStatsDto stats = mock(OutboxStatsDto.class);
            when(syncAdminService.getOutboxStats()).thenReturn(stats);

            ResponseEntity<?> response = controller.getOutboxStats();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenBulkRetry_thenReturnsOk() {
            BulkRetryResultDto result = mock(BulkRetryResultDto.class);
            BulkRetryRequestDto request = mock(BulkRetryRequestDto.class);
            when(request.ids()).thenReturn(List.of(1L, 2L));
            when(syncAdminService.bulkRetryOutbox(List.of(1L, 2L))).thenReturn(result);

            ResponseEntity<?> response = controller.bulkRetryOutbox(request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("calendar")
    class Calendar {
        @Test
        void whenGetCommands_thenReturnsOk() {
            when(syncAdminService.getCalendarCommands(any(), any()))
                    .thenReturn(new PageImpl<>(List.of()));

            ResponseEntity<?> response = controller.getCalendarCommands(null, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenGetConflicts_thenReturnsOk() {
            when(syncAdminService.getCalendarConflicts()).thenReturn(List.of());

            ResponseEntity<?> response = controller.getCalendarConflicts();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("mappings")
    class Mappings {
        @Test
        void whenGetMappings_thenReturnsOk() {
            when(syncAdminService.getMappings(any())).thenReturn(new PageImpl<>(List.of()));

            ResponseEntity<?> response = controller.getMappings(0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenMappingFound_thenReturnsOk() {
            MappingSummaryDto mapping = mock(MappingSummaryDto.class);
            when(syncAdminService.getMappingDetail(1L)).thenReturn(Optional.of(mapping));

            ResponseEntity<?> response = controller.getMappingDetail(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenMappingNotFound_thenReturns404() {
            when(syncAdminService.getMappingDetail(1L)).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.getMappingDetail(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("diagnostics")
    class Diagnostics {
        @Test
        void whenGetDiagnostics_thenReturnsOk() {
            DiagnosticsSummaryDto diagnostics = mock(DiagnosticsSummaryDto.class);
            when(syncAdminService.getDiagnostics()).thenReturn(diagnostics);

            ResponseEntity<?> response = controller.getDiagnostics();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenGetMetrics_thenReturnsOk() {
            MetricsSnapshotDto metrics = mock(MetricsSnapshotDto.class);
            when(syncAdminService.getMetrics()).thenReturn(metrics);

            ResponseEntity<?> response = controller.getMetrics();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("reconciliation")
    class Reconciliation {
        @Test
        void whenGetRuns_thenReturnsOk() {
            when(syncAdminService.getReconciliationRuns(any(), any(), any()))
                    .thenReturn(new PageImpl<>(List.of()));

            ResponseEntity<?> response = controller.getReconciliationRuns(null, null, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenGetStats_thenReturnsOk() {
            ReconciliationStatsDto stats = mock(ReconciliationStatsDto.class);
            when(syncAdminService.getReconciliationStats()).thenReturn(stats);

            ResponseEntity<?> response = controller.getReconciliationStats();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenTrigger_thenReturnsOk() {
            ReconciliationTriggerRequestDto request = mock(ReconciliationTriggerRequestDto.class);
            when(request.propertyId()).thenReturn(1L);

            ResponseEntity<?> response = controller.triggerReconciliation(request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(syncAdminService).triggerReconciliation(1L);
        }

        @Test
        void whenTriggerNoPropertyId_thenBadRequest() {
            ReconciliationTriggerRequestDto request = mock(ReconciliationTriggerRequestDto.class);
            when(request.propertyId()).thenReturn(null);

            ResponseEntity<?> response = controller.triggerReconciliation(request);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }
}
