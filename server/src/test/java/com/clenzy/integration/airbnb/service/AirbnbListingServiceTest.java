package com.clenzy.integration.airbnb.service;

import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.model.Property;
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

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link AirbnbListingService}.
 * Covers linking/unlinking properties, toggle operations, active listings,
 * and Kafka event handling for listing updates.
 */
@ExtendWith(MockitoExtension.class)
class AirbnbListingServiceTest {

    @Mock private AirbnbListingMappingRepository listingMappingRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private AirbnbWebhookService webhookService;
    @Mock private AuditLogService auditLogService;

    private AirbnbListingService service;

    @BeforeEach
    void setUp() {
        service = new AirbnbListingService(listingMappingRepository, propertyRepository,
                webhookService, auditLogService);
    }

    private Property createProperty(Long id) {
        Property property = new Property();
        property.setId(id);
        property.setOrganizationId(10L);
        property.setName("Test Property");
        property.setAddress("123 Rue Test");
        property.setBedroomCount(2);
        property.setBathroomCount(1);
        return property;
    }

    private AirbnbListingMapping createMapping(Long propertyId) {
        AirbnbListingMapping mapping = new AirbnbListingMapping();
        mapping.setId(1L);
        mapping.setPropertyId(propertyId);
        mapping.setAirbnbListingId("AIRBNB-456");
        mapping.setOrganizationId(10L);
        mapping.setSyncEnabled(true);
        return mapping;
    }

    // ===================================================================
    // linkPropertyToListing
    // ===================================================================

    @Nested
    @DisplayName("linkPropertyToListing")
    class LinkPropertyToListing {

        @Test
        @DisplayName("creates mapping and updates property on happy path")
        void whenValidInput_thenCreatesMapping() {
            // Arrange
            Property property = createProperty(42L);
            when(propertyRepository.findById(42L)).thenReturn(Optional.of(property));
            when(listingMappingRepository.existsByAirbnbListingId("AIRBNB-NEW")).thenReturn(false);
            when(listingMappingRepository.existsByPropertyId(42L)).thenReturn(false);
            when(listingMappingRepository.save(any(AirbnbListingMapping.class)))
                    .thenAnswer(inv -> {
                        AirbnbListingMapping m = inv.getArgument(0);
                        m.setId(1L);
                        return m;
                    });
            when(propertyRepository.save(any(Property.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            AirbnbListingMapping result = service.linkPropertyToListing(
                    42L, "AIRBNB-NEW", "Nice Apartment", "https://airbnb.com/rooms/123");

            // Assert
            assertThat(result.getAirbnbListingId()).isEqualTo("AIRBNB-NEW");
            assertThat(result.isSyncEnabled()).isTrue();
            assertThat(result.isAutoCreateInterventions()).isTrue();
            verify(propertyRepository).save(argThat(p ->
                    "AIRBNB-NEW".equals(p.getAirbnbListingId()) &&
                    "https://airbnb.com/rooms/123".equals(p.getAirbnbUrl())));
            verify(auditLogService).logSync(eq("AirbnbListingMapping"), anyString(), contains("42"));
        }

        @Test
        @DisplayName("throws when property not found")
        void whenPropertyNotFound_thenThrows() {
            // Arrange
            when(propertyRepository.findById(99L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.linkPropertyToListing(
                    99L, "AIRBNB-X", "Title", "url"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Propriete introuvable");
        }

        @Test
        @DisplayName("throws when listing already mapped to another property")
        void whenListingAlreadyMapped_thenThrows() {
            // Arrange
            when(propertyRepository.findById(42L)).thenReturn(Optional.of(createProperty(42L)));
            when(listingMappingRepository.existsByAirbnbListingId("AIRBNB-EXISTING")).thenReturn(true);

            // Act & Assert
            assertThatThrownBy(() -> service.linkPropertyToListing(
                    42L, "AIRBNB-EXISTING", "Title", "url"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("deja lie");
        }

        @Test
        @DisplayName("throws when property already linked to a listing")
        void whenPropertyAlreadyLinked_thenThrows() {
            // Arrange
            when(propertyRepository.findById(42L)).thenReturn(Optional.of(createProperty(42L)));
            when(listingMappingRepository.existsByAirbnbListingId("AIRBNB-NEW")).thenReturn(false);
            when(listingMappingRepository.existsByPropertyId(42L)).thenReturn(true);

            // Act & Assert
            assertThatThrownBy(() -> service.linkPropertyToListing(
                    42L, "AIRBNB-NEW", "Title", "url"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("deja liee");
        }
    }

    // ===================================================================
    // unlinkProperty
    // ===================================================================

    @Nested
    @DisplayName("unlinkProperty")
    class UnlinkProperty {

        @Test
        @DisplayName("removes mapping and clears property Airbnb fields")
        void whenMappingExists_thenUnlinks() {
            // Arrange
            AirbnbListingMapping mapping = createMapping(42L);
            Property property = createProperty(42L);
            property.setAirbnbListingId("AIRBNB-456");
            property.setAirbnbUrl("https://airbnb.com/rooms/456");
            when(listingMappingRepository.findByPropertyId(42L)).thenReturn(Optional.of(mapping));
            when(propertyRepository.findById(42L)).thenReturn(Optional.of(property));
            when(propertyRepository.save(any(Property.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            service.unlinkProperty(42L);

            // Assert
            verify(listingMappingRepository).delete(mapping);
            verify(propertyRepository).save(argThat(p ->
                    p.getAirbnbListingId() == null && p.getAirbnbUrl() == null));
            verify(auditLogService).logSync(eq("AirbnbListingMapping"), anyString(), contains("deliee"));
        }

        @Test
        @DisplayName("throws when no mapping exists for property")
        void whenNoMapping_thenThrows() {
            // Arrange
            when(listingMappingRepository.findByPropertyId(99L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.unlinkProperty(99L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucun mapping");
        }
    }

    // ===================================================================
    // getActiveListings
    // ===================================================================

    @Nested
    @DisplayName("getActiveListings")
    class GetActiveListings {

        @Test
        @DisplayName("delegates to repository with syncEnabled=true")
        void whenCalled_thenReturnsSyncEnabledMappings() {
            // Arrange
            List<AirbnbListingMapping> expected = List.of(createMapping(1L), createMapping(2L));
            when(listingMappingRepository.findBySyncEnabled(true)).thenReturn(expected);

            // Act
            List<AirbnbListingMapping> result = service.getActiveListings();

            // Assert
            assertThat(result).hasSize(2);
            verify(listingMappingRepository).findBySyncEnabled(true);
        }
    }

    // ===================================================================
    // getMappingForProperty
    // ===================================================================

    @Nested
    @DisplayName("getMappingForProperty")
    class GetMappingForProperty {

        @Test
        @DisplayName("returns mapping when it exists")
        void whenMappingExists_thenReturnsPresent() {
            // Arrange
            AirbnbListingMapping mapping = createMapping(42L);
            when(listingMappingRepository.findByPropertyId(42L)).thenReturn(Optional.of(mapping));

            // Act
            Optional<AirbnbListingMapping> result = service.getMappingForProperty(42L);

            // Assert
            assertThat(result).isPresent();
            assertThat(result.get().getAirbnbListingId()).isEqualTo("AIRBNB-456");
        }

        @Test
        @DisplayName("returns empty when no mapping exists")
        void whenNoMapping_thenReturnsEmpty() {
            // Arrange
            when(listingMappingRepository.findByPropertyId(99L)).thenReturn(Optional.empty());

            // Act
            Optional<AirbnbListingMapping> result = service.getMappingForProperty(99L);

            // Assert
            assertThat(result).isEmpty();
        }
    }

    // ===================================================================
    // toggleSync
    // ===================================================================

    @Nested
    @DisplayName("toggleSync")
    class ToggleSync {

        @Test
        @DisplayName("enables sync for property mapping")
        void whenCalled_thenUpdatesSyncEnabled() {
            // Arrange
            AirbnbListingMapping mapping = createMapping(42L);
            mapping.setSyncEnabled(false);
            when(listingMappingRepository.findByPropertyId(42L)).thenReturn(Optional.of(mapping));
            when(listingMappingRepository.save(any(AirbnbListingMapping.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            AirbnbListingMapping result = service.toggleSync(42L, true);

            // Assert
            assertThat(result.isSyncEnabled()).isTrue();
            verify(listingMappingRepository).save(mapping);
        }

        @Test
        @DisplayName("throws when no mapping found")
        void whenNoMapping_thenThrows() {
            // Arrange
            when(listingMappingRepository.findByPropertyId(99L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.toggleSync(99L, true))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucun mapping");
        }
    }

    // ===================================================================
    // toggleAutoPushPricing
    // ===================================================================

    @Nested
    @DisplayName("toggleAutoPushPricing")
    class ToggleAutoPushPricing {

        @Test
        @DisplayName("enables auto push pricing")
        void whenCalled_thenUpdatesAutoPushPricing() {
            // Arrange
            AirbnbListingMapping mapping = createMapping(42L);
            when(listingMappingRepository.findByPropertyId(42L)).thenReturn(Optional.of(mapping));
            when(listingMappingRepository.save(any(AirbnbListingMapping.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            AirbnbListingMapping result = service.toggleAutoPushPricing(42L, true);

            // Assert
            assertThat(result.isAutoPushPricing()).isTrue();
            verify(listingMappingRepository).save(mapping);
        }
    }

    // ===================================================================
    // toggleAutoInterventions
    // ===================================================================

    @Nested
    @DisplayName("toggleAutoInterventions")
    class ToggleAutoInterventions {

        @Test
        @DisplayName("disables auto interventions")
        void whenCalled_thenUpdatesAutoCreateInterventions() {
            // Arrange
            AirbnbListingMapping mapping = createMapping(42L);
            mapping.setAutoCreateInterventions(true);
            when(listingMappingRepository.findByPropertyId(42L)).thenReturn(Optional.of(mapping));
            when(listingMappingRepository.save(any(AirbnbListingMapping.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            AirbnbListingMapping result = service.toggleAutoInterventions(42L, false);

            // Assert
            assertThat(result.isAutoCreateInterventions()).isFalse();
            verify(listingMappingRepository).save(mapping);
        }
    }

    // ===================================================================
    // handleListingEvent (Kafka)
    // ===================================================================

    @Nested
    @DisplayName("handleListingEvent")
    class HandleListingEvent {

        private Map<String, Object> buildListingEvent(String eventType, String eventId, Map<String, Object> data) {
            Map<String, Object> event = new HashMap<>();
            event.put("event_type", eventType);
            event.put("event_id", eventId);
            event.put("data", data);
            return event;
        }

        @Test
        @DisplayName("marks as failed when data is null")
        void whenNullData_thenMarksFailed() {
            // Arrange
            Map<String, Object> event = buildListingEvent("listing.updated", "evt-1", null);

            // Act
            service.handleListingEvent(event);

            // Assert
            verify(webhookService).markAsFailed("evt-1", "Missing data field");
        }

        @Test
        @DisplayName("updates listing title on listing.updated event")
        void whenListingUpdated_thenUpdatesTitle() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("listing_id", "AIRBNB-456");
            data.put("title", "Updated Title");
            Map<String, Object> event = buildListingEvent("listing.updated", "evt-2", data);
            AirbnbListingMapping mapping = createMapping(42L);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-456"))
                    .thenReturn(Optional.of(mapping));
            when(listingMappingRepository.save(any(AirbnbListingMapping.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            service.handleListingEvent(event);

            // Assert
            verify(listingMappingRepository).save(argThat(m ->
                    "Updated Title".equals(m.getAirbnbListingTitle())));
            verify(webhookService).markAsProcessed("evt-2");
        }

        @Test
        @DisplayName("disables sync on listing.deactivated event")
        void whenListingDeactivated_thenDisablesSync() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("listing_id", "AIRBNB-456");
            Map<String, Object> event = buildListingEvent("listing.deactivated", "evt-3", data);
            AirbnbListingMapping mapping = createMapping(42L);
            mapping.setSyncEnabled(true);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-456"))
                    .thenReturn(Optional.of(mapping));
            when(listingMappingRepository.save(any(AirbnbListingMapping.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            service.handleListingEvent(event);

            // Assert
            verify(listingMappingRepository).save(argThat(m -> !m.isSyncEnabled()));
            verify(webhookService).markAsProcessed("evt-3");
        }

        @Test
        @DisplayName("handles unknown event type gracefully")
        void whenUnknownEventType_thenMarksProcessed() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("listing_id", "AIRBNB-456");
            Map<String, Object> event = buildListingEvent("listing.unknown", "evt-4", data);

            // Act
            service.handleListingEvent(event);

            // Assert
            verify(webhookService).markAsProcessed("evt-4");
        }

        @Test
        @DisplayName("marks as failed when exception occurs")
        void whenExceptionThrown_thenMarksFailed() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("listing_id", "AIRBNB-456");
            Map<String, Object> event = buildListingEvent("listing.updated", "evt-5", data);
            when(listingMappingRepository.findByAirbnbListingId("AIRBNB-456"))
                    .thenThrow(new RuntimeException("DB error"));

            // Act
            service.handleListingEvent(event);

            // Assert
            verify(webhookService).markAsFailed(eq("evt-5"), contains("DB error"));
        }
    }
}
