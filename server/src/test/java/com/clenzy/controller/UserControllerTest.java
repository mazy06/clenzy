package com.clenzy.controller;

import com.clenzy.dto.UserDto;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.LoginProtectionService;
import com.clenzy.service.LoginProtectionService.LoginStatus;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock private UserService userService;
    @Mock private UserRepository userRepository;
    @Mock private LoginProtectionService loginProtectionService;

    private UserController controller;

    @BeforeEach
    void setUp() {
        controller = new UserController(userService, userRepository, loginProtectionService);
    }

    private Jwt buildJwt(String subject, boolean isSuperAdmin) {
        var builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", subject)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600));
        if (isSuperAdmin) {
            builder.claim("realm_access", Map.of("roles", List.of("SUPER_ADMIN")));
        } else {
            builder.claim("realm_access", Map.of("roles", List.of("HOST")));
        }
        return builder.build();
    }

    private User buildUser(Long id, String keycloakId, String email) {
        User user = new User();
        user.setId(id);
        user.setKeycloakId(keycloakId);
        user.setEmail(email);
        user.setFirstName("Jean");
        user.setLastName("Dupont");
        return user;
    }

    @Nested
    @DisplayName("create")
    class Create {

        @Test
        @DisplayName("returns 201 with created user")
        void whenCreate_thenReturns201() {
            // Arrange
            UserDto dto = new UserDto();
            dto.firstName = "Jean";
            UserDto created = new UserDto();
            created.id = 1L;
            created.firstName = "Jean";
            when(userService.create(any(UserDto.class))).thenReturn(created);

            // Act
            ResponseEntity<UserDto> response = controller.create(dto);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(201);
            assertThat(response.getBody().firstName).isEqualTo("Jean");
        }
    }

    @Nested
    @DisplayName("update")
    class Update {

        @Test
        @DisplayName("owner can update their own resource")
        void whenOwnerUpdates_thenDelegates() {
            // Arrange
            User user = buildUser(1L, "kc-123", "jean@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            Jwt jwt = buildJwt("kc-123", false);
            UserDto dto = new UserDto();
            dto.firstName = "Updated";
            UserDto updated = new UserDto();
            updated.id = 1L;
            updated.firstName = "Updated";
            when(userService.update(1L, dto)).thenReturn(updated);

            // Act
            UserDto result = controller.update(1L, dto, jwt);

            // Assert
            assertThat(result.firstName).isEqualTo("Updated");
            verify(userService).update(1L, dto);
        }

        @Test
        @DisplayName("admin can update any user's resource")
        void whenAdminUpdates_thenDelegates() {
            // Arrange
            User user = buildUser(1L, "kc-other", "other@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            Jwt jwt = buildJwt("kc-admin", true);
            UserDto dto = new UserDto();
            UserDto updated = new UserDto();
            updated.id = 1L;
            when(userService.update(1L, dto)).thenReturn(updated);

            // Act
            UserDto result = controller.update(1L, dto, jwt);

            // Assert
            assertThat(result.id).isEqualTo(1L);
        }

        @Test
        @DisplayName("non-owner non-admin throws AccessDeniedException")
        void whenNonOwnerNonAdmin_thenThrows() {
            // Arrange
            User user = buildUser(1L, "kc-other", "other@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            Jwt jwt = buildJwt("kc-intruder", false);
            UserDto dto = new UserDto();

            // Act & Assert
            assertThatThrownBy(() -> controller.update(1L, dto, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    @Nested
    @DisplayName("get")
    class Get {

        @Test
        @DisplayName("owner can get their own resource")
        void whenOwnerGets_thenReturnsDto() {
            // Arrange
            User user = buildUser(1L, "kc-123", "jean@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            Jwt jwt = buildJwt("kc-123", false);
            UserDto dto = new UserDto();
            dto.id = 1L;
            when(userService.getById(1L)).thenReturn(dto);

            // Act
            UserDto result = controller.get(1L, jwt);

            // Assert
            assertThat(result.id).isEqualTo(1L);
        }

        @Test
        @DisplayName("admin can get any user")
        void whenAdminGets_thenReturnsDto() {
            // Arrange
            User user = buildUser(1L, "kc-other", "other@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            Jwt jwt = buildJwt("kc-admin", true);
            UserDto dto = new UserDto();
            dto.id = 1L;
            when(userService.getById(1L)).thenReturn(dto);

            // Act
            UserDto result = controller.get(1L, jwt);

            // Assert
            assertThat(result.id).isEqualTo(1L);
        }

        @Test
        @DisplayName("non-owner non-admin throws AccessDeniedException")
        void whenNonOwnerNonAdmin_thenThrows() {
            // Arrange
            User user = buildUser(1L, "kc-other", "other@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            Jwt jwt = buildJwt("kc-intruder", false);

            // Act & Assert
            assertThatThrownBy(() -> controller.get(1L, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("when user not found in DB, non-admin throws AccessDeniedException")
        void whenUserNotFound_thenNonAdminThrows() {
            // Arrange
            when(userRepository.findById(999L)).thenReturn(Optional.empty());
            Jwt jwt = buildJwt("kc-anyone", false);

            // Act & Assert
            assertThatThrownBy(() -> controller.get(999L, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    @Nested
    @DisplayName("list")
    class ListUsers {

        @Test
        @DisplayName("returns page of users")
        void whenList_thenReturnsPage() {
            // Arrange
            var pageable = PageRequest.of(0, 10);
            Page<UserDto> page = new PageImpl<>(List.of(new UserDto()));
            when(userService.list(pageable)).thenReturn(page);

            // Act
            Page<UserDto> result = controller.list(pageable);

            // Assert
            assertThat(result.getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {

        @Test
        @DisplayName("delegates to service")
        void whenDelete_thenDelegates() {
            // Act
            controller.delete(1L);

            // Assert
            verify(userService).delete(1L);
        }
    }

    @Nested
    @DisplayName("getLockoutStatus")
    class GetLockoutStatus {

        @Test
        @DisplayName("returns lockout info when user exists")
        void whenUserExists_thenReturnsLockoutInfo() {
            // Arrange
            User user = buildUser(1L, "kc-123", "jean@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            LoginStatus status = new LoginStatus(true, 120L, true);
            when(loginProtectionService.checkLoginAllowed("jean@test.com")).thenReturn(status);
            when(loginProtectionService.getFailedAttempts("jean@test.com")).thenReturn(5);

            // Act
            ResponseEntity<?> response = controller.getLockoutStatus(1L);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body.get("isLocked")).isEqualTo(true);
            assertThat(body.get("remainingSeconds")).isEqualTo(120L);
            assertThat(body.get("captchaRequired")).isEqualTo(true);
            assertThat(body.get("failedAttempts")).isEqualTo(5);
        }

        @Test
        @DisplayName("returns default status when user not found")
        void whenUserNotFound_thenReturnsDefault() {
            // Arrange
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            // Act
            ResponseEntity<?> response = controller.getLockoutStatus(99L);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body.get("isLocked")).isEqualTo(false);
            assertThat(body.get("failedAttempts")).isEqualTo(0);
        }

        @Test
        @DisplayName("returns default status when user has no email")
        void whenUserHasNoEmail_thenReturnsDefault() {
            // Arrange
            User user = new User();
            user.setId(1L);
            user.setEmail(null);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            // Act
            ResponseEntity<?> response = controller.getLockoutStatus(1L);

            // Assert
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body.get("isLocked")).isEqualTo(false);
        }
    }

    @Nested
    @DisplayName("unlockUser")
    class UnlockUser {

        @Test
        @DisplayName("unlocks user and returns success message")
        void whenUserExists_thenUnlocksSuccessfully() {
            // Arrange
            User user = buildUser(1L, "kc-123", "jean@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            // Act
            ResponseEntity<?> response = controller.unlockUser(1L);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(loginProtectionService).forceUnlock("jean@test.com");
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body.get("success")).isEqualTo(true);
            assertThat((String) body.get("message")).contains("Jean");
        }

        @Test
        @DisplayName("returns 400 when user not found")
        void whenUserNotFound_thenReturnsBadRequest() {
            // Arrange
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            // Act
            ResponseEntity<?> response = controller.unlockUser(99L);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("returns 400 when user has no email")
        void whenUserHasNoEmail_thenReturnsBadRequest() {
            // Arrange
            User user = new User();
            user.setId(1L);
            user.setEmail(null);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            // Act
            ResponseEntity<?> response = controller.unlockUser(1L);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }
}
