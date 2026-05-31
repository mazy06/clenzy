package com.clenzy.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.KeycloakUserDto;
import com.clenzy.dto.UpdateUserDto;
import com.clenzy.dto.UserProfileDto;
import com.clenzy.exception.UserNotFoundException;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.OrganizationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NewUserServiceTest {

    @Mock private KeycloakService keycloakService;
    @Mock private UserRepository userRepository;
    @Mock private OrganizationService organizationService;

    private NewUserService service;

    @BeforeEach
    void setUp() {
        service = new NewUserService(keycloakService, userRepository, organizationService);
    }

    private KeycloakUserDto buildKeycloakUser(String id, String email, String firstName, String lastName) {
        KeycloakUserDto dto = new KeycloakUserDto();
        dto.setId(id);
        dto.setEmail(email);
        dto.setFirstName(firstName);
        dto.setLastName(lastName);
        dto.setEnabled(true);
        dto.setEmailVerified(true);
        return dto;
    }

    // ===== GET USER PROFILE =====

    @Nested
    class GetUserProfile {

        @Test
        void whenKeycloakAndDbExist_thenMerges() {
            KeycloakUserDto kcUser = buildKeycloakUser("kc-1", "test@test.com", "John", "Doe");
            when(keycloakService.getUser("kc-1")).thenReturn(kcUser);

            User businessUser = new User();
            businessUser.setKeycloakId("kc-1");
            businessUser.setRole(UserRole.SUPER_ADMIN);
            businessUser.setStatus(UserStatus.ACTIVE);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(businessUser));

            UserProfileDto result = service.getUserProfile("kc-1");

            assertThat(result.getEmail()).isEqualTo("test@test.com");
            assertThat(result.getRole()).isEqualTo(UserRole.SUPER_ADMIN);
        }

        @Test
        void whenKeycloakFails_thenThrowsUserNotFound() {
            when(keycloakService.getUser("kc-unknown"))
                    .thenThrow(new UserNotFoundException("Not found"));

            assertThatThrownBy(() -> service.getUserProfile("kc-unknown"))
                    .isInstanceOf(UserNotFoundException.class);
        }
    }

    // ===== CREATE USER =====

    @Nested
    class CreateUser {

        @Test
        void whenValid_thenCreatesInKeycloakAndDb() {
            CreateUserDto createDto = new CreateUserDto();
            createDto.setEmail("new@test.com");
            createDto.setFirstName("Jane");
            createDto.setLastName("Smith");
            createDto.setPassword("secret123");
            createDto.setRole("HOST");

            when(keycloakService.createUser(createDto)).thenReturn("kc-new-1");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(1L);
                return u;
            });

            // Mock getUserProfile call
            KeycloakUserDto kcUser = buildKeycloakUser("kc-new-1", "new@test.com", "Jane", "Smith");
            when(keycloakService.getUser("kc-new-1")).thenReturn(kcUser);
            when(userRepository.findByKeycloakId("kc-new-1")).thenReturn(Optional.empty());

            UserProfileDto result = service.createUser(createDto);

            assertThat(result.getEmail()).isEqualTo("new@test.com");

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            assertThat(captor.getValue().getKeycloakId()).isEqualTo("kc-new-1");
            assertThat(captor.getValue().getRole()).isEqualTo(UserRole.HOST);
        }
    }

    // ===== UPDATE USER =====

    @Nested
    class UpdateUser {

        @Test
        void whenRoleChanged_thenUpdatesInDb() {
            UpdateUserDto updateDto = new UpdateUserDto();
            updateDto.setRole("SUPER_ADMIN");

            User businessUser = new User();
            businessUser.setKeycloakId("kc-1");
            businessUser.setRole(UserRole.HOST);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(businessUser));

            KeycloakUserDto kcUser = buildKeycloakUser("kc-1", "test@test.com", "Test", "User");
            when(keycloakService.getUser("kc-1")).thenReturn(kcUser);

            service.updateUser("kc-1", updateDto);

            verify(keycloakService).updateUser("kc-1", updateDto);
            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            assertThat(captor.getValue().getRole()).isEqualTo(UserRole.SUPER_ADMIN);
        }
    }

    // ===== DELETE USER =====

    @Nested
    class DeleteUser {

        @Test
        void whenExists_thenDeletesFromBoth() {
            User businessUser = new User();
            businessUser.setKeycloakId("kc-1");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(businessUser));

            service.deleteUser("kc-1");

            verify(keycloakService).deleteUser("kc-1");
            verify(userRepository).delete(any(User.class));
        }

        @Test
        void whenNoBusinessUser_thenOnlyDeletesFromKeycloak() {
            when(userRepository.findByKeycloakId("kc-2")).thenReturn(Optional.empty());

            service.deleteUser("kc-2");

            verify(keycloakService).deleteUser("kc-2");
            verify(userRepository, never()).delete(any(User.class));
        }
    }

    // ===== USER EXISTS =====

    @Nested
    class UserExists {

        @Test
        void whenDelegates_thenReturnsResult() {
            when(keycloakService.userExists("kc-1")).thenReturn(true);

            assertThat(service.userExists("kc-1")).isTrue();
        }

        @Test
        void whenDoesNotExist_returnsFalse() {
            when(keycloakService.userExists("kc-x")).thenReturn(false);

            assertThat(service.userExists("kc-x")).isFalse();
        }
    }

    @Nested
    class GetAllUserProfiles {

        @Test
        void whenKeycloakAndDbProvidesUsers_thenMerges() {
            KeycloakUserDto u1 = buildKeycloakUser("kc-1", "a@test.com", "Alice", "A");
            KeycloakUserDto u2 = buildKeycloakUser("kc-2", "b@test.com", "Bob", "B");
            when(keycloakService.getAllUsers()).thenReturn(List.of(u1, u2));

            User bu1 = new User();
            bu1.setKeycloakId("kc-1");
            bu1.setRole(UserRole.SUPER_ADMIN);
            bu1.setStatus(UserStatus.ACTIVE);
            when(userRepository.findAll()).thenReturn(List.of(bu1));

            List<UserProfileDto> all = service.getAllUserProfiles();

            assertThat(all).hasSize(2);
            assertThat(all.get(0).getEmail()).isEqualTo("a@test.com");
            assertThat(all.get(0).getRole()).isEqualTo(UserRole.SUPER_ADMIN);
            assertThat(all.get(1).getEmail()).isEqualTo("b@test.com");
            assertThat(all.get(1).getRole()).isNull(); // no DB row
        }

        @Test
        void whenKeycloakFails_thenThrowsRuntime() {
            when(keycloakService.getAllUsers()).thenThrow(new RuntimeException("kc down"));

            assertThatThrownBy(() -> service.getAllUserProfiles())
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    class SearchUsers {

        @Test
        void whenMatches_thenReturnsMapList() {
            User u = new User();
            u.setId(1L);
            u.setFirstName("John");
            u.setLastName("Doe");
            u.setEmail("john@test.com");
            u.setOrganizationId(42L);
            when(userRepository.searchByNameOrEmail("john")).thenReturn(List.of(u));

            var result = service.searchUsers("john");

            assertThat(result).hasSize(1);
            assertThat(result.get(0)).containsEntry("id", 1L)
                    .containsEntry("firstName", "John")
                    .containsEntry("email", "john@test.com")
                    .containsEntry("organizationId", 42L);
        }

        @Test
        void whenNullFields_thenDefaultsToEmpty() {
            User u = new User();
            u.setId(1L);
            // null first/last/email/orgId
            when(userRepository.searchByNameOrEmail("x")).thenReturn(List.of(u));

            var result = service.searchUsers("x");

            assertThat(result.get(0)).containsEntry("firstName", "")
                    .containsEntry("lastName", "")
                    .containsEntry("email", "")
                    .containsEntry("organizationId", 0L);
        }

        @Test
        void whenManyResults_thenLimitsToTwenty() {
            List<User> many = new java.util.ArrayList<>();
            for (long i = 0; i < 30; i++) {
                User u = new User();
                u.setId(i);
                many.add(u);
            }
            when(userRepository.searchByNameOrEmail("test")).thenReturn(many);

            var result = service.searchUsers("test");

            assertThat(result).hasSize(20);
        }
    }

    @Nested
    class CreateUserAdditional {

        @Test
        void whenOrganizationIdProvided_addsMember() {
            CreateUserDto dto = new CreateUserDto();
            dto.setEmail("new@test.com");
            dto.setFirstName("Jane");
            dto.setLastName("Smith");
            dto.setPassword("pwd");
            dto.setRole("HOST");
            dto.setOrganizationId(100L);
            dto.setOrgRole("OWNER");

            when(keycloakService.createUser(dto)).thenReturn("kc-1");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(5L);
                return u;
            });
            KeycloakUserDto kcUser = buildKeycloakUser("kc-1", "new@test.com", "Jane", "Smith");
            when(keycloakService.getUser("kc-1")).thenReturn(kcUser);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.empty());

            service.createUser(dto);

            verify(organizationService).addMember(eq(100L), eq(5L), any());
        }

        @Test
        void whenOrgRoleNull_defaultsToMember() {
            CreateUserDto dto = new CreateUserDto();
            dto.setEmail("x@test.com");
            dto.setFirstName("X");
            dto.setLastName("Y");
            dto.setPassword("pwd");
            dto.setRole("HOST");
            dto.setOrganizationId(100L);
            // orgRole null

            when(keycloakService.createUser(dto)).thenReturn("kc-1");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(7L);
                return u;
            });
            KeycloakUserDto kcUser = buildKeycloakUser("kc-1", "x@test.com", "X", "Y");
            when(keycloakService.getUser("kc-1")).thenReturn(kcUser);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.empty());

            service.createUser(dto);

            ArgumentCaptor<com.clenzy.model.OrgMemberRole> roleCap =
                    ArgumentCaptor.forClass(com.clenzy.model.OrgMemberRole.class);
            verify(organizationService).addMember(eq(100L), eq(7L), roleCap.capture());
            assertThat(roleCap.getValue()).isEqualTo(com.clenzy.model.OrgMemberRole.MEMBER);
        }

        @Test
        void whenKeycloakCreateFails_thenWrapsInRuntime() {
            CreateUserDto dto = new CreateUserDto();
            dto.setEmail("x@test.com");
            dto.setFirstName("X");
            dto.setLastName("Y");
            dto.setPassword("pwd");
            dto.setRole("HOST");
            when(keycloakService.createUser(dto)).thenThrow(new RuntimeException("kc fail"));

            assertThatThrownBy(() -> service.createUser(dto))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("création");
        }
    }

    @Nested
    class UpdateUserAdditional {

        @Test
        void whenNoRoleChange_doesNotSaveBusinessUser() {
            UpdateUserDto dto = new UpdateUserDto();
            // role null

            User bu = new User();
            bu.setKeycloakId("kc-1");
            bu.setRole(UserRole.HOST);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(bu));
            KeycloakUserDto kcUser = buildKeycloakUser("kc-1", "t@test.com", "T", "U");
            when(keycloakService.getUser("kc-1")).thenReturn(kcUser);

            service.updateUser("kc-1", dto);

            verify(keycloakService).updateUser("kc-1", dto);
            // No save call since role wasn't updated
            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        void whenNoBusinessUserExists_thenStillUpdatesKeycloak() {
            UpdateUserDto dto = new UpdateUserDto();
            dto.setRole("HOST");

            when(userRepository.findByKeycloakId("kc-99")).thenReturn(Optional.empty());
            KeycloakUserDto kcUser = buildKeycloakUser("kc-99", "y@test.com", "Y", "Z");
            when(keycloakService.getUser("kc-99")).thenReturn(kcUser);

            service.updateUser("kc-99", dto);

            verify(keycloakService).updateUser("kc-99", dto);
            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        void whenKeycloakFails_thenWrapsRuntime() {
            UpdateUserDto dto = new UpdateUserDto();
            doThrow(new RuntimeException("kc")).when(keycloakService).updateUser(any(), any());

            assertThatThrownBy(() -> service.updateUser("kc-1", dto))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("mise");
        }
    }

    @Nested
    class ResetPassword {

        @Test
        void delegatesToKeycloakService() {
            service.resetPassword("kc-1", "newPwd");

            verify(keycloakService).resetPassword("kc-1", "newPwd");
        }

        @Test
        void whenKeycloakFails_thenWrapsRuntime() {
            doThrow(new RuntimeException("kc")).when(keycloakService).resetPassword(any(), any());

            assertThatThrownBy(() -> service.resetPassword("kc-1", "p"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("mot de passe");
        }
    }

    @Nested
    class DeleteUserAdditional {

        @Test
        void whenKeycloakFails_thenWrapsRuntime() {
            doThrow(new RuntimeException("kc")).when(keycloakService).deleteUser("kc-1");

            assertThatThrownBy(() -> service.deleteUser("kc-1"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("suppression");
        }
    }
}
