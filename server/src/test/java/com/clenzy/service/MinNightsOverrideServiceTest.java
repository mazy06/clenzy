package com.clenzy.service;

import com.clenzy.dto.MinNightsOverrideDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.MinNightsOverride;
import com.clenzy.model.Property;
import com.clenzy.repository.MinNightsOverrideRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests de MinNightsOverrideService — logique deplacee de
 * MinNightsOverrideController (T-ARCH-01). La regle d'acces propriete
 * elle-meme (org + super admin + platform staff + owner) est testee sur
 * ReservationService.validatePropertyAccess (ReservationServiceTest) ;
 * ici on verifie la delegation, la propagation et la logique metier.
 */
@ExtendWith(MockitoExtension.class)
class MinNightsOverrideServiceTest {

    @Mock private MinNightsOverrideRepository overrideRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private ReservationService reservationService;
    @Mock private TenantContext tenantContext;

    @InjectMocks
    private MinNightsOverrideService service;

    private Property property(Long id, Long orgId) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(orgId);
        return p;
    }

    private MinNightsOverride override(Long id, Property property, LocalDate date, int minNights) {
        MinNightsOverride mno = new MinNightsOverride(property, date, minNights, "MANUAL", 1L);
        mno.setId(id);
        return mno;
    }

    // ── getByPropertyAndRange ────────────────────────────────────────────

    @Nested
    @DisplayName("getByPropertyAndRange")
    class GetByPropertyAndRange {
        @Test
        void returnsList() {
            Property prop = property(100L, 1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            LocalDate from = LocalDate.of(2026, 5, 1);
            LocalDate to = LocalDate.of(2026, 5, 31);
            MinNightsOverride o1 = override(1L, prop, from.plusDays(5), 3);
            when(overrideRepository.findByPropertyIdAndDateRange(100L, from, to, 1L))
                    .thenReturn(List.of(o1));

            List<MinNightsOverrideDto> result = service.getByPropertyAndRange(100L, from, to, "kc-user-123");

            assertThat(result).hasSize(1);
            assertThat(result.get(0).minNights()).isEqualTo(3);
            verify(reservationService).validatePropertyAccess(100L, "kc-user-123");
        }

        @Test
        void propertyNotFound_throws() {
            doThrow(new NotFoundException("Propriete introuvable: 100"))
                    .when(reservationService).validatePropertyAccess(100L, "kc-user-123");

            assertThatThrownBy(() ->
                    service.getByPropertyAndRange(100L, LocalDate.now(), LocalDate.now().plusDays(1), "kc-user-123"))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void propertyInOtherOrg_throwsAccessDenied() {
            doThrow(new AccessDeniedException("Acces refuse : propriete hors de votre organisation"))
                    .when(reservationService).validatePropertyAccess(100L, "kc-user-123");

            assertThatThrownBy(() ->
                    service.getByPropertyAndRange(100L, LocalDate.now(), LocalDate.now().plusDays(1), "kc-user-123"))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    // ── create ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void valid_returnsCreated() {
            Property prop = property(100L, 1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            MinNightsOverrideDto dto = new MinNightsOverrideDto(
                    null, 100L, "2026-06-15", 4, "MANUAL");
            when(overrideRepository.save(any(MinNightsOverride.class))).thenAnswer(inv -> {
                MinNightsOverride m = inv.getArgument(0);
                m.setId(123L);
                return m;
            });

            MinNightsOverrideDto result = service.create(dto, "kc-user-123");

            assertThat(result.minNights()).isEqualTo(4);
            assertThat(result.id()).isEqualTo(123L);
        }

        @Test
        void propertyMissingAfterAccessCheck_throws() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.empty());
            MinNightsOverrideDto dto = new MinNightsOverrideDto(null, 100L, "2026-06-15", 4, null);

            assertThatThrownBy(() -> service.create(dto, "kc-user-123"))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void invalidMinNightsTooLow_throws() {
            Property prop = property(100L, 1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            MinNightsOverrideDto dto = new MinNightsOverrideDto(null, 100L, "2026-06-15", 0, null);

            assertThatThrownBy(() -> service.create(dto, "kc-user-123"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("minNights doit etre");
        }

        @Test
        void invalidMinNightsTooHigh_throws() {
            Property prop = property(100L, 1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            MinNightsOverrideDto dto = new MinNightsOverrideDto(null, 100L, "2026-06-15", 366, null);

            assertThatThrownBy(() -> service.create(dto, "kc-user-123"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void nullMinNights_throws() {
            Property prop = property(100L, 1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            MinNightsOverrideDto dto = new MinNightsOverrideDto(null, 100L, "2026-06-15", null, null);

            assertThatThrownBy(() -> service.create(dto, "kc-user-123"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void sourceNull_defaultsToManual() {
            Property prop = property(100L, 1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            MinNightsOverrideDto dto = new MinNightsOverrideDto(null, 100L, "2026-06-15", 2, null);
            when(overrideRepository.save(any(MinNightsOverride.class))).thenAnswer(inv -> {
                MinNightsOverride m = inv.getArgument(0);
                m.setId(124L);
                return m;
            });

            MinNightsOverrideDto result = service.create(dto, "kc-user-123");

            assertThat(result.source()).isEqualTo("MANUAL");
        }
    }

    // ── createBulk ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("createBulk")
    class CreateBulk {
        @Test
        void valid_createsOverrideForEachDay() {
            Property prop = property(100L, 1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));

            // 3 jours: from 2026-06-01 inclusive to 2026-06-04 exclusive
            Map<String, Object> body = Map.of(
                    "propertyId", 100L,
                    "from", "2026-06-01",
                    "to", "2026-06-04",
                    "minNights", 5,
                    "source", "BATCH"
            );
            when(overrideRepository.findByPropertyIdAndDate(eq(100L), any(LocalDate.class), eq(1L)))
                    .thenReturn(Optional.empty());
            when(overrideRepository.save(any(MinNightsOverride.class))).thenAnswer(inv -> {
                MinNightsOverride m = inv.getArgument(0);
                m.setId(1L);
                return m;
            });

            Map<String, Object> result = service.createBulk(body, "kc-user-123");

            assertThat(result.get("count")).isEqualTo(3);
            verify(overrideRepository, times(3)).save(any(MinNightsOverride.class));
        }

        @Test
        void existingOverride_updatesInPlace() {
            Property prop = property(100L, 1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));

            Map<String, Object> body = Map.of(
                    "propertyId", 100L,
                    "from", "2026-06-01",
                    "to", "2026-06-02",  // 1 jour
                    "minNights", 7
            );
            MinNightsOverride existing = override(99L, prop, LocalDate.of(2026, 6, 1), 3);
            when(overrideRepository.findByPropertyIdAndDate(eq(100L), eq(LocalDate.of(2026, 6, 1)), eq(1L)))
                    .thenReturn(Optional.of(existing));
            when(overrideRepository.save(any(MinNightsOverride.class))).thenAnswer(inv -> inv.getArgument(0));

            Map<String, Object> result = service.createBulk(body, "kc-user-123");

            assertThat(result.get("count")).isEqualTo(1);
            assertThat(existing.getMinNights()).isEqualTo(7);
        }

        @Test
        void missingSource_defaultsToManual() {
            Property prop = property(100L, 1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            Map<String, Object> body = Map.of(
                    "propertyId", 100L,
                    "from", "2026-06-01",
                    "to", "2026-06-02",
                    "minNights", 2
            );
            when(overrideRepository.findByPropertyIdAndDate(anyLong(), any(), anyLong()))
                    .thenReturn(Optional.empty());
            when(overrideRepository.save(any(MinNightsOverride.class))).thenAnswer(inv -> inv.getArgument(0));

            Map<String, Object> result = service.createBulk(body, "kc-user-123");

            assertThat(result.get("count")).isEqualTo(1);
        }

        @Test
        void invalidMinNights_throws() {
            Property prop = property(100L, 1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            Map<String, Object> body = Map.of(
                    "propertyId", 100L,
                    "from", "2026-06-01",
                    "to", "2026-06-02",
                    "minNights", 0
            );

            assertThatThrownBy(() -> service.createBulk(body, "kc-user-123"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void accessDenied_neverSaves() {
            doThrow(new AccessDeniedException("Acces refuse : propriete hors de votre organisation"))
                    .when(reservationService).validatePropertyAccess(100L, "kc-intruder");
            Map<String, Object> body = Map.of(
                    "propertyId", 100L,
                    "from", "2026-06-01",
                    "to", "2026-06-02",
                    "minNights", 2
            );

            assertThatThrownBy(() -> service.createBulk(body, "kc-intruder"))
                    .isInstanceOf(AccessDeniedException.class);
            verify(overrideRepository, never()).save(any());
        }
    }

    // ── delete ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void valid_deletes() {
            Property prop = property(100L, 1L);
            MinNightsOverride existing = override(50L, prop, LocalDate.of(2026, 6, 1), 3);
            when(overrideRepository.findById(50L)).thenReturn(Optional.of(existing));

            service.delete(50L, "kc-user-123");

            verify(reservationService).validatePropertyAccess(100L, "kc-user-123");
            verify(overrideRepository).delete(existing);
        }

        @Test
        void notFound_throws() {
            when(overrideRepository.findById(50L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.delete(50L, "kc-user-123"))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void noAccess_throws() {
            Property prop = property(100L, 99L);
            MinNightsOverride existing = override(50L, prop, LocalDate.of(2026, 6, 1), 3);
            when(overrideRepository.findById(50L)).thenReturn(Optional.of(existing));
            doThrow(new AccessDeniedException("Acces refuse : propriete hors de votre organisation"))
                    .when(reservationService).validatePropertyAccess(100L, "kc-user-123");

            assertThatThrownBy(() -> service.delete(50L, "kc-user-123"))
                    .isInstanceOf(AccessDeniedException.class);
            verify(overrideRepository, never()).delete(any());
        }
    }
}
