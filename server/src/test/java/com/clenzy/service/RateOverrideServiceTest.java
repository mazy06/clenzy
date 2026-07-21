package com.clenzy.service;

import com.clenzy.dto.RateOverrideDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests de RateOverrideService — logique deplacee de RateOverrideController
 * (T-ARCH-01). La regle d'acces propriete elle-meme est testee sur
 * ReservationService.validatePropertyAccess (ReservationServiceTest).
 */
@ExtendWith(MockitoExtension.class)
class RateOverrideServiceTest {

    @Mock private RateOverrideRepository rateOverrideRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private ReservationService reservationService;
    @Mock private TenantContext tenantContext;
    @Mock private SearchCacheInvalidator searchCacheInvalidator;

    @InjectMocks
    private RateOverrideService service;

    @Nested
    @DisplayName("getByPropertyAndRange")
    class GetByRange {
        @Test
        void whenAccessGranted_thenReturnsList() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            RateOverride override = mock(RateOverride.class);
            Property property = mock(Property.class);
            when(property.getId()).thenReturn(1L);
            when(override.getProperty()).thenReturn(property);
            when(override.getDate()).thenReturn(LocalDate.of(2026, 3, 1));
            when(override.getNightlyPrice()).thenReturn(BigDecimal.valueOf(120));
            when(rateOverrideRepository.findByPropertyIdAndDateRange(1L, LocalDate.of(2026, 3, 1),
                    LocalDate.of(2026, 3, 31), 1L)).thenReturn(List.of(override));

            List<RateOverrideDto> result = service.getByPropertyAndRange(
                    1L, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31), "user-123");

            assertThat(result).hasSize(1);
            assertThat(result.get(0).nightlyPrice()).isEqualTo(120.0);
            verify(reservationService).validatePropertyAccess(1L, "user-123");
        }

        @Test
        void whenAccessDenied_thenThrows() {
            doThrow(new AccessDeniedException("Acces refuse : propriete hors de votre organisation"))
                    .when(reservationService).validatePropertyAccess(1L, "intruder");

            assertThatThrownBy(() -> service.getByPropertyAndRange(
                    1L, LocalDate.now(), LocalDate.now().plusDays(1), "intruder"))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenValid_thenCreatesWithManualSourceByDefault() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Property property = mock(Property.class);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(rateOverrideRepository.save(any(RateOverride.class))).thenAnswer(inv -> inv.getArgument(0));

            RateOverrideDto dto = new RateOverrideDto(null, 1L, "2026-03-15", 150.0, null, null);

            RateOverrideDto result = service.create(dto, "user-123");

            // Semantique source MANUAL/YIELD_RULE : repli MANUAL si absente
            assertThat(result.source()).isEqualTo("MANUAL");
            ArgumentCaptor<RateOverride> captor = ArgumentCaptor.forClass(RateOverride.class);
            verify(rateOverrideRepository).save(captor.capture());
            assertThat(captor.getValue().getNightlyPrice()).isEqualByComparingTo("150");
            assertThat(captor.getValue().getCreatedBy()).isEqualTo("user-123");
        }

        @Test
        void whenSourceProvided_thenKeepsIt() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Property property = mock(Property.class);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(rateOverrideRepository.save(any(RateOverride.class))).thenAnswer(inv -> inv.getArgument(0));

            RateOverrideDto dto = new RateOverrideDto(null, 1L, "2026-03-15", 150.0, "YIELD_RULE", "EUR");

            RateOverrideDto result = service.create(dto, "user-123");

            assertThat(result.source()).isEqualTo("YIELD_RULE");
        }

        @Test
        void whenCurrencyAbsent_thenFallsBackToPropertyDefaultThenEur() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Property property = mock(Property.class);
            when(property.getDefaultCurrency()).thenReturn(null);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(rateOverrideRepository.save(any(RateOverride.class))).thenAnswer(inv -> inv.getArgument(0));

            RateOverrideDto dto = new RateOverrideDto(null, 1L, "2026-03-15", 150.0, null, null);

            RateOverrideDto result = service.create(dto, "user-123");

            assertThat(result.currency()).isEqualTo("EUR");
        }

        @Test
        void whenPropertyMissing_thenThrows() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.empty());

            RateOverrideDto dto = new RateOverrideDto(null, 1L, "2026-03-15", 150.0, null, null);

            assertThatThrownBy(() -> service.create(dto, "user-123"))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("createBulk")
    class CreateBulk {
        @Test
        @SuppressWarnings("unchecked")
        void whenValid_thenCreatesOnePerDay() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Property property = mock(Property.class);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            // Batch (audit perf P2-2) : plage prechargee en une requete, aucun
            // override existant — tout est cree puis sauve en un seul saveAll.
            when(rateOverrideRepository.findByPropertyIdAndDateRange(
                    1L, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 4), 1L))
                    .thenReturn(List.of());

            Map<String, Object> body = Map.of(
                    "propertyId", 1L,
                    "from", "2026-03-01",
                    "to", "2026-03-04",
                    "nightlyPrice", 120
            );

            Map<String, Object> result = service.createBulk(body, "user-123");

            assertThat(result.get("count")).isEqualTo(3);
            ArgumentCaptor<List<RateOverride>> captor = ArgumentCaptor.forClass(List.class);
            verify(rateOverrideRepository).saveAll(captor.capture());
            assertThat(captor.getValue()).hasSize(3);
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenExistingOverrideInRange_thenItIsUpdatedNotDuplicated() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Property property = mock(Property.class);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            RateOverride existing = new RateOverride(property, LocalDate.of(2026, 3, 2),
                    BigDecimal.valueOf(90), "MANUAL", 1L);
            when(rateOverrideRepository.findByPropertyIdAndDateRange(
                    1L, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 4), 1L))
                    .thenReturn(List.of(existing));

            Map<String, Object> body = Map.of(
                    "propertyId", 1L,
                    "from", "2026-03-01",
                    "to", "2026-03-04",
                    "nightlyPrice", 120
            );

            Map<String, Object> result = service.createBulk(body, "user-123");

            // Upsert : 3 dates dont 1 existante mise a jour en place
            assertThat(result.get("count")).isEqualTo(3);
            ArgumentCaptor<List<RateOverride>> captor = ArgumentCaptor.forClass(List.class);
            verify(rateOverrideRepository).saveAll(captor.capture());
            assertThat(captor.getValue()).hasSize(3).contains(existing);
            assertThat(existing.getNightlyPrice()).isEqualByComparingTo("120");
        }

        @Test
        void whenAccessDenied_thenNeverSaves() {
            doThrow(new AccessDeniedException("Acces refuse : propriete hors de votre organisation"))
                    .when(reservationService).validatePropertyAccess(1L, "intruder");

            Map<String, Object> body = Map.of(
                    "propertyId", 1L,
                    "from", "2026-03-01",
                    "to", "2026-03-04",
                    "nightlyPrice", 120
            );

            assertThatThrownBy(() -> service.createBulk(body, "intruder"))
                    .isInstanceOf(AccessDeniedException.class);
            verify(rateOverrideRepository, never()).saveAll(any());
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenAccessGranted_thenDeletes() {
            Property property = mock(Property.class);
            when(property.getId()).thenReturn(1L);
            RateOverride existing = mock(RateOverride.class);
            when(existing.getProperty()).thenReturn(property);
            when(rateOverrideRepository.findById(10L)).thenReturn(Optional.of(existing));

            service.delete(10L, "user-123");

            verify(reservationService).validatePropertyAccess(1L, "user-123");
            verify(rateOverrideRepository).delete(existing);
        }

        @Test
        void whenNotFound_thenThrows() {
            when(rateOverrideRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.delete(99L, "user-123"))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenAccessDenied_thenNeverDeletes() {
            Property property = mock(Property.class);
            when(property.getId()).thenReturn(1L);
            RateOverride existing = mock(RateOverride.class);
            when(existing.getProperty()).thenReturn(property);
            when(rateOverrideRepository.findById(10L)).thenReturn(Optional.of(existing));
            doThrow(new AccessDeniedException("Acces refuse : propriete hors de votre organisation"))
                    .when(reservationService).validatePropertyAccess(1L, "intruder");

            assertThatThrownBy(() -> service.delete(10L, "intruder"))
                    .isInstanceOf(AccessDeniedException.class);
            verify(rateOverrideRepository, never()).delete(any());
        }
    }
}
