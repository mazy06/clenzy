package com.clenzy.service;

import com.clenzy.dto.InvitationDto;
import com.clenzy.model.*;
import com.clenzy.repository.OrganizationInvitationRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
    class SendInvitation {

        @Test
        void whenSuperAdmin_thenSendsInvitation() {
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

            InvitationDto result = invitationService.sendInvitation(
                    ORG_ID, "invite@test.com", "MEMBER", jwt);

            assertThat(result).isNotNull();
            assertThat(result.getOrganizationName()).isEqualTo("Test Org");
            assertThat(result.getInvitedEmail()).isEqualTo("invite@test.com");
            assertThat(result.getRoleInvited()).isEqualTo("MEMBER");

            verify(invitationRepository).save(any(OrganizationInvitation.class));
        }

        @Test
        void whenOwnerRoleRequested_thenThrowsIllegalArgument() {
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));

            assertThatThrownBy(() -> invitationService.sendInvitation(
                    ORG_ID, "invite@test.com", "OWNER", jwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("OWNER");
        }

        @Test
        void whenPendingInvitationExists_thenThrowsIllegalState() {
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
            when(invitationRepository.existsByOrganizationIdAndInvitedEmailAndStatus(
                    ORG_ID, "dup@test.com", InvitationStatus.PENDING)).thenReturn(true);

            assertThatThrownBy(() -> invitationService.sendInvitation(
                    ORG_ID, "dup@test.com", "MEMBER", jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("deja en attente");
        }

        @Test
        void whenEmailSendFails_thenInvitationIsStillCreated() {
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

            InvitationDto result = invitationService.sendInvitation(
                    ORG_ID, "no-email@test.com", "MEMBER", jwt);

            assertThat(result).isNotNull();
            verify(invitationRepository).save(any());
        }

        @Test
        void whenUserNotFound_thenThrowsAccessDenied() {
            Jwt jwt = buildJwt("kc-unknown");
            when(userRepository.findByKeycloakId("kc-unknown")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> invitationService.sendInvitation(
                    ORG_ID, "invite@test.com", "MEMBER", jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    // ===== GET INVITATION INFO =====

    @Nested
    class GetInvitationInfo {

        @Test
        void whenValidToken_thenReturnsInfo() {
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(1L, org, "test@test.com");

            // We need to mock by hash — use any() since we can't compute the hash easily
            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(inv));

            InvitationDto result = invitationService.getInvitationInfo("raw-token-123");

            assertThat(result.getOrganizationName()).isEqualTo("Test Org");
            assertThat(result.getInvitedEmail()).isEqualTo("test@test.com");
            assertThat(result.getStatus()).isEqualTo("PENDING");
        }

        @Test
        void whenTokenNotFound_thenThrowsIllegalArgument() {
            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> invitationService.getInvitationInfo("invalid-token"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenAlreadyAccepted_thenThrowsIllegalState() {
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(1L, org, "test@test.com");
            inv.setStatus(InvitationStatus.ACCEPTED);

            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(inv));

            assertThatThrownBy(() -> invitationService.getInvitationInfo("token"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("acceptee");
        }

        @Test
        void whenExpired_thenThrowsIllegalState() {
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(1L, org, "test@test.com");
            inv.setExpiresAt(LocalDateTime.now().minusDays(1));

            when(invitationRepository.findByTokenHash(any())).thenReturn(Optional.of(inv));

            assertThatThrownBy(() -> invitationService.getInvitationInfo("token"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("expire");
        }
    }

    // ===== CANCEL INVITATION =====

    @Nested
    class CancelInvitation {

        @Test
        void whenPendingInvitation_thenCancels() {
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(100L, org, "cancel@test.com");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(invitationRepository.findById(100L)).thenReturn(Optional.of(inv));

            invitationService.cancelInvitation(ORG_ID, 100L, jwt);

            assertThat(inv.getStatus()).isEqualTo(InvitationStatus.CANCELLED);
            verify(invitationRepository).save(inv);
        }

        @Test
        void whenInvitationBelongsToDifferentOrg_thenThrowsAccessDenied() {
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization otherOrg = buildOrg(99L, "Other Org");
            OrganizationInvitation inv = buildInvitation(100L, otherOrg, "cancel@test.com");

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(invitationRepository.findById(100L)).thenReturn(Optional.of(inv));

            assertThatThrownBy(() -> invitationService.cancelInvitation(ORG_ID, 100L, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void whenAlreadyAccepted_thenThrowsIllegalState() {
            Jwt jwt = buildJwt("kc-1", "SUPER_ADMIN");
            User admin = buildUser(1L, UserRole.SUPER_ADMIN);
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(100L, org, "cancel@test.com");
            inv.setStatus(InvitationStatus.ACCEPTED);

            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(admin));
            when(invitationRepository.findById(100L)).thenReturn(Optional.of(inv));

            assertThatThrownBy(() -> invitationService.cancelInvitation(ORG_ID, 100L, jwt))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    // ===== AUTO ACCEPT PENDING INVITATIONS =====

    @Nested
    class AutoAcceptPendingInvitations {

        @Test
        void whenPendingInvitationsExist_thenAcceptsThem() {
            User user = buildUser(1L, UserRole.HOST);
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(100L, org, "auto@test.com");

            when(invitationRepository.findPendingByEmail("auto@test.com")).thenReturn(List.of(inv));
            when(memberRepository.existsByOrganizationIdAndUserId(ORG_ID, 1L)).thenReturn(false);

            invitationService.autoAcceptPendingInvitations("auto@test.com", user);

            assertThat(inv.getStatus()).isEqualTo(InvitationStatus.ACCEPTED);
            assertThat(inv.getAcceptedByUser()).isEqualTo(user);
            verify(organizationService).addMember(ORG_ID, 1L, OrgMemberRole.MEMBER);
        }

        @Test
        void whenNullEmail_thenDoesNothing() {
            invitationService.autoAcceptPendingInvitations(null, buildUser(1L, UserRole.HOST));
            verify(invitationRepository, never()).findPendingByEmail(any());
        }

        @Test
        void whenNullUser_thenDoesNothing() {
            invitationService.autoAcceptPendingInvitations("test@test.com", null);
            verify(invitationRepository, never()).findPendingByEmail(any());
        }

        @Test
        void whenAlreadyMember_thenSkipsOrganizationJoin() {
            User user = buildUser(1L, UserRole.HOST);
            Organization org = buildOrg(ORG_ID, "Test Org");
            OrganizationInvitation inv = buildInvitation(100L, org, "member@test.com");

            when(invitationRepository.findPendingByEmail("member@test.com")).thenReturn(List.of(inv));
            when(memberRepository.existsByOrganizationIdAndUserId(ORG_ID, 1L)).thenReturn(true);

            invitationService.autoAcceptPendingInvitations("member@test.com", user);

            verify(organizationService, never()).addMember(anyLong(), anyLong(), any());
            assertThat(inv.getStatus()).isEqualTo(InvitationStatus.ACCEPTED);
        }
    }
}
