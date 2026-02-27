package com.clenzy.integration.expedia.service;

import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.CalendarLockException;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.service.AuditLogService;
import com.clenzy.service.CalendarEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpediaCalendarServiceTest {

    @Mock private ChannelMappingRepository channelMappingRepository;
    @Mock private ExpediaWebhookService webhookService;
    @Mock private AuditLogService auditLogService;
    @Mock private CalendarEngine calendarEngine;

    private ExpediaCalendarService service;

    private static final String EXPEDIA_PROPERTY_ID = "exp-prop-123";
    private static final String EVENT_ID = "evt-456";
    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 42L;

    @BeforeEach
    void setUp() {
        service = new ExpediaCalendarService(
                channelMappingRepository,
                webhookService,
                auditLogService,
                calendarEngine
        );
    }

    private Map<String, Object> buildEvent(String eventType, Map<String, Object> data) {
        Map<String, Object> event = new HashMap<>();
        event.put("event_type", eventType);
        event.put("event_id", EVENT_ID);
        if (data != null) {
            event.put("data", data);
        }
        return event;
    }

    private Map<String, Object> buildCalendarData() {
        Map<String, Object> data = new HashMap<>();
        data.put("property_id", EXPEDIA_PROPERTY_ID);
        data.put("organization_id", ORG_ID);
        data.put("start_date", "2025-09-01");
        data.put("end_date", "2025-09-10");
        return data;
    }

    private ChannelMapping buildMapping() {
        ChannelMapping mapping = new ChannelMapping();
        mapping.setInternalId(PROPERTY_ID);
        mapping.setExternalId(EXPEDIA_PROPERTY_ID);
        mapping.setOrganizationId(ORG_ID);
        return mapping;
    }

    private void stubMapping() {
        when(channelMappingRepository.findByExternalIdAndChannel(EXPEDIA_PROPERTY_ID, ChannelName.VRBO, ORG_ID))
                .thenReturn(Optional.of(buildMapping()));
    }

    // ===== AVAILABILITY UPDATED =====

    @Nested
    @DisplayName("availability.updated")
    class AvailabilityUpdated {

        @Test
        @DisplayName("updates price when price_per_night is present")
        void handleCalendarEvent_availabilityUpdated_updatesCalendar() {
            stubMapping();

            Map<String, Object> data = buildCalendarData();
            data.put("price_per_night", 120.0);
            Map<String, Object> event = buildEvent("availability.updated", data);

            service.handleCalendarEvent(event);

            verify(calendarEngine).updatePrice(
                    eq(PROPERTY_ID),
                    eq(LocalDate.of(2025, 9, 1)),
                    eq(LocalDate.of(2025, 9, 10)),
                    any(BigDecimal.class),
                    eq(ORG_ID),
                    eq("expedia-webhook")
            );
            verify(auditLogService).logSync(eq("ExpediaCalendar"), eq(EXPEDIA_PROPERTY_ID), anyString());
            verify(webhookService).markAsProcessed(EVENT_ID);
        }
    }

    // ===== AVAILABILITY BLOCKED =====

    @Nested
    @DisplayName("availability.blocked")
    class AvailabilityBlocked {

        @Test
        @DisplayName("blocks dates via CalendarEngine")
        void handleCalendarEvent_availabilityBlocked_blocksCalendar() {
            stubMapping();

            Map<String, Object> data = buildCalendarData();
            Map<String, Object> event = buildEvent("availability.blocked", data);

            service.handleCalendarEvent(event);

            verify(calendarEngine).block(
                    eq(PROPERTY_ID),
                    eq(LocalDate.of(2025, 9, 1)),
                    eq(LocalDate.of(2025, 9, 10)),
                    eq(ORG_ID),
                    eq("VRBO"),
                    anyString(),
                    eq("expedia-webhook")
            );
            verify(webhookService).markAsProcessed(EVENT_ID);
        }

        @Test
        @DisplayName("handles CalendarConflictException gracefully without rethrowing")
        void handleCalendarEvent_availabilityBlocked_conflictHandled() {
            stubMapping();

            doThrow(new CalendarConflictException(PROPERTY_ID, LocalDate.of(2025, 9, 1), LocalDate.of(2025, 9, 10), 1))
                    .when(calendarEngine).block(anyLong(), any(), any(), anyLong(), anyString(), anyString(), anyString());

            Map<String, Object> data = buildCalendarData();
            Map<String, Object> event = buildEvent("availability.blocked", data);

            // Should not throw -- conflict is caught
            service.handleCalendarEvent(event);

            verify(webhookService).markAsProcessed(EVENT_ID);
        }
    }

    // ===== AVAILABILITY UNBLOCKED =====

    @Nested
    @DisplayName("availability.unblocked")
    class AvailabilityUnblocked {

        @Test
        @DisplayName("unblocks dates via CalendarEngine")
        void handleCalendarEvent_availabilityUnblocked_unblocksCalendar() {
            stubMapping();

            Map<String, Object> data = buildCalendarData();
            Map<String, Object> event = buildEvent("availability.unblocked", data);

            service.handleCalendarEvent(event);

            verify(calendarEngine).unblock(
                    eq(PROPERTY_ID),
                    eq(LocalDate.of(2025, 9, 1)),
                    eq(LocalDate.of(2025, 9, 10)),
                    eq(ORG_ID),
                    eq("expedia-webhook")
            );
            verify(webhookService).markAsProcessed(EVENT_ID);
        }
    }

    // ===== RATE UPDATED =====

    @Nested
    @DisplayName("rate.updated")
    class RateUpdated {

        @Test
        @DisplayName("updates prices via CalendarEngine")
        void handleCalendarEvent_rateUpdated_updatesPrices() {
            stubMapping();

            Map<String, Object> data = buildCalendarData();
            data.put("price_per_night", "99.50");
            Map<String, Object> event = buildEvent("rate.updated", data);

            service.handleCalendarEvent(event);

            verify(calendarEngine).updatePrice(
                    eq(PROPERTY_ID),
                    eq(LocalDate.of(2025, 9, 1)),
                    eq(LocalDate.of(2025, 9, 10)),
                    any(BigDecimal.class),
                    eq(ORG_ID),
                    eq("expedia-webhook")
            );
            verify(auditLogService).logSync(eq("ExpediaRate"), eq(EXPEDIA_PROPERTY_ID), anyString());
            verify(webhookService).markAsProcessed(EVENT_ID);
        }

        @Test
        @DisplayName("skips when price_per_night is missing")
        void handleCalendarEvent_rateUpdated_missingPrice_skips() {
            stubMapping();

            Map<String, Object> data = buildCalendarData();
            // No price_per_night
            Map<String, Object> event = buildEvent("rate.updated", data);

            service.handleCalendarEvent(event);

            verifyNoInteractions(calendarEngine);
            verify(webhookService).markAsProcessed(EVENT_ID);
        }
    }

    // ===== MISSING DATA =====

    @Nested
    @DisplayName("Missing data field")
    class MissingData {

        @Test
        @DisplayName("marks event as failed when data is null")
        void handleCalendarEvent_missingData_marksFailed() {
            Map<String, Object> event = buildEvent("availability.updated", null);

            service.handleCalendarEvent(event);

            verify(webhookService).markAsFailed(eq(EVENT_ID), anyString());
            verifyNoInteractions(calendarEngine);
        }
    }

    // ===== UNMAPPED PROPERTY =====

    @Nested
    @DisplayName("Unmapped property")
    class UnmappedProperty {

        @Test
        @DisplayName("skips and marks as processed when mapping not found")
        void handleCalendarEvent_unmappedProperty_skips() {
            when(channelMappingRepository.findByExternalIdAndChannel(EXPEDIA_PROPERTY_ID, ChannelName.VRBO, ORG_ID))
                    .thenReturn(Optional.empty());

            Map<String, Object> data = buildCalendarData();
            Map<String, Object> event = buildEvent("availability.updated", data);

            service.handleCalendarEvent(event);

            verifyNoInteractions(calendarEngine);
            verify(webhookService).markAsProcessed(EVENT_ID);
        }
    }

    // ===== LOCK PROPAGATION =====

    @Nested
    @DisplayName("CalendarLockException propagation")
    class LockPropagation {

        @Test
        @DisplayName("propagates CalendarLockException for Kafka retry")
        void handleCalendarEvent_lockException_propagates() {
            stubMapping();

            doThrow(new CalendarLockException(PROPERTY_ID))
                    .when(calendarEngine).unblock(anyLong(), any(), any(), anyLong(), anyString());

            Map<String, Object> data = buildCalendarData();
            Map<String, Object> event = buildEvent("availability.unblocked", data);

            assertThatThrownBy(() -> service.handleCalendarEvent(event))
                    .isInstanceOf(CalendarLockException.class);
        }
    }
}
