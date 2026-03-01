package com.clenzy.integration.direct.controller;

import com.clenzy.integration.direct.dto.*;
import com.clenzy.integration.direct.service.DirectBookingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DirectBookingControllerTest {

    @Mock private DirectBookingService directBookingService;

    private DirectBookingController controller;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 42L;

    @BeforeEach
    void setUp() {
        controller = new DirectBookingController(directBookingService);
    }

    // ===== CHECK AVAILABILITY =====

    @Nested
    @DisplayName("checkAvailability")
    class CheckAvailability {

        @Test
        @DisplayName("returns 200 with availability response when valid request")
        void checkAvailability_valid_returns200() {
            DirectAvailabilityRequest request = new DirectAvailabilityRequest(
                    PROPERTY_ID,
                    LocalDate.of(2025, 9, 1),
                    LocalDate.of(2025, 9, 5),
                    2
            );

            DirectAvailabilityResponse expectedResponse = new DirectAvailabilityResponse(
                    true, PROPERTY_ID, BigDecimal.valueOf(400), BigDecimal.valueOf(100),
                    "EUR", 4, 1, 365, List.of()
            );

            when(directBookingService.checkAvailability(request, ORG_ID)).thenReturn(expectedResponse);

            ResponseEntity<DirectAvailabilityResponse> response =
                    controller.checkAvailability(request, ORG_ID);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().available()).isTrue();
            assertThat(response.getBody().totalPrice()).isEqualByComparingTo("400");
            assertThat(response.getBody().nights()).isEqualTo(4);
            verify(directBookingService).checkAvailability(request, ORG_ID);
        }
    }

    // ===== CREATE BOOKING =====

    @Nested
    @DisplayName("createBooking")
    class CreateBooking {

        @Test
        @DisplayName("returns 200 with booking response when valid request")
        void createBooking_valid_returns200() {
            DirectBookingRequest request = new DirectBookingRequest(
                    PROPERTY_ID,
                    LocalDate.of(2025, 9, 1),
                    LocalDate.of(2025, 9, 5),
                    "Jean",
                    "Dupont",
                    "jean@example.com",
                    "+33612345678",
                    2,
                    0,
                    null,
                    null,
                    "fr",
                    "EUR"
            );

            DirectBookingResponse expectedResponse = DirectBookingResponse.confirmed(
                    "DB-ABC12345", "Appartement Paris",
                    LocalDate.of(2025, 9, 1), LocalDate.of(2025, 9, 5),
                    BigDecimal.valueOf(400), "EUR", "Reservation confirmee"
            );

            when(directBookingService.createBooking(request, ORG_ID)).thenReturn(expectedResponse);

            ResponseEntity<DirectBookingResponse> response =
                    controller.createBooking(request, ORG_ID);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo("CONFIRMED");
            assertThat(response.getBody().bookingId()).isEqualTo("DB-ABC12345");
            verify(directBookingService).createBooking(request, ORG_ID);
        }

        @Test
        @DisplayName("propagates IllegalArgumentException when input is invalid")
        void createBooking_invalidInput_returns400() {
            DirectBookingRequest request = new DirectBookingRequest(
                    PROPERTY_ID,
                    LocalDate.of(2025, 9, 5),
                    LocalDate.of(2025, 9, 1), // check-out before check-in
                    "Jean",
                    "Dupont",
                    "jean@example.com",
                    null,
                    2,
                    0,
                    null,
                    null,
                    "fr",
                    "EUR"
            );

            when(directBookingService.createBooking(request, ORG_ID))
                    .thenThrow(new IllegalArgumentException("La date de check-out doit etre apres le check-in"));

            assertThatThrownBy(() -> controller.createBooking(request, ORG_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("check-out");
        }
    }

    // ===== GET PROPERTY SUMMARY =====

    @Nested
    @DisplayName("getPropertySummary")
    class GetPropertySummary {

        @Test
        @DisplayName("returns 200 with property summary when property exists")
        void getPropertySummary_found_returns200() {
            DirectPropertySummaryDto summary = new DirectPropertySummaryDto(
                    PROPERTY_ID, "Appartement Paris", "Bel appartement",
                    "APARTMENT", 4, 2, 1,
                    BigDecimal.valueOf(100), "EUR",
                    List.of("https://photos.clenzy.fr/1.jpg"),
                    List.of("wifi", "parking"),
                    "10 rue de la Paix", "Paris", "France",
                    48.8566, 2.3522, 4.5, 12
            );

            when(directBookingService.getPropertySummary(PROPERTY_ID)).thenReturn(summary);

            ResponseEntity<DirectPropertySummaryDto> response =
                    controller.getPropertySummary(PROPERTY_ID);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().name()).isEqualTo("Appartement Paris");
            assertThat(response.getBody().maxGuests()).isEqualTo(4);
            verify(directBookingService).getPropertySummary(PROPERTY_ID);
        }

        @Test
        @DisplayName("propagates exception when property not found")
        void getPropertySummary_notFound_returns404() {
            when(directBookingService.getPropertySummary(999L))
                    .thenThrow(new IllegalArgumentException("Propriete introuvable: 999"));

            assertThatThrownBy(() -> controller.getPropertySummary(999L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }
    }

    // ===== CONFIRM BOOKING =====

    @Nested
    @DisplayName("confirmBooking")
    class ConfirmBooking {

        @Test
        @DisplayName("returns 200 when booking is confirmed successfully")
        void confirmBooking_valid_returns200() {
            String bookingId = "DB-ABC12345";

            DirectBookingResponse expectedResponse = DirectBookingResponse.confirmed(
                    bookingId, "Appartement Paris",
                    LocalDate.of(2025, 9, 1), LocalDate.of(2025, 9, 5),
                    BigDecimal.valueOf(400), "EUR", "Reservation confirmee avec succes"
            );

            when(directBookingService.confirmBooking(bookingId, ORG_ID)).thenReturn(expectedResponse);

            ResponseEntity<DirectBookingResponse> response =
                    controller.confirmBooking(bookingId, ORG_ID);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo("CONFIRMED");
        }
    }
}
