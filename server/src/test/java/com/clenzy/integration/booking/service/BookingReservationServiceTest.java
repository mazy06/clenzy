package com.clenzy.integration.booking.service;

import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.*;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ServiceRequestRepository;
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
    @Mock private ServiceRequestRepository serviceRequestRepository;
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
                serviceRequestRepository,
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
        @DisplayName("creates cleaning service request")
        void handleReservationEvent_created_createsServiceRequest() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            Property property = buildProperty();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(serviceRequestRepository.save(any(ServiceRequest.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            Map<String, Object> data = buildReservationData();
            Map<String, Object> event = buildEvent("reservation.created", data);

            service.handleReservationEvent(event);

            ArgumentCaptor<ServiceRequest> captor = ArgumentCaptor.forClass(ServiceRequest.class);
            verify(serviceRequestRepository).save(captor.capture());

            ServiceRequest saved = captor.getValue();
            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(saved.getStatus()).isEqualTo(RequestStatus.PENDING);
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
        @DisplayName("updates existing service request dates")
        void handleReservationEvent_modified_updatesServiceRequest() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            // Existing service request linked to this reservation
            ServiceRequest sr = new ServiceRequest();
            sr.setId(100L);
            sr.setSpecialInstructions("[BOOKING:" + RESERVATION_ID + "] 2 guests");
            sr.setStatus(RequestStatus.AWAITING_PAYMENT);

            when(serviceRequestRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(sr));

            Property property = buildProperty();
            lenient().when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            when(serviceRequestRepository.save(any(ServiceRequest.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("reservation_id", RESERVATION_ID);
            data.put("check_in", "2025-08-02");
            data.put("check_out", "2025-08-07");
            data.put("number_of_guests", 4);

            Map<String, Object> event = buildEvent("reservation.modified", data);

            service.handleReservationEvent(event);

            verify(serviceRequestRepository).save(any(ServiceRequest.class));
            verify(auditLogService).logSync(eq("BookingReservation"), eq(RESERVATION_ID), anyString());
        }
    }

    // ===== RESERVATION CANCELLED =====

    @Nested
    @DisplayName("reservation.cancelled")
    class ReservationCancelled {

        @Test
        @DisplayName("cancels linked cleaning service requests")
        void handleReservationEvent_cancelled_cancelsServiceRequest() {
            stubOrgResolution();
            ChannelMapping mapping = buildMapping();
            when(channelMappingRepository.findByExternalIdAndChannel(ROOM_ID, ChannelName.BOOKING, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            ServiceRequest sr = new ServiceRequest();
            sr.setId(100L);
            sr.setSpecialInstructions("[BOOKING:" + RESERVATION_ID + "] 2 guests");
            sr.setStatus(RequestStatus.AWAITING_PAYMENT);

            when(serviceRequestRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(sr));
            when(serviceRequestRepository.save(any(ServiceRequest.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            Map<String, Object> data = new HashMap<>();
            data.put("room_id", ROOM_ID);
            data.put("reservation_id", RESERVATION_ID);

            Map<String, Object> event = buildEvent("reservation.cancelled", data);

            service.handleReservationEvent(event);

            ArgumentCaptor<ServiceRequest> captor = ArgumentCaptor.forClass(ServiceRequest.class);
            verify(serviceRequestRepository).save(captor.capture());

            assertThat(captor.getValue().getStatus()).isEqualTo(RequestStatus.CANCELLED);
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
            verifyNoInteractions(serviceRequestRepository);
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

            verifyNoInteractions(serviceRequestRepository);
        }
    }
}
