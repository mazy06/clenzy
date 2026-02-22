package com.clenzy.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.UserDto;
import com.clenzy.dto.UserProfileDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.model.Organization;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private PermissionService permissionService;
    @Mock private NewUserService newUserService;
    @Mock private NotificationService notificationService;

    private TenantContext tenantContext;
    private UserService userService;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        userService = new UserService(
                userRepository, organizationRepository, permissionService,
                newUserService, notificationService, tenantContext);
    }

    private User buildUser(Long id, String email, UserRole role) {
        User user = new User();
        user.setId(id);
        user.setFirstName("Jean");
        user.setLastName("Dupont");
        user.setEmail(email);
        user.setPassword("Passw0rd!");
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        user.setKeycloakId("kc-" + id);
        user.setOrganizationId(ORG_ID);
        return user;
    }

    // ===== CREATE =====

    @Nested
    class Create {

        @Test
        void whenValidDto_thenCreatesUserViaNewUserServiceAndReturnsDto() {
            UserDto dto = new UserDto();
            dto.email = "test@example.com";
            dto.firstName = "Jean";
            dto.lastName = "Dupont";
            dto.password = "Passw0rd!";
            dto.role = UserRole.HOST;
            dto.phoneNumber = "+33612345678";
            dto.status = UserStatus.ACTIVE;

            UserProfileDto profileDto = new UserProfileDto();
            profileDto.setId("kc-42");
            when(newUserService.createUser(any(CreateUserDto.class))).thenReturn(profileDto);

            User savedUser = buildUser(42L, "test@example.com", UserRole.HOST);
            savedUser.setKeycloakId("kc-42");
            when(userRepository.findByKeycloakId("kc-42")).thenReturn(Optional.of(savedUser));
            when(userRepository.save(any(User.class))).thenReturn(savedUser);

            UserDto result = userService.create(dto);

            assertThat(result).isNotNull();
            assertThat(result.email).isEqualTo("test@example.com");
            assertThat(result.firstName).isEqualTo("Jean");

            ArgumentCaptor<CreateUserDto> captor = ArgumentCaptor.forClass(CreateUserDto.class);
            verify(newUserService).createUser(captor.capture());
            assertThat(captor.getValue().getEmail()).isEqualTo("test@example.com");
            assertThat(captor.getValue().getRole()).isEqualTo("HOST");
        }

        @Test
        void whenNewUserServiceFails_thenThrowsRuntime() {
            UserDto dto = new UserDto();
            dto.email = "fail@example.com";
            dto.firstName = "Fail";
            dto.lastName = "Test";
            dto.password = "Passw0rd!";

            when(newUserService.createUser(any())).thenThrow(new RuntimeException("Keycloak down"));

            assertThatThrownBy(() -> userService.create(dto))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Impossible de créer l'utilisateur");
        }

        @Test
        void whenNotificationFails_thenUserIsStillCreated() {
            UserDto dto = new UserDto();
            dto.email = "notif@example.com";
            dto.firstName = "Notif";
            dto.lastName = "Fail";
            dto.password = "Passw0rd!";

            UserProfileDto profileDto = new UserProfileDto();
            profileDto.setId("kc-99");
            when(newUserService.createUser(any())).thenReturn(profileDto);

            User savedUser = buildUser(99L, "notif@example.com", UserRole.HOST);
            savedUser.setKeycloakId("kc-99");
            when(userRepository.findByKeycloakId("kc-99")).thenReturn(Optional.of(savedUser));
            when(userRepository.save(any())).thenReturn(savedUser);
            doThrow(new RuntimeException("SMTP down")).when(notificationService)
                    .notifyAdminsAndManagers(any(), anyString(), anyString(), anyString());

            UserDto result = userService.create(dto);
            assertThat(result).isNotNull();
            assertThat(result.email).isEqualTo("notif@example.com");
        }
    }

    // ===== UPDATE =====

    @Nested
    class Update {

        @Test
        void whenUpdatingExistingUser_thenFieldsAreUpdated() {
            User existing = buildUser(1L, "old@example.com", UserRole.HOST);
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            UserDto dto = new UserDto();
            dto.firstName = "Pierre";
            dto.lastName = "Martin";
            dto.phoneNumber = "+33699999999";
            dto.role = UserRole.SUPER_MANAGER;
            dto.status = UserStatus.INACTIVE;

            UserDto result = userService.update(1L, dto);

            assertThat(result.firstName).isEqualTo("Pierre");
            assertThat(result.lastName).isEqualTo("Martin");
            assertThat(result.phoneNumber).isEqualTo("+33699999999");
            assertThat(result.role).isEqualTo(UserRole.SUPER_MANAGER);
            assertThat(result.status).isEqualTo(UserStatus.INACTIVE);
        }

        @Test
        void whenUserNotFound_thenThrowsNotFoundException() {
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.update(999L, new UserDto()))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenNewPasswordProvided_thenResetsPasswordInKeycloak() {
            User existing = buildUser(1L, "pwd@example.com", UserRole.HOST);
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UserDto dto = new UserDto();
            dto.newPassword = "NewPassw0rd!";

            userService.update(1L, dto);

            verify(newUserService).resetPassword("kc-1", "NewPassw0rd!");
        }

        @Test
        void whenKeycloakPasswordResetFails_thenUserIsStillUpdatedInDb() {
            User existing = buildUser(1L, "kc-fail@example.com", UserRole.HOST);
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            doThrow(new RuntimeException("Keycloak unreachable")).when(newUserService)
                    .resetPassword(anyString(), anyString());

            UserDto dto = new UserDto();
            dto.firstName = "Updated";
            dto.newPassword = "NewPass123!";

            UserDto result = userService.update(1L, dto);
            assertThat(result.firstName).isEqualTo("Updated");
        }

        @Test
        void whenNullFieldsInDto_thenExistingFieldsArePreserved() {
            User existing = buildUser(1L, "keep@example.com", UserRole.HOST);
            existing.setPhoneNumber("+33600000000");
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UserDto dto = new UserDto(); // all null

            UserDto result = userService.update(1L, dto);

            assertThat(result.firstName).isEqualTo("Jean");
            assertThat(result.phoneNumber).isEqualTo("+33600000000");
            assertThat(result.role).isEqualTo(UserRole.HOST);
        }
    }

    // ===== GET BY ID =====

    @Nested
    class GetById {

        @Test
        void whenUserExists_thenReturnsDto() {
            User user = buildUser(1L, "found@example.com", UserRole.HOST);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            UserDto result = userService.getById(1L);
            assertThat(result.email).isEqualTo("found@example.com");
            assertThat(result.id).isEqualTo(1L);
        }

        @Test
        void whenUserNotFound_thenThrowsNotFoundException() {
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.getById(999L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    // ===== LIST =====

    @Nested
    class ListUsers {

        @Test
        void whenListAll_thenReturnsDtoList() {
            User u1 = buildUser(1L, "u1@test.com", UserRole.HOST);
            User u2 = buildUser(2L, "u2@test.com", UserRole.SUPER_ADMIN);
            when(userRepository.findAll()).thenReturn(List.of(u1, u2));

            List<UserDto> results = userService.list();

            assertThat(results).hasSize(2);
            assertThat(results.get(0).email).isEqualTo("u1@test.com");
            assertThat(results.get(1).role).isEqualTo(UserRole.SUPER_ADMIN);
        }

        @Test
        void whenListWithPagination_thenReturnsPage() {
            User u1 = buildUser(1L, "page@test.com", UserRole.HOST);
            Page<User> page = new PageImpl<>(List.of(u1), PageRequest.of(0, 10), 1);
            when(userRepository.findAll(any(PageRequest.class))).thenReturn(page);

            Page<UserDto> result = userService.list(PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getTotalElements()).isEqualTo(1);
        }
    }

    // ===== FIND BY KEYCLOAK ID / EMAIL =====

    @Nested
    class FindOperations {

        @Test
        void whenFindByKeycloakId_thenReturnsUser() {
            User user = buildUser(1L, "kc@test.com", UserRole.HOST);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            User result = userService.findByKeycloakId("kc-1");
            assertThat(result).isNotNull();
            assertThat(result.getEmail()).isEqualTo("kc@test.com");
        }

        @Test
        void whenFindByKeycloakIdNotFound_thenReturnsNull() {
            when(userRepository.findByKeycloakId("unknown")).thenReturn(Optional.empty());

            assertThat(userService.findByKeycloakId("unknown")).isNull();
        }

        @Test
        void whenFindByEmailNull_thenReturnsNull() {
            assertThat(userService.findByEmail(null)).isNull();
        }

        @Test
        void whenExistsByEmailNull_thenReturnsFalse() {
            assertThat(userService.existsByEmail(null)).isFalse();
        }
    }

    // ===== UPDATE KEYCLOAK ID =====

    @Nested
    class UpdateKeycloakId {

        @Test
        void whenUserExists_thenUpdatesKeycloakId() {
            User user = buildUser(1L, "upd@test.com", UserRole.HOST);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            userService.updateKeycloakId(1L, "new-kc-id");

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            assertThat(captor.getValue().getKeycloakId()).isEqualTo("new-kc-id");
        }

        @Test
        void whenUserNotFound_thenDoesNothing() {
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            userService.updateKeycloakId(999L, "noop");

            verify(userRepository, never()).save(any());
        }
    }

    // ===== AUTO PROVISION =====

    @Nested
    class AutoProvisionUser {

        @Test
        void whenAllFieldsProvided_thenCreatesUser() {
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(10L);
                return u;
            });

            User result = userService.autoProvisionUser("kc-new", "auto@test.com",
                    "Auto", "User", UserRole.HOUSEKEEPER);

            assertThat(result).isNotNull();
            assertThat(result.getKeycloakId()).isEqualTo("kc-new");
            assertThat(result.getEmail()).isEqualTo("auto@test.com");
            assertThat(result.getRole()).isEqualTo(UserRole.HOUSEKEEPER);
            assertThat(result.getStatus()).isEqualTo(UserStatus.ACTIVE);
            assertThat(result.getOrganizationId()).isEqualTo(ORG_ID);
        }

        @Test
        void whenEmailIsNull_thenUsesAutoProvisionedEmail() {
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            User result = userService.autoProvisionUser("kc-no-email", null,
                    "Auto", "User", UserRole.HOST);

            assertThat(result.getEmail()).isEqualTo("kc-no-email@auto-provisioned.local");
        }

        @Test
        void whenNameFieldsBlank_thenUsesDefaults() {
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            User result = userService.autoProvisionUser("kc-blank", "blank@test.com",
                    "", "  ", UserRole.HOST);

            assertThat(result.getFirstName()).isEqualTo("Auto");
            assertThat(result.getLastName()).isEqualTo("Provisioned");
        }

        @Test
        void whenTenantContextHasNoOrgId_thenFallsBackToFirstOrg() {
            tenantContext.setOrganizationId(null);

            Organization org = new Organization();
            org.setId(5L);
            org.setName("Default Org");
            when(organizationRepository.findAll()).thenReturn(List.of(org));
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            User result = userService.autoProvisionUser("kc-no-org", "noorg@test.com",
                    "Test", "User", UserRole.HOST);

            assertThat(result.getOrganizationId()).isEqualTo(5L);
        }

        @Test
        void whenExceptionDuringSave_thenReturnsNull() {
            when(userRepository.save(any())).thenThrow(new RuntimeException("DB error"));

            User result = userService.autoProvisionUser("kc-err", "err@test.com",
                    "Err", "User", UserRole.HOST);

            assertThat(result).isNull();
        }
    }

    // ===== DELETE =====

    @Nested
    class Delete {

        @Test
        void whenUserExistsWithKeycloakId_thenDeletesFromKeycloakAndDb() {
            User user = buildUser(1L, "del@test.com", UserRole.HOST);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            userService.delete(1L);

            verify(newUserService).deleteUser("kc-1");
            verify(userRepository).deleteById(1L);
        }

        @Test
        void whenUserHasNoKeycloakId_thenSkipsKeycloakDeletion() {
            User user = buildUser(1L, "no-kc@test.com", UserRole.HOST);
            user.setKeycloakId(null);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            userService.delete(1L);

            verify(newUserService, never()).deleteUser(anyString());
            verify(userRepository).deleteById(1L);
        }

        @Test
        void whenKeycloakDeletionFails_thenStillDeletesFromDb() {
            User user = buildUser(1L, "kc-fail-del@test.com", UserRole.HOST);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            doThrow(new RuntimeException("Keycloak down")).when(newUserService).deleteUser(anyString());

            userService.delete(1L);

            verify(userRepository).deleteById(1L);
        }

        @Test
        void whenUserNotFound_thenThrowsNotFoundException() {
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.delete(999L))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenNotificationFailsAfterDelete_thenDoesNotThrow() {
            User user = buildUser(1L, "del-notif@test.com", UserRole.HOST);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            doThrow(new RuntimeException("Notif error")).when(notificationService)
                    .notifyAdminsAndManagers(any(), anyString(), anyString(), anyString());

            userService.delete(1L);

            verify(userRepository).deleteById(1L);
        }
    }
}
