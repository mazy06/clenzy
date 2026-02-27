package com.clenzy.controller;

import com.clenzy.dto.RateOverrideDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.UserRepository;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RateOverrideControllerTest {

    @Mock private RateOverrideRepository rateOverrideRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;

    private RateOverrideController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new RateOverrideController(rateOverrideRepository, propertyRepository, userRepository, tenantContext);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private void setupOwnerAccess(Long propertyId) {
        Property property = mock(Property.class);
        when(property.getOrganizationId()).thenReturn(1L);
        User owner = mock(User.class);
        when(owner.getId()).thenReturn(1L);
        when(owner.getKeycloakId()).thenReturn("user-123");
        when(property.getOwner()).thenReturn(owner);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(tenantContext.isSuperAdmin()).thenReturn(false);
        when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(owner));
    }

    @Nested
    @DisplayName("getByPropertyAndRange")
    class GetByRange {
        @Test
        void whenOwner_thenReturnsList() {
            setupOwnerAccess(1L);
            RateOverride override = mock(RateOverride.class);
            Property property = mock(Property.class);
            when(property.getId()).thenReturn(1L);
            when(override.getProperty()).thenReturn(property);
            when(override.getDate()).thenReturn(LocalDate.of(2026, 3, 1));
            when(override.getNightlyPrice()).thenReturn(BigDecimal.valueOf(120));
            when(rateOverrideRepository.findByPropertyIdAndDateRange(1L, LocalDate.of(2026, 3, 1),
                    LocalDate.of(2026, 3, 31), 1L)).thenReturn(List.of(override));

            ResponseEntity<List<RateOverrideDto>> response = controller.getByPropertyAndRange(
                    1L, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31), jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenSuperAdmin_thenCreates() {
            Property property = mock(Property.class);
            when(property.getOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.isSuperAdmin()).thenReturn(true);

            RateOverride saved = mock(RateOverride.class);
            when(saved.getProperty()).thenReturn(property);
            when(saved.getDate()).thenReturn(LocalDate.of(2026, 3, 15));
            when(saved.getNightlyPrice()).thenReturn(BigDecimal.valueOf(150));
            when(saved.getSource()).thenReturn("MANUAL");
            when(rateOverrideRepository.save(any(RateOverride.class))).thenReturn(saved);

            RateOverrideDto dto = new RateOverrideDto(null, 1L, "2026-03-15", 150.0, null);

            ResponseEntity<RateOverrideDto> response = controller.create(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("createBulk")
    class CreateBulk {
        @Test
        void whenSuperAdmin_thenCreatesMultiple() {
            Property property = mock(Property.class);
            when(property.getOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            when(rateOverrideRepository.save(any(RateOverride.class))).thenAnswer(inv -> inv.getArgument(0));

            Map<String, Object> body = Map.of(
                    "propertyId", 1L,
                    "from", "2026-03-01",
                    "to", "2026-03-04",
                    "nightlyPrice", 120
            );

            ResponseEntity<Map<String, Object>> response = controller.createBulk(body, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("count", 3);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenOwner_thenDeletes() {
            Property property = mock(Property.class);
            when(property.getId()).thenReturn(1L);
            RateOverride existing = mock(RateOverride.class);
            when(existing.getProperty()).thenReturn(property);
            when(rateOverrideRepository.findById(10L)).thenReturn(Optional.of(existing));
            setupOwnerAccess(1L);

            ResponseEntity<Void> response = controller.delete(10L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(rateOverrideRepository).delete(existing);
        }

        @Test
        void whenNotFound_thenThrows() {
            when(rateOverrideRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.delete(99L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }
}
