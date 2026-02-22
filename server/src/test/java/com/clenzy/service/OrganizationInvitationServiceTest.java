package com.clenzy.service;

import com.clenzy.dto.InvitationDto;
import com.clenzy.model.*;
import com.clenzy.repository.OrganizationInvitationRepository;
import com.clenzy.repository.OrganizationMemberRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.lang.reflect.Field;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrganizationInvitationServiceTest {

    @Mock private OrganizationInvitationRepository invitationRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationMemberRepository memberRepository;
    @Mock private UserRepository userRepository;
    @Mock private OrganizationService organizationService;
    @Mock private EmailService emailService;
    @Mock private RedisTemplate<String, Object> redisTemplate;
    @Mock private ValueOperations<String, Object> valueOperations;

    private TenantContext tenantContext;
    private OrganizationInvitationService invitationService;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() throws Exception {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        invitationService = new OrganizationInvitationService(
                invitationRepository, organizationRepository, memberRepository,
                userRepository, organizationService, emailService,
                redisTemplate, tenantContext);

        setField(invitationService, "frontendUrl", "http://localhost:3000");
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private User buildUser(Long id, UserRole role) {
        User user = new User();
        user.setId(id);
        user.setFirstName("User");
        user.setLastName("Test");
        user.setEmail("user" + id + "@test.com");
        user.setRole(role);
        user.setKeycloakId("kc-" + id);
        return user;
    }

    private Organization buildOrg(Long id, String name) {
        Organization org = new Organization();
        org.setId(id);
        org.setName(name);
        return org;
    }

    private Jwt buildJwt(String subject, String... roles) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600));
        if (roles.length > 0) {
            builder.claim("realm_access", Map.of("roles", List.of(roles)));
        }
        return builder.build();
    }

    private OrganizationInvitation buildInvitation(Long id, Organization org, String email) {
        OrganizationInvitation inv = new OrganizationInvitation();
        inv.setId(id);
        inv.setOrganization(org);
        inv.setInvitedEmail(email);
        inv.setRoleInvited(OrgMemberRole.MEMBER);
        inv.setStatus(InvitationStatus.PENDING);
        inv.setExpiresAt(LocalDateTime.now().plusDays(7));
        return inv;
    }

    // ===== SEND INVITATION =====

    @Nested
    @DisplayName("sendInvitation")
    class SendInvitation {

        @Test
        @DisplayName("when SUPER_ADMIN then sends invitation successfully")
        void whenSuperAdmin_thenSendsInvitation() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
            when(invitationRepository.existsByOrganizationIdAndInvitedEmailAndStatus(
                    eq(ORG_ID), anyString(), eq(InvitationStatus.PENDING))).thenReturn(false);
            when(invitationRepository.save(any(OrganizationInvitation.class))).thenAnswer(inv -> {
                OrganizationInvitation i = inv.getArgument(0);
                i.setId(100L);
                return i;
            });
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);

            // Act
            InvitationDto result = invitationService.sendInvitation(
                    ORG_ID, "invite@test.com", "MEMBER", jwt);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.getOrganizationName()).isEqualTo("Test Org");
            assertThat(result.getInvitedEmail()).isEqualTo("invite@test.com");
            assertThat(result.getRoleInvited()).isEqualTo("MEMBER");
            assertThat(result.getInvitationLink()).contains("accept-invitation?token=");
            verify(invitationRepository).save(any(OrganizationInvitation.class));
        }

        @Test
        @DisplayName("when OWNER role requested then throws IllegalArgumentException")
        void whenOwnerRoleRequested_thenThrowsIllegalArgument() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));

            // Act & Assert
            assertThatThrownBy(() -> invitationService.sendInvitation(
                    ORG_ID, "invite@test.com", "OWNER", jwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("OWNER");
        }

        @Test
        @DisplayName("when pending invitation exists for email then throws IllegalStateException")
        void whenPendingInvitationExists_thenThrowsIllegalState() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
            when(invitationRepository.existsByOrganizationIdAndInvitedEmailAndStatus(
                    ORG_ID, "dup@test.com", InvitationStatus.PENDING)).thenReturn(true);

            // Act & Assert
            assertThatThrownBy(() -> invitationService.sendInvitation(
                    ORG_ID, "dup@test.com", "MEMBER", jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("deja en attente");
        }

        @Test
        @DisplayName("when email send fails then invitation is still created")
        void whenEmailSendFails_thenInvitationIsStillCreated() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
            when(invitationRepository.existsByOrganizationIdAndInvitedEmailAndStatus(
                    any(), any(), any())).thenReturn(false);
            when(invitationRepository.save(any())).thenAnswer(inv -> {
                OrganizationInvitation i = inv.getArgument(0);
                i.setId(100L);
                return i;
            });
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            doThrow(new RuntimeException("SMTP error")).when(emailService)
                    .sendInvitationEmail(any(), any(), any(), any(), any(), any());

            // Act
            InvitationDto result = invitationService.sendInvitation(
                    ORG_ID, "no-email@test.com", "MEMBER", jwt);

            // Assert
            assertThat(result).isNotNull();
            verify(invitationRepository).save(any());
        }

        @Test
        @DisplayName("when user not found then throws AccessDeniedException")
        void whenUserNotFound_thenThrowsAccessDenied() {
            // Arrange
            Jwt jwt = buildJwt("kc-unknown");
            when(userRepository.findByKeycloakId("kc-unknown")).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> invitationService.sendInvitation(
                    ORG_ID, "invite@test.com", "MEMBER", jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("when null role string then defaults to MEMBER")
        void whenNullRole_thenDefaultsToMember() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
            when(invitationRepository.existsByOrganizationIdAndInvitedEmailAndStatus(
                    any(), any(), any())).thenReturn(false);
            when(invitationRepository.save(any())).thenAnswer(inv -> {
                OrganizationInvitation i = inv.getArgument(0);
                i.setId(101L);
                return i;
            });
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);

            // Act
            InvitationDto result = invitationService.sendInvitation(
                    ORG_ID, "default@test.com", null, jwt);

            // Assert
            assertThat(result.getRoleInvited()).isEqualTo("MEMBER");
        }

        @Test
        @DisplayName("when invalid role string then defaults to MEMBER")
        void whenInvalidRole_thenDefaultsToMember() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
            when(invitationRepository.existsByOrganizationIdAndInvitedEmailAndStatus(
                    any(), any(), any())).thenReturn(false);
            when(invitationRepository.save(any())).thenAnswer(inv -> {
                OrganizationInvitation i = inv.getArgument(0);
                i.setId(102L);
                return i;
            });
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);

            // Act
            InvitationDto result = invitationService.sendInvitation(
                    ORG_ID, "invalid-role@test.com", "NONEXISTENT_ROLE", jwt);

            // Assert
            assertThat(result.getRoleInvited()).isEqualTo("MEMBER");
        }
    }

    // ===== GET INVITATION INFO =====

    @Nested
    @DisplayName("getInvitationInfo")
    class GetInvitationInfo {

        @Test
        @DisplayName("when valid token and pending invitation then returns info")
        void whenValidToken_thenReturnsInfo() {
            // Arrange
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(1L, org, "test@test.com");
            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(inv));

            // Act
            InvitationDto result = invitationService.getInvitationInfo("raw-token-123");

            // Assert
            assertThat(result.getOrganizationName()).isEqualTo("Test Org");
            assertThat(result.getInvitedEmail()).isEqualTo("test@test.com");
            assertThat(result.getStatus()).isEqualTo("PENDING");
            assertThat(result.getRoleInvited()).isEqualTo("MEMBER");
        }

        @Test
        @DisplayName("when token not found then throws IllegalArgumentException")
        void whenTokenNotFound_thenThrowsIllegalArgument() {
            // Arrange
            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> invitationService.getInvitationInfo("invalid-token"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("when already accepted then throws IllegalStateException")
        void whenAlreadyAccepted_thenThrowsIllegalState() {
            // Arrange
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(1L, org, "test@test.com");
            inv.setStatus(InvitationStatus.ACCEPTED);
            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(inv));

            // Act & Assert
            assertThatThrownBy(() -> invitationService.getInvitationInfo("token"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("acceptee");
        }

        @Test
        @DisplayName("when expired then throws IllegalStateException")
        void whenExpired_thenThrowsIllegalState() {
            // Arrange
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(1L, org, "test@test.com");
            inv.setExpiresAt(LocalDateTime.now().minusDays(1));
            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(inv));

            // Act & Assert
            assertThatThrownBy(() -> invitationService.getInvitationInfo("token"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("expire");
        }

        @Test
        @DisplayName("when cancelled then throws IllegalStateException")
        void whenCancelled_thenThrowsIllegalState() {
            // Arrange
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(1L, org, "test@test.com");
            inv.setStatus(InvitationStatus.CANCELLED);
            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(inv));

            // Act & Assert
            assertThatThrownBy(() -> invitationService.getInvitationInfo("token"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("annulee");
        }
    }

    // ===== ACCEPT INVITATION =====

    @Nested
    @DisplayName("acceptInvitation")
    class AcceptInvitation {

        @Test
        @DisplayName("when existing user then adds to org and marks accepted")
        void whenExistingUser_thenAddsToOrgAndMarksAccepted() {
            // Arrange
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(1L, org, "accept@test.com");
            User user = buildUser(10L, UserRole.HOST);

            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(inv));
            when(userRepository.findByKeycloakId("kc-10")).thenReturn(Optional.of(user));
            when(memberRepository.existsByOrganizationIdAndUserId(ORG_ID, 10L)).thenReturn(false);
            when(invitationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
            lenient().when(redisTemplate.delete(anyString())).thenReturn(true);

            Jwt jwt = buildJwt("kc-10");

            // Act
            InvitationDto result = invitationService.acceptInvitation("raw-token", jwt);

            // Assert
            assertThat(result.getStatus()).isEqualTo("ACCEPTED");
            assertThat(result.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(inv.getAcceptedByUser()).isEqualTo(user);
            verify(organizationService).addMember(ORG_ID, 10L, OrgMemberRole.MEMBER);
        }

        @Test
        @DisplayName("when user does not exist then auto-provisions from JWT claims")
        void whenUserNotExists_thenAutoProvisions() {
            // Arrange
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(1L, org, "new@test.com");

            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(inv));
            when(userRepository.findByKeycloakId("kc-new")).thenReturn(Optional.empty());
            when(userRepository.save(any(User.class))).thenAnswer(i -> {
                User u = i.getArgument(0);
                u.setId(99L);
                return u;
            });
            when(memberRepository.existsByOrganizationIdAndUserId(eq(ORG_ID), any())).thenReturn(false);
            when(invitationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
            lenient().when(redisTemplate.delete(anyString())).thenReturn(true);

            Jwt jwt = Jwt.withTokenValue("token")
                    .header("alg", "RS256")
                    .subject("kc-new")
                    .claim("email", "new@test.com")
                    .claim("given_name", "New")
                    .claim("family_name", "User")
                    .issuedAt(Instant.now())
                    .expiresAt(Instant.now().plusSeconds(3600))
                    .build();

            // Act
            InvitationDto result = invitationService.acceptInvitation("raw-token", jwt);

            // Assert
            assertThat(result.getStatus()).isEqualTo("ACCEPTED");

            ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(userCaptor.capture());
            User savedUser = userCaptor.getValue();
            assertThat(savedUser.getKeycloakId()).isEqualTo("kc-new");
            assertThat(savedUser.getEmail()).isEqualTo("new@test.com");
            assertThat(savedUser.getFirstName()).isEqualTo("New");
            assertThat(savedUser.getLastName()).isEqualTo("User");
            assertThat(savedUser.getStatus()).isEqualTo(UserStatus.ACTIVE);
        }

        @Test
        @DisplayName("when invitation not pending then throws IllegalStateException")
        void whenNotPending_thenThrowsIllegalState() {
            // Arrange
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(1L, org, "test@test.com");
            inv.setStatus(InvitationStatus.ACCEPTED);
            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(inv));

            Jwt jwt = buildJwt("kc-1");

            // Act & Assert
            assertThatThrownBy(() -> invitationService.acceptInvitation("token", jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("plus valide");
        }

        @Test
        @DisplayName("when invitation expired then marks as EXPIRED and throws")
        void whenExpired_thenMarksExpiredAndThrows() {
            // Arrange
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(1L, org, "test@test.com");
            inv.setExpiresAt(LocalDateTime.now().minusDays(1));
            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(inv));
            when(invitationRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            Jwt jwt = buildJwt("kc-1");

            // Act & Assert
            assertThatThrownBy(() -> invitationService.acceptInvitation("token", jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("expire");

            assertThat(inv.getStatus()).isEqualTo(InvitationStatus.EXPIRED);
        }

        @Test
        @DisplayName("when token not found then throws IllegalArgumentException")
        void whenTokenNotFound_thenThrows() {
            // Arrange
            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.empty());
            Jwt jwt = buildJwt("kc-1");

            // Act & Assert
            assertThatThrownBy(() -> invitationService.acceptInvitation("invalid", jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("when already a member then skips addMember but still marks accepted")
        void whenAlreadyMember_thenSkipsAddMember() {
            // Arrange
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(1L, org, "member@test.com");
            User user = buildUser(10L, UserRole.HOST);

            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(inv));
            when(userRepository.findByKeycloakId("kc-10")).thenReturn(Optional.of(user));
            when(memberRepository.existsByOrganizationIdAndUserId(ORG_ID, 10L)).thenReturn(true);
            when(invitationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
            lenient().when(redisTemplate.delete(anyString())).thenReturn(true);

            Jwt jwt = buildJwt("kc-10");

            // Act
            InvitationDto result = invitationService.acceptInvitation("token", jwt);

            // Assert
            assertThat(result.getStatus()).isEqualTo("ACCEPTED");
            verify(organizationService, never()).addMember(anyLong(), anyLong(), any());
        }
    }

    // ===== AUTO ACCEPT PENDING INVITATIONS =====

    @Nested
    @DisplayName("autoAcceptPendingInvitations")
    class AutoAcceptPendingInvitations {

        @Test
        @DisplayName("when pending invitations exist then accepts them and adds member")
        void whenPendingInvitationsExist_thenAcceptsThem() {
            // Arrange
            User user = buildUser(1L, UserRole.HOST);
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(100L, org, "auto@test.com");

            when(invitationRepository.findPendingByEmail("auto@test.com")).thenReturn(List.of(inv));
            when(memberRepository.existsByOrganizationIdAndUserId(ORG_ID, 1L)).thenReturn(false);

            // Act
            invitationService.autoAcceptPendingInvitations("auto@test.com", user);

            // Assert
            assertThat(inv.getStatus()).isEqualTo(InvitationStatus.ACCEPTED);
            assertThat(inv.getAcceptedByUser()).isEqualTo(user);
            verify(organizationService).addMember(ORG_ID, 1L, OrgMemberRole.MEMBER);
        }

        @Test
        @DisplayName("when null email then does nothing")
        void whenNullEmail_thenDoesNothing() {
            // Act
            invitationService.autoAcceptPendingInvitations(null, buildUser(1L, UserRole.HOST));

            // Assert
            verify(invitationRepository, never()).findPendingByEmail(any());
        }

        @Test
        @DisplayName("when null user then does nothing")
        void whenNullUser_thenDoesNothing() {
            // Act
            invitationService.autoAcceptPendingInvitations("test@test.com", null);

            // Assert
            verify(invitationRepository, never()).findPendingByEmail(any());
        }

        @Test
        @DisplayName("when already member then skips organization join but still marks accepted")
        void whenAlreadyMember_thenSkipsOrganizationJoin() {
            // Arrange
            User user = buildUser(1L, UserRole.HOST);
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(100L, org, "member@test.com");

            when(invitationRepository.findPendingByEmail("member@test.com")).thenReturn(List.of(inv));
            when(memberRepository.existsByOrganizationIdAndUserId(ORG_ID, 1L)).thenReturn(true);

            // Act
            invitationService.autoAcceptPendingInvitations("member@test.com", user);

            // Assert
            verify(organizationService, never()).addMember(anyLong(), anyLong(), any());
            assertThat(inv.getStatus()).isEqualTo(InvitationStatus.ACCEPTED);
        }

        @Test
        @DisplayName("when email has mixed case then lowercases before lookup")
        void whenMixedCaseEmail_thenLowercases() {
            // Arrange
            User user = buildUser(1L, UserRole.HOST);

            when(invitationRepository.findPendingByEmail("upper@test.com")).thenReturn(List.of());

            // Act
            invitationService.autoAcceptPendingInvitations("UPPER@test.com", user);

            // Assert
            verify(invitationRepository).findPendingByEmail("upper@test.com");
        }
    }

    // ===== LIST BY ORGANIZATION =====

    @Nested
    @DisplayName("listByOrganization")
    class ListByOrganization {

        @Test
        @DisplayName("when invitations exist then returns list of DTOs")
        void whenInvitationsExist_thenReturnsList() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");

            OrganizationInvitation inv1 = buildInvitation(10L, org, "a@test.com");
            inv1.setInvitedBy(admin);
            OrganizationInvitation inv2 = buildInvitation(11L, org, "b@test.com");
            inv2.setInvitedBy(admin);

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(invitationRepository.findByOrganizationIdOrderByCreatedAtDesc(ORG_ID))
                    .thenReturn(List.of(inv1, inv2));

            // Act
            List<InvitationDto> result = invitationService.listByOrganization(ORG_ID, jwt);

            // Assert
            assertThat(result).hasSize(2);
            assertThat(result.get(0).getInvitedEmail()).isEqualTo("a@test.com");
            assertThat(result.get(1).getInvitedEmail()).isEqualTo("b@test.com");
        }

        @Test
        @DisplayName("when no invitations then returns empty list")
        void whenNoInvitations_thenReturnsEmpty() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(invitationRepository.findByOrganizationIdOrderByCreatedAtDesc(ORG_ID))
                    .thenReturn(List.of());

            // Act
            List<InvitationDto> result = invitationService.listByOrganization(ORG_ID, jwt);

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when user has no permission then throws AccessDeniedException")
        void whenNoPermission_thenThrowsAccessDenied() {
            // Arrange
            Jwt jwt = buildJwt("kc-2");
            User regular = buildUser(2L, UserRole.HOST);
            when(userRepository.findByKeycloakId("kc-2")).thenReturn(Optional.of(regular));
            when(memberRepository.findByUserId(2L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> invitationService.listByOrganization(ORG_ID, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    // ===== CANCEL INVITATION =====

    @Nested
    @DisplayName("cancelInvitation")
    class CancelInvitation {

        @Test
        @DisplayName("when pending invitation then cancels successfully")
        void whenPendingInvitation_thenCancels() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(100L, org, "cancel@test.com");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(invitationRepository.findById(100L)).thenReturn(Optional.of(inv));

            // Act
            invitationService.cancelInvitation(ORG_ID, 100L, jwt);

            // Assert
            assertThat(inv.getStatus()).isEqualTo(InvitationStatus.CANCELLED);
            verify(invitationRepository).save(inv);
        }

        @Test
        @DisplayName("when invitation belongs to different org then throws AccessDeniedException")
        void whenInvitationBelongsToDifferentOrg_thenThrowsAccessDenied() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization otherOrg = buildOrg(99L, "Other Org");
            OrganizationInvitation inv = buildInvitation(100L, otherOrg, "cancel@test.com");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(invitationRepository.findById(100L)).thenReturn(Optional.of(inv));

            // Act & Assert
            assertThatThrownBy(() -> invitationService.cancelInvitation(ORG_ID, 100L, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("when already accepted then throws IllegalStateException")
        void whenAlreadyAccepted_thenThrowsIllegalState() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(100L, org, "cancel@test.com");
            inv.setStatus(InvitationStatus.ACCEPTED);

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(invitationRepository.findById(100L)).thenReturn(Optional.of(inv));

            // Act & Assert
            assertThatThrownBy(() -> invitationService.cancelInvitation(ORG_ID, 100L, jwt))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("when invitation not found then throws IllegalArgumentException")
        void whenInvitationNotFound_thenThrows() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(invitationRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> invitationService.cancelInvitation(ORG_ID, 999L, jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ===== RESEND INVITATION =====

    @Nested
    @DisplayName("resendInvitation")
    class ResendInvitation {

        @Test
        @DisplayName("when valid invitation then cancels old and creates new")
        void whenValidInvitation_thenCancelsOldAndCreatesNew() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation oldInv = buildInvitation(100L, org, "resend@test.com");
            oldInv.setRoleInvited(OrgMemberRole.ADMIN);

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(invitationRepository.findById(100L)).thenReturn(Optional.of(oldInv));
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
            when(invitationRepository.existsByOrganizationIdAndInvitedEmailAndStatus(
                    any(), any(), any())).thenReturn(false);
            when(invitationRepository.save(any())).thenAnswer(inv -> {
                OrganizationInvitation i = inv.getArgument(0);
                if (i.getId() == null) i.setId(200L);
                return i;
            });
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);

            // Act
            InvitationDto result = invitationService.resendInvitation(ORG_ID, 100L, jwt);

            // Assert
            assertThat(oldInv.getStatus()).isEqualTo(InvitationStatus.CANCELLED);
            assertThat(result).isNotNull();
            assertThat(result.getInvitedEmail()).isEqualTo("resend@test.com");
        }

        @Test
        @DisplayName("when invitation belongs to different org then throws AccessDeniedException")
        void whenWrongOrg_thenThrowsAccessDenied() {
            // Arrange
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization otherOrg = buildOrg(99L, "Other Org");
            OrganizationInvitation inv = buildInvitation(100L, otherOrg, "test@test.com");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(invitationRepository.findById(100L)).thenReturn(Optional.of(inv));

            // Act & Assert
            assertThatThrownBy(() -> invitationService.resendInvitation(ORG_ID, 100L, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }
}
