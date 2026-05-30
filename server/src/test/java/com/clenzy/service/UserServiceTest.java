package com.clenzy.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.UserDto;
import com.clenzy.dto.UserProfileDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.OrgMemberRole;
import com.clenzy.model.OrganizationMember;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.model.Organization;
import com.clenzy.repository.OrganizationMemberRepository;
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
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationMemberRepository memberRepository;
    @Mock private OrganizationService organizationService;
    @Mock private PermissionService permissionService;
    @Mock private NewUserService newUserService;
    @Mock private NotificationService notificationService;
    @Mock private EmailService emailService;
    @Mock private UserAvatarStorageService avatarStorage;
    @Mock private AvatarSelfHealer avatarSelfHealer;
    @Mock private ObjectProvider<OutboxPublisher> outboxPublisherProvider;
    @Mock private ObjectProvider<UserProfileSyncService> profileSyncProvider;

    private TenantContext tenantContext;
    private UserService userService;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        // ObjectProvider.getIfAvailable() returns null when not wired — the tests don't
        // exercise outbox / OTA fan-out, so keeping these null mirrors a context without
        // the Kafka stack (matches ContactMessageEventPublisher's pattern).
        when(outboxPublisherProvider.getIfAvailable()).thenReturn(null);
        when(profileSyncProvider.getIfAvailable()).thenReturn(null);

        userService = new UserService(
                userRepository, organizationRepository, memberRepository,
                organizationService, permissionService,
                newUserService, notificationService, emailService, tenantContext,
                avatarStorage, avatarSelfHealer, outboxPublisherProvider, profileSyncProvider);
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

        @Test
        void whenUserHasBlankKeycloakId_thenSkipsKeycloakDeletion() {
            User user = buildUser(1L, "blank-kc@test.com", UserRole.HOST);
            user.setKeycloakId("   ");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            userService.delete(1L);

            verify(newUserService, never()).deleteUser(anyString());
            verify(memberRepository).deleteByUserId(1L);
            verify(userRepository).deleteById(1L);
        }
    }

    // ===== UPDATE — BRANCHES SUPPLÉMENTAIRES =====

    @Nested
    class UpdateAdditionalBranches {

        @Test
        void whenProfilePictureUrlIsExternalHttps_thenStored() {
            User existing = buildUser(1L, "pic@test.com", UserRole.HOST);
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UserDto dto = new UserDto();
            dto.profilePictureUrl = "https://gravatar.com/avatar/abc";

            UserDto result = userService.update(1L, dto);

            assertThat(result.profilePictureUrl).isEqualTo("https://gravatar.com/avatar/abc");
        }

        @Test
        void whenProfilePictureUrlIsRelativeStoragePath_thenServedAsApiUrl() {
            User existing = buildUser(1L, "pic@test.com", UserRole.HOST);
            // Already stored relative path in DB
            existing.setProfilePictureUrl("avatars/1/pic.png");
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UserDto dto = new UserDto();
            // DTO ne fournit pas d'URL externe → reste sur storage path
            UserDto result = userService.update(1L, dto);

            // dto.profilePictureUrl exposed via publicAvatarUrl
            assertThat(result.profilePictureUrl).isEqualTo("/api/users/1/profile-picture");
        }

        @Test
        void whenProfilePictureUrlIsRelativeNotHttp_thenIgnored() {
            User existing = buildUser(1L, "pic@test.com", UserRole.HOST);
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UserDto dto = new UserDto();
            dto.profilePictureUrl = "avatars/1/pic.png"; // not http/https
            userService.update(1L, dto);

            // The entity should NOT be updated with the relative path
            assertThat(existing.getProfilePictureUrl()).isNull();
        }

        @Test
        void whenDeferredPaymentSet_thenUpdatedOnEntity() {
            User existing = buildUser(1L, "defer@test.com", UserRole.HOST);
            existing.setDeferredPayment(false);
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UserDto dto = new UserDto();
            dto.deferredPayment = true;

            UserDto result = userService.update(1L, dto);
            assertThat(result.deferredPayment).isTrue();
        }

        @Test
        void whenOrganizationIdChanged_thenAddsMembershipIfMissing() {
            User existing = buildUser(1L, "org@test.com", UserRole.HOST);
            existing.setOrganizationId(5L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(memberRepository.existsByOrganizationIdAndUserId(99L, 1L)).thenReturn(false);

            UserDto dto = new UserDto();
            dto.organizationId = 99L;

            userService.update(1L, dto);

            verify(organizationService).addMember(eq(99L), eq(1L), any(OrgMemberRole.class));
        }

        @Test
        void whenOrganizationIdChangedButMembershipExists_thenNoAddMember() {
            User existing = buildUser(1L, "org-exist@test.com", UserRole.HOST);
            existing.setOrganizationId(5L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(memberRepository.existsByOrganizationIdAndUserId(99L, 1L)).thenReturn(true);

            UserDto dto = new UserDto();
            dto.organizationId = 99L;

            userService.update(1L, dto);

            verify(organizationService, never()).addMember(anyLong(), anyLong(), any());
        }

        @Test
        void whenRoleChangedAndMemberIsOwner_thenNoRoleSyncOnMember() {
            User existing = buildUser(1L, "owner@test.com", UserRole.HOST);
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            OrganizationMember owner = new OrganizationMember();
            owner.setRoleInOrg(OrgMemberRole.OWNER);
            when(memberRepository.findByUserId(1L)).thenReturn(Optional.of(owner));

            UserDto dto = new UserDto();
            dto.role = UserRole.SUPER_MANAGER;

            userService.update(1L, dto);

            // Owner is not changed
            assertThat(owner.getRoleInOrg()).isEqualTo(OrgMemberRole.OWNER);
            verify(memberRepository, never()).save(any());
        }

        @Test
        void whenRoleChangedAndMemberIsMember_thenRoleInOrgIsSynced() {
            User existing = buildUser(1L, "syncrole@test.com", UserRole.HOUSEKEEPER);
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            OrganizationMember member = new OrganizationMember();
            member.setRoleInOrg(OrgMemberRole.HOUSEKEEPER);
            when(memberRepository.findByUserId(1L)).thenReturn(Optional.of(member));

            UserDto dto = new UserDto();
            dto.role = UserRole.TECHNICIAN;

            userService.update(1L, dto);

            assertThat(member.getRoleInOrg()).isEqualTo(OrgMemberRole.TECHNICIAN);
            verify(memberRepository).save(member);
        }

        @Test
        void whenRoleChangedToHostAndMemberWouldBecomeOwner_thenStaysMember() {
            User existing = buildUser(1L, "newhost@test.com", UserRole.HOUSEKEEPER);
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            OrganizationMember member = new OrganizationMember();
            member.setRoleInOrg(OrgMemberRole.HOUSEKEEPER);
            when(memberRepository.findByUserId(1L)).thenReturn(Optional.of(member));

            UserDto dto = new UserDto();
            dto.role = UserRole.HOST; // maps to OWNER

            userService.update(1L, dto);

            // OWNER mapping gets replaced by MEMBER
            assertThat(member.getRoleInOrg()).isEqualTo(OrgMemberRole.MEMBER);
        }

        @Test
        void whenNotificationFailsAfterUpdate_thenStillReturnsDto() {
            User existing = buildUser(1L, "notif-upd@test.com", UserRole.HOST);
            when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            doThrow(new RuntimeException("Notif failed")).when(notificationService)
                    .notify(anyString(), any(), anyString(), anyString(), anyString());

            UserDto dto = new UserDto();
            dto.firstName = "NewName";

            UserDto result = userService.update(1L, dto);
            assertThat(result.firstName).isEqualTo("NewName");
        }
    }

    // ===== CREATE — additional branches =====

    @Nested
    class CreateAdditionalBranches {

        @Test
        void whenOrgIdNull_thenSkipsMembership() {
            tenantContext.setOrganizationId(null);

            UserDto dto = new UserDto();
            dto.email = "noorg@test.com";
            dto.firstName = "No";
            dto.lastName = "Org";
            dto.password = "Pwd123!";
            dto.role = UserRole.HOST;

            UserProfileDto profileDto = new UserProfileDto();
            profileDto.setId("kc-noorg");
            when(newUserService.createUser(any())).thenReturn(profileDto);

            User saved = buildUser(99L, "noorg@test.com", UserRole.HOST);
            saved.setKeycloakId("kc-noorg");
            saved.setOrganizationId(null);
            when(userRepository.findByKeycloakId("kc-noorg")).thenReturn(Optional.of(saved));
            when(userRepository.save(any())).thenReturn(saved);

            UserDto result = userService.create(dto);

            assertThat(result).isNotNull();
            verify(organizationService, never()).addMember(anyLong(), anyLong(), any());
        }

        @Test
        void whenUserNotFoundInDbAfterCreate_thenWrapsRuntime() {
            UserDto dto = new UserDto();
            dto.email = "ghost@test.com";
            dto.firstName = "Ghost";
            dto.lastName = "Test";
            dto.password = "Pwd123!";

            UserProfileDto profileDto = new UserProfileDto();
            profileDto.setId("kc-ghost");
            when(newUserService.createUser(any())).thenReturn(profileDto);
            when(userRepository.findByKeycloakId("kc-ghost")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.create(dto))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        void whenEmailFailsAfterCreate_thenStillSucceeds() {
            UserDto dto = new UserDto();
            dto.email = "noemail@test.com";
            dto.firstName = "NoEmail";
            dto.lastName = "Test";
            dto.password = "Pwd123!";

            UserProfileDto profileDto = new UserProfileDto();
            profileDto.setId("kc-noemail");
            when(newUserService.createUser(any())).thenReturn(profileDto);

            User saved = buildUser(50L, "noemail@test.com", UserRole.HOST);
            saved.setKeycloakId("kc-noemail");
            when(userRepository.findByKeycloakId("kc-noemail")).thenReturn(Optional.of(saved));
            when(userRepository.save(any())).thenReturn(saved);

            doThrow(new RuntimeException("SMTP down")).when(emailService)
                    .sendWelcomeEmail(anyString(), anyString(), anyString(), anyString(), anyString());

            UserDto result = userService.create(dto);
            assertThat(result).isNotNull();
        }
    }

    // ===== AUTO-PROVISIONING — additional branches =====

    @Nested
    class AutoProvisionAdditionalBranches {

        @Test
        void whenNoOrgInTenantAndNoOrgsInDb_thenStillCreatesUserWithoutMembership() {
            tenantContext.setOrganizationId(null);
            when(organizationRepository.findAll()).thenReturn(List.of());
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            User result = userService.autoProvisionUser("kc-no-orgs", "noorgsdb@test.com",
                    "Test", "User", UserRole.HOST);

            assertThat(result).isNotNull();
            assertThat(result.getOrganizationId()).isNull();
            verify(organizationService, never()).addMember(anyLong(), anyLong(), any());
        }

        @Test
        void whenMembershipAlreadyExists_thenNoAddMember() {
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(11L);
                return u;
            });
            when(memberRepository.existsByOrganizationIdAndUserId(ORG_ID, 11L)).thenReturn(true);

            User result = userService.autoProvisionUser("kc-dup", "dup@test.com",
                    "Dup", "Member", UserRole.HOUSEKEEPER);

            assertThat(result).isNotNull();
            verify(organizationService, never()).addMember(anyLong(), anyLong(), any());
        }
    }

    // ===== FIND BY EMAIL / EXISTS =====

    @Nested
    class FindByEmailExists {

        @Test
        void whenFindByEmail_thenLooksUpByHash() {
            User user = buildUser(1L, "em@test.com", UserRole.HOST);
            when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.of(user));

            User result = userService.findByEmail("em@test.com");
            assertThat(result).isNotNull();
            assertThat(result.getEmail()).isEqualTo("em@test.com");
        }

        @Test
        void whenFindByEmailNotFound_thenReturnsNull() {
            when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.empty());

            assertThat(userService.findByEmail("missing@test.com")).isNull();
        }

        @Test
        void whenExistsByEmailTrue_thenReturnsTrue() {
            when(userRepository.existsByEmailHash(anyString())).thenReturn(true);
            assertThat(userService.existsByEmail("exists@test.com")).isTrue();
        }

        @Test
        void whenExistsByEmailFalse_thenReturnsFalse() {
            when(userRepository.existsByEmailHash(anyString())).thenReturn(false);
            assertThat(userService.existsByEmail("notthere@test.com")).isFalse();
        }
    }

    // ===== AVATAR — upload / delete / stream =====

    @Nested
    class AvatarManagement {

        @Test
        void uploadProfilePicture_persistsNewPathAndDeletesPrevious() {
            User user = buildUser(1L, "avatar@test.com", UserRole.HOST);
            user.setProfilePictureUrl("avatars/old.png"); // pre-existing storage path
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            MultipartFile file = mock(MultipartFile.class);
            when(avatarStorage.store(eq(1L), eq(file))).thenReturn("avatars/new.png");

            UserDto result = userService.uploadProfilePicture(1L, file);

            assertThat(result.profilePictureUrl).isEqualTo("/api/users/1/profile-picture");
            verify(avatarStorage).delete("avatars/old.png");
        }

        @Test
        void uploadProfilePicture_whenPreviousIsHttp_thenNotDeleted() {
            User user = buildUser(1L, "avatar-http@test.com", UserRole.HOST);
            user.setProfilePictureUrl("https://gravatar.com/x");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            MultipartFile file = mock(MultipartFile.class);
            when(avatarStorage.store(eq(1L), eq(file))).thenReturn("avatars/new.png");

            userService.uploadProfilePicture(1L, file);

            verify(avatarStorage, never()).delete(anyString());
        }

        @Test
        void uploadProfilePicture_whenSamePath_thenNoDelete() {
            User user = buildUser(1L, "avatar-same@test.com", UserRole.HOST);
            user.setProfilePictureUrl("avatars/same.png");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            MultipartFile file = mock(MultipartFile.class);
            when(avatarStorage.store(eq(1L), eq(file))).thenReturn("avatars/same.png");

            userService.uploadProfilePicture(1L, file);

            verify(avatarStorage, never()).delete(anyString());
        }

        @Test
        void uploadProfilePicture_userNotFound_throwsNotFound() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());
            MultipartFile file = mock(MultipartFile.class);

            assertThatThrownBy(() -> userService.uploadProfilePicture(99L, file))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void deleteProfilePicture_clearsPathAndDeletesFile() {
            User user = buildUser(1L, "del-avatar@test.com", UserRole.HOST);
            user.setProfilePictureUrl("avatars/x.png");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            userService.deleteProfilePicture(1L);

            verify(avatarStorage).delete("avatars/x.png");
            assertThat(user.getProfilePictureUrl()).isNull();
        }

        @Test
        void deleteProfilePicture_whenHttpUrl_thenNoFileDelete() {
            User user = buildUser(1L, "del-http@test.com", UserRole.HOST);
            user.setProfilePictureUrl("http://example.com/x.png");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            userService.deleteProfilePicture(1L);

            verify(avatarStorage, never()).delete(anyString());
        }

        @Test
        void deleteProfilePicture_userNotFound_throwsNotFound() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> userService.deleteProfilePicture(99L))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void streamProfilePicture_userNotFound_returnsNull() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());
            assertThat(userService.streamProfilePicture(99L)).isNull();
        }

        @Test
        void streamProfilePicture_pathBlank_returnsNull() {
            User user = buildUser(1L, "blank@test.com", UserRole.HOST);
            user.setProfilePictureUrl("   ");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            assertThat(userService.streamProfilePicture(1L)).isNull();
        }

        @Test
        void streamProfilePicture_pathIsHttp_returnsNull() {
            User user = buildUser(1L, "http@test.com", UserRole.HOST);
            user.setProfilePictureUrl("https://gravatar.com/avatar/x");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            assertThat(userService.streamProfilePicture(1L)).isNull();
        }

        @Test
        void streamProfilePicture_fileMissing_triggersSelfHeal() {
            User user = buildUser(1L, "stale@test.com", UserRole.HOST);
            user.setProfilePictureUrl("avatars/stale.png");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(avatarStorage.exists("avatars/stale.png")).thenReturn(false);

            assertThat(userService.streamProfilePicture(1L)).isNull();
            verify(avatarSelfHealer).clearStaleReference(1L);
        }

        @Test
        void streamProfilePicture_fileExists_returnsResourceArray() {
            User user = buildUser(1L, "stream@test.com", UserRole.HOST);
            user.setProfilePictureUrl("avatars/ok.png");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(avatarStorage.exists("avatars/ok.png")).thenReturn(true);

            Resource resource = new ByteArrayResource(new byte[]{1, 2, 3});
            when(avatarStorage.load("avatars/ok.png")).thenReturn(resource);
            when(avatarStorage.contentTypeFor("avatars/ok.png")).thenReturn("image/png");

            Object[] result = userService.streamProfilePicture(1L);
            assertThat(result).isNotNull();
            assertThat(result[0]).isSameAs(resource);
            assertThat(result[1]).isEqualTo("image/png");
        }
    }

    // ===== toDto — additional avatar/organization branches =====

    @Nested
    class ToDtoBranches {

        @Test
        void whenUserHasOrganization_thenIncludesOrgName() {
            User user = buildUser(1L, "withorg@test.com", UserRole.HOST);
            user.setOrganizationId(7L);

            Organization org = new Organization();
            org.setId(7L);
            org.setName("MyCo");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(organizationRepository.findById(7L)).thenReturn(Optional.of(org));

            UserDto result = userService.getById(1L);
            assertThat(result.organizationName).isEqualTo("MyCo");
        }

        @Test
        void whenAvatarBlank_thenDtoReturnsNullProfileUrl() {
            User user = buildUser(1L, "blankav@test.com", UserRole.HOST);
            user.setProfilePictureUrl("");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            UserDto result = userService.getById(1L);
            assertThat(result.profilePictureUrl).isNull();
        }

        @Test
        void whenAvatarIsExternalUrl_thenDtoReturnsItDirectly() {
            User user = buildUser(1L, "exturl@test.com", UserRole.HOST);
            user.setProfilePictureUrl("http://external.com/x.jpg");
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            UserDto result = userService.getById(1L);
            assertThat(result.profilePictureUrl).isEqualTo("http://external.com/x.jpg");
        }
    }
}
