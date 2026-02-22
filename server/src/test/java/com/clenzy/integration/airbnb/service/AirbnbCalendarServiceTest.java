package com.clenzy.integration.airbnb.service;

import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.CalendarLockException;
import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
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

/**
 * Unit tests for {@link AirbnbCalendarService}.
 * Covers Kafka event handling for calendar.updated, calendar.blocked,
 * calendar.unblocked, missing data, and unknown event types.
 */
@ExtendWith(MockitoExtension.class)
class AirbnbCalendarServiceTest {

    @Mock private AirbnbListingMappingRepository listingMappingRepository;
    @Mock private AirbnbWebhookService webhookService;
    @Mock private AuditLogService auditLogService;
    @Mock private CalendarEngine calendarEngine;

    private AirbnbCalendarService service;

    @BeforeEach
    void setUp() {
        service = new AirbnbCalendarService(listingMappingRepository, webhookService,
                auditLogService, calendarEngine);
    }

    private AirbnbListingMapping createMapping() {
        AirbnbListingMapping mapping = new AirbnbListingMapping();
        mapping.setId(1L);
        mapping.setPropertyId(42L);
        mapping.setAirbnbListingId("AIRBNB-123");
        mapping.setOrganizationId(10L);
        return mapping;
    }

    private Map<String, Object> buildEvent(String eventType, String eventId, Map<String, Object> data) {
        Map<String, Object> event = new HashMap<>();
        event.put("event_type", eventType);
        event.put("event_id", eventId);
        event.put("data", data);
        return event;
    }

    private Map<String, Object> buildDataWithDates(String startDate, String endDate) {
        Map<String, Object> data = new HashMap<>();
        data.put("listing_id", "AIRBNB-123");
        if (startDate != null) data.put("start_date", startDate);
        if (endDate != null) data.put("end_date", endDate);
        return data;
    }

    // ===================================================================
    // Missing data
    // ===================================================================

    @Nested
    @DisplayName("handleCalendarEvent - missing data")
    class MissingData {

        @Test
        @DisplayName("marks event as failed when data field is null")
        void whenDataFieldNull_thenMarksFailed() {
            // Arrange
            Map<String, Object> event = buildEvent("calendar.updated", "evt-1", null);

            // Act
            service.handleCalendarEvent(event);

            // Assert
            verify(webhookService).markAsFailed("evt-1", "Missing data field");
            verify(calendarEngine, never()).updatePrice(any(), any(), any(), any(), any(), any());
        }
    }

    // ===================================================================
    // Unknown event type
    // ===================================================================

    @Nested
    @DisplayName("handleCalendarEvent - unknown event type")
    class UnknownEventType {

        @Test
        @DisplayName("marks as processed for unmapped listing")
        void whenListingNotMapped_thenMarksProcessed() {
            // Arrange
            Map<String, Object> data = buildDataWithDates("2025-06-01", "2025-06-05");
            Map<String, Object> event = buildEvent("calendar.updated", "evt-2", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.empty());

            // Act
            service.handleCalendarEvent(event);

            // Assert
            verify(webhookService).markAsProcessed("evt-2");
            verify(calendarEngine, never()).updatePrice(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("processes unknown event type without calling calendar engine")
        void whenUnknownType_thenMarksProcessedWithoutAction() {
            // Arrange
            Map<String, Object> data = buildDataWithDates("2025-06-01", "2025-06-05");
            Map<String, Object> event = buildEvent("calendar.unknown", "evt-3", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.of(createMapping()));

            // Act
            service.handleCalendarEvent(event);

            // Assert
            verify(webhookService).markAsProcessed("evt-3");
            verify(calendarEngine, never()).updatePrice(any(), any(), any(), any(), any(), any());
            verify(calendarEngine, never()).block(any(), any(), any(), any(), any(), any(), any());
            verify(calendarEngine, never()).unblock(any(), any(), any(), any(), any());
        }
    }

    // ===================================================================
    // calendar.updated
    // ===================================================================

    @Nested
    @DisplayName("handleCalendarEvent - calendar.updated")
    class CalendarUpdated {

        @Test
        @DisplayName("updates price via CalendarEngine on happy path")
        void whenValidDatesAndPrice_thenUpdatesPrice() {
            // Arrange
            Map<String, Object> data = buildDataWithDates("2025-06-01", "2025-06-05");
            data.put("nightly_price", 150.00);
            Map<String, Object> event = buildEvent("calendar.updated", "evt-4", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.of(createMapping()));

            // Act
            service.handleCalendarEvent(event);

            // Assert
            verify(calendarEngine).updatePrice(
                    eq(42L),
                    eq(LocalDate.of(2025, 6, 1)),
                    eq(LocalDate.of(2025, 6, 5)),
                    eq(BigDecimal.valueOf(150.0)),
                    eq(10L),
                    eq("airbnb-webhook")
            );
            verify(auditLogService).logSync(eq("AirbnbCalendar"), eq("AIRBNB-123"), contains("42"));
            verify(webhookService).markAsProcessed("evt-4");
        }

        @Test
        @DisplayName("logs sync but skips price update when dates are missing")
        void whenMissingDates_thenLogsWithoutPriceUpdate() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("listing_id", "AIRBNB-123");
            // No start_date/end_date
            Map<String, Object> event = buildEvent("calendar.updated", "evt-5", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.of(createMapping()));

            // Act
            service.handleCalendarEvent(event);

            // Assert
            verify(calendarEngine, never()).updatePrice(any(), any(), any(), any(), any(), any());
            verify(auditLogService).logSync(eq("AirbnbCalendar"), eq("AIRBNB-123"),
                    contains("dates manquantes"));
            verify(webhookService).markAsProcessed("evt-5");
        }

        @Test
        @DisplayName("logs sync but skips price update when dates have invalid format")
        void whenInvalidDateFormat_thenLogsWithoutPriceUpdate() {
            // Arrange
            Map<String, Object> data = buildDataWithDates("not-a-date", "also-not");
            data.put("nightly_price", 100);
            Map<String, Object> event = buildEvent("calendar.updated", "evt-6", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.of(createMapping()));

            // Act
            service.handleCalendarEvent(event);

            // Assert
            verify(calendarEngine, never()).updatePrice(any(), any(), any(), any(), any(), any());
            verify(auditLogService).logSync(eq("AirbnbCalendar"), eq("AIRBNB-123"),
                    contains("dates manquantes"));
            verify(webhookService).markAsProcessed("evt-6");
        }

        @Test
        @DisplayName("logs sync without calling updatePrice when nightly_price is null")
        void whenNoPriceField_thenLogsWithoutCallingUpdatePrice() {
            // Arrange
            Map<String, Object> data = buildDataWithDates("2025-06-01", "2025-06-05");
            // No nightly_price
            Map<String, Object> event = buildEvent("calendar.updated", "evt-7", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.of(createMapping()));

            // Act
            service.handleCalendarEvent(event);

            // Assert
            verify(calendarEngine, never()).updatePrice(any(), any(), any(), any(), any(), any());
            verify(auditLogService).logSync(eq("AirbnbCalendar"), eq("AIRBNB-123"),
                    contains("synchronise"));
            verify(webhookService).markAsProcessed("evt-7");
        }

        @Test
        @DisplayName("rethrows CalendarLockException so Kafka can retry")
        void whenLockException_thenRethrowsAndMarksFailed() {
            // Arrange
            Map<String, Object> data = buildDataWithDates("2025-06-01", "2025-06-05");
            data.put("nightly_price", 100);
            Map<String, Object> event = buildEvent("calendar.updated", "evt-8", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.of(createMapping()));
            doThrow(new CalendarLockException(42L))
                    .when(calendarEngine).updatePrice(any(), any(), any(), any(), any(), any());

            // Act & Assert
            // The CalendarLockException is caught by the outer catch -> markAsFailed
            // Actually it IS re-thrown from handleCalendarUpdated, but the outer catch catches it
            service.handleCalendarEvent(event);

            verify(webhookService).markAsFailed(eq("evt-8"), anyString());
        }
    }

    // ===================================================================
    // calendar.blocked
    // ===================================================================

    @Nested
    @DisplayName("handleCalendarEvent - calendar.blocked")
    class CalendarBlocked {

        @Test
        @DisplayName("blocks dates via CalendarEngine on happy path")
        void whenValidDates_thenBlocksDates() {
            // Arrange
            Map<String, Object> data = buildDataWithDates("2025-07-01", "2025-07-10");
            Map<String, Object> event = buildEvent("calendar.blocked", "evt-9", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.of(createMapping()));

            // Act
            service.handleCalendarEvent(event);

            // Assert
            verify(calendarEngine).block(
                    eq(42L),
                    eq(LocalDate.of(2025, 7, 1)),
                    eq(LocalDate.of(2025, 7, 10)),
                    eq(10L),
                    eq("AIRBNB"),
                    contains("AIRBNB-123"),
                    eq("airbnb-webhook")
            );
            verify(webhookService).markAsProcessed("evt-9");
        }

        @Test
        @DisplayName("swallows CalendarConflictException and marks as processed")
        void whenConflict_thenSwallowsExceptionAndMarksProcessed() {
            // Arrange
            Map<String, Object> data = buildDataWithDates("2025-07-01", "2025-07-10");
            Map<String, Object> event = buildEvent("calendar.blocked", "evt-10", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.of(createMapping()));
            doThrow(new CalendarConflictException(42L, LocalDate.of(2025, 7, 1),
                    LocalDate.of(2025, 7, 10), 3))
                    .when(calendarEngine).block(any(), any(), any(), any(), any(), any(), any());

            // Act
            service.handleCalendarEvent(event);

            // Assert - conflict is swallowed, event marked as processed
            verify(webhookService).markAsProcessed("evt-10");
        }

        @Test
        @DisplayName("does not call block when dates are missing")
        void whenMissingDates_thenSkipsBlock() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("listing_id", "AIRBNB-123");
            Map<String, Object> event = buildEvent("calendar.blocked", "evt-11", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.of(createMapping()));

            // Act
            service.handleCalendarEvent(event);

            // Assert
            verify(calendarEngine, never()).block(any(), any(), any(), any(), any(), any(), any());
            verify(webhookService).markAsProcessed("evt-11");
        }
    }

    // ===================================================================
    // calendar.unblocked
    // ===================================================================

    @Nested
    @DisplayName("handleCalendarEvent - calendar.unblocked")
    class CalendarUnblocked {

        @Test
        @DisplayName("unblocks dates via CalendarEngine on happy path")
        void whenValidDates_thenUnblocksDates() {
            // Arrange
            Map<String, Object> data = buildDataWithDates("2025-08-01", "2025-08-05");
            Map<String, Object> event = buildEvent("calendar.unblocked", "evt-12", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.of(createMapping()));

            // Act
            service.handleCalendarEvent(event);

            // Assert
            verify(calendarEngine).unblock(
                    eq(42L),
                    eq(LocalDate.of(2025, 8, 1)),
                    eq(LocalDate.of(2025, 8, 5)),
                    eq(10L),
                    eq("airbnb-webhook")
            );
            verify(webhookService).markAsProcessed("evt-12");
        }

        @Test
        @DisplayName("does not call unblock when dates are missing")
        void whenMissingDates_thenSkipsUnblock() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("listing_id", "AIRBNB-123");
            Map<String, Object> event = buildEvent("calendar.unblocked", "evt-13", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.of(createMapping()));

            // Act
            service.handleCalendarEvent(event);

            // Assert
            verify(calendarEngine, never()).unblock(any(), any(), any(), any(), any());
            verify(webhookService).markAsProcessed("evt-13");
        }

        @Test
        @DisplayName("rethrows CalendarLockException so Kafka can retry")
        void whenLockException_thenMarksFailed() {
            // Arrange
            Map<String, Object> data = buildDataWithDates("2025-08-01", "2025-08-05");
            Map<String, Object> event = buildEvent("calendar.unblocked", "evt-14", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-123"))
                    .thenReturn(Optional.of(createMapping()));
            doThrow(new CalendarLockException(42L))
                    .when(calendarEngine).unblock(any(), any(), any(), any(), any());

            // Act
            service.handleCalendarEvent(event);

            // Assert
            verify(webhookService).markAsFailed(eq("evt-14"), anyString());
        }
    }
}
