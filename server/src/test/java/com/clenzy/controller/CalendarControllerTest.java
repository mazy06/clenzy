package com.clenzy.controller;

import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.channel.AirbnbChannelAdapter;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.*;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.ReservationService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CalendarControllerTest {

    @Mock private CalendarEngine calendarEngine;
    @Mock private ReservationService reservationService;
    @Mock private TenantContext tenantContext;
    @Mock private PriceEngine priceEngine;
    @Mock private AirbnbChannelAdapter airbnbChannelAdapter;

    private CalendarController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new CalendarController(calendarEngine,
                reservationService, tenantContext, priceEngine, airbnbChannelAdapter);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    /**
     * T-ARCH-08 : l'acces est valide par le mecanisme transverse
     * ReservationService.validatePropertyAccess (mock silencieux = acces accorde).
     */
    private void setupSuperAdminAccess(Long propertyId) {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
    }

    @Nested
    @DisplayName("getAvailability")
    class GetAvailability {
        @Test
        void whenAdmin_thenReturnsDays() {
            setupSuperAdminAccess(1L);
            CalendarDay day = mock(CalendarDay.class);
            when(day.getDate()).thenReturn(LocalDate.of(2026, 3, 1));
            when(day.getStatus()).thenReturn(CalendarDayStatus.AVAILABLE);
            when(calendarEngine.getDays(1L, LocalDate.of(2026, 3, 1),
                    LocalDate.of(2026, 3, 31), 1L)).thenReturn(List.of(day));

            ResponseEntity<List<Map<String, Object>>> response = controller.getAvailability(
                    1L, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31), jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void whenPropertyNotFound_thenThrows() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            doThrow(new NotFoundException("Propriete introuvable: 99"))
                    .when(reservationService).validatePropertyAccess(99L, "user-123");

            assertThatThrownBy(() -> controller.getAvailability(
                    99L, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31), jwt))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("blockDates")
    class BlockDates {
        @Test
        void whenAdmin_thenBlocksDates() {
            setupSuperAdminAccess(1L);
            CalendarDay day = mock(CalendarDay.class);
            when(calendarEngine.block(eq(1L), eq(LocalDate.of(2026, 3, 1)), eq(LocalDate.of(2026, 3, 5)),
                    eq(1L), eq("MANUAL"), eq("Travaux"), eq("user-123"))).thenReturn(List.of(day, day, day, day));

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("from", "2026-03-01");
            body.put("to", "2026-03-05");
            body.put("notes", "Travaux");

            ResponseEntity<Map<String, Object>> response = controller.blockDates(1L, body, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("daysBlocked", 4);
            assertThat(response.getBody()).containsEntry("status", "BLOCKED");
        }
    }

    @Nested
    @DisplayName("unblockDates")
    class UnblockDates {
        @Test
        void whenAdmin_thenUnblocksDates() {
            setupSuperAdminAccess(1L);
            when(calendarEngine.unblock(1L, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5), 1L, "user-123"))
                    .thenReturn(4);

            ResponseEntity<Map<String, Object>> response = controller.unblockDates(
                    1L, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5), jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("daysUnblocked", 4);
            assertThat(response.getBody()).containsEntry("status", "UNBLOCKED");
        }
    }

    @Nested
    @DisplayName("updatePrice")
    class UpdatePrice {
        @Test
        void whenAdmin_thenUpdatesManualPrice() {
            setupSuperAdminAccess(1L);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("from", "2026-03-01");
            body.put("to", "2026-03-05");
            body.put("price", 150);

            ResponseEntity<Map<String, Object>> response = controller.updatePrice(1L, body, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("status", "UPDATED");
            // Z5-BUGS-04 : le prix saisi manuellement passe par updateManualPrice
            // (calendar_days + RateOverride source MANUAL visible du PriceEngine)
            verify(calendarEngine).updateManualPrice(eq(1L), eq(LocalDate.of(2026, 3, 1)),
                    eq(LocalDate.of(2026, 3, 5)), eq(new BigDecimal("150")), eq(1L), eq("user-123"));
        }
    }

    @Nested
    @DisplayName("getPricing")
    class GetPricing {
        @Test
        void whenAdmin_thenReturnsPricingInfo() {
            setupSuperAdminAccess(1L);
            LocalDate from = LocalDate.of(2026, 3, 1);
            LocalDate to = LocalDate.of(2026, 3, 3);

            when(calendarEngine.getDays(1L, from, to, 1L)).thenReturn(List.of());
            Map<LocalDate, PriceEngine.ResolvedPrice> prices = new LinkedHashMap<>();
            prices.put(from, new PriceEngine.ResolvedPrice(BigDecimal.valueOf(100), "BASE"));
            prices.put(from.plusDays(1), new PriceEngine.ResolvedPrice(BigDecimal.valueOf(120), "BASE"));
            when(priceEngine.resolvePriceRangeWithSource(1L, from, to, 1L)).thenReturn(prices);

            ResponseEntity<List<Map<String, Object>>> response = controller.getPricing(1L, from, to, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(2);
        }
    }

    /**
     * T-ARCH-09 : le push n'est plus factice — l'endpoint delegue reellement a
     * AirbnbChannelAdapter.pushCalendarUpdate et reflete son resultat (PUSHED /
     * SKIPPED 409 / FAILED 502) au lieu de toujours repondre "PUSHED".
     */
    @Nested
    @DisplayName("pushPricing")
    class PushPricing {
        @Test
        void whenAdapterSucceeds_thenReturnsPushedWithDaysPushed() {
            // Arrange
            setupSuperAdminAccess(1L);
            when(airbnbChannelAdapter.pushCalendarUpdate(eq(1L), any(LocalDate.class), any(LocalDate.class), eq(1L)))
                    .thenReturn(SyncResult.success(90, 1200L));

            // Act
            ResponseEntity<Map<String, Object>> response = controller.pushPricing(1L, jwt);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("status", "PUSHED");
            assertThat(response.getBody()).containsEntry("daysResolved", 90);
            LocalDate from = LocalDate.now();
            verify(airbnbChannelAdapter).pushCalendarUpdate(1L, from,
                    from.plusDays(CalendarController.PUSH_PRICING_HORIZON_DAYS), 1L);
        }

        @Test
        void whenNoAirbnbMapping_thenReturns409Skipped() {
            // Arrange
            setupSuperAdminAccess(1L);
            when(airbnbChannelAdapter.pushCalendarUpdate(eq(1L), any(LocalDate.class), any(LocalDate.class), eq(1L)))
                    .thenReturn(SyncResult.skipped("Aucun mapping Airbnb pour propriete 1"));

            // Act
            ResponseEntity<Map<String, Object>> response = controller.pushPricing(1L, jwt);

            // Assert : plus de fausse confirmation quand rien n'a ete pousse
            assertThat(response.getStatusCode().value()).isEqualTo(409);
            assertThat(response.getBody()).containsEntry("status", "SKIPPED");
            assertThat(response.getBody()).containsEntry("daysResolved", 0);
        }

        @Test
        void whenAirbnbApiFails_thenReturns502Failed() {
            // Arrange
            setupSuperAdminAccess(1L);
            when(airbnbChannelAdapter.pushCalendarUpdate(eq(1L), any(LocalDate.class), any(LocalDate.class), eq(1L)))
                    .thenReturn(SyncResult.failed("Pas de token OAuth Airbnb valide"));

            // Act
            ResponseEntity<Map<String, Object>> response = controller.pushPricing(1L, jwt);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(502);
            assertThat(response.getBody()).containsEntry("status", "FAILED");
        }
    }

    /**
     * T-ARCH-08 : la regle d'acces elle-meme (org + super admin + platform staff
     * + owner) est testee sur ReservationService.validatePropertyAccess
     * (ReservationServiceTest) ; ici on verifie la delegation et la propagation.
     */
    @Nested
    @DisplayName("validatePropertyAccess")
    class ValidateAccess {
        @Test
        void whenDifferentOrg_thenThrows() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            doThrow(new AccessDeniedException("Acces refuse : propriete hors de votre organisation"))
                    .when(reservationService).validatePropertyAccess(1L, "user-123");

            assertThatThrownBy(() -> controller.getAvailability(
                    1L, LocalDate.now(), LocalDate.now().plusDays(1), jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void whenUserIsOwner_thenAllows() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            // Mock silencieux = la regle transverse accorde l'acces (owner)

            when(calendarEngine.getDays(1L, LocalDate.of(2026, 3, 1),
                    LocalDate.of(2026, 3, 5), 1L)).thenReturn(List.of());

            ResponseEntity<List<Map<String, Object>>> response = controller.getAvailability(
                    1L, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5), jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(reservationService).validatePropertyAccess(1L, "user-123");
        }

        @Test
        void whenUserIsHostNotOwner_thenAccessDenied() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            doThrow(new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete"))
                    .when(reservationService).validatePropertyAccess(1L, "user-123");

            assertThatThrownBy(() -> controller.getAvailability(
                    1L, LocalDate.now(), LocalDate.now().plusDays(1), jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    @Nested
    @DisplayName("getBlockedDays - batch")
    class GetBlockedDays {
        @Test
        void whenCalled_thenReturnsBlockedDays() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Property prop = mock(Property.class);
            when(prop.getId()).thenReturn(10L);

            CalendarDay day = mock(CalendarDay.class);
            when(day.getDate()).thenReturn(LocalDate.of(2026, 3, 1));
            when(day.getStatus()).thenReturn(CalendarDayStatus.BLOCKED);
            when(day.getSource()).thenReturn("MANUAL");
            when(day.getNotes()).thenReturn("test");
            when(day.getProperty()).thenReturn(prop);

            when(calendarEngine.getBlockedOrMaintenanceDays(
                anyList(), any(LocalDate.class), any(LocalDate.class), eq(1L)))
                .thenReturn(List.of(day));

            ResponseEntity<List<Map<String, Object>>> response = controller.getBlockedDays(
                List.of(10L, 11L), LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31),
                org.mockito.Mockito.mock(org.springframework.security.oauth2.jwt.Jwt.class));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("blockDates with source override")
    class BlockDatesWithSource {
        @Test
        void whenSourceProvided_thenUsesIt() {
            setupSuperAdminAccess(1L);
            when(calendarEngine.block(eq(1L), any(LocalDate.class), any(LocalDate.class),
                    eq(1L), eq("AIRBNB"), eq("Booked"), eq("user-123")))
                    .thenReturn(List.of(mock(CalendarDay.class)));

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("from", "2026-04-01");
            body.put("to", "2026-04-05");
            body.put("notes", "Booked");
            body.put("source", "AIRBNB");

            ResponseEntity<Map<String, Object>> response = controller.blockDates(1L, body, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("daysBlocked", 1);
        }
    }

    @Nested
    @DisplayName("getPricing with overrides and plans")
    class GetPricingExt {
        @Test
        void whenOverrideExists_thenSourceIsOverride() {
            setupSuperAdminAccess(1L);
            LocalDate from = LocalDate.of(2026, 5, 1);
            LocalDate to = LocalDate.of(2026, 5, 3);

            when(calendarEngine.getDays(1L, from, to, 1L)).thenReturn(List.of());
            Map<LocalDate, PriceEngine.ResolvedPrice> prices = new LinkedHashMap<>();
            prices.put(from, new PriceEngine.ResolvedPrice(BigDecimal.valueOf(150), "OVERRIDE"));
            prices.put(from.plusDays(1), new PriceEngine.ResolvedPrice(BigDecimal.valueOf(150), "PROPERTY_DEFAULT"));
            when(priceEngine.resolvePriceRangeWithSource(1L, from, to, 1L)).thenReturn(prices);

            ResponseEntity<List<Map<String, Object>>> response = controller.getPricing(1L, from, to, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(2);
            assertThat(response.getBody().get(0)).containsEntry("priceSource", "OVERRIDE");
            assertThat(response.getBody().get(1)).containsEntry("priceSource", "PROPERTY_DEFAULT");
        }

        @Test
        void whenEventPlanWins_thenSourceComesFromPriceEngine() {
            // T-ARCH-04 : la source vient du PriceEngine (cascade unique), y compris
            // pour les types EVENT/WEEKEND/EARLY_BIRD absents de l'ancienne copie locale
            setupSuperAdminAccess(1L);
            LocalDate from = LocalDate.of(2026, 5, 1);
            LocalDate to = LocalDate.of(2026, 5, 2);

            when(calendarEngine.getDays(1L, from, to, 1L)).thenReturn(List.of());
            Map<LocalDate, PriceEngine.ResolvedPrice> prices = new LinkedHashMap<>();
            prices.put(from, new PriceEngine.ResolvedPrice(BigDecimal.valueOf(250), "EVENT"));
            when(priceEngine.resolvePriceRangeWithSource(1L, from, to, 1L)).thenReturn(prices);

            ResponseEntity<List<Map<String, Object>>> response = controller.getPricing(1L, from, to, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get(0)).containsEntry("priceSource", "EVENT");
            assertThat(response.getBody().get(0)).containsEntry("nightlyPrice", 250.0);
        }
    }

    @Nested
    @DisplayName("getAvailability edge cases")
    class GetAvailabilityEdges {
        @Test
        void whenEmptyDays_thenReturnsEmptyList() {
            setupSuperAdminAccess(1L);
            when(calendarEngine.getDays(eq(1L), any(LocalDate.class),
                any(LocalDate.class), eq(1L))).thenReturn(List.of());

            ResponseEntity<List<Map<String, Object>>> response = controller.getAvailability(
                    1L, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5), jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isEmpty();
        }
    }
}
