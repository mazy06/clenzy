package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.integration.channel.model.ChannelCalendarDay;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditSource;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.ReconciliationRun;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.ReconciliationRunRepository;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class ReconciliationServiceTest {

    @Mock private ChannelMappingRepository mappingRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private ChannelConnectorRegistry connectorRegistry;
    @Mock private ReconciliationRunRepository reconciliationRunRepository;
    @Mock private SyncMetrics syncMetrics;
    @Mock private NotificationService notificationService;
    @Mock private AuditLogService auditLogService;
    @Mock private ObjectMapper objectMapper;

    private ReconciliationService service;

    // Test fixtures
    private ChannelMapping mapping;
    private ChannelConnection connection;
    @Mock private ChannelConnector connector;

    @BeforeEach
    void setUp() {
        service = new ReconciliationService(
                mappingRepository,
                calendarDayRepository,
                connectorRegistry,
                reconciliationRunRepository,
                syncMetrics,
                notificationService,
                auditLogService,
                objectMapper
        );

        connection = new ChannelConnection(1L, ChannelName.AIRBNB);
        mapping = new ChannelMapping(connection, 42L, "ext-123", 1L);
        mapping.setId(100L);

        // Default: save returns the run as-is (lenient because not all tests trigger save)
        lenient().when(reconciliationRunRepository.save(any(ReconciliationRun.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    // ── Helper methods ───────────────────────────────────────────────────────

    private ChannelCalendarDay channelDay(LocalDate date, String status) {
        return new ChannelCalendarDay(date, status, null);
    }

    private CalendarDay pmsDay(LocalDate date, CalendarDayStatus status) {
        CalendarDay cd = new CalendarDay();
        cd.setDate(date);
        cd.setStatus(status);
        return cd;
    }

    // ── reconcileMapping ─────────────────────────────────────────────────────

    @Nested
    class ReconcileMappingTests {

        @Test
        void reconcileMapping_connectorNotFound_returnsFailed() {
            // Arrange
            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.empty());

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert
            assertThat(run.getStatus()).isEqualTo("FAILED");
            assertThat(run.getErrorMessage()).contains("Connector not found");
            verify(syncMetrics).incrementReconciliationRuns();
            verify(reconciliationRunRepository, times(2)).save(any());
        }

        @Test
        void reconcileMapping_emptyChannelDays_returnsSuccessWithoutComparison() {
            // Arrange
            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(LocalDate.class), any(LocalDate.class)))
                    .thenReturn(List.of());

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert
            assertThat(run.getStatus()).isEqualTo("SUCCESS");
            assertThat(run.getChannelDaysChecked()).isZero();
            assertThat(run.getPmsDaysChecked()).isZero();
            assertThat(run.getDiscrepanciesFound()).isZero();
            verifyNoInteractions(calendarDayRepository);
        }

        @Test
        void reconcileMapping_noDiscrepancies_returnsSuccess() {
            // Arrange
            LocalDate today = LocalDate.now();
            LocalDate tomorrow = today.plusDays(1);

            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenReturn(List.of(
                            channelDay(today, "AVAILABLE"),
                            channelDay(tomorrow, "BOOKED")
                    ));
            when(calendarDayRepository.findByPropertyAndDateRange(eq(42L), any(), any(), eq(1L)))
                    .thenReturn(List.of(
                            pmsDay(today, CalendarDayStatus.AVAILABLE),
                            pmsDay(tomorrow, CalendarDayStatus.BOOKED)
                    ));

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert
            assertThat(run.getStatus()).isEqualTo("SUCCESS");
            assertThat(run.getDiscrepanciesFound()).isZero();
            assertThat(run.getDiscrepanciesFixed()).isZero();
            assertThat(run.getChannelDaysChecked()).isEqualTo(2);
            assertThat(run.getPmsDaysChecked()).isEqualTo(2);
            verify(connector, never()).pushCalendarUpdate(anyLong(), any(), any(), anyLong());
        }

        @Test
        void reconcileMapping_discrepanciesFound_pushesPmsToChannelAndFixes() {
            // Arrange: 1 discrepancy out of 30 days = 3.33% < 5% threshold => SUCCESS
            LocalDate today = LocalDate.now();
            List<ChannelCalendarDay> channelDays = new java.util.ArrayList<>();
            List<CalendarDay> pmsDays = new java.util.ArrayList<>();

            // Day 0: discrepancy (channel says BOOKED, PMS says AVAILABLE)
            channelDays.add(channelDay(today, "BOOKED"));
            pmsDays.add(pmsDay(today, CalendarDayStatus.AVAILABLE));

            // Days 1-29: matching
            for (int i = 1; i < 30; i++) {
                LocalDate d = today.plusDays(i);
                channelDays.add(channelDay(d, "AVAILABLE"));
                pmsDays.add(pmsDay(d, CalendarDayStatus.AVAILABLE));
            }

            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenReturn(channelDays);
            when(calendarDayRepository.findByPropertyAndDateRange(eq(42L), any(), any(), eq(1L)))
                    .thenReturn(pmsDays);
            when(connector.pushCalendarUpdate(eq(42L), eq(today), eq(today.plusDays(1)), eq(1L)))
                    .thenReturn(SyncResult.success(1, 100));

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert
            assertThat(run.getStatus()).isEqualTo("SUCCESS");
            assertThat(run.getDiscrepanciesFound()).isEqualTo(1);
            assertThat(run.getDiscrepanciesFixed()).isEqualTo(1);
            verify(connector).pushCalendarUpdate(eq(42L), eq(today), eq(today.plusDays(1)), eq(1L));
            verify(syncMetrics).incrementReconciliationDiscrepancies(1);
            verify(syncMetrics).incrementReconciliationFixes(1);
        }

        @Test
        void reconcileMapping_highDivergence_returnsDivergenceStatusAndAlerts() {
            // Arrange: >5% divergence requires > 5% of channel days to have discrepancies
            // With 10 channel days and 1 discrepancy = 10%, that exceeds the 5% threshold
            LocalDate today = LocalDate.now();
            List<ChannelCalendarDay> channelDays = new java.util.ArrayList<>();
            List<CalendarDay> pmsDays = new java.util.ArrayList<>();

            // 1 discrepancy out of 10 = 10% divergence
            channelDays.add(channelDay(today, "BOOKED"));
            pmsDays.add(pmsDay(today, CalendarDayStatus.AVAILABLE));

            for (int i = 1; i < 10; i++) {
                LocalDate d = today.plusDays(i);
                channelDays.add(channelDay(d, "AVAILABLE"));
                pmsDays.add(pmsDay(d, CalendarDayStatus.AVAILABLE));
            }

            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenReturn(channelDays);
            when(calendarDayRepository.findByPropertyAndDateRange(eq(42L), any(), any(), eq(1L)))
                    .thenReturn(pmsDays);
            when(connector.pushCalendarUpdate(anyLong(), any(), any(), anyLong()))
                    .thenReturn(SyncResult.success(1, 50));

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert
            assertThat(run.getStatus()).isEqualTo("DIVERGENCE");
            assertThat(run.getDivergencePct().doubleValue()).isGreaterThan(5.0);
            assertThat(run.getDiscrepanciesFound()).isEqualTo(1);
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.RECONCILIATION_DIVERGENCE_HIGH),
                    anyString(),
                    anyString(),
                    eq("/admin/sync")
            );
        }

        @Test
        void reconcileMapping_pushFixFailure_fixesStayAtZero() {
            // Arrange
            LocalDate today = LocalDate.now();

            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenReturn(List.of(channelDay(today, "BOOKED")));
            when(calendarDayRepository.findByPropertyAndDateRange(eq(42L), any(), any(), eq(1L)))
                    .thenReturn(List.of(pmsDay(today, CalendarDayStatus.AVAILABLE)));
            when(connector.pushCalendarUpdate(anyLong(), any(), any(), anyLong()))
                    .thenReturn(SyncResult.failed("Push failed"));

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert
            assertThat(run.getDiscrepanciesFound()).isEqualTo(1);
            assertThat(run.getDiscrepanciesFixed()).isZero();
            verify(syncMetrics).incrementReconciliationDiscrepancies(1);
            verify(syncMetrics, never()).incrementReconciliationFixes(anyLong());
        }

        @Test
        void reconcileMapping_pushThrowsException_fixesStayAtZero() {
            // Arrange
            LocalDate today = LocalDate.now();

            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenReturn(List.of(channelDay(today, "BOOKED")));
            when(calendarDayRepository.findByPropertyAndDateRange(eq(42L), any(), any(), eq(1L)))
                    .thenReturn(List.of(pmsDay(today, CalendarDayStatus.AVAILABLE)));
            when(connector.pushCalendarUpdate(anyLong(), any(), any(), anyLong()))
                    .thenThrow(new RuntimeException("Network error"));

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert
            assertThat(run.getDiscrepanciesFound()).isEqualTo(1);
            assertThat(run.getDiscrepanciesFixed()).isZero();
        }

        @Test
        void reconcileMapping_exceptionDuringReconciliation_returnsFailedAndNotifies() {
            // Arrange
            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenThrow(new RuntimeException("Channel API error"));

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert
            assertThat(run.getStatus()).isEqualTo("FAILED");
            assertThat(run.getErrorMessage()).contains("Channel API error");
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.RECONCILIATION_FAILED),
                    anyString(),
                    contains("Channel API error"),
                    eq("/admin/sync")
            );
        }

        @Test
        void reconcileMapping_notificationFailure_doesNotPropagateException() {
            // Arrange
            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenThrow(new RuntimeException("Channel error"));
            doThrow(new RuntimeException("Notification error"))
                    .when(notificationService).notifyAdminsAndManagers(any(), anyString(), anyString(), anyString());

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert - should still return FAILED, not propagate notification exception
            assertThat(run.getStatus()).isEqualTo("FAILED");
        }

        @Test
        void reconcileMapping_auditsReconciliationResult() {
            // Arrange
            LocalDate today = LocalDate.now();

            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenReturn(List.of(channelDay(today, "AVAILABLE")));
            when(calendarDayRepository.findByPropertyAndDateRange(eq(42L), any(), any(), eq(1L)))
                    .thenReturn(List.of(pmsDay(today, CalendarDayStatus.AVAILABLE)));

            // Act
            service.reconcileMapping(mapping);

            // Assert
            verify(auditLogService).logAction(
                    eq(AuditAction.RECONCILIATION),
                    eq("PROPERTY"),
                    eq("42"),
                    isNull(),
                    eq("SUCCESS"),
                    anyString(),
                    eq(AuditSource.CRON)
            );
        }

        @Test
        void reconcileMapping_channelStatusNormalization_matchesPms() {
            // Arrange: channel uses "RESERVED" which normalizes to "BOOKED"
            LocalDate today = LocalDate.now();

            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenReturn(List.of(channelDay(today, "RESERVED")));
            when(calendarDayRepository.findByPropertyAndDateRange(eq(42L), any(), any(), eq(1L)))
                    .thenReturn(List.of(pmsDay(today, CalendarDayStatus.BOOKED)));

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert - "RESERVED" normalizes to "BOOKED" so no discrepancy
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void reconcileMapping_missingPmsDay_defaultsToAvailable() {
            // Arrange: channel has a day but PMS has no record for it
            LocalDate today = LocalDate.now();

            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenReturn(List.of(channelDay(today, "AVAILABLE")));
            when(calendarDayRepository.findByPropertyAndDateRange(eq(42L), any(), any(), eq(1L)))
                    .thenReturn(List.of()); // no PMS data

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert - default PMS status is AVAILABLE, channel is AVAILABLE => no discrepancy
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void reconcileMapping_lowDivergence_returnsSuccess() {
            // Arrange: 1 discrepancy out of 30 = 3.33% < 5% threshold
            LocalDate today = LocalDate.now();
            List<ChannelCalendarDay> channelDays = new java.util.ArrayList<>();
            List<CalendarDay> pmsDays = new java.util.ArrayList<>();

            // First day is a discrepancy
            channelDays.add(channelDay(today, "BOOKED"));
            pmsDays.add(pmsDay(today, CalendarDayStatus.AVAILABLE));

            // Remaining 29 days match
            for (int i = 1; i < 30; i++) {
                LocalDate d = today.plusDays(i);
                channelDays.add(channelDay(d, "AVAILABLE"));
                pmsDays.add(pmsDay(d, CalendarDayStatus.AVAILABLE));
            }

            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenReturn(channelDays);
            when(calendarDayRepository.findByPropertyAndDateRange(eq(42L), any(), any(), eq(1L)))
                    .thenReturn(pmsDays);
            when(connector.pushCalendarUpdate(anyLong(), any(), any(), anyLong()))
                    .thenReturn(SyncResult.success(1, 50));

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert - < 5% divergence, so SUCCESS not DIVERGENCE
            assertThat(run.getStatus()).isEqualTo("SUCCESS");
            assertThat(run.getDiscrepanciesFound()).isEqualTo(1);
            assertThat(run.getDivergencePct().doubleValue()).isLessThan(5.0);
            verify(notificationService, never()).notifyAdminsAndManagers(
                    eq(NotificationKey.RECONCILIATION_DIVERGENCE_HIGH), anyString(), anyString(), anyString());
        }

        @Test
        void reconcileMapping_serializesDiscrepancyDetailsAsJson() throws Exception {
            // Arrange
            LocalDate today = LocalDate.now();

            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenReturn(List.of(channelDay(today, "BOOKED")));
            when(calendarDayRepository.findByPropertyAndDateRange(eq(42L), any(), any(), eq(1L)))
                    .thenReturn(List.of(pmsDay(today, CalendarDayStatus.AVAILABLE)));
            when(connector.pushCalendarUpdate(anyLong(), any(), any(), anyLong()))
                    .thenReturn(SyncResult.failed("Push failed"));
            when(objectMapper.writeValueAsString(anyList()))
                    .thenReturn("[{\"date\":\"" + today + "\",\"pmsStatus\":\"AVAILABLE\",\"channelStatus\":\"BOOKED\"}]");

            // Act
            ReconciliationRun run = service.reconcileMapping(mapping);

            // Assert
            assertThat(run.getDetails()).contains("AVAILABLE").contains("BOOKED");
            verify(objectMapper).writeValueAsString(anyList());
        }
    }

    // ── scheduledReconciliation ──────────────────────────────────────────────

    @Nested
    class ScheduledReconciliationTests {

        @Test
        void scheduledReconciliation_noActiveMappings_completesWithoutError() {
            // Arrange
            when(mappingRepository.findAllActiveCrossOrg()).thenReturn(List.of());

            // Act
            service.scheduledReconciliation();

            // Assert
            verify(mappingRepository).findAllActiveCrossOrg();
            verifyNoInteractions(connectorRegistry);
        }

        @Test
        void scheduledReconciliation_multipleActiveMappings_reconcilesEach() {
            // Arrange
            ChannelMapping mapping2 = new ChannelMapping(connection, 43L, "ext-456", 1L);
            mapping2.setId(101L);

            when(mappingRepository.findAllActiveCrossOrg()).thenReturn(List.of(mapping, mapping2));
            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(any(), any(), any()))
                    .thenReturn(List.of());

            // Act
            service.scheduledReconciliation();

            // Assert
            verify(connectorRegistry, times(2)).getConnector(ChannelName.AIRBNB);
        }

        @Test
        void scheduledReconciliation_exceptionOnOneMapping_continuesWithOthers() {
            // Arrange
            ChannelConnection connection2 = new ChannelConnection(1L, ChannelName.BOOKING);
            ChannelMapping mapping2 = new ChannelMapping(connection2, 43L, "ext-456", 1L);
            mapping2.setId(101L);

            @SuppressWarnings("unchecked")
            ChannelConnector connector2 = mock(ChannelConnector.class);

            when(mappingRepository.findAllActiveCrossOrg()).thenReturn(List.of(mapping, mapping2));

            // First mapping's connector throws
            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(any(), any(), any()))
                    .thenThrow(new RuntimeException("API down"));

            // Second mapping's connector works fine
            when(connectorRegistry.getConnector(ChannelName.BOOKING))
                    .thenReturn(Optional.of(connector2));
            when(connector2.getChannelCalendar(any(), any(), any()))
                    .thenReturn(List.of());

            // Act - should not throw
            service.scheduledReconciliation();

            // Assert - both were attempted
            verify(connectorRegistry).getConnector(ChannelName.AIRBNB);
            verify(connectorRegistry).getConnector(ChannelName.BOOKING);
        }
    }

    // ── reconcileProperty ────────────────────────────────────────────────────

    @Nested
    class ReconcilePropertyTests {

        @Test
        void reconcileProperty_noMappingsForProperty_returnsEarly() {
            // Arrange
            when(mappingRepository.findAllActiveCrossOrg()).thenReturn(List.of(mapping));
            // mapping has internalId=42, we query for 99

            // Act
            service.reconcileProperty(99L);

            // Assert
            verifyNoInteractions(connectorRegistry);
        }

        @Test
        void reconcileProperty_matchingMappings_reconcilesEach() {
            // Arrange
            ChannelConnection conn2 = new ChannelConnection(1L, ChannelName.BOOKING);
            ChannelMapping mapping2 = new ChannelMapping(conn2, 42L, "ext-789", 1L);
            mapping2.setId(102L);

            @SuppressWarnings("unchecked")
            ChannelConnector connector2 = mock(ChannelConnector.class);

            when(mappingRepository.findAllActiveCrossOrg()).thenReturn(List.of(mapping, mapping2));
            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connectorRegistry.getConnector(ChannelName.BOOKING))
                    .thenReturn(Optional.of(connector2));
            when(connector.getChannelCalendar(any(), any(), any())).thenReturn(List.of());
            when(connector2.getChannelCalendar(any(), any(), any())).thenReturn(List.of());

            // Act
            service.reconcileProperty(42L);

            // Assert - both mappings reconciled
            verify(connectorRegistry).getConnector(ChannelName.AIRBNB);
            verify(connectorRegistry).getConnector(ChannelName.BOOKING);
        }

        @Test
        void reconcileProperty_exceptionOnOneMapping_continuesWithOthers() {
            // Arrange
            ChannelConnection conn2 = new ChannelConnection(1L, ChannelName.BOOKING);
            ChannelMapping mapping2 = new ChannelMapping(conn2, 42L, "ext-789", 1L);
            mapping2.setId(103L);

            @SuppressWarnings("unchecked")
            ChannelConnector connector2 = mock(ChannelConnector.class);

            when(mappingRepository.findAllActiveCrossOrg()).thenReturn(List.of(mapping, mapping2));
            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(any(), any(), any()))
                    .thenThrow(new RuntimeException("Airbnb API down"));
            when(connectorRegistry.getConnector(ChannelName.BOOKING))
                    .thenReturn(Optional.of(connector2));
            when(connector2.getChannelCalendar(any(), any(), any()))
                    .thenReturn(List.of());

            // Act - should not throw
            service.reconcileProperty(42L);

            // Assert - second mapping was still processed
            verify(connectorRegistry).getConnector(ChannelName.BOOKING);
        }
    }

    // ── normalizeStatus (tested indirectly via reconcileMapping) ─────────────

    @Nested
    class NormalizeStatusTests {

        private ReconciliationRun reconcileWithChannelStatus(String channelStatus, CalendarDayStatus pmsStatus) {
            LocalDate today = LocalDate.now();

            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connector));
            when(connector.getChannelCalendar(eq(mapping), any(), any()))
                    .thenReturn(List.of(channelDay(today, channelStatus)));
            when(calendarDayRepository.findByPropertyAndDateRange(eq(42L), any(), any(), eq(1L)))
                    .thenReturn(List.of(pmsDay(today, pmsStatus)));

            return service.reconcileMapping(mapping);
        }

        @Test
        void normalizeStatus_available_mapsToAvailable() {
            ReconciliationRun run = reconcileWithChannelStatus("AVAILABLE", CalendarDayStatus.AVAILABLE);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void normalizeStatus_free_mapsToAvailable() {
            ReconciliationRun run = reconcileWithChannelStatus("FREE", CalendarDayStatus.AVAILABLE);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void normalizeStatus_open_mapsToAvailable() {
            ReconciliationRun run = reconcileWithChannelStatus("OPEN", CalendarDayStatus.AVAILABLE);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void normalizeStatus_booked_mapsToBooked() {
            ReconciliationRun run = reconcileWithChannelStatus("BOOKED", CalendarDayStatus.BOOKED);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void normalizeStatus_reserved_mapsToBooked() {
            ReconciliationRun run = reconcileWithChannelStatus("RESERVED", CalendarDayStatus.BOOKED);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void normalizeStatus_occupied_mapsToBooked() {
            ReconciliationRun run = reconcileWithChannelStatus("OCCUPIED", CalendarDayStatus.BOOKED);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void normalizeStatus_blocked_mapsToBlocked() {
            ReconciliationRun run = reconcileWithChannelStatus("BLOCKED", CalendarDayStatus.BLOCKED);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void normalizeStatus_closed_mapsToBlocked() {
            ReconciliationRun run = reconcileWithChannelStatus("CLOSED", CalendarDayStatus.BLOCKED);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void normalizeStatus_unavailable_mapsToBlocked() {
            ReconciliationRun run = reconcileWithChannelStatus("UNAVAILABLE", CalendarDayStatus.BLOCKED);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void normalizeStatus_maintenance_mapsToMaintenance() {
            ReconciliationRun run = reconcileWithChannelStatus("MAINTENANCE", CalendarDayStatus.MAINTENANCE);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void normalizeStatus_unknown_defaultsToAvailable() {
            ReconciliationRun run = reconcileWithChannelStatus("SOMETHING_ELSE", CalendarDayStatus.AVAILABLE);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void normalizeStatus_null_defaultsToAvailable() {
            ReconciliationRun run = reconcileWithChannelStatus(null, CalendarDayStatus.AVAILABLE);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }

        @Test
        void normalizeStatus_caseInsensitive_lowercaseBooked() {
            ReconciliationRun run = reconcileWithChannelStatus("booked", CalendarDayStatus.BOOKED);
            assertThat(run.getDiscrepanciesFound()).isZero();
        }
    }
}
