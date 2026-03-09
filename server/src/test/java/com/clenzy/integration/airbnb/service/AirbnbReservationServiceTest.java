package com.clenzy.integration.airbnb.service;

import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
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

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link AirbnbReservationService}.
 * Validates Kafka event handling, auto-service-request creation, update, and cancellation.
 */
@ExtendWith(MockitoExtension.class)
class AirbnbReservationServiceTest {

    @Mock
    private AirbnbListingMappingRepository listingMappingRepository;
    @Mock
    private ServiceRequestRepository serviceRequestRepository;
    @Mock
    private PropertyRepository propertyRepository;
    @Mock
    private AirbnbWebhookService webhookService;
    @Mock
    private AuditLogService auditLogService;

    private AirbnbReservationService service;

    @BeforeEach
    void setUp() {
        service = new AirbnbReservationService(
                listingMappingRepository, serviceRequestRepository,
                propertyRepository, webhookService, auditLogService);
    }

    private AirbnbListingMapping createMapping(Long propertyId, boolean autoCreate) {
        AirbnbListingMapping mapping = new AirbnbListingMapping();
        mapping.setId(1L);
        mapping.setPropertyId(propertyId);
        mapping.setAirbnbListingId("airbnb-listing-1");
        mapping.setAutoCreateInterventions(autoCreate);
        mapping.setOrganizationId(10L);
        return mapping;
    }

    private Property createProperty(Long id, String name) {
        Property property = new Property();
        property.setId(id);
        property.setName(name);
        property.setOrganizationId(10L);
        User owner = new User();
        owner.setId(1L);
        property.setOwner(owner);
        return property;
    }

    @Nested
    @DisplayName("handleReservationEvent")
    class HandleEvent {

        @Test
        void whenReservationCreated_thenProcessesAndMarksProcessed() {
            Map<String, Object> event = Map.of(
                    "event_type", "reservation.created",
                    "event_id", "evt-1",
                    "data", Map.of(
                            "listing_id", "airbnb-listing-1",
                            "confirmation_code", "HMABCDEF",
                            "guest_name", "John Doe",
                            "check_in", "2026-04-01",
                            "check_out", "2026-04-05",
                            "guest_count", 2
                    )
            );

            AirbnbListingMapping mapping = createMapping(5L, true);
            when(listingMappingRepository.findByAirbnbListingId("airbnb-listing-1"))
                    .thenReturn(Optional.of(mapping));
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(createProperty(5L, "Villa Nice")));

            service.handleReservationEvent(event);

            verify(webhookService).markAsProcessed("evt-1");
            verify(serviceRequestRepository).save(any(ServiceRequest.class));
        }

        @Test
        void whenMissingData_thenMarksFailed() {
            Map<String, Object> event = Map.of(
                    "event_type", "reservation.created",
                    "event_id", "evt-2"
                    // Missing "data" key
            );

            service.handleReservationEvent(event);

            verify(webhookService).markAsFailed("evt-2", "Missing data field");
        }

        @Test
        void whenUnknownEventType_thenStillMarksProcessed() {
            Map<String, Object> event = Map.of(
                    "event_type", "reservation.unknown",
                    "event_id", "evt-3",
                    "data", Map.of("listing_id", "test")
            );

            service.handleReservationEvent(event);

            verify(webhookService).markAsProcessed("evt-3");
        }

        @Test
        void whenProcessingFails_thenMarksFailed() {
            Map<String, Object> event = Map.of(
                    "event_type", "reservation.created",
                    "event_id", "evt-4",
                    "data", Map.of("listing_id", "airbnb-listing-1")
            );

            when(listingMappingRepository.findByAirbnbListingId("airbnb-listing-1"))
                    .thenThrow(new RuntimeException("DB error"));

            service.handleReservationEvent(event);

            verify(webhookService).markAsFailed(eq("evt-4"), contains("DB error"));
        }
    }

    @Nested
    @DisplayName("handleReservationCreated")
    class Created {

        @Test
        void whenMappingNotFound_thenIgnores() {
            when(listingMappingRepository.findByAirbnbListingId("unknown-listing"))
                    .thenReturn(Optional.empty());

            Map<String, Object> data = Map.of("listing_id", "unknown-listing", "confirmation_code", "HM123");
            service.handleReservationCreated(data);

            verify(serviceRequestRepository, never()).save(any());
        }

        @Test
        void whenAutoCreateDisabled_thenDoesNotCreateServiceRequest() {
            AirbnbListingMapping mapping = createMapping(5L, false);
            when(listingMappingRepository.findByAirbnbListingId("airbnb-listing-1"))
                    .thenReturn(Optional.of(mapping));

            Map<String, Object> data = Map.of(
                    "listing_id", "airbnb-listing-1",
                    "confirmation_code", "HMTEST"
            );
            service.handleReservationCreated(data);

            verify(serviceRequestRepository, never()).save(any());
            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        void whenAutoCreateEnabled_thenCreatesCleaningServiceRequest() {
            AirbnbListingMapping mapping = createMapping(5L, true);
            Property property = createProperty(5L, "Villa Nice");
            property.setBedroomCount(2);

            when(listingMappingRepository.findByAirbnbListingId("airbnb-listing-1"))
                    .thenReturn(Optional.of(mapping));
            when(propertyRepository.findById(5L)).thenReturn(Optional.of(property));

            Map<String, Object> data = Map.of(
                    "listing_id", "airbnb-listing-1",
                    "confirmation_code", "HMTEST",
                    "guest_name", "Jane",
                    "check_in", "2026-04-01",
                    "check_out", "2026-04-05",
                    "guest_count", 3
            );
            service.handleReservationCreated(data);

            ArgumentCaptor<ServiceRequest> captor = ArgumentCaptor.forClass(ServiceRequest.class);
            verify(serviceRequestRepository).save(captor.capture());
            ServiceRequest saved = captor.getValue();
            assertThat(saved.getTitle()).contains("Menage Airbnb");
            assertThat(saved.getStatus()).isEqualTo(RequestStatus.PENDING);
            assertThat(saved.getServiceType()).isEqualTo(ServiceType.CLEANING);
        }
    }

    @Nested
    @DisplayName("handleReservationCancelled")
    class Cancelled {

        @Test
        void whenMappingNotFound_thenIgnores() {
            when(listingMappingRepository.findByAirbnbListingId("unknown"))
                    .thenReturn(Optional.empty());

            service.handleReservationCancelled(Map.of(
                    "listing_id", "unknown", "confirmation_code", "HM123"));

            verify(serviceRequestRepository, never()).save(any());
        }

        @Test
        void whenMatchingServiceRequest_thenCancels() {
            AirbnbListingMapping mapping = createMapping(5L, true);
            when(listingMappingRepository.findByAirbnbListingId("airbnb-listing-1"))
                    .thenReturn(Optional.of(mapping));

            ServiceRequest sr = new ServiceRequest();
            sr.setId(100L);
            sr.setStatus(RequestStatus.AWAITING_PAYMENT);
            sr.setSpecialInstructions("[AIRBNB:HMCANCEL] 2 guests");

            when(serviceRequestRepository.findByPropertyId(5L, 10L))
                    .thenReturn(List.of(sr));

            service.handleReservationCancelled(Map.of(
                    "listing_id", "airbnb-listing-1",
                    "confirmation_code", "HMCANCEL"));

            verify(serviceRequestRepository).save(argThat(s ->
                    ((ServiceRequest) s).getStatus() == RequestStatus.CANCELLED));
        }
    }
}
