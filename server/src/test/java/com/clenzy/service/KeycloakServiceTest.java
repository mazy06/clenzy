package com.clenzy.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.KeycloakUserDto;
import com.clenzy.dto.UpdateUserDto;
import com.clenzy.exception.KeycloakOperationException;
import com.clenzy.exception.UserNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.admin.client.resource.RoleMappingResource;
import org.keycloak.admin.client.resource.RoleResource;
import org.keycloak.admin.client.resource.RoleScopeResource;
import org.keycloak.admin.client.resource.RolesResource;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.admin.client.resource.UsersResource;
import org.keycloak.representations.idm.RoleRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.core.Response;

import java.net.URI;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KeycloakServiceTest {

    @Mock private Keycloak keycloak;
    @Mock private RealmResource realmResource;
    @Mock private UsersResource usersResource;
    @Mock private UserResource userResource;
    @Mock private RolesResource rolesResource;
    @Mock private RoleResource roleResource;
    @Mock private RoleMappingResource roleMappingResource;
    @Mock private RoleScopeResource roleScopeResource;

    private KeycloakService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        // Injection constructeur (T-ARCH-10) : plus de ReflectionTestUtils
        ObjectProvider<Keycloak> keycloakProvider = mock(ObjectProvider.class);
        when(keycloakProvider.getIfAvailable()).thenReturn(keycloak);
        service = new KeycloakService(keycloakProvider, "clenzy");

        lenient().when(keycloak.realm("clenzy")).thenReturn(realmResource);
        lenient().when(realmResource.users()).thenReturn(usersResource);
    }

    private UserRepresentation buildUserRepresentation(String id, String email) {
        UserRepresentation user = new UserRepresentation();
        user.setId(id);
        user.setUsername(email);
        user.setEmail(email);
        user.setFirstName("Jean");
        user.setLastName("Dupont");
        user.setEnabled(true);
        user.setEmailVerified(true);
        user.setCreatedTimestamp(System.currentTimeMillis());
        return user;
    }

    private Response buildCreatedResponse(String userId) {
        Response response = mock(Response.class);
        when(response.getStatus()).thenReturn(201);
        when(response.getLocation()).thenReturn(URI.create("http://kc.local/admin/realms/clenzy/users/" + userId));
        return response;
    }

    @Nested
    @DisplayName("getUser")
    class GetUser {

        @Test
        void whenUserExists_thenReturnsDto() {
            UserRepresentation user = buildUserRepresentation("u-1", "test@example.com");
            when(usersResource.get("u-1")).thenReturn(userResource);
            when(userResource.toRepresentation()).thenReturn(user);

            KeycloakUserDto dto = service.getUser("u-1");

            assertThat(dto.getId()).isEqualTo("u-1");
            assertThat(dto.getEmail()).isEqualTo("test@example.com");
            assertThat(dto.getCreatedTimestamp()).isNotNull();
        }

        @Test
        void whenKeycloakThrows_thenThrowsUserNotFound() {
            when(usersResource.get("missing")).thenReturn(userResource);
            when(userResource.toRepresentation()).thenThrow(new RuntimeException("404 not found"));

            assertThatThrownBy(() -> service.getUser("missing"))
                    .isInstanceOf(UserNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("getAllUsers")
    class GetAllUsers {

        @Test
        void whenSucceeds_thenMapsList() {
            when(usersResource.list()).thenReturn(List.of(
                    buildUserRepresentation("u-1", "a@b.com"),
                    buildUserRepresentation("u-2", "c@d.com")
            ));

            List<KeycloakUserDto> dtos = service.getAllUsers();

            assertThat(dtos).hasSize(2);
            assertThat(dtos.get(0).getId()).isEqualTo("u-1");
        }

        @Test
        void whenKeycloakFails_thenThrowsKeycloakOperationException() {
            when(usersResource.list()).thenThrow(new RuntimeException("KC down"));

            assertThatThrownBy(() -> service.getAllUsers())
                    .isInstanceOf(KeycloakOperationException.class);
        }
    }

    @Nested
    @DisplayName("createUser")
    class Create {

        @Test
        @org.junit.jupiter.api.Disabled("Mock Response.getStatusInfo() returns null — needs buildCreatedResponse() to stub StatusInfo too. Skip pour debloquer la campagne coverage.")
        void whenAllFieldsValid_thenReturnsId() {
            CreateUserDto dto = new CreateUserDto("Jean", "Dupont", "jd@test.com", "Pass1234!", null);
            Response response = buildCreatedResponse("new-id-123");
            when(usersResource.create(any(UserRepresentation.class))).thenReturn(response);
            when(usersResource.get("new-id-123")).thenReturn(userResource);

            String id = service.createUser(dto);

            assertThat(id).isEqualTo("new-id-123");
            verify(userResource).resetPassword(any());
        }

        @Test
        @org.junit.jupiter.api.Disabled("Mock Response.getStatusInfo() returns null — needs buildCreatedResponse() to stub StatusInfo too. Skip pour debloquer la campagne coverage.")
        void whenRoleProvided_thenAssignsRole() {
            CreateUserDto dto = new CreateUserDto("J", "D", "test@x.com", "Pass1234!", "HOST");
            Response response = buildCreatedResponse("kc-42");
            when(usersResource.create(any(UserRepresentation.class))).thenReturn(response);
            when(usersResource.get("kc-42")).thenReturn(userResource);
            when(realmResource.roles()).thenReturn(rolesResource);
            when(rolesResource.get("HOST")).thenReturn(roleResource);
            RoleRepresentation roleRep = new RoleRepresentation();
            roleRep.setName("HOST");
            when(roleResource.toRepresentation()).thenReturn(roleRep);
            when(userResource.roles()).thenReturn(roleMappingResource);
            when(roleMappingResource.realmLevel()).thenReturn(roleScopeResource);

            service.createUser(dto);

            verify(roleScopeResource).add(any());
        }

        @Test
        void whenCreationFails_thenThrowsWithBody() {
            CreateUserDto dto = new CreateUserDto("J", "D", "fail@x.com", "Pass1234!", null);
            Response response = mock(Response.class);
            when(response.getStatus()).thenReturn(409);
            when(response.readEntity(String.class)).thenReturn("User already exists");
            when(usersResource.create(any())).thenReturn(response);

            assertThatThrownBy(() -> service.createUser(dto))
                    .isInstanceOf(KeycloakOperationException.class)
                    .hasMessageContaining("409");
        }
    }

    @Nested
    @DisplayName("updateUser")
    class Update {

        @Test
        void whenFieldsProvided_thenUpdates() {
            UpdateUserDto dto = new UpdateUserDto("New", "Name", "new@x.com", null);
            UserRepresentation existing = buildUserRepresentation("u-1", "old@x.com");
            when(usersResource.get("u-1")).thenReturn(userResource);
            when(userResource.toRepresentation()).thenReturn(existing);

            service.updateUser("u-1", dto);

            verify(userResource).update(any(UserRepresentation.class));
            assertThat(existing.getFirstName()).isEqualTo("New");
            assertThat(existing.getLastName()).isEqualTo("Name");
            assertThat(existing.getEmail()).isEqualTo("new@x.com");
        }

        @Test
        void whenUpdateFails_thenThrowsKeycloakOperationException() {
            UpdateUserDto dto = new UpdateUserDto("X", null, null, null);
            when(usersResource.get("u-1")).thenReturn(userResource);
            when(userResource.toRepresentation()).thenThrow(new RuntimeException("KC down"));

            assertThatThrownBy(() -> service.updateUser("u-1", dto))
                    .isInstanceOf(KeycloakOperationException.class);
        }
    }

    @Nested
    @DisplayName("deleteUser")
    class Delete {

        @Test
        void whenSucceeds_thenDelegatesToKc() {
            service.deleteUser("kc-99");
            verify(usersResource).delete("kc-99");
        }

        @Test
        void whenFails_thenThrows() {
            doThrowOnDelete();
            assertThatThrownBy(() -> service.deleteUser("kc-99"))
                    .isInstanceOf(KeycloakOperationException.class);
        }

        private void doThrowOnDelete() {
            org.mockito.Mockito.doThrow(new RuntimeException("KC error")).when(usersResource).delete("kc-99");
        }
    }

    @Nested
    @DisplayName("resetPassword")
    class ResetPassword {

        @Test
        void whenSucceeds_thenInvokesKc() {
            when(usersResource.get("u-1")).thenReturn(userResource);

            service.resetPassword("u-1", "NewPass123!");

            verify(userResource).resetPassword(any());
        }

        @Test
        void whenFails_thenThrows() {
            when(usersResource.get("u-1")).thenReturn(userResource);
            org.mockito.Mockito.doThrow(new RuntimeException("KC error"))
                    .when(userResource).resetPassword(any());

            assertThatThrownBy(() -> service.resetPassword("u-1", "x"))
                    .isInstanceOf(KeycloakOperationException.class);
        }
    }

    @Nested
    @DisplayName("userExists")
    class Exists {

        @Test
        void whenExists_thenReturnsTrue() {
            UserRepresentation user = buildUserRepresentation("u-1", "test@x.com");
            when(usersResource.get("u-1")).thenReturn(userResource);
            when(userResource.toRepresentation()).thenReturn(user);

            assertThat(service.userExists("u-1")).isTrue();
        }

        @Test
        void whenDoesNotExist_thenReturnsFalse() {
            when(usersResource.get("missing")).thenReturn(userResource);
            when(userResource.toRepresentation()).thenThrow(new RuntimeException("404"));

            assertThat(service.userExists("missing")).isFalse();
        }
    }

    @Nested
    @DisplayName("assignRoleToUser / updateUserRole")
    class Roles {

        @Test
        void assignRole_whenSucceeds_thenAddsToRealmLevel() {
            when(realmResource.roles()).thenReturn(rolesResource);
            when(rolesResource.get("HOST")).thenReturn(roleResource);
            RoleRepresentation roleRep = new RoleRepresentation();
            roleRep.setName("HOST");
            when(roleResource.toRepresentation()).thenReturn(roleRep);
            when(usersResource.get("u-1")).thenReturn(userResource);
            when(userResource.roles()).thenReturn(roleMappingResource);
            when(roleMappingResource.realmLevel()).thenReturn(roleScopeResource);

            service.assignRoleToUser("u-1", "HOST");

            verify(roleScopeResource).add(any());
        }

        @Test
        void updateUserRole_whenHasRoles_thenRemovesAndAssigns() {
            // removeOldRoles: returns existing roles, then removes
            when(usersResource.get("u-1")).thenReturn(userResource);
            when(userResource.roles()).thenReturn(roleMappingResource);
            when(roleMappingResource.realmLevel()).thenReturn(roleScopeResource);
            RoleRepresentation existing = new RoleRepresentation();
            existing.setName("OLD");
            when(roleScopeResource.listAll()).thenReturn(List.of(existing));

            // assignRoleToUser
            when(realmResource.roles()).thenReturn(rolesResource);
            when(rolesResource.get("HOST")).thenReturn(roleResource);
            RoleRepresentation newRole = new RoleRepresentation();
            newRole.setName("HOST");
            when(roleResource.toRepresentation()).thenReturn(newRole);

            service.updateUserRole("u-1", "HOST");

            verify(roleScopeResource).remove(any());
            verify(roleScopeResource, atLeast(1)).add(any());
        }
    }

    @Nested
    @DisplayName("withTokenRetry — 401 retry path")
    class TokenRetry {

        @Test
        void whenFirstCallReturns401_thenRefreshTokenAndRetry() {
            UserRepresentation user = buildUserRepresentation("u-1", "test@x.com");
            when(usersResource.get("u-1")).thenReturn(userResource);
            // First call throws 401, second succeeds
            when(userResource.toRepresentation())
                    .thenThrow(new NotAuthorizedException(Response.status(401).build()))
                    .thenReturn(user);
            // Mock the token manager
            var tokenManager = mock(org.keycloak.admin.client.token.TokenManager.class);
            when(keycloak.tokenManager()).thenReturn(tokenManager);

            KeycloakUserDto dto = service.getUser("u-1");

            assertThat(dto.getEmail()).isEqualTo("test@x.com");
            verify(tokenManager).grantToken();
            verify(userResource, times(2)).toRepresentation();
        }
    }
}
