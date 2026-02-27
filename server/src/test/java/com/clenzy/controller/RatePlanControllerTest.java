package com.clenzy.controller;

import com.clenzy.dto.RatePlanDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.RatePlan;
import com.clenzy.model.RatePlanType;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RatePlanRepository;
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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RatePlanControllerTest {

    @Mock private RatePlanRepository ratePlanRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;

    private RatePlanController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new RatePlanController(ratePlanRepository, propertyRepository, userRepository, tenantContext);
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
        when(property.getOwner()).thenReturn(owner);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(tenantContext.isSuperAdmin()).thenReturn(false);
        when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(owner));
    }

    @Nested
    @DisplayName("getByProperty")
    class GetByProperty {
        @Test
        void whenOwner_thenReturnsPlans() {
            setupOwnerAccess(1L);
            RatePlan plan = mock(RatePlan.class);
            when(plan.getProperty()).thenReturn(mock(Property.class));
            when(plan.getType()).thenReturn(RatePlanType.BASE);
            when(plan.getNightlyPrice()).thenReturn(BigDecimal.valueOf(100));
            when(ratePlanRepository.findAllByPropertyId(1L, 1L)).thenReturn(List.of(plan));

            ResponseEntity<List<RatePlanDto>> response = controller.getByProperty(1L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void whenPropertyNotFound_thenThrows() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(propertyRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.getByProperty(99L, jwt))
                    .isInstanceOf(NotFoundException.class);
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

            RatePlan saved = mock(RatePlan.class);
            when(saved.getProperty()).thenReturn(property);
            when(saved.getType()).thenReturn(RatePlanType.SEASONAL);
            when(saved.getNightlyPrice()).thenReturn(BigDecimal.valueOf(150));
            when(ratePlanRepository.save(any(RatePlan.class))).thenReturn(saved);

            RatePlanDto dto = new RatePlanDto(null, 1L, "Summer", "SEASONAL", 1, 150.0, "EUR",
                    "2026-06-01", "2026-09-01", null, null, true);

            ResponseEntity<RatePlanDto> response = controller.create(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("update")
    class Update {
        @Test
        void whenOwner_thenUpdates() {
            Property property = mock(Property.class);
            when(property.getId()).thenReturn(1L);
            RatePlan existing = mock(RatePlan.class);
            when(existing.getProperty()).thenReturn(property);
            when(ratePlanRepository.findById(10L)).thenReturn(Optional.of(existing));
            setupOwnerAccess(1L);

            RatePlan saved = mock(RatePlan.class);
            when(saved.getProperty()).thenReturn(property);
            when(saved.getType()).thenReturn(RatePlanType.SEASONAL);
            when(saved.getNightlyPrice()).thenReturn(BigDecimal.valueOf(200));
            when(ratePlanRepository.save(existing)).thenReturn(saved);

            RatePlanDto dto = new RatePlanDto(null, 1L, "Updated", null, null, 200.0, null,
                    null, null, null, null, null);

            ResponseEntity<RatePlanDto> response = controller.update(10L, dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenPlanNotFound_thenThrows() {
            when(ratePlanRepository.findById(99L)).thenReturn(Optional.empty());

            RatePlanDto dto = new RatePlanDto(null, 1L, "Test", null, null, null, null,
                    null, null, null, null, null);

            assertThatThrownBy(() -> controller.update(99L, dto, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenOwner_thenDeletes() {
            Property property = mock(Property.class);
            when(property.getId()).thenReturn(1L);
            RatePlan existing = mock(RatePlan.class);
            when(existing.getProperty()).thenReturn(property);
            when(ratePlanRepository.findById(10L)).thenReturn(Optional.of(existing));
            setupOwnerAccess(1L);

            ResponseEntity<Void> response = controller.delete(10L, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(ratePlanRepository).delete(existing);
        }

        @Test
        void whenNotOwner_thenThrowsAccessDenied() {
            Property property = mock(Property.class);
            when(property.getId()).thenReturn(1L);
            when(property.getOrganizationId()).thenReturn(1L);
            User otherOwner = mock(User.class);
            lenient().when(property.getOwner()).thenReturn(otherOwner);
            RatePlan existing = mock(RatePlan.class);
            when(existing.getProperty()).thenReturn(property);
            when(ratePlanRepository.findById(10L)).thenReturn(Optional.of(existing));
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.delete(10L, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }
}
