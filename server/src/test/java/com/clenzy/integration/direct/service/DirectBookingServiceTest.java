package com.clenzy.integration.direct.service;

import com.clenzy.integration.direct.config.DirectBookingConfig;
import com.clenzy.integration.direct.dto.DirectAvailabilityRequest;
import com.clenzy.integration.direct.dto.DirectAvailabilityResponse;
import com.clenzy.integration.direct.dto.DirectBookingRequest;
import com.clenzy.integration.direct.dto.DirectBookingResponse;
import com.clenzy.integration.direct.dto.DirectPromoCodeDto;
import com.clenzy.integration.direct.model.DirectBookingConfiguration;
import com.clenzy.integration.direct.model.PromoCode;
import com.clenzy.integration.direct.repository.DirectBookingConfigRepository;
import com.clenzy.integration.direct.repository.PromoCodeRepository;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.PriceEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DirectBookingServiceTest {

    @Mock private DirectBookingConfig config;
    @Mock private DirectBookingConfigRepository configRepository;
    @Mock private PromoCodeRepository promoCodeRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private CalendarEngine calendarEngine;
    @Mock private PriceEngine priceEngine;

    private DirectBookingService service;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 42L;
    private static final String CURRENCY = "EUR";

    @BeforeEach
    void setUp() {
        service = new DirectBookingService(config, configRepository, promoCodeRepository,
                propertyRepository, reservationRepository, calendarEngine, priceEngine);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private Property activeProperty() {
        var p = new Property();
        p.setId(PROPERTY_ID);
        p.setName("Villa Provencale");
        p.setMaxGuests(6);
        p.setNightlyPrice(new BigDecimal("120.00"));
        // status defaults to ACTIVE -> isActive() = true
        return p;
    }

    private DirectBookingConfiguration enabledConfig() {
        var c = new DirectBookingConfiguration(ORG_ID, PROPERTY_ID);
        c.setEnabled(true);
        c.setAutoConfirm(true);
        c.setRequirePayment(false);
        return c;
    }

    private void stubConfigDefaults() {
        lenient().when(config.getDefaultCurrency()).thenReturn(CURRENCY);
        lenient().when(config.getMinAdvanceDays()).thenReturn(1);
        lenient().when(config.getMaxAdvanceDays()).thenReturn(365);
        lenient().when(config.isStripeEnabled()).thenReturn(false);
    }

    private LocalDate futureCheckIn() {
        return LocalDate.now().plusDays(10);
    }

    private LocalDate futureCheckOut() {
        return LocalDate.now().plusDays(13);
    }

    // ================================================================
    // checkAvailability
    // ================================================================

    @Nested
    @DisplayName("checkAvailability")
    class CheckAvailability {

        @Test
        @DisplayName("available property returns pricing")
        void checkAvailability_available_returnsPricing() {
            stubConfigDefaults();
            LocalDate checkIn = futureCheckIn();
            LocalDate checkOut = futureCheckOut();
            var request = new DirectAvailabilityRequest(PROPERTY_ID, checkIn, checkOut, 2);

            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(activeProperty()));
            when(configRepository.findEnabledByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(enabledConfig()));
            when(reservationRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(List.of());
            when(priceEngine.resolvePriceRange(eq(PROPERTY_ID), eq(checkIn), eq(checkOut), eq(ORG_ID)))
                    .thenReturn(Map.of(
                            checkIn, new BigDecimal("120.00"),
                            checkIn.plusDays(1), new BigDecimal("120.00"),
                            checkIn.plusDays(2), new BigDecimal("120.00")
                    ));

            DirectAvailabilityResponse response = service.checkAvailability(request, ORG_ID);

            assertThat(response.available()).isTrue();
            assertThat(response.propertyId()).isEqualTo(PROPERTY_ID);
            assertThat(response.totalPrice()).isEqualByComparingTo("360.00");
            assertThat(response.nights()).isEqualTo(3);
            assertThat(response.currency()).isEqualTo(CURRENCY);
        }

        @Test
        @DisplayName("conflicting dates returns unavailable")
        void checkAvailability_conflictingDates_returnsUnavailable() {
            stubConfigDefaults();
            LocalDate checkIn = futureCheckIn();
            LocalDate checkOut = futureCheckOut();
            var request = new DirectAvailabilityRequest(PROPERTY_ID, checkIn, checkOut, 2);

            Property property = activeProperty();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(configRepository.findEnabledByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(enabledConfig()));

            // Existing reservation that overlaps
            Reservation existing = new Reservation(property, "Existing Guest",
                    checkIn.minusDays(1), checkOut.plusDays(1), "confirmed", "AIRBNB");
            existing.setOrganizationId(ORG_ID);
            when(reservationRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(existing));

            DirectAvailabilityResponse response = service.checkAvailability(request, ORG_ID);

            assertThat(response.available()).isFalse();
        }

        @Test
        @DisplayName("too few advance days returns unavailable")
        void checkAvailability_tooFewAdvanceDays_returnsUnavailable() {
            when(config.getDefaultCurrency()).thenReturn(CURRENCY);
            when(config.getMinAdvanceDays()).thenReturn(3);

            // Check-in tomorrow = only 1 day advance, but min is 3
            LocalDate checkIn = LocalDate.now().plusDays(1);
            LocalDate checkOut = checkIn.plusDays(3);
            var request = new DirectAvailabilityRequest(PROPERTY_ID, checkIn, checkOut, 2);

            DirectAvailabilityResponse response = service.checkAvailability(request, ORG_ID);

            assertThat(response.available()).isFalse();
        }
    }

    // ================================================================
    // createBooking
    // ================================================================

    @Nested
    @DisplayName("createBooking")
    class CreateBooking {

        @Test
        @DisplayName("success creates reservation")
        void createBooking_success_createsReservation() {
            stubConfigDefaults();
            LocalDate checkIn = futureCheckIn();
            LocalDate checkOut = futureCheckOut();
            var request = new DirectBookingRequest(PROPERTY_ID, checkIn, checkOut,
                    "Jean", "Dupont", "jean@example.com", null, 2, 0,
                    null, null, null, null);

            Property property = activeProperty();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(configRepository.findEnabledByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(enabledConfig()));
            when(priceEngine.resolvePriceRange(eq(PROPERTY_ID), eq(checkIn), eq(checkOut), eq(ORG_ID)))
                    .thenReturn(Map.of(
                            checkIn, new BigDecimal("120.00"),
                            checkIn.plusDays(1), new BigDecimal("120.00"),
                            checkIn.plusDays(2), new BigDecimal("120.00")
                    ));
            when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> {
                Reservation r = inv.getArgument(0);
                r.setId(100L);
                return r;
            });

            DirectBookingResponse response = service.createBooking(request, ORG_ID);

            assertThat(response.status()).isEqualTo(DirectBookingResponse.STATUS_CONFIRMED);
            assertThat(response.totalPrice()).isEqualByComparingTo("360.00");
            assertThat(response.bookingId()).startsWith("DB-");

            // Verify calendar booking
            verify(calendarEngine).book(eq(PROPERTY_ID), eq(checkIn), eq(checkOut),
                    isNull(), eq(ORG_ID), eq("DIRECT"), eq("system"));

            // Verify reservation saved
            ArgumentCaptor<Reservation> captor = ArgumentCaptor.forClass(Reservation.class);
            verify(reservationRepository, atLeastOnce()).save(captor.capture());
            Reservation saved = captor.getValue();
            assertThat(saved.getGuestName()).isEqualTo("Jean Dupont");
            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
        }

        @Test
        @DisplayName("property not found throws")
        void createBooking_notAvailable_throws() {
            stubConfigDefaults();
            LocalDate checkIn = futureCheckIn();
            LocalDate checkOut = futureCheckOut();
            var request = new DirectBookingRequest(PROPERTY_ID, checkIn, checkOut,
                    "Jean", "Dupont", "jean@example.com", null, 2, 0,
                    null, null, null, null);

            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createBooking(request, ORG_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("with promo code applies discount")
        void createBooking_withPromoCode_appliesDiscount() {
            stubConfigDefaults();
            LocalDate checkIn = futureCheckIn();
            LocalDate checkOut = futureCheckOut();
            var request = new DirectBookingRequest(PROPERTY_ID, checkIn, checkOut,
                    "Jean", "Dupont", "jean@example.com", null, 2, 0,
                    null, "SUMMER10", null, null);

            Property property = activeProperty();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
            when(configRepository.findEnabledByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(enabledConfig()));
            when(priceEngine.resolvePriceRange(eq(PROPERTY_ID), eq(checkIn), eq(checkOut), eq(ORG_ID)))
                    .thenReturn(Map.of(
                            checkIn, new BigDecimal("100.00"),
                            checkIn.plusDays(1), new BigDecimal("100.00"),
                            checkIn.plusDays(2), new BigDecimal("100.00")
                    ));

            // Promo code: 10% off
            PromoCode promo = new PromoCode(ORG_ID, "SUMMER10",
                    PromoCode.DiscountType.PERCENTAGE, new BigDecimal("10"));
            promo.setActive(true);
            when(promoCodeRepository.findByCodeAndOrganizationId("SUMMER10", ORG_ID))
                    .thenReturn(Optional.of(promo));
            when(promoCodeRepository.save(any(PromoCode.class))).thenReturn(promo);

            when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> {
                Reservation r = inv.getArgument(0);
                r.setId(100L);
                return r;
            });

            DirectBookingResponse response = service.createBooking(request, ORG_ID);

            // Total = 300, discount 10% = 30, final = 270
            assertThat(response.totalPrice()).isEqualByComparingTo("270.00");
        }

        @Test
        @DisplayName("with payment creates Stripe intent flow")
        void createBooking_withPayment_pendingIfStripeError() {
            stubConfigDefaults();
            when(config.isStripeEnabled()).thenReturn(true);

            LocalDate checkIn = futureCheckIn();
            LocalDate checkOut = futureCheckOut();
            var request = new DirectBookingRequest(PROPERTY_ID, checkIn, checkOut,
                    "Jean", "Dupont", "jean@example.com", null, 2, 0,
                    null, null, null, null);

            Property property = activeProperty();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            DirectBookingConfiguration dbConfig = enabledConfig();
            dbConfig.setRequirePayment(true);
            when(configRepository.findEnabledByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(dbConfig));
            when(priceEngine.resolvePriceRange(eq(PROPERTY_ID), eq(checkIn), eq(checkOut), eq(ORG_ID)))
                    .thenReturn(Map.of(
                            checkIn, new BigDecimal("100.00"),
                            checkIn.plusDays(1), new BigDecimal("100.00"),
                            checkIn.plusDays(2), new BigDecimal("100.00")
                    ));
            when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> {
                Reservation r = inv.getArgument(0);
                r.setId(100L);
                return r;
            });

            // Stripe is enabled but will fail (no real API key) -> falls back to pending
            DirectBookingResponse response = service.createBooking(request, ORG_ID);

            // When Stripe fails, the reservation falls back to pending
            assertThat(response.status()).isEqualTo(DirectBookingResponse.STATUS_PENDING);
        }
    }

    // ================================================================
    // cancelBooking
    // ================================================================

    @Nested
    @DisplayName("cancelBooking")
    class CancelBooking {

        @Test
        @DisplayName("success frees calendar")
        void cancelBooking_success_freesCalendar() {
            Property property = activeProperty();
            Reservation reservation = new Reservation(property, "Jean Dupont",
                    futureCheckIn(), futureCheckOut(), "confirmed", "DIRECT");
            reservation.setId(100L);
            reservation.setOrganizationId(ORG_ID);
            reservation.setConfirmationCode("DB-ABCD1234");

            when(reservationRepository.findAll()).thenReturn(List.of(reservation));
            when(reservationRepository.save(any(Reservation.class))).thenReturn(reservation);

            service.cancelBooking("DB-ABCD1234", "Changement de plans", ORG_ID);

            // Verify status updated to cancelled
            ArgumentCaptor<Reservation> captor = ArgumentCaptor.forClass(Reservation.class);
            verify(reservationRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo("cancelled");

            // Verify calendar freed
            verify(calendarEngine).cancel(eq(100L), eq(ORG_ID), eq("system"));
        }

        @Test
        @DisplayName("unknown booking id throws")
        void cancelBooking_unknownId_throws() {
            when(reservationRepository.findAll()).thenReturn(List.of());

            assertThatThrownBy(() -> service.cancelBooking("DB-UNKNOWN", "reason", ORG_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }
    }

    // ================================================================
    // applyPromoCode
    // ================================================================

    @Nested
    @DisplayName("applyPromoCode")
    class ApplyPromoCode {

        @Test
        @DisplayName("valid code returns DTO")
        void applyPromoCode_valid_returnsDto() {
            PromoCode promo = new PromoCode(ORG_ID, "SUMMER10",
                    PromoCode.DiscountType.PERCENTAGE, new BigDecimal("10"));
            promo.setActive(true);
            promo.setValidFrom(LocalDate.now().minusDays(30));
            promo.setValidUntil(LocalDate.now().plusDays(30));

            when(promoCodeRepository.findByCodeAndOrganizationId("SUMMER10", ORG_ID))
                    .thenReturn(Optional.of(promo));

            DirectPromoCodeDto dto = service.applyPromoCode("SUMMER10", PROPERTY_ID, ORG_ID);

            assertThat(dto.code()).isEqualTo("SUMMER10");
            assertThat(dto.discountType()).isEqualTo("PERCENTAGE");
            assertThat(dto.discountValue()).isEqualByComparingTo("10");
        }

        @Test
        @DisplayName("invalid code throws")
        void applyPromoCode_invalid_throws() {
            when(promoCodeRepository.findByCodeAndOrganizationId("INVALID", ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.applyPromoCode("INVALID", PROPERTY_ID, ORG_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("invalide");
        }

        @Test
        @DisplayName("expired code throws")
        void applyPromoCode_expired_throws() {
            PromoCode promo = new PromoCode(ORG_ID, "EXPIRED",
                    PromoCode.DiscountType.PERCENTAGE, new BigDecimal("10"));
            promo.setActive(true);
            promo.setValidFrom(LocalDate.of(2025, 1, 1));
            promo.setValidUntil(LocalDate.of(2025, 6, 30));

            when(promoCodeRepository.findByCodeAndOrganizationId("EXPIRED", ORG_ID))
                    .thenReturn(Optional.of(promo));

            assertThatThrownBy(() -> service.applyPromoCode("EXPIRED", PROPERTY_ID, ORG_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("expire");
        }

        @Test
        @DisplayName("code not applicable to property throws")
        void applyPromoCode_notApplicable_throws() {
            PromoCode promo = new PromoCode(ORG_ID, "VILLA_ONLY",
                    PromoCode.DiscountType.PERCENTAGE, new BigDecimal("10"));
            promo.setActive(true);
            promo.setPropertyId(999L); // specific to another property

            when(promoCodeRepository.findByCodeAndOrganizationId("VILLA_ONLY", ORG_ID))
                    .thenReturn(Optional.of(promo));

            assertThatThrownBy(() -> service.applyPromoCode("VILLA_ONLY", PROPERTY_ID, ORG_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("non applicable");
        }
    }
}
