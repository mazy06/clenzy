package com.clenzy.controller;

import com.clenzy.dto.MinNightsOverrideDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.MinNightsOverride;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.MinNightsOverrideRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MinNightsOverrideControllerTest {

    @Mock private MinNightsOverrideRepository overrideRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;

    private MinNightsOverrideController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new MinNightsOverrideController(
                overrideRepository, propertyRepository, userRepository, tenantContext);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "kc-user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private Property property(Long id, Long orgId, Long ownerId) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(orgId);
        if (ownerId != null) {
            User owner = new User();
            owner.setId(ownerId);
            p.setOwner(owner);
        }
        return p;
    }

    private User user(Long id, UserRole role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        return u;
    }

    private MinNightsOverride override(Long id, Property property, LocalDate date, int minNights) {
        MinNightsOverride mno = new MinNightsOverride(property, date, minNights, "MANUAL", 1L);
        mno.setId(id);
        return mno;
    }

    // ── GET byPropertyAndRange ────────────────────────────────────────────

    @Nested
    @DisplayName("getByPropertyAndRange")
    class GetByPropertyAndRange {
        @Test
        void returnsList() {
            Property prop = property(100L, 1L, 42L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            lenient().when(tenantContext.isSuperAdmin()).thenReturn(true);

            LocalDate from = LocalDate.of(2026, 5, 1);
            LocalDate to = LocalDate.of(2026, 5, 31);
            MinNightsOverride o1 = override(1L, prop, from.plusDays(5), 3);
            when(overrideRepository.findByPropertyIdAndDateRange(100L, from, to, 1L))
                    .thenReturn(List.of(o1));

            ResponseEntity<List<MinNightsOverrideDto>> response =
                    controller.getByPropertyAndRange(100L, from, to, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).minNights()).isEqualTo(3);
        }

        @Test
        void propertyNotFound_throws() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.empty());

            assertThatThrownBy(() ->
                    controller.getByPropertyAndRange(100L, LocalDate.now(), LocalDate.now().plusDays(1), jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void propertyInOtherOrg_throwsAccessDenied() {
            Property prop = property(100L, 99L, 42L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));

            assertThatThrownBy(() ->
                    controller.getByPropertyAndRange(100L, LocalDate.now(), LocalDate.now().plusDays(1), jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void userIsOwner_allowed() {
            Property prop = property(100L, 1L, 42L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            User u = user(42L, UserRole.HOST);
            when(userRepository.findByKeycloakId("kc-user-123")).thenReturn(Optional.of(u));
            when(overrideRepository.findByPropertyIdAndDateRange(anyLong(), any(), any(), anyLong()))
                    .thenReturn(List.of());

            ResponseEntity<List<MinNightsOverrideDto>> response = controller.getByPropertyAndRange(
                    100L, LocalDate.now(), LocalDate.now().plusDays(1), jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void userIsPlatformStaff_allowed() {
            Property prop = property(100L, 1L, 42L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            User staff = user(9L, UserRole.SUPER_MANAGER);
            when(userRepository.findByKeycloakId("kc-user-123")).thenReturn(Optional.of(staff));
            when(overrideRepository.findByPropertyIdAndDateRange(anyLong(), any(), any(), anyLong()))
                    .thenReturn(List.of());

            ResponseEntity<List<MinNightsOverrideDto>> response = controller.getByPropertyAndRange(
                    100L, LocalDate.now(), LocalDate.now().plusDays(1), jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void userNotOwnerNotStaff_denied() {
            Property prop = property(100L, 1L, 42L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            User other = user(7L, UserRole.HOST);
            when(userRepository.findByKeycloakId("kc-user-123")).thenReturn(Optional.of(other));

            assertThatThrownBy(() ->
                    controller.getByPropertyAndRange(100L, LocalDate.now(), LocalDate.now().plusDays(1), jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    // ── POST create ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void valid_returnsCreated() {
            Property prop = property(100L, 1L, null);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            lenient().when(tenantContext.isSuperAdmin()).thenReturn(true);
            MinNightsOverrideDto dto = new MinNightsOverrideDto(
                    null, 100L, "2026-06-15", 4, "MANUAL");
            when(overrideRepository.save(any(MinNightsOverride.class))).thenAnswer(inv -> {
                MinNightsOverride m = inv.getArgument(0);
                m.setId(123L);
                return m;
            });

            ResponseEntity<MinNightsOverrideDto> response = controller.create(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().minNights()).isEqualTo(4);
        }

        @Test
        void invalidMinNightsTooLow_throws() {
            Property prop = property(100L, 1L, null);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            lenient().when(tenantContext.isSuperAdmin()).thenReturn(true);
            MinNightsOverrideDto dto = new MinNightsOverrideDto(null, 100L, "2026-06-15", 0, null);

            assertThatThrownBy(() -> controller.create(dto, jwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("minNights doit etre");
        }

        @Test
        void invalidMinNightsTooHigh_throws() {
            Property prop = property(100L, 1L, null);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            lenient().when(tenantContext.isSuperAdmin()).thenReturn(true);
            MinNightsOverrideDto dto = new MinNightsOverrideDto(null, 100L, "2026-06-15", 366, null);

            assertThatThrownBy(() -> controller.create(dto, jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void nullMinNights_throws() {
            Property prop = property(100L, 1L, null);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            lenient().when(tenantContext.isSuperAdmin()).thenReturn(true);
            MinNightsOverrideDto dto = new MinNightsOverrideDto(null, 100L, "2026-06-15", null, null);

            assertThatThrownBy(() -> controller.create(dto, jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void sourceNull_defaultsToManual() {
            Property prop = property(100L, 1L, null);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            lenient().when(tenantContext.isSuperAdmin()).thenReturn(true);
            MinNightsOverrideDto dto = new MinNightsOverrideDto(null, 100L, "2026-06-15", 2, null);
            when(overrideRepository.save(any(MinNightsOverride.class))).thenAnswer(inv -> {
                MinNightsOverride m = inv.getArgument(0);
                m.setId(124L);
                return m;
            });

            ResponseEntity<MinNightsOverrideDto> response = controller.create(dto, jwt);

            assertThat(response.getBody().source()).isEqualTo("MANUAL");
        }
    }

    // ── POST bulk ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createBulk")
    class CreateBulk {
        @Test
        void valid_createsOverrideForEachDay() {
            Property prop = property(100L, 1L, null);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            lenient().when(tenantContext.isSuperAdmin()).thenReturn(true);

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

            ResponseEntity<Map<String, Object>> response = controller.createBulk(body, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("count")).isEqualTo(3);
            verify(overrideRepository, org.mockito.Mockito.times(3)).save(any(MinNightsOverride.class));
        }

        @Test
        void existingOverride_updatesInPlace() {
            Property prop = property(100L, 1L, null);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            lenient().when(tenantContext.isSuperAdmin()).thenReturn(true);

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

            ResponseEntity<Map<String, Object>> response = controller.createBulk(body, jwt);

            assertThat(response.getBody().get("count")).isEqualTo(1);
            assertThat(existing.getMinNights()).isEqualTo(7);
        }

        @Test
        void missingSource_defaultsToManual() {
            Property prop = property(100L, 1L, null);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            lenient().when(tenantContext.isSuperAdmin()).thenReturn(true);
            Map<String, Object> body = Map.of(
                    "propertyId", 100L,
                    "from", "2026-06-01",
                    "to", "2026-06-02",
                    "minNights", 2
            );
            when(overrideRepository.findByPropertyIdAndDate(anyLong(), any(), anyLong()))
                    .thenReturn(Optional.empty());
            when(overrideRepository.save(any(MinNightsOverride.class))).thenAnswer(inv -> inv.getArgument(0));

            ResponseEntity<Map<String, Object>> response = controller.createBulk(body, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void invalidMinNights_throws() {
            Property prop = property(100L, 1L, null);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            lenient().when(tenantContext.isSuperAdmin()).thenReturn(true);
            Map<String, Object> body = Map.of(
                    "propertyId", 100L,
                    "from", "2026-06-01",
                    "to", "2026-06-02",
                    "minNights", 0
            );

            assertThatThrownBy(() -> controller.createBulk(body, jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ── DELETE ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void valid_deletes() {
            Property prop = property(100L, 1L, null);
            MinNightsOverride existing = override(50L, prop, LocalDate.of(2026, 6, 1), 3);
            when(overrideRepository.findById(50L)).thenReturn(Optional.of(existing));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
            lenient().when(tenantContext.isSuperAdmin()).thenReturn(true);

            ResponseEntity<Void> response = controller.delete(50L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(overrideRepository).delete(existing);
        }

        @Test
        void notFound_throws() {
            when(overrideRepository.findById(50L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.delete(50L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void noAccess_throws() {
            Property prop = property(100L, 99L, 7L);
            MinNightsOverride existing = override(50L, prop, LocalDate.of(2026, 6, 1), 3);
            when(overrideRepository.findById(50L)).thenReturn(Optional.of(existing));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));

            assertThatThrownBy(() -> controller.delete(50L, jwt))
                    .isInstanceOf(AccessDeniedException.class);
            verify(overrideRepository, never()).delete(any());
        }
    }
}
