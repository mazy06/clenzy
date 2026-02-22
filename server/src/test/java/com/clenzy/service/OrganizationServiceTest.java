package com.clenzy.service;

import com.clenzy.model.OrgMemberRole;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationMember;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.OrganizationMemberRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrganizationServiceTest {

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private OrganizationMemberRepository memberRepository;

    @Mock
    private UserRepository userRepository;

    private OrganizationService organizationService;

    @BeforeEach
    void setUp() {
        organizationService = new OrganizationService(
                organizationRepository,
                memberRepository,
                userRepository
        );
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private User buildUser(Long id, String email, UserRole role) {
        User user = new User("First", "Last", email, "password123");
        user.setId(id);
        user.setKeycloakId("kc-" + id);
        user.setRole(role);
        return user;
    }

    private Organization buildOrg(Long id, String name, OrganizationType type) {
        Organization org = new Organization(name, type, "slug-" + id);
        org.setId(id);
        return org;
    }

    private OrganizationMember buildMember(Long id, Organization org, User user, OrgMemberRole role) {
        OrganizationMember member = new OrganizationMember(org, user, role);
        member.setId(id);
        return member;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // createForUser()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class CreateForUser {

        @Test
        void createForUser_createsOrgAndOwnerMembership() {
            // Arrange
            User user = buildUser(1L, "alice@test.com", UserRole.HOST);
            when(organizationRepository.existsBySlug(anyString())).thenReturn(false);
            when(organizationRepository.save(any(Organization.class)))
                    .thenAnswer(inv -> {
                        Organization org = inv.getArgument(0);
                        org.setId(100L);
                        return org;
                    });
            when(memberRepository.save(any(OrganizationMember.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(userRepository.save(any(User.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            Organization result = organizationService.createForUser(user, "Ma Conciergerie", OrganizationType.CONCIERGE);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.getName()).isEqualTo("Ma Conciergerie");
            assertThat(result.getType()).isEqualTo(OrganizationType.CONCIERGE);
            assertThat(result.getSlug()).isNotBlank();

            // Verify OWNER membership created
            ArgumentCaptor<OrganizationMember> memberCaptor = ArgumentCaptor.forClass(OrganizationMember.class);
            verify(memberRepository).save(memberCaptor.capture());
            assertThat(memberCaptor.getValue().getRoleInOrg()).isEqualTo(OrgMemberRole.OWNER);

            // Verify user organizationId updated
            assertThat(user.getOrganizationId()).isEqualTo(100L);
            verify(userRepository).save(user);
        }

        @Test
        void createForUser_generatesSlugFromName() {
            User user = buildUser(1L, "a@test.com", UserRole.HOST);
            when(organizationRepository.existsBySlug(anyString())).thenReturn(false);
            when(organizationRepository.save(any(Organization.class)))
                    .thenAnswer(inv -> {
                        Organization org = inv.getArgument(0);
                        org.setId(101L);
                        return org;
                    });
            when(memberRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Organization result = organizationService.createForUser(user, "Hello World Test", OrganizationType.INDIVIDUAL);

            assertThat(result.getSlug()).isEqualTo("hello-world-test");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // createForUserWithBilling()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class CreateForUserWithBilling {

        @Test
        void createForUserWithBilling_setsBillingFields() {
            // Arrange
            User user = buildUser(1L, "billing@test.com", UserRole.HOST);
            when(organizationRepository.existsBySlug(anyString())).thenReturn(false);
            when(organizationRepository.save(any(Organization.class)))
                    .thenAnswer(inv -> {
                        Organization org = inv.getArgument(0);
                        if (org.getId() == null) org.setId(200L);
                        return org;
                    });
            when(memberRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // Act
            Organization result = organizationService.createForUserWithBilling(
                    user, "Billing Org", OrganizationType.CONCIERGE,
                    "cus_stripe123", "sub_stripe456", "premium", "monthly"
            );

            // Assert
            assertThat(result.getStripeCustomerId()).isEqualTo("cus_stripe123");
            assertThat(result.getStripeSubscriptionId()).isEqualTo("sub_stripe456");
            assertThat(result.getForfait()).isEqualTo("premium");
            assertThat(result.getBillingPeriod()).isEqualTo("monthly");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // addMember()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class AddMember {

        @Test
        void addMember_duplicateMember_throwsIllegalState() {
            when(memberRepository.existsByOrganizationIdAndUserId(1L, 2L)).thenReturn(true);

            assertThatThrownBy(() -> organizationService.addMember(1L, 2L, OrgMemberRole.MEMBER))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("deja membre");
        }

        @Test
        void addMember_success_createsMembershipAndUpdatesUser() {
            // Arrange
            Organization org = buildOrg(1L, "Org", OrganizationType.CONCIERGE);
            User user = buildUser(2L, "new@test.com", UserRole.HOUSEKEEPER);

            when(memberRepository.existsByOrganizationIdAndUserId(1L, 2L)).thenReturn(false);
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
            when(userRepository.findById(2L)).thenReturn(Optional.of(user));
            when(memberRepository.save(any(OrganizationMember.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(userRepository.save(any(User.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            OrganizationMember result = organizationService.addMember(1L, 2L, OrgMemberRole.MEMBER);

            // Assert
            assertThat(result.getRoleInOrg()).isEqualTo(OrgMemberRole.MEMBER);
            assertThat(user.getOrganizationId()).isEqualTo(1L);
            verify(userRepository).save(user);
        }

        @Test
        void addMember_orgNotFound_throwsRuntimeException() {
            when(memberRepository.existsByOrganizationIdAndUserId(1L, 2L)).thenReturn(false);
            when(organizationRepository.findById(1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> organizationService.addMember(1L, 2L, OrgMemberRole.MEMBER))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Organisation non trouvee");
        }

        @Test
        void addMember_userNotFound_throwsRuntimeException() {
            Organization org = buildOrg(1L, "Org", OrganizationType.CONCIERGE);
            when(memberRepository.existsByOrganizationIdAndUserId(1L, 2L)).thenReturn(false);
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
            when(userRepository.findById(2L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> organizationService.addMember(1L, 2L, OrgMemberRole.MEMBER))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Utilisateur non trouve");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // removeMember()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class RemoveMember {

        @Test
        void removeMember_ownerRole_throwsIllegalState() {
            Organization org = buildOrg(1L, "Org", OrganizationType.CONCIERGE);
            User user = buildUser(2L, "owner@test.com", UserRole.HOST);
            OrganizationMember owner = buildMember(10L, org, user, OrgMemberRole.OWNER);

            when(memberRepository.findByUserId(2L)).thenReturn(Optional.of(owner));

            assertThatThrownBy(() -> organizationService.removeMember(1L, 2L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("proprietaire");
        }

        @Test
        void removeMember_regularMember_removesAndClearsOrgId() {
            // Arrange
            Organization org = buildOrg(1L, "Org", OrganizationType.CONCIERGE);
            User user = buildUser(2L, "member@test.com", UserRole.HOUSEKEEPER);
            user.setOrganizationId(1L);
            OrganizationMember member = buildMember(10L, org, user, OrgMemberRole.MEMBER);

            when(memberRepository.findByUserId(2L)).thenReturn(Optional.of(member));
            when(userRepository.findById(2L)).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            organizationService.removeMember(1L, 2L);

            // Assert
            verify(memberRepository).deleteByOrganizationIdAndUserId(1L, 2L);
            assertThat(user.getOrganizationId()).isNull();
            verify(userRepository).save(user);
        }

        @Test
        void removeMember_memberNotFound_throwsRuntimeException() {
            when(memberRepository.findByUserId(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> organizationService.removeMember(1L, 99L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Membre non trouve");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // getByUserId() / getByUserKeycloakId()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class GetByUser {

        @Test
        void getByUserId_memberExists_returnsOrganization() {
            Organization org = buildOrg(1L, "Org", OrganizationType.CONCIERGE);
            User user = buildUser(2L, "u@test.com", UserRole.HOST);
            OrganizationMember member = buildMember(10L, org, user, OrgMemberRole.MEMBER);

            when(memberRepository.findByUserId(2L)).thenReturn(Optional.of(member));

            Optional<Organization> result = organizationService.getByUserId(2L);

            assertThat(result).isPresent();
            assertThat(result.get().getId()).isEqualTo(1L);
        }

        @Test
        void getByUserId_noMember_returnsEmpty() {
            when(memberRepository.findByUserId(99L)).thenReturn(Optional.empty());

            Optional<Organization> result = organizationService.getByUserId(99L);

            assertThat(result).isEmpty();
        }

        @Test
        void getByUserKeycloakId_memberExists_returnsOrganization() {
            Organization org = buildOrg(1L, "Org", OrganizationType.INDIVIDUAL);
            User user = buildUser(2L, "u@test.com", UserRole.HOST);
            OrganizationMember member = buildMember(10L, org, user, OrgMemberRole.OWNER);

            when(memberRepository.findByUserKeycloakId("kc-2")).thenReturn(Optional.of(member));

            Optional<Organization> result = organizationService.getByUserKeycloakId("kc-2");

            assertThat(result).isPresent();
            assertThat(result.get().getName()).isEqualTo("Org");
        }

        @Test
        void getByUserKeycloakId_noMember_returnsEmpty() {
            when(memberRepository.findByUserKeycloakId("kc-unknown")).thenReturn(Optional.empty());

            Optional<Organization> result = organizationService.getByUserKeycloakId("kc-unknown");

            assertThat(result).isEmpty();
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // getMembers() / getMembersWithUser()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class GetMembers {

        @Test
        void getMembers_delegatesToRepository() {
            Organization org = buildOrg(1L, "Org", OrganizationType.CONCIERGE);
            User user = buildUser(2L, "u@t.com", UserRole.HOST);
            OrganizationMember member = buildMember(10L, org, user, OrgMemberRole.MEMBER);

            when(memberRepository.findByOrganizationId(1L)).thenReturn(List.of(member));

            List<OrganizationMember> result = organizationService.getMembers(1L);

            assertThat(result).hasSize(1);
            verify(memberRepository).findByOrganizationId(1L);
        }

        @Test
        void getMembersWithUser_delegatesToRepository() {
            when(memberRepository.findByOrganizationIdWithUser(1L)).thenReturn(List.of());

            List<OrganizationMember> result = organizationService.getMembersWithUser(1L);

            assertThat(result).isEmpty();
            verify(memberRepository).findByOrganizationIdWithUser(1L);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // changeMemberRole()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class ChangeMemberRole {

        @Test
        void changeMemberRole_assignOwnerRole_throwsIllegalState() {
            assertThatThrownBy(() -> organizationService.changeMemberRole(1L, 10L, OrgMemberRole.OWNER))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("OWNER ne peut pas etre attribue");
        }

        @Test
        void changeMemberRole_modifyOwner_throwsIllegalState() {
            Organization org = buildOrg(1L, "Org", OrganizationType.CONCIERGE);
            User user = buildUser(2L, "owner@test.com", UserRole.HOST);
            OrganizationMember owner = buildMember(10L, org, user, OrgMemberRole.OWNER);

            when(memberRepository.findByIdAndOrganizationId(10L, 1L)).thenReturn(Optional.of(owner));

            assertThatThrownBy(() -> organizationService.changeMemberRole(1L, 10L, OrgMemberRole.ADMIN))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("proprietaire ne peut pas etre modifie");
        }

        @Test
        void changeMemberRole_validChange_updatesRole() {
            // Arrange
            Organization org = buildOrg(1L, "Org", OrganizationType.CONCIERGE);
            User user = buildUser(2L, "m@test.com", UserRole.HOUSEKEEPER);
            OrganizationMember member = buildMember(10L, org, user, OrgMemberRole.MEMBER);

            when(memberRepository.findByIdAndOrganizationId(10L, 1L)).thenReturn(Optional.of(member));
            when(memberRepository.save(any(OrganizationMember.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            OrganizationMember result = organizationService.changeMemberRole(1L, 10L, OrgMemberRole.ADMIN);

            // Assert
            assertThat(result.getRoleInOrg()).isEqualTo(OrgMemberRole.ADMIN);
            verify(memberRepository).save(member);
        }

        @Test
        void changeMemberRole_memberNotFound_throwsRuntimeException() {
            when(memberRepository.findByIdAndOrganizationId(99L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> organizationService.changeMemberRole(1L, 99L, OrgMemberRole.ADMIN))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Membre non trouve");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // removeMemberById()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class RemoveMemberById {

        @Test
        void removeMemberById_ownerRole_throwsIllegalState() {
            Organization org = buildOrg(1L, "Org", OrganizationType.CONCIERGE);
            User user = buildUser(2L, "o@test.com", UserRole.HOST);
            OrganizationMember owner = buildMember(10L, org, user, OrgMemberRole.OWNER);

            when(memberRepository.findByIdAndOrganizationId(10L, 1L)).thenReturn(Optional.of(owner));

            assertThatThrownBy(() -> organizationService.removeMemberById(1L, 10L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("proprietaire");
        }

        @Test
        void removeMemberById_regularMember_deletesAndClearsOrgId() {
            // Arrange
            Organization org = buildOrg(1L, "Org", OrganizationType.CONCIERGE);
            User user = buildUser(2L, "m@test.com", UserRole.HOUSEKEEPER);
            user.setOrganizationId(1L);
            OrganizationMember member = buildMember(10L, org, user, OrgMemberRole.MEMBER);

            // We need userId to be accessible. Since OrganizationMember.userId is a read-only column,
            // the getter returns null when not loaded from DB. We use the user object via findById.
            when(memberRepository.findByIdAndOrganizationId(10L, 1L)).thenReturn(Optional.of(member));
            when(userRepository.findById(any())).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            organizationService.removeMemberById(1L, 10L);

            // Assert
            verify(memberRepository).delete(member);
            assertThat(user.getOrganizationId()).isNull();
        }

        @Test
        void removeMemberById_memberNotFound_throwsRuntimeException() {
            when(memberRepository.findByIdAndOrganizationId(99L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> organizationService.removeMemberById(1L, 99L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Membre non trouve");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // validateOrgManagement()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class ValidateOrgManagement {

        @Test
        void validateOrgManagement_platformStaff_bypasses() {
            User admin = buildUser(1L, "admin@test.com", UserRole.SUPER_ADMIN);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));

            // Should not throw
            organizationService.validateOrgManagement("kc-1", 5L);

            verify(memberRepository, never()).findByUserId(any());
        }

        @Test
        void validateOrgManagement_superManager_bypasses() {
            User manager = buildUser(2L, "mgr@test.com", UserRole.SUPER_MANAGER);
            when(userRepository.findByKeycloakId("kc-2")).thenReturn(Optional.of(manager));

            // Should not throw
            organizationService.validateOrgManagement("kc-2", 5L);

            verify(memberRepository, never()).findByUserId(any());
        }

        @Test
        void validateOrgManagement_ownerOfOrg_succeeds() {
            // Arrange
            User user = buildUser(3L, "owner@test.com", UserRole.HOST);
            Organization org = buildOrg(5L, "Org", OrganizationType.CONCIERGE);
            OrganizationMember member = buildMember(10L, org, user, OrgMemberRole.OWNER);

            when(userRepository.findByKeycloakId("kc-3")).thenReturn(Optional.of(user));
            when(memberRepository.findByUserId(3L)).thenReturn(Optional.of(member));

            // Should not throw
            organizationService.validateOrgManagement("kc-3", 5L);
        }

        @Test
        void validateOrgManagement_adminOfOrg_succeeds() {
            User user = buildUser(3L, "orgadmin@test.com", UserRole.HOST);
            Organization org = buildOrg(5L, "Org", OrganizationType.CONCIERGE);
            OrganizationMember member = buildMember(10L, org, user, OrgMemberRole.ADMIN);

            when(userRepository.findByKeycloakId("kc-3")).thenReturn(Optional.of(user));
            when(memberRepository.findByUserId(3L)).thenReturn(Optional.of(member));

            // Should not throw
            organizationService.validateOrgManagement("kc-3", 5L);
        }

        @Test
        void validateOrgManagement_userNotFound_throwsAccessDenied() {
            when(userRepository.findByKeycloakId("kc-unknown")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> organizationService.validateOrgManagement("kc-unknown", 5L))
                    .isInstanceOf(AccessDeniedException.class)
                    .hasMessageContaining("Utilisateur non trouve");
        }

        @Test
        void validateOrgManagement_notMemberOfAnyOrg_throwsAccessDenied() {
            User user = buildUser(3L, "nomember@test.com", UserRole.HOST);
            when(userRepository.findByKeycloakId("kc-3")).thenReturn(Optional.of(user));
            when(memberRepository.findByUserId(3L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> organizationService.validateOrgManagement("kc-3", 5L))
                    .isInstanceOf(AccessDeniedException.class)
                    .hasMessageContaining("pas membre");
        }

        @Test
        void validateOrgManagement_memberOfDifferentOrg_throwsAccessDenied() {
            User user = buildUser(3L, "wrong@test.com", UserRole.HOST);
            Organization otherOrg = buildOrg(99L, "Other Org", OrganizationType.CONCIERGE);
            OrganizationMember member = buildMember(10L, otherOrg, user, OrgMemberRole.OWNER);

            when(userRepository.findByKeycloakId("kc-3")).thenReturn(Optional.of(user));
            when(memberRepository.findByUserId(3L)).thenReturn(Optional.of(member));

            assertThatThrownBy(() -> organizationService.validateOrgManagement("kc-3", 5L))
                    .isInstanceOf(AccessDeniedException.class)
                    .hasMessageContaining("pas membre");
        }

        @Test
        void validateOrgManagement_memberWithoutManagementRights_throwsAccessDenied() {
            User user = buildUser(3L, "regular@test.com", UserRole.HOST);
            Organization org = buildOrg(5L, "Org", OrganizationType.CONCIERGE);
            OrganizationMember member = buildMember(10L, org, user, OrgMemberRole.MEMBER);

            when(userRepository.findByKeycloakId("kc-3")).thenReturn(Optional.of(user));
            when(memberRepository.findByUserId(3L)).thenReturn(Optional.of(member));

            assertThatThrownBy(() -> organizationService.validateOrgManagement("kc-3", 5L))
                    .isInstanceOf(AccessDeniedException.class)
                    .hasMessageContaining("droits de gestion");
        }

        @Test
        void validateOrgManagement_managerRoleInOrg_throwsAccessDenied() {
            // MANAGER in OrgMemberRole does NOT have canManageOrg() rights
            User user = buildUser(3L, "orgmgr@test.com", UserRole.HOST);
            Organization org = buildOrg(5L, "Org", OrganizationType.CONCIERGE);
            OrganizationMember member = buildMember(10L, org, user, OrgMemberRole.MANAGER);

            when(userRepository.findByKeycloakId("kc-3")).thenReturn(Optional.of(user));
            when(memberRepository.findByUserId(3L)).thenReturn(Optional.of(member));

            assertThatThrownBy(() -> organizationService.validateOrgManagement("kc-3", 5L))
                    .isInstanceOf(AccessDeniedException.class)
                    .hasMessageContaining("droits de gestion");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // upgradeType()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class UpgradeType {

        @Test
        void upgradeType_updatesTypeSuccessfully() {
            Organization org = buildOrg(1L, "Org", OrganizationType.INDIVIDUAL);
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
            when(organizationRepository.save(any(Organization.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            Organization result = organizationService.upgradeType(1L, OrganizationType.CONCIERGE);

            assertThat(result.getType()).isEqualTo(OrganizationType.CONCIERGE);
            verify(organizationRepository).save(org);
        }

        @Test
        void upgradeType_orgNotFound_throwsRuntimeException() {
            when(organizationRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> organizationService.upgradeType(99L, OrganizationType.CONCIERGE))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Organisation non trouvee");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // createStandalone()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class CreateStandalone {

        @Test
        void createStandalone_createsOrgWithoutUser() {
            when(organizationRepository.existsBySlug(anyString())).thenReturn(false);
            when(organizationRepository.save(any(Organization.class)))
                    .thenAnswer(inv -> {
                        Organization org = inv.getArgument(0);
                        org.setId(300L);
                        return org;
                    });

            Organization result = organizationService.createStandalone("Standalone Org", OrganizationType.CLEANING_COMPANY);

            assertThat(result).isNotNull();
            assertThat(result.getName()).isEqualTo("Standalone Org");
            assertThat(result.getType()).isEqualTo(OrganizationType.CLEANING_COMPANY);
            assertThat(result.getSlug()).isNotBlank();

            // No membership or user update should happen
            verify(memberRepository, never()).save(any());
            verify(userRepository, never()).save(any());
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // updateOrganization()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class UpdateOrganization {

        @Test
        void updateOrganization_nameChanges_regeneratesSlug() {
            Organization org = buildOrg(1L, "Old Name", OrganizationType.CONCIERGE);
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
            when(organizationRepository.existsBySlug(anyString())).thenReturn(false);
            when(organizationRepository.save(any(Organization.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            Organization result = organizationService.updateOrganization(1L, "New Name", null);

            assertThat(result.getName()).isEqualTo("New Name");
            assertThat(result.getSlug()).isEqualTo("new-name");
        }

        @Test
        void updateOrganization_sameName_doesNotRegenerateSlug() {
            Organization org = buildOrg(1L, "Same Name", OrganizationType.CONCIERGE);
            org.setSlug("original-slug");
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
            when(organizationRepository.save(any(Organization.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            Organization result = organizationService.updateOrganization(1L, "Same Name", OrganizationType.CLEANING_COMPANY);

            assertThat(result.getSlug()).isEqualTo("original-slug");
            assertThat(result.getType()).isEqualTo(OrganizationType.CLEANING_COMPANY);
        }

        @Test
        void updateOrganization_nullName_doesNotChangeName() {
            Organization org = buildOrg(1L, "Keep", OrganizationType.CONCIERGE);
            org.setSlug("keep-slug");
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
            when(organizationRepository.save(any(Organization.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            Organization result = organizationService.updateOrganization(1L, null, OrganizationType.INDIVIDUAL);

            assertThat(result.getName()).isEqualTo("Keep");
            assertThat(result.getType()).isEqualTo(OrganizationType.INDIVIDUAL);
            assertThat(result.getSlug()).isEqualTo("keep-slug");
        }

        @Test
        void updateOrganization_orgNotFound_throwsRuntimeException() {
            when(organizationRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> organizationService.updateOrganization(99L, "X", null))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Organisation non trouvee");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // deleteOrganization()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class DeleteOrganization {

        @Test
        void deleteOrganization_withMembers_throwsIllegalState() {
            Organization org = buildOrg(1L, "Org With Members", OrganizationType.CONCIERGE);
            User user = buildUser(2L, "u@t.com", UserRole.HOST);
            OrganizationMember member = buildMember(10L, org, user, OrgMemberRole.OWNER);

            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
            when(memberRepository.findByOrganizationId(1L)).thenReturn(List.of(member));

            assertThatThrownBy(() -> organizationService.deleteOrganization(1L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("contient")
                    .hasMessageContaining("membre");
        }

        @Test
        void deleteOrganization_noMembers_dissociatesUsersAndDeletes() {
            // Arrange
            Organization organization = buildOrg(1L, "Empty Org", OrganizationType.CONCIERGE);
            User user1 = buildUser(2L, "u1@t.com", UserRole.HOST);
            user1.setOrganizationId(1L);
            User user2 = buildUser(3L, "u2@t.com", UserRole.HOUSEKEEPER);
            user2.setOrganizationId(1L);

            when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
            when(memberRepository.findByOrganizationId(1L)).thenReturn(Collections.emptyList());
            when(userRepository.findByOrganizationId(1L)).thenReturn(List.of(user1, user2));
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            organizationService.deleteOrganization(1L);

            // Assert
            assertThat(user1.getOrganizationId()).isNull();
            assertThat(user2.getOrganizationId()).isNull();
            verify(userRepository, times(2)).save(any(User.class));
            verify(organizationRepository).delete(organization);
        }

        @Test
        void deleteOrganization_orgNotFound_throwsRuntimeException() {
            when(organizationRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> organizationService.deleteOrganization(99L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Organisation non trouvee");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // generateUniqueSlug()
    // ═════════════════════════════════════════════════════════════════════════

    @Nested
    class GenerateUniqueSlug {

        @Test
        void generateUniqueSlug_simpleName_returnsLowercaseHyphenated() {
            when(organizationRepository.existsBySlug("ma-conciergerie-paris")).thenReturn(false);

            String slug = organizationService.generateUniqueSlug("Ma Conciergerie Paris");

            assertThat(slug).isEqualTo("ma-conciergerie-paris");
        }

        @Test
        void generateUniqueSlug_accentedName_removesAccents() {
            when(organizationRepository.existsBySlug("hotel-de-la-cote")).thenReturn(false);

            String slug = organizationService.generateUniqueSlug("Hotel de la Cote");

            assertThat(slug).isEqualTo("hotel-de-la-cote");
        }

        @Test
        void generateUniqueSlug_duplicateSlug_appendsCounter() {
            when(organizationRepository.existsBySlug("my-org")).thenReturn(true);
            when(organizationRepository.existsBySlug("my-org-1")).thenReturn(true);
            when(organizationRepository.existsBySlug("my-org-2")).thenReturn(false);

            String slug = organizationService.generateUniqueSlug("My Org");

            assertThat(slug).isEqualTo("my-org-2");
        }

        @Test
        void generateUniqueSlug_longName_truncatesTo80() {
            String longName = "A".repeat(100);
            String expectedBase = "a".repeat(80);
            when(organizationRepository.existsBySlug(expectedBase)).thenReturn(false);

            String slug = organizationService.generateUniqueSlug(longName);

            assertThat(slug).hasSize(80);
        }

        @Test
        void generateUniqueSlug_specialCharacters_removedCleanly() {
            when(organizationRepository.existsBySlug("hello-world")).thenReturn(false);

            String slug = organizationService.generateUniqueSlug("Hello! @World#");

            assertThat(slug).isEqualTo("hello-world");
        }
    }
}
