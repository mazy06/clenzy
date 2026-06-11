package com.clenzy.service;

import com.clenzy.dto.RatePlanDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.RatePlan;
import com.clenzy.model.RatePlanType;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RatePlanRepository;
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
import java.util.List;
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
 * Tests de RatePlanService — logique deplacee de RatePlanController
 * (T-ARCH-01). La regle d'acces propriete elle-meme est testee sur
 * ReservationService.validatePropertyAccess (ReservationServiceTest).
 */
@ExtendWith(MockitoExtension.class)
class RatePlanServiceTest {

    @Mock private RatePlanRepository ratePlanRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private ReservationService reservationService;
    @Mock private TenantContext tenantContext;

    @InjectMocks
    private RatePlanService service;

    @Nested
    @DisplayName("getByProperty")
    class GetByProperty {
        @Test
        void whenAccessGranted_thenReturnsPlans() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            RatePlan plan = mock(RatePlan.class);
            when(plan.getProperty()).thenReturn(mock(Property.class));
            when(plan.getType()).thenReturn(RatePlanType.BASE);
            when(plan.getNightlyPrice()).thenReturn(BigDecimal.valueOf(100));
            when(ratePlanRepository.findAllByPropertyId(1L, 1L)).thenReturn(List.of(plan));

            List<RatePlanDto> result = service.getByProperty(1L, "user-123");

            assertThat(result).hasSize(1);
            verify(reservationService).validatePropertyAccess(1L, "user-123");
        }

        @Test
        void whenPropertyNotFound_thenThrows() {
            doThrow(new NotFoundException("Propriete introuvable: 99"))
                    .when(reservationService).validatePropertyAccess(99L, "user-123");

            assertThatThrownBy(() -> service.getByProperty(99L, "user-123"))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenValid_thenCreatesWithDefaults() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Property property = mock(Property.class);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(ratePlanRepository.save(any(RatePlan.class))).thenAnswer(inv -> inv.getArgument(0));

            RatePlanDto dto = new RatePlanDto(null, 1L, "Summer", "SEASONAL", 1, 150.0, "EUR",
                    "2026-06-01", "2026-09-01", null, null, true);

            RatePlanDto result = service.create(dto, "user-123");

            assertThat(result.name()).isEqualTo("Summer");
            assertThat(result.type()).isEqualTo("SEASONAL");
            ArgumentCaptor<RatePlan> captor = ArgumentCaptor.forClass(RatePlan.class);
            verify(ratePlanRepository).save(captor.capture());
            assertThat(captor.getValue().getNightlyPrice()).isEqualByComparingTo("150");
        }

        @Test
        void whenOptionalFieldsNull_thenAppliesDefaults() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Property property = mock(Property.class);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(ratePlanRepository.save(any(RatePlan.class))).thenAnswer(inv -> inv.getArgument(0));

            RatePlanDto dto = new RatePlanDto(null, 1L, "Base", "BASE", null, 90.0, null,
                    null, null, null, null, null);

            RatePlanDto result = service.create(dto, "user-123");

            assertThat(result.priority()).isEqualTo(0);
            assertThat(result.currency()).isEqualTo("EUR");
            assertThat(result.isActive()).isTrue();
        }

        @Test
        void whenPropertyMissing_thenThrows() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.empty());

            RatePlanDto dto = new RatePlanDto(null, 1L, "Summer", "SEASONAL", 1, 150.0, "EUR",
                    null, null, null, null, true);

            assertThatThrownBy(() -> service.create(dto, "user-123"))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenAccessDenied_thenNeverSaves() {
            doThrow(new AccessDeniedException("Acces refuse : propriete hors de votre organisation"))
                    .when(reservationService).validatePropertyAccess(1L, "intruder");

            RatePlanDto dto = new RatePlanDto(null, 1L, "Summer", "SEASONAL", 1, 150.0, "EUR",
                    null, null, null, null, true);

            assertThatThrownBy(() -> service.create(dto, "intruder"))
                    .isInstanceOf(AccessDeniedException.class);
            verify(ratePlanRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("update")
    class Update {
        @Test
        void whenAccessGranted_thenAppliesPartialPatch() {
            Property property = mock(Property.class);
            when(property.getId()).thenReturn(1L);
            RatePlan existing = mock(RatePlan.class);
            when(existing.getProperty()).thenReturn(property);
            when(ratePlanRepository.findById(10L)).thenReturn(Optional.of(existing));

            RatePlan saved = mock(RatePlan.class);
            when(saved.getProperty()).thenReturn(property);
            when(saved.getType()).thenReturn(RatePlanType.SEASONAL);
            when(saved.getNightlyPrice()).thenReturn(BigDecimal.valueOf(200));
            when(ratePlanRepository.save(existing)).thenReturn(saved);

            RatePlanDto dto = new RatePlanDto(null, 1L, "Updated", null, null, 200.0, null,
                    null, null, null, null, null);

            RatePlanDto result = service.update(10L, dto, "user-123");

            assertThat(result.nightlyPrice()).isEqualTo(200.0);
            verify(existing).setName("Updated");
            verify(existing).setNightlyPrice(BigDecimal.valueOf(200.0));
            verify(existing, never()).setType(any());
            verify(reservationService).validatePropertyAccess(1L, "user-123");
        }

        @Test
        void whenPlanNotFound_thenThrows() {
            when(ratePlanRepository.findById(99L)).thenReturn(Optional.empty());

            RatePlanDto dto = new RatePlanDto(null, 1L, "Test", null, null, null, null,
                    null, null, null, null, null);

            assertThatThrownBy(() -> service.update(99L, dto, "user-123"))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenAccessDenied_thenNeverSaves() {
            Property property = mock(Property.class);
            when(property.getId()).thenReturn(1L);
            RatePlan existing = mock(RatePlan.class);
            when(existing.getProperty()).thenReturn(property);
            when(ratePlanRepository.findById(10L)).thenReturn(Optional.of(existing));
            doThrow(new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete"))
                    .when(reservationService).validatePropertyAccess(1L, "intruder");

            RatePlanDto dto = new RatePlanDto(null, 1L, "Test", null, null, null, null,
                    null, null, null, null, null);

            assertThatThrownBy(() -> service.update(10L, dto, "intruder"))
                    .isInstanceOf(AccessDeniedException.class);
            verify(ratePlanRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenAccessGranted_thenDeletes() {
            Property property = mock(Property.class);
            when(property.getId()).thenReturn(1L);
            RatePlan existing = mock(RatePlan.class);
            when(existing.getProperty()).thenReturn(property);
            when(ratePlanRepository.findById(10L)).thenReturn(Optional.of(existing));

            service.delete(10L, "user-123");

            verify(reservationService).validatePropertyAccess(1L, "user-123");
            verify(ratePlanRepository).delete(existing);
        }

        @Test
        void whenNotFound_thenThrows() {
            when(ratePlanRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.delete(99L, "user-123"))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenAccessDenied_thenNeverDeletes() {
            Property property = mock(Property.class);
            when(property.getId()).thenReturn(1L);
            RatePlan existing = mock(RatePlan.class);
            when(existing.getProperty()).thenReturn(property);
            when(ratePlanRepository.findById(10L)).thenReturn(Optional.of(existing));
            doThrow(new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete"))
                    .when(reservationService).validatePropertyAccess(1L, "intruder");

            assertThatThrownBy(() -> service.delete(10L, "intruder"))
                    .isInstanceOf(AccessDeniedException.class);
            verify(ratePlanRepository, never()).delete(any());
        }
    }
}
