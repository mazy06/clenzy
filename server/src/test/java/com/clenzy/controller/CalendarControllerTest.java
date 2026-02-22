package com.clenzy.controller;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.PriceEngine;
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
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;
    @Mock private PriceEngine priceEngine;
    @Mock private RatePlanRepository ratePlanRepository;
    @Mock private RateOverrideRepository rateOverrideRepository;

    private CalendarController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new CalendarController(calendarEngine, calendarDayRepository,
                propertyRepository, userRepository, tenantContext, priceEngine,
                ratePlanRepository, rateOverrideRepository);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private void setupSuperAdminAccess(Long propertyId) {
        Property property = mock(Property.class);
        when(property.getOrganizationId()).thenReturn(1L);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(tenantContext.isSuperAdmin()).thenReturn(true);
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
            when(calendarDayRepository.findByPropertyAndDateRange(1L, LocalDate.of(2026, 3, 1),
                    LocalDate.of(2026, 3, 31), 1L)).thenReturn(List.of(day));

            ResponseEntity<List<Map<String, Object>>> response = controller.getAvailability(
                    1L, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31), jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void whenPropertyNotFound_thenThrows() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(99L)).thenReturn(Optional.empty());

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
        void whenAdmin_thenUpdatesPrice() {
            setupSuperAdminAccess(1L);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("from", "2026-03-01");
            body.put("to", "2026-03-05");
            body.put("price", 150);

            ResponseEntity<Map<String, Object>> response = controller.updatePrice(1L, body, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("status", "UPDATED");
            verify(calendarEngine).updatePrice(eq(1L), eq(LocalDate.of(2026, 3, 1)),
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

            when(calendarDayRepository.findByPropertyAndDateRange(1L, from, to, 1L)).thenReturn(List.of());
            Map<LocalDate, BigDecimal> prices = new LinkedHashMap<>();
            prices.put(from, BigDecimal.valueOf(100));
            prices.put(from.plusDays(1), BigDecimal.valueOf(120));
            when(priceEngine.resolvePriceRange(1L, from, to, 1L)).thenReturn(prices);
            when(rateOverrideRepository.findByPropertyIdAndDateRange(1L, from, to, 1L)).thenReturn(List.of());
            when(ratePlanRepository.findActiveByPropertyId(1L, 1L)).thenReturn(List.of());

            ResponseEntity<List<Map<String, Object>>> response = controller.getPricing(1L, from, to, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(2);
        }
    }

    @Nested
    @DisplayName("pushPricing")
    class PushPricing {
        @Test
        void whenAdmin_thenReturnsPushedStatus() {
            setupSuperAdminAccess(1L);
            Map<LocalDate, BigDecimal> prices = Map.of(
                    LocalDate.now(), BigDecimal.valueOf(100)
            );
            when(priceEngine.resolvePriceRange(eq(1L), any(LocalDate.class), any(LocalDate.class), eq(1L)))
                    .thenReturn(prices);

            ResponseEntity<Map<String, Object>> response = controller.pushPricing(1L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("status", "PUSHED");
            assertThat(response.getBody()).containsEntry("daysResolved", 1);
        }
    }

    @Nested
    @DisplayName("validatePropertyAccess")
    class ValidateAccess {
        @Test
        void whenDifferentOrg_thenThrows() {
            Property property = mock(Property.class);
            when(property.getOrganizationId()).thenReturn(2L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            assertThatThrownBy(() -> controller.getAvailability(
                    1L, LocalDate.now(), LocalDate.now().plusDays(1), jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }
}
