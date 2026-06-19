package com.clenzy.controller;

import com.clenzy.dto.UserDto;
import com.clenzy.model.User;
import com.clenzy.service.DeviceTokenService;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock private UserService userService;
    @Mock private LoginProtectionService loginProtectionService;
    @Mock private DeviceTokenService deviceTokenService;
    @Mock private com.clenzy.service.MediaTicketService mediaTicketService;

    private UserController controller;

    @BeforeEach
    void setUp() {
        controller = new UserController(userService, loginProtectionService, deviceTokenService, mediaTicketService);
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
            verify(userService).requireOwnershipOrAdmin(1L, "kc-123", false);
        }

        @Test
        @DisplayName("admin can update any user's resource")
        void whenAdminUpdates_thenDelegates() {
            // Arrange
            Jwt jwt = buildJwt("kc-admin", true);
            UserDto dto = new UserDto();
            UserDto updated = new UserDto();
            updated.id = 1L;
            when(userService.update(1L, dto)).thenReturn(updated);

            // Act
            UserDto result = controller.update(1L, dto, jwt);

            // Assert
            assertThat(result.id).isEqualTo(1L);
            verify(userService).requireOwnershipOrAdmin(1L, "kc-admin", true);
        }

        @Test
        @DisplayName("non-owner non-admin throws AccessDeniedException")
        void whenNonOwnerNonAdmin_thenThrows() {
            // Arrange
            Jwt jwt = buildJwt("kc-intruder", false);
            UserDto dto = new UserDto();
            doThrow(new AccessDeniedException("Acces refuse : vous ne pouvez acceder qu'a vos propres donnees"))
                    .when(userService).requireOwnershipOrAdmin(1L, "kc-intruder", false);

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
            Jwt jwt = buildJwt("kc-123", false);
            UserDto dto = new UserDto();
            dto.id = 1L;
            when(userService.getById(1L)).thenReturn(dto);

            // Act
            UserDto result = controller.get(1L, jwt);

            // Assert
            assertThat(result.id).isEqualTo(1L);
            verify(userService).requireOwnershipOrAdmin(1L, "kc-123", false);
        }

        @Test
        @DisplayName("admin can get any user")
        void whenAdminGets_thenReturnsDto() {
            // Arrange
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
            Jwt jwt = buildJwt("kc-intruder", false);
            doThrow(new AccessDeniedException("Acces refuse : vous ne pouvez acceder qu'a vos propres donnees"))
                    .when(userService).requireOwnershipOrAdmin(1L, "kc-intruder", false);

            // Act & Assert
            assertThatThrownBy(() -> controller.get(1L, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("when user not found in DB, non-admin throws AccessDeniedException")
        void whenUserNotFound_thenNonAdminThrows() {
            // Arrange
            Jwt jwt = buildJwt("kc-anyone", false);
            doThrow(new AccessDeniedException("Acces refuse : vous ne pouvez acceder qu'a vos propres donnees"))
                    .when(userService).requireOwnershipOrAdmin(999L, "kc-anyone", false);

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
            when(userService.findById(1L)).thenReturn(Optional.of(user));
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
            when(userService.findById(99L)).thenReturn(Optional.empty());

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
            when(userService.findById(1L)).thenReturn(Optional.of(user));

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
            when(userService.findById(1L)).thenReturn(Optional.of(user));

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
            when(userService.findById(99L)).thenReturn(Optional.empty());

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
            when(userService.findById(1L)).thenReturn(Optional.of(user));

            // Act
            ResponseEntity<?> response = controller.unlockUser(1L);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("marketing preferences (RGPD article 7-3)")
    class MarketingPreferences {

        @Test
        @DisplayName("GET returns current newsletterOptIn from the user entity")
        void whenGet_thenReturnsCurrentOptIn() {
            // Arrange
            when(userService.getNewsletterOptIn("kc-123")).thenReturn(true);
            Jwt jwt = buildJwt("kc-123", false);

            // Act
            ResponseEntity<Map<String, Object>> response = controller.getMyMarketingPreferences(jwt);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("newsletterOptIn", true);
        }

        @Test
        @DisplayName("PUT updates newsletterOptIn to false (retrait du consentement)")
        void whenPutFalse_thenUpdatesOptOut() {
            // Arrange
            when(userService.updateNewsletterOptIn("kc-123", false)).thenReturn(false);
            Jwt jwt = buildJwt("kc-123", false);

            // Act
            ResponseEntity<Map<String, Object>> response = controller.updateMyMarketingPreferences(
                    Map.of("newsletterOptIn", false), jwt);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("newsletterOptIn", false);
            verify(userService).updateNewsletterOptIn("kc-123", false);
        }

        @Test
        @DisplayName("PUT with non-boolean newsletterOptIn returns 400")
        void whenPutInvalidType_thenReturns400() {
            // Arrange
            Jwt jwt = buildJwt("kc-123", false);

            // Act
            ResponseEntity<Map<String, Object>> response = controller.updateMyMarketingPreferences(
                    Map.of("newsletterOptIn", "true"), jwt); // String au lieu de Boolean

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(400);
            verify(userService, never()).updateNewsletterOptIn(anyString(), any());
        }

        @Test
        @DisplayName("PUT with empty body is a no-op (returns current state)")
        void whenPutEmptyBody_thenNoOp() {
            // Arrange
            when(userService.updateNewsletterOptIn("kc-123", null)).thenReturn(true);
            Jwt jwt = buildJwt("kc-123", false);

            // Act
            ResponseEntity<Map<String, Object>> response = controller.updateMyMarketingPreferences(
                    Map.of(), jwt);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("newsletterOptIn", true);
            // La sauvegarde (meme sans changement) est testee cote UserServiceTest
            verify(userService).updateNewsletterOptIn("kc-123", null);
        }
    }

    @Nested
    @DisplayName("updateMyProfile")
    class UpdateMyProfile {

        @Test
        @DisplayName("updates phoneNumber when present")
        void whenPhoneNumberPresent_thenUpdates() {
            Jwt jwt = buildJwt("kc-123", false);

            ResponseEntity<?> response = controller.updateMyProfile(
                    Map.of("phoneNumber", "+33612345678"), jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(userService).updateOwnProfile("kc-123", Map.of("phoneNumber", "+33612345678"));
        }

        @Test
        @DisplayName("when body missing phoneNumber - just saves (no update)")
        void whenNoPhoneNumber_thenJustSaves() {
            Jwt jwt = buildJwt("kc-123", false);

            ResponseEntity<?> response = controller.updateMyProfile(Map.of(), jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(userService).updateOwnProfile("kc-123", Map.of());
        }

        @Test
        @DisplayName("throws when user not found")
        void whenUserNotFound_thenThrows() {
            doThrow(new RuntimeException("Utilisateur non trouve"))
                    .when(userService).updateOwnProfile(eq("kc-bad"), any());
            Jwt jwt = buildJwt("kc-bad", false);

            assertThatThrownBy(() -> controller.updateMyProfile(Map.of(), jwt))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("deleteSelf")
    class DeleteSelf {

        @Test
        @DisplayName("removes device tokens and deletes user")
        void whenUserFound_thenDeletesAll() {
            User user = buildUser(1L, "kc-123", "jean@test.com");
            when(userService.findByKeycloakId("kc-123")).thenReturn(user);
            Jwt jwt = buildJwt("kc-123", false);

            controller.deleteSelf(jwt);

            verify(deviceTokenService).removeAllForUser("kc-123");
            verify(userService).delete(1L);
        }

        @Test
        @DisplayName("throws IllegalArgumentException when user not found")
        void whenUserNotFound_thenThrows() {
            when(userService.findByKeycloakId("kc-bad")).thenReturn(null);
            Jwt jwt = buildJwt("kc-bad", false);

            assertThatThrownBy(() -> controller.deleteSelf(jwt))
                    .isInstanceOf(IllegalArgumentException.class);
            verify(userService, never()).delete(any());
        }
    }

    @Nested
    @DisplayName("getMyMarketingPreferences error path")
    class GetMyPrefsErrors {
        @Test
        @DisplayName("throws when user not found")
        void whenUserNotFound_thenThrows() {
            when(userService.getNewsletterOptIn("kc-bad"))
                    .thenThrow(new RuntimeException("Utilisateur non trouve"));
            Jwt jwt = buildJwt("kc-bad", false);

            assertThatThrownBy(() -> controller.getMyMarketingPreferences(jwt))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("uploadProfilePicture & deleteProfilePicture & getProfilePicture")
    class ProfilePictures {

        @Test
        @DisplayName("upload : owner can upload and returns dto")
        void uploadProfilePicture_owner_returnsDto() {
            Jwt jwt = buildJwt("kc-123", false);

            org.springframework.web.multipart.MultipartFile file =
                    mock(org.springframework.web.multipart.MultipartFile.class);
            UserDto dto = new UserDto();
            dto.id = 1L;
            when(userService.uploadProfilePicture(1L, file)).thenReturn(dto);

            UserDto result = controller.uploadProfilePicture(1L, file, jwt);

            assertThat(result.id).isEqualTo(1L);
            verify(userService).requireOwnershipOrAdmin(1L, "kc-123", false);
        }

        @Test
        @DisplayName("upload : non-owner non-admin throws AccessDeniedException")
        void uploadProfilePicture_nonOwner_throws() {
            Jwt jwt = buildJwt("kc-intruder", false);
            org.springframework.web.multipart.MultipartFile file =
                    mock(org.springframework.web.multipart.MultipartFile.class);
            doThrow(new AccessDeniedException("Acces refuse : vous ne pouvez acceder qu'a vos propres donnees"))
                    .when(userService).requireOwnershipOrAdmin(1L, "kc-intruder", false);

            assertThatThrownBy(() -> controller.uploadProfilePicture(1L, file, jwt))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }

        @Test
        @DisplayName("upload : IllegalArgumentException -> 400")
        void uploadProfilePicture_invalidFile_returnsBadRequest() {
            Jwt jwt = buildJwt("kc-123", false);
            org.springframework.web.multipart.MultipartFile file =
                    mock(org.springframework.web.multipart.MultipartFile.class);
            when(userService.uploadProfilePicture(1L, file))
                    .thenThrow(new IllegalArgumentException("File too big"));

            assertThatThrownBy(() -> controller.uploadProfilePicture(1L, file, jwt))
                    .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        }

        @Test
        @DisplayName("delete : owner can delete and returns dto")
        void deleteProfilePicture_owner_returnsDto() {
            Jwt jwt = buildJwt("kc-123", false);
            UserDto dto = new UserDto();
            dto.id = 1L;
            when(userService.deleteProfilePicture(1L)).thenReturn(dto);

            UserDto result = controller.deleteProfilePicture(1L, jwt);

            assertThat(result.id).isEqualTo(1L);
            verify(userService).requireOwnershipOrAdmin(1L, "kc-123", false);
        }

        @Test
        @DisplayName("get : not found -> 404 (owner)")
        void getProfilePicture_notFound_returns404() {
            Jwt jwt = buildJwt("kc-123", false);
            when(userService.streamProfilePicture(1L)).thenReturn(null);

            ResponseEntity<org.springframework.core.io.Resource> response =
                    controller.getProfilePicture(1L, null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        @DisplayName("get : owner gets resource with content type")
        void getProfilePicture_found_returnsResource() {
            Jwt jwt = buildJwt("kc-123", false);
            org.springframework.core.io.Resource resource =
                    mock(org.springframework.core.io.Resource.class);
            when(userService.streamProfilePicture(1L))
                    .thenReturn(new Object[]{resource, "image/jpeg"});

            ResponseEntity<org.springframework.core.io.Resource> response =
                    controller.getProfilePicture(1L, null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isSameAs(resource);
            verify(userService).requireSameOrganizationOrSelf(1L, "kc-123", false);
        }

        // ─── Z2-SEC-06 : ownership / org sur GET /{id}/profile-picture ──────
        // (la logique same-org/cross-org est testee dans UserServiceTest —
        //  requireSameOrganizationOrSelf ; ici on verifie le cablage controller)

        @Test
        @DisplayName("get : same-org member can fetch a teammate avatar")
        void getProfilePicture_sameOrgMember_returnsResource() {
            // Arrange : la garde service autorise (meme organisation)
            Jwt jwt = buildJwt("kc-123", false);
            org.springframework.core.io.Resource resource =
                    mock(org.springframework.core.io.Resource.class);
            when(userService.streamProfilePicture(1L))
                    .thenReturn(new Object[]{resource, "image/png"});

            // Act
            ResponseEntity<org.springframework.core.io.Resource> response =
                    controller.getProfilePicture(1L, null, jwt);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        @DisplayName("get : cross-org non-admin throws AccessDeniedException")
        void getProfilePicture_crossOrg_throwsAccessDenied() {
            // Arrange : la garde service refuse (organisation differente)
            Jwt jwt = buildJwt("kc-intruder", false);
            doThrow(new AccessDeniedException(
                    "Acces refuse : vous ne pouvez consulter que les photos de votre organisation"))
                    .when(userService).requireSameOrganizationOrSelf(1L, "kc-intruder", false);

            // Act & Assert : pas de fuite de photo cross-org
            assertThatThrownBy(() -> controller.getProfilePicture(1L, null, jwt))
                    .isInstanceOf(AccessDeniedException.class);
            verify(userService, never()).streamProfilePicture(any());
        }

        @Test
        @DisplayName("get : unknown user id throws AccessDeniedException for non-admin")
        void getProfilePicture_unknownUser_throwsAccessDenied() {
            Jwt jwt = buildJwt("kc-123", false);
            doThrow(new AccessDeniedException(
                    "Acces refuse : vous ne pouvez consulter que les photos de votre organisation"))
                    .when(userService).requireSameOrganizationOrSelf(999L, "kc-123", false);

            assertThatThrownBy(() -> controller.getProfilePicture(999L, null, jwt))
                    .isInstanceOf(AccessDeniedException.class);
            verify(userService, never()).streamProfilePicture(any());
        }

        @Test
        @DisplayName("get : SUPER_ADMIN can fetch any avatar cross-org")
        void getProfilePicture_superAdmin_returnsResource() {
            Jwt jwt = buildJwt("kc-admin", true);
            org.springframework.core.io.Resource resource =
                    mock(org.springframework.core.io.Resource.class);
            when(userService.streamProfilePicture(1L))
                    .thenReturn(new Object[]{resource, "image/jpeg"});

            ResponseEntity<org.springframework.core.io.Resource> response =
                    controller.getProfilePicture(1L, null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(userService).requireSameOrganizationOrSelf(1L, "kc-admin", true);
        }

        @Test
        @DisplayName("get : SUPER_MANAGER (platform staff) can fetch any avatar cross-org")
        void getProfilePicture_superManager_returnsResource() {
            Jwt jwt = Jwt.withTokenValue("token")
                    .header("alg", "RS256")
                    .claim("sub", "kc-staff")
                    .claim("realm_access", Map.of("roles", List.of("SUPER_MANAGER")))
                    .issuedAt(Instant.now())
                    .expiresAt(Instant.now().plusSeconds(3600))
                    .build();
            org.springframework.core.io.Resource resource =
                    mock(org.springframework.core.io.Resource.class);
            when(userService.streamProfilePicture(1L))
                    .thenReturn(new Object[]{resource, "image/jpeg"});

            ResponseEntity<org.springframework.core.io.Resource> response =
                    controller.getProfilePicture(1L, null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(userService).requireSameOrganizationOrSelf(1L, "kc-staff", true);
        }
    }
}
