package com.clenzy.integration.airbnb.controller;

import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.service.AirbnbListingService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AirbnbListingControllerTest {

    @Mock private AirbnbListingService listingService;

    private AirbnbListingController controller;

    @BeforeEach
    void setUp() {
        controller = new AirbnbListingController(listingService);
    }

    // ── getLinkedListings ───────────────────────────────────────────

    @Nested
    @DisplayName("getLinkedListings")
    class GetLinkedListings {

        @Test
        @DisplayName("when active listings exist then returns them")
        void whenActiveListingsExist_thenReturnsThem() {
            // Arrange
            AirbnbListingMapping m1 = new AirbnbListingMapping();
            m1.setAirbnbListingId("listing-1");
            AirbnbListingMapping m2 = new AirbnbListingMapping();
            m2.setAirbnbListingId("listing-2");
            when(listingService.getActiveListings()).thenReturn(List.of(m1, m2));

            // Act
            ResponseEntity<List<AirbnbListingMapping>> response = controller.getLinkedListings();

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).hasSize(2);
        }

        @Test
        @DisplayName("when no active listings then returns empty list")
        void whenNoActiveListings_thenReturnsEmptyList() {
            // Arrange
            when(listingService.getActiveListings()).thenReturn(List.of());

            // Act
            ResponseEntity<List<AirbnbListingMapping>> response = controller.getLinkedListings();

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isEmpty();
        }
    }

    // ── linkProperty ────────────────────────────────────────────────

    @Nested
    @DisplayName("linkProperty")
    class LinkProperty {

        @Test
        @DisplayName("when valid request then returns mapping")
        void whenValidRequest_thenReturnsMapping() {
            // Arrange
            Map<String, Object> request = new HashMap<>();
            request.put("propertyId", 1L);
            request.put("airbnbListingId", "listing-abc");
            request.put("airbnbListingTitle", "Cozy Apartment");
            request.put("airbnbListingUrl", "https://airbnb.com/rooms/123");

            AirbnbListingMapping mapping = new AirbnbListingMapping();
            mapping.setAirbnbListingId("listing-abc");
            when(listingService.linkPropertyToListing(1L, "listing-abc", "Cozy Apartment", "https://airbnb.com/rooms/123"))
                    .thenReturn(mapping);

            // Act
            ResponseEntity<?> response = controller.linkProperty(request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isInstanceOf(AirbnbListingMapping.class);
        }

        @Test
        @DisplayName("when service throws then returns bad request")
        @SuppressWarnings("unchecked")
        void whenServiceThrows_thenReturnsBadRequest() {
            // Arrange
            Map<String, Object> request = new HashMap<>();
            request.put("propertyId", 1L);
            request.put("airbnbListingId", "listing-abc");
            request.put("airbnbListingTitle", null);
            request.put("airbnbListingUrl", null);

            when(listingService.linkPropertyToListing(1L, "listing-abc", null, null))
                    .thenThrow(new RuntimeException("Property not found"));

            // Act
            ResponseEntity<?> response = controller.linkProperty(request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("error", "link_failed");
        }

        @Test
        @DisplayName("when propertyId missing then returns bad request")
        @SuppressWarnings("unchecked")
        void whenPropertyIdMissing_thenReturnsBadRequest() {
            // Arrange
            Map<String, Object> request = new HashMap<>();
            request.put("propertyId", null);
            request.put("airbnbListingId", "listing-abc");

            // Act — NullPointerException from Long.valueOf(null) is caught as RuntimeException
            ResponseEntity<?> response = controller.linkProperty(request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }
    }

    // ── unlinkProperty ──────────────────────────────────────────────

    @Nested
    @DisplayName("unlinkProperty")
    class UnlinkProperty {

        @Test
        @DisplayName("when successful then returns unlinked")
        void whenSuccessful_thenReturnsUnlinked() {
            // Arrange
            doNothing().when(listingService).unlinkProperty(1L);

            // Act
            ResponseEntity<Map<String, String>> response = controller.unlinkProperty(1L);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsEntry("status", "unlinked");
        }

        @Test
        @DisplayName("when property not found then returns bad request")
        void whenPropertyNotFound_thenReturnsBadRequest() {
            // Arrange
            doThrow(new RuntimeException("No mapping found")).when(listingService).unlinkProperty(999L);

            // Act
            ResponseEntity<Map<String, String>> response = controller.unlinkProperty(999L);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("error", "unlink_failed");
        }
    }

    // ── toggleSync ──────────────────────────────────────────────────

    @Nested
    @DisplayName("toggleSync")
    class ToggleSync {

        @Test
        @DisplayName("when enable sync then returns updated mapping")
        void whenEnableSync_thenReturnsUpdatedMapping() {
            // Arrange
            AirbnbListingMapping mapping = new AirbnbListingMapping();
            mapping.setSyncEnabled(true);
            when(listingService.toggleSync(1L, true)).thenReturn(mapping);

            // Act
            ResponseEntity<?> response = controller.toggleSync(1L, true);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isInstanceOf(AirbnbListingMapping.class);
        }

        @Test
        @DisplayName("when toggle fails then returns bad request")
        @SuppressWarnings("unchecked")
        void whenToggleFails_thenReturnsBadRequest() {
            // Arrange
            when(listingService.toggleSync(999L, true))
                    .thenThrow(new RuntimeException("Mapping not found"));

            // Act
            ResponseEntity<?> response = controller.toggleSync(999L, true);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("error", "toggle_failed");
        }
    }

    // ── toggleAutoPushPricing ───────────────────────────────────────

    @Nested
    @DisplayName("toggleAutoPushPricing")
    class ToggleAutoPushPricing {

        @Test
        @DisplayName("when enable auto push then returns updated mapping")
        void whenEnableAutoPush_thenReturnsUpdatedMapping() {
            // Arrange
            AirbnbListingMapping mapping = new AirbnbListingMapping();
            mapping.setAutoPushPricing(true);
            when(listingService.toggleAutoPushPricing(1L, true)).thenReturn(mapping);

            // Act
            ResponseEntity<?> response = controller.toggleAutoPushPricing(1L, true);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("when toggle fails then returns bad request")
        @SuppressWarnings("unchecked")
        void whenToggleFails_thenReturnsBadRequest() {
            // Arrange
            when(listingService.toggleAutoPushPricing(999L, false))
                    .thenThrow(new RuntimeException("Mapping not found"));

            // Act
            ResponseEntity<?> response = controller.toggleAutoPushPricing(999L, false);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("error", "toggle_failed");
        }
    }

    // ── toggleAutoInterventions ─────────────────────────────────────

    @Nested
    @DisplayName("toggleAutoInterventions")
    class ToggleAutoInterventions {

        @Test
        @DisplayName("when enable auto interventions then returns updated mapping")
        void whenEnableAutoInterventions_thenReturnsUpdatedMapping() {
            // Arrange
            AirbnbListingMapping mapping = new AirbnbListingMapping();
            mapping.setAutoCreateInterventions(true);
            when(listingService.toggleAutoInterventions(1L, true)).thenReturn(mapping);

            // Act
            ResponseEntity<?> response = controller.toggleAutoInterventions(1L, true);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("when toggle fails then returns bad request")
        @SuppressWarnings("unchecked")
        void whenToggleFails_thenReturnsBadRequest() {
            // Arrange
            when(listingService.toggleAutoInterventions(999L, true))
                    .thenThrow(new RuntimeException("Mapping not found"));

            // Act
            ResponseEntity<?> response = controller.toggleAutoInterventions(999L, true);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("error", "toggle_failed");
        }
    }
}
