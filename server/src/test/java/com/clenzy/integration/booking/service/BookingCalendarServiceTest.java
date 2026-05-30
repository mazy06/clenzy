package com.clenzy.integration.booking.service;

import com.clenzy.exception.CalendarLockException;
import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.PropertyRepository;
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
class BookingCalendarServiceTest {

    @Mock private ChannelMappingRepository channelMappingRepository;
    @Mock private BookingConnectionRepository bookingConnectionRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private CalendarEngine calendarEngine;
    @Mock private BookingRestrictionRepository bookingRestrictionRepository;
    @Mock private PropertyRepository propertyRepository;

    private BookingCalendarService service;

    private static final String HOTEL_ID = "hotel-123";
    private static final String ROOM_ID = "room-456";
    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 42L;

    @BeforeEach
    void setUp() {
        service = new BookingCalendarService(
                channelMappingRepository,
                bookingConnectionRepository,
                auditLogService,
                calendarEngine,
                bookingRestrictionRepository,
                propertyRepository
        );
    }

    private Map<String, Object> buildEvent(String eventType, Map<String, Object> data) {
        Map<String, Object> event = new HashMap<>();
        event.put("event_type", eventType);
        event.put("hotel_id", HOTEL_ID);
        if (data != null) {
            event.put("data", data);
        }
        return event;
    }

    private Map<String, Object> buildAvailabilityData(boolean available) {
        Map<String, Object> data = new HashMap<>();
        data.put("room_id", ROOM_ID);
        data.put("start_date", "2025-07-01");
        data.put("end_date", "2025-07-10");
        data.put("available", available);
        return data;
    }

    private ChannelMapping buildMapping() {
        ChannelMapping mapping = new ChannelMapping();
        mapping.setInternalId(PROPERTY_ID);
        mapping.setExternalId(ROOM_ID);
        mapping.setOrganizationId(ORG_ID);
        return mapping;
    }

    private void stubOrgResolution() {
        BookingConnection connection = new BookingConnection(ORG_ID, HOTEL_ID);
        lenient().when(bookingConnectionRepository.findByHotelId(HOTEL_ID))
                .thenReturn(Optional.of(connection));
    }

    // ===== AVAILABILITY UPDATED =====

    @Nested
    @DisplayName("availability.updated")
    class AvailabilityUpdated {

        @Test
        @DisplayName("unblocks calendar when available=true")
        void handleCalendarEvent_availabilityUpdated_updatesCalendar() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = buildAvailabilityData(true);
            Map<String, Object> event = buildEvent("availability.updated", data);

            service.handleCalendarEvent(event);

            verify(calendarEngine).unblock(
                    eq(PROPERTY_ID),
                    eq(LocalDate.of(2025, 7, 1)),
                    eq(LocalDate.of(2025, 7, 10)),
                    eq(ORG_ID),
                    eq("booking-webhook")
            );
            verify(auditLogService).logSync(eq("BookingCalendar"), eq(ROOM_ID), anyString());
        }

        @Test
        @DisplayName("blocks calendar when available=false")
        void handleCalendarEvent_availabilityUpdated_blocksCalendar() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = buildAvailabilityData(false);
            Map<String, Object> event = buildEvent("availability.updated", data);

            service.handleCalendarEvent(event);

            verify(calendarEngine).block(
                    eq(PROPERTY_ID),
                    eq(LocalDate.of(2025, 7, 1)),
                    eq(LocalDate.of(2025, 7, 10)),
                    eq(ORG_ID),
                    eq("BOOKING"),
                    anyString(),
                    eq("booking-webhook")
            );
            verify(auditLogService).logSync(eq("BookingCalendar"), eq(ROOM_ID), anyString());
        }
    }

    // ===== RATES UPDATED =====

    @Nested
    @DisplayName("rates.updated")
    class RatesUpdated {

        @Test
        @DisplayName("updates prices via CalendarEngine")
        void handleCalendarEvent_ratesUpdated_updatesPrices() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("start_date", "2025-08-01");
            data.put("end_date", "2025-08-15");
            data.put("price", 150.0);

            Map<String, Object> event = buildEvent("rates.updated", data);

            service.handleCalendarEvent(event);

            verify(calendarEngine).updatePrice(
                    eq(PROPERTY_ID),
                    eq(LocalDate.of(2025, 8, 1)),
                    eq(LocalDate.of(2025, 8, 15)),
                    any(BigDecimal.class),
                    eq(ORG_ID),
                    eq("booking-webhook")
            );
            verify(auditLogService).logSync(eq("BookingCalendar"), eq(ROOM_ID), anyString());
        }
    }

    // ===== RESTRICTIONS UPDATED =====

    @Nested
    @DisplayName("restrictions.updated")
    class RestrictionsUpdated {

        @Test
        @DisplayName("logs sync and audit for restrictions event")
        void handleCalendarEvent_restrictionsUpdated_updatesRestrictions() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("min_stay", 2);
            data.put("max_stay", 14);

            Map<String, Object> event = buildEvent("restrictions.updated", data);

            service.handleCalendarEvent(event);

            verify(auditLogService).logSync(eq("BookingCalendar"), eq(ROOM_ID), anyString());
            // CalendarEngine is not called for restrictions (TODO in source)
            verifyNoInteractions(calendarEngine);
        }
    }

    // ===== UNKNOWN EVENT TYPE =====

    @Nested
    @DisplayName("Unknown event type")
    class UnknownEventType {

        @Test
        @DisplayName("logs warning for unknown event type without throwing")
        void handleCalendarEvent_unknownType_logsWarning() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);

            Map<String, Object> event = buildEvent("unknown.event.type", data);

            // Should not throw
            service.handleCalendarEvent(event);

            // No CalendarEngine interaction for unknown event types
            verifyNoInteractions(calendarEngine);
        }
    }

    // ===== MISSING DATA =====

    @Nested
    @DisplayName("Missing data field")
    class MissingData {

        @Test
        @DisplayName("handles gracefully when data field is null")
        void handleCalendarEvent_missingData_handlesGracefully() {
            Map<String, Object> event = buildEvent("availability.updated", null);

            // Should not throw
            service.handleCalendarEvent(event);

            verifyNoInteractions(calendarEngine);
            verifyNoInteractions(auditLogService);
        }
    }

    // ===== UNMAPPED HOTEL =====

    @Nested
    @DisplayName("Unmapped hotel")
    class UnmappedHotel {

        @Test
        @DisplayName("skips event when room mapping not found")
        void handleCalendarEvent_unmappedHotel_skips() {
            stubOrgResolution();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.empty());

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("start_date", "2025-07-01");
            data.put("end_date", "2025-07-10");

            Map<String, Object> event = buildEvent("availability.updated", data);

            service.handleCalendarEvent(event);

            verifyNoInteractions(calendarEngine);
            verifyNoInteractions(auditLogService);
        }
    }

    // ===== CALENDAR LOCK EXCEPTION =====

    @Nested
    @DisplayName("CalendarLockException propagation")
    class LockPropagation {

        @Test
        @DisplayName("propagates CalendarLockException for Kafka retry")
        void handleCalendarEvent_lockException_propagates() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            doThrow(new CalendarLockException(PROPERTY_ID))
                    .when(calendarEngine).unblock(anyLong(), any(), any(), anyLong(), anyString());

            Map<String, Object> data = buildAvailabilityData(true);
            Map<String, Object> event = buildEvent("availability.updated", data);

            assertThatThrownBy(() -> service.handleCalendarEvent(event))
                    .isInstanceOf(CalendarLockException.class);
        }
    }

    // ============= EXTENDED =============

    @Nested
    @DisplayName("availability.updated edge cases")
    class AvailabilityEdgeCases {

        @Test
        @DisplayName("missing dates skips processing")
        void whenDatesMissing_thenSkips() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("available", true);
            // start_date and end_date missing

            service.handleCalendarEvent(buildEvent("availability.updated", data));

            verifyNoInteractions(calendarEngine);
            // No audit either — source returns before logging
            verifyNoInteractions(auditLogService);
        }

        @Test
        @DisplayName("invalid date format treated as null")
        void whenInvalidDateFormat_thenSkipsProcessing() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("start_date", "not-a-date");
            data.put("end_date", "also-not-a-date");

            service.handleCalendarEvent(buildEvent("availability.updated", data));

            verifyNoInteractions(calendarEngine);
        }

        @Test
        @DisplayName("default availability true when field missing")
        void whenAvailableMissing_thenDefaultsTrue() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("start_date", "2025-07-01");
            data.put("end_date", "2025-07-10");
            // no available field

            service.handleCalendarEvent(buildEvent("availability.updated", data));

            verify(calendarEngine).unblock(eq(PROPERTY_ID), any(), any(), eq(ORG_ID), anyString());
        }

        @Test
        @DisplayName("block conflict is caught and logged")
        void whenBlockConflict_thenSwallowedAndAudited() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            doThrow(new com.clenzy.exception.CalendarConflictException(
                    PROPERTY_ID, LocalDate.now(), LocalDate.now().plusDays(1), 1))
                    .when(calendarEngine).block(anyLong(), any(), any(), anyLong(), anyString(), anyString(), anyString());

            service.handleCalendarEvent(buildEvent("availability.updated", buildAvailabilityData(false)));

            verify(auditLogService).logSync(eq("BookingCalendar"), eq(ROOM_ID), anyString());
        }
    }

    @Nested
    @DisplayName("rates.updated edge cases")
    class RatesEdgeCases {

        @Test
        @DisplayName("missing dates audits without engine call")
        void whenDatesMissing_thenAuditedNoUpdate() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("price", 100.0);

            service.handleCalendarEvent(buildEvent("rates.updated", data));

            verifyNoInteractions(calendarEngine);
            verify(auditLogService).logSync(eq("BookingCalendar"), eq(ROOM_ID), anyString());
        }

        @Test
        @DisplayName("missing price skips updatePrice call but still audits")
        void whenPriceMissing_thenSkipsUpdateButAudits() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("start_date", "2025-08-01");
            data.put("end_date", "2025-08-15");

            service.handleCalendarEvent(buildEvent("rates.updated", data));

            verify(calendarEngine, never()).updatePrice(anyLong(), any(), any(), any(), anyLong(), anyString());
            verify(auditLogService).logSync(eq("BookingCalendar"), eq(ROOM_ID), anyString());
        }

        @Test
        @DisplayName("BigDecimal string price parsed correctly")
        void whenStringPrice_thenParsed() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("start_date", "2025-08-01");
            data.put("end_date", "2025-08-15");
            data.put("price", "200.50");

            service.handleCalendarEvent(buildEvent("rates.updated", data));

            verify(calendarEngine).updatePrice(anyLong(), any(), any(), any(BigDecimal.class), anyLong(), anyString());
        }

        @Test
        @DisplayName("invalid price string treated as null")
        void whenInvalidPriceString_thenSkipped() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("start_date", "2025-08-01");
            data.put("end_date", "2025-08-15");
            data.put("price", "not-a-price");

            service.handleCalendarEvent(buildEvent("rates.updated", data));

            verify(calendarEngine, never()).updatePrice(anyLong(), any(), any(), any(), anyLong(), anyString());
        }

        @Test
        @DisplayName("rates lock exception propagated for Kafka retry")
        void whenRatesLockException_thenPropagated() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            doThrow(new CalendarLockException(PROPERTY_ID))
                    .when(calendarEngine).updatePrice(anyLong(), any(), any(), any(), anyLong(), anyString());

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("start_date", "2025-08-01");
            data.put("end_date", "2025-08-15");
            data.put("price", 100.0);

            assertThatThrownBy(() -> service.handleCalendarEvent(buildEvent("rates.updated", data)))
                    .isInstanceOf(CalendarLockException.class);
        }
    }

    @Nested
    @DisplayName("restrictions.updated full flow")
    class RestrictionsFullFlow {

        @Test
        @DisplayName("with property found and restriction params, saves new restriction")
        void whenPropertyAndDates_thenSavesNewRestriction() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            com.clenzy.model.Property property = new com.clenzy.model.Property();
            property.setId(PROPERTY_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(bookingRestrictionRepository.findApplicable(eq(PROPERTY_ID), any(), any(), eq(ORG_ID)))
                    .thenReturn(java.util.List.of());

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("start_date", "2026-01-01");
            data.put("end_date", "2026-01-31");
            data.put("min_stay", 3);
            data.put("max_stay", 14);
            data.put("closed_to_arrival", true);
            data.put("closed_to_departure", false);

            service.handleCalendarEvent(buildEvent("restrictions.updated", data));

            verify(bookingRestrictionRepository).save(any(com.clenzy.model.BookingRestriction.class));
            verify(auditLogService).logSync(eq("BookingCalendar"), eq(ROOM_ID), anyString());
        }

        @Test
        @DisplayName("updates existing restriction when one is found")
        void whenExistingRestriction_thenUpdates() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            com.clenzy.model.Property property = new com.clenzy.model.Property();
            property.setId(PROPERTY_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            com.clenzy.model.BookingRestriction existing = new com.clenzy.model.BookingRestriction(
                    property, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31), ORG_ID);
            when(bookingRestrictionRepository.findApplicable(eq(PROPERTY_ID), any(), any(), eq(ORG_ID)))
                    .thenReturn(java.util.List.of(existing));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("start_date", "2026-01-01");
            data.put("end_date", "2026-01-31");
            data.put("min_stay", 5);

            service.handleCalendarEvent(buildEvent("restrictions.updated", data));

            verify(bookingRestrictionRepository).save(existing);
            org.assertj.core.api.Assertions.assertThat(existing.getMinStay()).isEqualTo(5);
        }

        @Test
        @DisplayName("dates missing -> audited and returns")
        void whenDatesMissing_thenAuditsAndReturns() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);

            service.handleCalendarEvent(buildEvent("restrictions.updated", data));

            verifyNoInteractions(propertyRepository);
            verifyNoInteractions(bookingRestrictionRepository);
            verify(auditLogService).logSync(eq("BookingCalendar"), eq(ROOM_ID), anyString());
        }

        @Test
        @DisplayName("property not found -> skips save")
        void whenPropertyNotFound_thenSkips() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("start_date", "2026-01-01");
            data.put("end_date", "2026-01-31");
            data.put("min_stay", 2);

            service.handleCalendarEvent(buildEvent("restrictions.updated", data));

            verify(bookingRestrictionRepository, never()).save(any());
        }

        @Test
        @DisplayName("integer fields parsed from Number type")
        void whenIntegerFromNumber_thenParsed() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            com.clenzy.model.Property property = new com.clenzy.model.Property();
            property.setId(PROPERTY_ID);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(bookingRestrictionRepository.findApplicable(eq(PROPERTY_ID), any(), any(), eq(ORG_ID)))
                    .thenReturn(java.util.List.of());

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("start_date", "2026-01-01");
            data.put("end_date", "2026-01-31");
            data.put("min_stay", 4L); // Number instance
            data.put("max_stay", "10"); // String instance

            service.handleCalendarEvent(buildEvent("restrictions.updated", data));

            verify(bookingRestrictionRepository).save(any(com.clenzy.model.BookingRestriction.class));
        }
    }
}
