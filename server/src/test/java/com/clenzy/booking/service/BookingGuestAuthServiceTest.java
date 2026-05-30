package com.clenzy.booking.service;

import com.clenzy.booking.dto.GuestAuthResponse;
import com.clenzy.booking.dto.GuestLoginRequest;
import com.clenzy.booking.dto.GuestRegisterRequest;
import com.clenzy.booking.model.BookingGuestProfile;
import com.clenzy.booking.repository.BookingGuestProfileRepository;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.admin.client.resource.RoleMappingResource;
import org.keycloak.admin.client.resource.RoleScopeResource;
import org.keycloak.admin.client.resource.RolesResource;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.admin.client.resource.UsersResource;
import org.keycloak.representations.idm.RoleRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingGuestAuthServiceTest {

    private static final Long ORG_ID = 42L;
    private static final String EMAIL = "guest@example.com";
    private static final String KC_ID = "kc-guest-1";

    @Mock private Keycloak keycloakAdmin;
    @Mock private BookingGuestProfileRepository profileRepository;
    @Mock private RestTemplate restTemplate;

    // Keycloak chain
    @Mock private RealmResource realmResource;
    @Mock private UsersResource usersResource;
    @Mock private UserResource userResource;
    @Mock private RolesResource rolesResource;
    @Mock private RoleMappingResource roleMappingResource;
    @Mock private RoleScopeResource roleScopeResource;

    private BookingGuestAuthService service;

    @BeforeEach
    void setUp() {
        service = new BookingGuestAuthService(keycloakAdmin, profileRepository, restTemplate);
        ReflectionTestUtils.setField(service, "keycloakUrl", "http://kc:8080");
        ReflectionTestUtils.setField(service, "guestClientSecret", "secret-123");
    }

    private void stubKeycloakUsers() {
        lenient().when(keycloakAdmin.realm("clenzy-guests")).thenReturn(realmResource);
        lenient().when(realmResource.users()).thenReturn(usersResource);
    }

    private BookingGuestProfile sampleProfile() {
        BookingGuestProfile p = new BookingGuestProfile();
        p.setKeycloakId(KC_ID);
        p.setEmail(EMAIL);
        p.setFirstName("John");
        p.setLastName("Doe");
        p.setPhone("+33600000000");
        p.setOrganizationId(ORG_ID);
        p.setEmailVerified(false);
        return p;
    }

    private GuestRegisterRequest sampleRegister() {
        return new GuestRegisterRequest(
                EMAIL, "Password123!", "John", "Doe", "+33600000000", ORG_ID);
    }

    private ResponseEntity<Map> tokenResponse() {
        Map<String, Object> body = new HashMap<>();
        body.put("access_token", "AT-abc");
        body.put("refresh_token", "RT-xyz");
        body.put("expires_in", 300);
        return new ResponseEntity<>(body, HttpStatus.OK);
    }

    // ─── register ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("register")
    class Register {

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void newGuest_createsKeycloakUserAndProfile_returnsTokens() {
            stubKeycloakUsers();
            when(profileRepository.existsByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(false);
            when(usersResource.searchByEmail(EMAIL, true)).thenReturn(List.of());

            // Mock create response (HTTP 201 with Location header).
            // CreatedResponseUtil.getCreatedId() requires getStatusInfo() and getLocation().
            Response kcResponse = mock(Response.class);
            when(kcResponse.getStatus()).thenReturn(201);
            lenient().when(kcResponse.getStatusInfo()).thenReturn(Response.Status.CREATED);
            when(kcResponse.getLocation()).thenReturn(
                    java.net.URI.create("http://kc/admin/realms/clenzy-guests/users/" + KC_ID));
            when(usersResource.create(any(UserRepresentation.class))).thenReturn(kcResponse);

            // role assignment chain
            when(realmResource.roles()).thenReturn(rolesResource);
            RoleRepresentation guestRole = new RoleRepresentation();
            guestRole.setName("BOOKING_GUEST");
            when(rolesResource.list()).thenReturn(List.of(guestRole));
            when(usersResource.get(KC_ID)).thenReturn(userResource);
            when(userResource.roles()).thenReturn(roleMappingResource);
            when(roleMappingResource.realmLevel()).thenReturn(roleScopeResource);

            // profile save
            when(profileRepository.save(any(BookingGuestProfile.class))).thenAnswer(inv -> inv.getArgument(0));

            // token request
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Map.class)))
                    .thenReturn(tokenResponse());

            GuestAuthResponse response = service.register(sampleRegister());

            assertThat(response.accessToken()).isEqualTo("AT-abc");
            assertThat(response.refreshToken()).isEqualTo("RT-xyz");
            assertThat(response.expiresIn()).isEqualTo(300);
            assertThat(response.profile().email()).isEqualTo(EMAIL);
            verify(profileRepository).save(any(BookingGuestProfile.class));
        }

        @Test
        void existingProfileForSameOrg_throwsIllegalArgument() {
            when(profileRepository.existsByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(true);

            assertThatThrownBy(() -> service.register(sampleRegister()))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("compte existe");
        }

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void existingKeycloakUserOtherOrg_addsOrgToAttributesAndSaves() {
            stubKeycloakUsers();
            when(profileRepository.existsByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(false);

            UserRepresentation existingUser = new UserRepresentation();
            existingUser.setId(KC_ID);
            existingUser.setUsername(EMAIL);
            Map<String, List<String>> attrs = new HashMap<>();
            attrs.put("org_ids", new ArrayList<>(List.of("100")));
            existingUser.setAttributes(attrs);

            when(usersResource.searchByEmail(EMAIL, true)).thenReturn(List.of(existingUser));
            when(usersResource.get(KC_ID)).thenReturn(userResource);

            when(profileRepository.save(any(BookingGuestProfile.class))).thenAnswer(inv -> inv.getArgument(0));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Map.class)))
                    .thenReturn(tokenResponse());

            GuestAuthResponse response = service.register(sampleRegister());

            assertThat(response).isNotNull();
            assertThat(existingUser.getAttributes().get("org_ids")).contains("100", String.valueOf(ORG_ID));
            verify(userResource).update(existingUser);
        }

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void existingKeycloakUserNullAttrs_initializesOrgList() {
            stubKeycloakUsers();
            when(profileRepository.existsByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(false);

            UserRepresentation existingUser = new UserRepresentation();
            existingUser.setId(KC_ID);
            existingUser.setAttributes(null);

            when(usersResource.searchByEmail(EMAIL, true)).thenReturn(List.of(existingUser));
            when(usersResource.get(KC_ID)).thenReturn(userResource);

            when(profileRepository.save(any(BookingGuestProfile.class))).thenAnswer(inv -> inv.getArgument(0));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Map.class)))
                    .thenReturn(tokenResponse());

            GuestAuthResponse response = service.register(sampleRegister());

            assertThat(response).isNotNull();
            assertThat(existingUser.getAttributes()).containsKey("org_ids");
            assertThat(existingUser.getAttributes().get("org_ids")).contains(String.valueOf(ORG_ID));
        }

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void keycloakReturnsConflict_throwsIllegalArgument() {
            stubKeycloakUsers();
            when(profileRepository.existsByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(false);
            when(usersResource.searchByEmail(EMAIL, true)).thenReturn(List.of());

            Response kcResponse = mock(Response.class);
            when(kcResponse.getStatus()).thenReturn(409);
            when(usersResource.create(any(UserRepresentation.class))).thenReturn(kcResponse);

            assertThatThrownBy(() -> service.register(sampleRegister()))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("existe");
        }

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void keycloakReturnsOtherError_throwsRuntime() {
            stubKeycloakUsers();
            when(profileRepository.existsByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(false);
            when(usersResource.searchByEmail(EMAIL, true)).thenReturn(List.of());

            Response kcResponse = mock(Response.class);
            when(kcResponse.getStatus()).thenReturn(500);
            when(kcResponse.readEntity(String.class)).thenReturn("KC fail");
            when(usersResource.create(any(UserRepresentation.class))).thenReturn(kcResponse);

            assertThatThrownBy(() -> service.register(sampleRegister()))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("500");
        }
    }

    // ─── login ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("login")
    class Login {

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void existingProfile_returnsTokensAndUpdatesLastLogin() {
            BookingGuestProfile profile = sampleProfile();
            when(profileRepository.findByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(Optional.of(profile));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Map.class)))
                    .thenReturn(tokenResponse());

            GuestLoginRequest req = new GuestLoginRequest(EMAIL, "Password123!", ORG_ID);
            GuestAuthResponse response = service.login(req);

            assertThat(response.accessToken()).isEqualTo("AT-abc");
            verify(profileRepository).save(profile);
            assertThat(profile.getLastLoginAt()).isNotNull();
        }

        @Test
        void noProfile_throwsIllegalArgument() {
            when(profileRepository.findByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(Optional.empty());

            GuestLoginRequest req = new GuestLoginRequest(EMAIL, "x", ORG_ID);
            assertThatThrownBy(() -> service.login(req))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void wrongPassword_unauthorizedFromKeycloak_throwsIllegalArgument() {
            BookingGuestProfile profile = sampleProfile();
            when(profileRepository.findByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(Optional.of(profile));

            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Map.class)))
                    .thenThrow(HttpClientErrorException.create(
                            HttpStatus.UNAUTHORIZED, "Unauthorized", new HttpHeaders(),
                            new byte[0], null));

            GuestLoginRequest req = new GuestLoginRequest(EMAIL, "wrong", ORG_ID);
            assertThatThrownBy(() -> service.login(req))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("incorrect");
        }

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void otherKeycloakError_throwsRuntime() {
            BookingGuestProfile profile = sampleProfile();
            when(profileRepository.findByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(Optional.of(profile));

            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Map.class)))
                    .thenThrow(HttpClientErrorException.create(
                            HttpStatus.BAD_REQUEST, "Bad req", new HttpHeaders(),
                            new byte[0], null));

            GuestLoginRequest req = new GuestLoginRequest(EMAIL, "x", ORG_ID);
            assertThatThrownBy(() -> service.login(req))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void responseBodyNull_throwsRuntime() {
            BookingGuestProfile profile = sampleProfile();
            when(profileRepository.findByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(Optional.of(profile));

            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Map.class)))
                    .thenReturn(new ResponseEntity<>(null, HttpStatus.OK));

            GuestLoginRequest req = new GuestLoginRequest(EMAIL, "x", ORG_ID);
            assertThatThrownBy(() -> service.login(req))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("authentification");
        }

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void emptyClientSecret_omitsItFromRequest() {
            ReflectionTestUtils.setField(service, "guestClientSecret", "");

            BookingGuestProfile profile = sampleProfile();
            when(profileRepository.findByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(Optional.of(profile));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Map.class)))
                    .thenReturn(tokenResponse());

            GuestLoginRequest req = new GuestLoginRequest(EMAIL, "x", ORG_ID);
            GuestAuthResponse response = service.login(req);

            assertThat(response).isNotNull();
        }
    }

    // ─── sendPasswordResetEmail ─────────────────────────────────────────────

    @Nested
    @DisplayName("sendPasswordResetEmail")
    class PasswordReset {

        @Test
        void noProfile_silentReturn() {
            when(profileRepository.existsByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(false);

            service.sendPasswordResetEmail(EMAIL, ORG_ID);

            verify(keycloakAdmin, never()).realm(anyString());
        }

        @Test
        void noKeycloakUser_silentReturn() {
            when(profileRepository.existsByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(true);
            stubKeycloakUsers();
            when(usersResource.searchByEmail(EMAIL, true)).thenReturn(List.of());

            service.sendPasswordResetEmail(EMAIL, ORG_ID);

            verify(usersResource, never()).get(anyString());
        }

        @Test
        void existingUser_callsExecuteActionsEmail() {
            when(profileRepository.existsByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(true);
            stubKeycloakUsers();

            UserRepresentation user = new UserRepresentation();
            user.setId(KC_ID);
            when(usersResource.searchByEmail(EMAIL, true)).thenReturn(List.of(user));
            when(usersResource.get(KC_ID)).thenReturn(userResource);

            service.sendPasswordResetEmail(EMAIL, ORG_ID);

            verify(userResource).executeActionsEmail(eq(List.of("UPDATE_PASSWORD")));
        }

        @Test
        void executeActionsThrows_wrapsInRuntime() {
            when(profileRepository.existsByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(true);
            stubKeycloakUsers();

            UserRepresentation user = new UserRepresentation();
            user.setId(KC_ID);
            when(usersResource.searchByEmail(EMAIL, true)).thenReturn(List.of(user));
            when(usersResource.get(KC_ID)).thenReturn(userResource);
            org.mockito.Mockito.doThrow(new RuntimeException("KC down"))
                    .when(userResource).executeActionsEmail(any());

            assertThatThrownBy(() -> service.sendPasswordResetEmail(EMAIL, ORG_ID))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("envoi");
        }
    }

    // ─── refreshToken ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("refreshToken")
    class Refresh {

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void validRefresh_returnsNewTokens() {
            BookingGuestProfile profile = sampleProfile();
            when(profileRepository.findByKeycloakIdAndOrganizationId(KC_ID, ORG_ID))
                    .thenReturn(Optional.of(profile));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Map.class)))
                    .thenReturn(tokenResponse());

            GuestAuthResponse response = service.refreshToken("RT-old", ORG_ID, KC_ID);

            assertThat(response.accessToken()).isEqualTo("AT-abc");
            assertThat(response.refreshToken()).isEqualTo("RT-xyz");
        }

        @Test
        void profileNotFound_throwsIllegalArgument() {
            when(profileRepository.findByKeycloakIdAndOrganizationId(KC_ID, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.refreshToken("RT", ORG_ID, KC_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void emptyClientSecret_omitted() {
            ReflectionTestUtils.setField(service, "guestClientSecret", "");

            BookingGuestProfile profile = sampleProfile();
            when(profileRepository.findByKeycloakIdAndOrganizationId(KC_ID, ORG_ID))
                    .thenReturn(Optional.of(profile));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Map.class)))
                    .thenReturn(tokenResponse());

            GuestAuthResponse response = service.refreshToken("RT", ORG_ID, KC_ID);
            assertThat(response).isNotNull();
        }
    }

    // ─── buildAuthResponse fallback behaviors ───────────────────────────────

    @Nested
    @DisplayName("buildAuthResponse details")
    class BuildAuthResponse {

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void missingExpiresIn_usesDefault300() {
            BookingGuestProfile profile = sampleProfile();
            when(profileRepository.findByEmailAndOrganizationId(EMAIL, ORG_ID))
                    .thenReturn(Optional.of(profile));

            Map<String, Object> body = new HashMap<>();
            body.put("access_token", "AT");
            body.put("refresh_token", "RT");
            // no expires_in
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Map.class)))
                    .thenReturn(new ResponseEntity<>(body, HttpStatus.OK));

            GuestLoginRequest req = new GuestLoginRequest(EMAIL, "x", ORG_ID);
            GuestAuthResponse response = service.login(req);

            assertThat(response.expiresIn()).isEqualTo(300);
        }
    }
}
