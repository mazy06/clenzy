package com.clenzy.integration.booking.service;

import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.AuditLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingReservationServiceTest {

    @Mock private ChannelMappingRepository channelMappingRepository;
    @Mock private BookingConnectionRepository bookingConnectionRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private AuditLogService auditLogService;

    private BookingReservationService service;

    private static final String HOTEL_ID = "hotel-123";
    private static final String ROOM_ID = "room-456";
    private static final String RESERVATION_ID = "res-789";
    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 42L;

    @BeforeEach
    void setUp() {
        service = new BookingReservationService(
                channelMappingRepository,
                bookingConnectionRepository,
                interventionRepository,
                propertyRepository,
                auditLogService
        );
    }

    private Map<String, Object> buildEvent(String eventType, Map<String, Object> data) {
        Map<String, Object> event = new HashMap<>();
        event.put("event_type", eventType);
        event.put("hotel_id", HOTEL_ID);
        event.put("reservation_id", RESERVATION_ID);
        if (data != null) {
            event.put("data", data);
        }
        return event;
    }

    private Map<String, Object> buildReservationData() {
        Map<String, Object> data = new HashMap<>();
        data.put("room_id", ROOM_ID);
        data.put("reservation_id", RESERVATION_ID);
        data.put("guest_name", "Jean Dupont");
        data.put("check_in", "2025-08-01");
        data.put("check_out", "2025-08-05");
        data.put("number_of_guests", 2);
        return data;
    }

    private void stubOrgResolution() {
        BookingConnection connection = new BookingConnection(ORG_ID, HOTEL_ID);
        lenient().when(bookingConnectionRepository.findByHotelId(HOTEL_ID))
                .thenReturn(Optional.of(connection));
    }

    private ChannelMapping buildMapping() {
        ChannelMapping mapping = new ChannelMapping();
        mapping.setInternalId(PROPERTY_ID);
        mapping.setExternalId(ROOM_ID);
        mapping.setOrganizationId(ORG_ID);
        return mapping;
    }

    private Property buildProperty() {
        Property property = new Property();
        property.setId(PROPERTY_ID);
        property.setName("Appartement Paris");
        property.setBedroomCount(2);
        return property;
    }

    // ===== RESERVATION CREATED =====

    @Nested
    @DisplayName("reservation.created")
    class ReservationCreated {

        @Test
        @DisplayName("creates reservation and auto-generates cleaning intervention")
        void handleReservationEvent_created_createsReservation() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Property property = buildProperty();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(interventionRepository.save(any(Intervention.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            Map<String, Object> data = buildReservationData();
            Map<String, Object> event = buildEvent("reservation.created", data);

            service.handleReservationEvent(event);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());

            Intervention saved = captor.getValue();
            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(saved.getStatus()).isEqualTo(InterventionStatus.PENDING);
            assertThat(saved.getProperty()).isEqualTo(property);
            assertThat(saved.getSpecialInstructions()).contains("[BOOKING:" + RESERVATION_ID + "]");
            assertThat(saved.getTitle()).contains("Menage Booking.com");

            verify(auditLogService).logSync(eq("BookingReservation"), eq(RESERVATION_ID), anyString());
        }
    }

    // ===== RESERVATION MODIFIED =====

    @Nested
    @DisplayName("reservation.modified")
    class ReservationModified {

        @Test
        @DisplayName("updates existing intervention dates and guest count")
        void handleReservationEvent_modified_updatesReservation() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            // Existing intervention linked to this reservation
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setSpecialInstructions("[BOOKING:" + RESERVATION_ID + "] 2 guests");
            intervention.setStatus(InterventionStatus.PENDING);

            when(interventionRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(intervention));

            Property property = buildProperty();
            lenient().when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            when(interventionRepository.save(any(Intervention.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("reservation_id", RESERVATION_ID);
            data.put("check_in", "2025-08-02");
            data.put("check_out", "2025-08-07");
            data.put("number_of_guests", 4);

            Map<String, Object> event = buildEvent("reservation.modified", data);

            service.handleReservationEvent(event);

            verify(interventionRepository).save(any(Intervention.class));
            verify(auditLogService).logSync(eq("BookingReservation"), eq(RESERVATION_ID), anyString());
        }
    }

    // ===== RESERVATION CANCELLED =====

    @Nested
    @DisplayName("reservation.cancelled")
    class ReservationCancelled {

        @Test
        @DisplayName("cancels linked cleaning interventions")
        void handleReservationEvent_cancelled_cancelsReservation() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setSpecialInstructions("[BOOKING:" + RESERVATION_ID + "] 2 guests");
            intervention.setStatus(InterventionStatus.PENDING);

            when(interventionRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(intervention));
            when(interventionRepository.save(any(Intervention.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("reservation_id", RESERVATION_ID);

            Map<String, Object> event = buildEvent("reservation.cancelled", data);

            service.handleReservationEvent(event);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());

            assertThat(captor.getValue().getStatus()).isEqualTo(InterventionStatus.CANCELLED);
            verify(auditLogService).logSync(eq("BookingReservation"), eq(RESERVATION_ID), anyString());
        }
    }

    // ===== MISSING DATA =====

    @Nested
    @DisplayName("Missing data field")
    class MissingData {

        @Test
        @DisplayName("logs warning and returns when data is null")
        void handleReservationEvent_missingData_logsWarning() {
            Map<String, Object> event = buildEvent("reservation.created", null);

            service.handleReservationEvent(event);

            verifyNoInteractions(channelMappingRepository);
            verifyNoInteractions(interventionRepository);
            verifyNoInteractions(auditLogService);
        }
    }

    // ===== UNMAPPED HOTEL =====

    @Nested
    @DisplayName("Unmapped hotel")
    class UnmappedHotel {

        @Test
        @DisplayName("skips when org resolution returns null")
        void handleReservationEvent_unmappedHotel_skips() {
            when(bookingConnectionRepository.findByHotelId(HOTEL_ID))
                    .thenReturn(Optional.empty());

            Map<String, Object> data = buildReservationData();
            Map<String, Object> event = buildEvent("reservation.created", data);

            service.handleReservationEvent(event);

            verifyNoInteractions(interventionRepository);
        }
    }
}
