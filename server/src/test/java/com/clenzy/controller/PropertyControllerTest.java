package com.clenzy.controller;

import com.clenzy.dto.PropertyDto;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.service.PropertyService;
import com.clenzy.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PropertyControllerTest {

    @Mock private PropertyService propertyService;
    @Mock private UserService userService;
    @Mock private AirbnbListingMappingRepository listingMappingRepository;

    private PropertyController controller;

    private Jwt createJwt(String role) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .claim("realm_access", Map.of("roles", List.of(role)))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @BeforeEach
    void setUp() {
        controller = new PropertyController(propertyService, userService, listingMappingRepository);
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenHostCreates_thenForcesOwnerId() {
            Jwt jwt = createJwt("HOST");
            User user = new User();
            user.setId(5L);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);

            PropertyDto dto = new PropertyDto();
            PropertyDto created = new PropertyDto();
            created.id = 1L;
            when(propertyService.create(any(PropertyDto.class))).thenReturn(created);

            ResponseEntity<PropertyDto> response = controller.create(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(201);
            assertThat(dto.ownerId).isEqualTo(5L);
        }

        @Test
        void whenAdminCreates_thenKeepsOriginalOwnerId() {
            Jwt jwt = createJwt("SUPER_ADMIN");
            PropertyDto dto = new PropertyDto();
            dto.ownerId = 99L;
            PropertyDto created = new PropertyDto();
            created.id = 1L;
            when(propertyService.create(any(PropertyDto.class))).thenReturn(created);

            ResponseEntity<PropertyDto> response = controller.create(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(201);
            assertThat(dto.ownerId).isEqualTo(99L);
        }

        @Test
        void whenHostNotFoundInDb_thenThrowsUnauthorized() {
            Jwt jwt = createJwt("HOST");
            when(userService.findByKeycloakId("user-123")).thenReturn(null);

            assertThatThrownBy(() -> controller.create(new PropertyDto(), jwt))
                    .isInstanceOf(UnauthorizedException.class);
        }
    }

    @Nested
    @DisplayName("list")
    class ListProperties {
        @Test
        void whenHost_thenFiltersbyOwner() {
            Jwt jwt = createJwt("HOST");
            User user = new User();
            user.setId(5L);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);

            Page<PropertyDto> page = new PageImpl<>(List.of(new PropertyDto()));
            when(propertyService.search(any(), eq(5L), isNull(), isNull(), isNull())).thenReturn(page);

            Page<PropertyDto> result = controller.list(PageRequest.of(0, 10), null, null, null, null, jwt);
            assertThat(result.getContent()).hasSize(1);
        }

        @Test
        void whenAdmin_thenUsesProvidedOwnerId() {
            Jwt jwt = createJwt("SUPER_ADMIN");

            Page<PropertyDto> page = new PageImpl<>(List.of());
            when(propertyService.search(any(), eq(3L), isNull(), isNull(), isNull())).thenReturn(page);

            Page<PropertyDto> result = controller.list(PageRequest.of(0, 10), 3L, null, null, null, jwt);
            assertThat(result.getContent()).isEmpty();
        }
    }

    @Nested
    @DisplayName("get")
    class Get {
        @Test
        void whenAdminGets_thenDelegates() {
            Jwt jwt = createJwt("SUPER_ADMIN");
            PropertyDto dto = new PropertyDto();
            dto.id = 1L;

            // checkHostAccess won't throw for non-HOST roles
            when(propertyService.getById(1L)).thenReturn(dto);
            PropertyDto result = controller.get(1L, jwt);
            assertThat(result.id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenAdminDeletes_thenDelegates() {
            Jwt jwt = createJwt("SUPER_ADMIN");
            controller.delete(1L, jwt);
            verify(propertyService).delete(1L);
        }
    }

    @Nested
    @DisplayName("canAssignForProperty")
    class CanAssign {
        @Test
        void whenNullJwt_thenReturnsFalse() {
            ResponseEntity<Map<String, Boolean>> response = controller.canAssignForProperty(1L, null);
            assertThat(response.getBody().get("canAssign")).isFalse();
        }

        @Test
        void whenUserNotFound_thenReturnsFalse() {
            Jwt jwt = createJwt("HOST");
            when(userService.findByKeycloakId("user-123")).thenReturn(null);

            ResponseEntity<Map<String, Boolean>> response = controller.canAssignForProperty(1L, jwt);
            assertThat(response.getBody().get("canAssign")).isFalse();
        }

        @Test
        void whenUserCanAssign_thenReturnsTrue() {
            Jwt jwt = createJwt("HOST");
            User user = new User();
            user.setId(5L);
            when(userService.findByKeycloakId("user-123")).thenReturn(user);
            when(propertyService.canUserAssignForProperty(5L, 1L)).thenReturn(true);

            ResponseEntity<Map<String, Boolean>> response = controller.canAssignForProperty(1L, jwt);
            assertThat(response.getBody().get("canAssign")).isTrue();
        }
    }

    @Nested
    @DisplayName("getPropertyChannelStatus")
    class ChannelStatus {
        @Test
        void whenMappingExists_thenReturnsLinked() {
            AirbnbListingMapping mapping = new AirbnbListingMapping();
            mapping.setSyncEnabled(true);
            when(listingMappingRepository.findByPropertyId(1L)).thenReturn(Optional.of(mapping));

            ResponseEntity<Map<String, Object>> response = controller.getPropertyChannelStatus(1L);

            @SuppressWarnings("unchecked")
            Map<String, Object> airbnb = (Map<String, Object>) response.getBody().get("airbnb");
            assertThat(airbnb.get("linked")).isEqualTo(true);
            assertThat(airbnb.get("status")).isEqualTo("ACTIVE");
        }

        @Test
        void whenNoMapping_thenReturnsNotLinked() {
            when(listingMappingRepository.findByPropertyId(1L)).thenReturn(Optional.empty());

            ResponseEntity<Map<String, Object>> response = controller.getPropertyChannelStatus(1L);

            @SuppressWarnings("unchecked")
            Map<String, Object> airbnb = (Map<String, Object>) response.getBody().get("airbnb");
            assertThat(airbnb.get("linked")).isEqualTo(false);
            assertThat(airbnb.get("status")).isEqualTo("NOT_LINKED");
        }
    }
}
