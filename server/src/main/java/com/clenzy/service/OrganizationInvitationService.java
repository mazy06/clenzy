package com.clenzy.service;

import com.clenzy.dto.InvitationDto;
import com.clenzy.model.*;
import com.clenzy.repository.OrganizationInvitationRepository;
import com.clenzy.repository.OrganizationMemberRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@Transactional
public class OrganizationInvitationService {

    private static final Logger log = LoggerFactory.getLogger(OrganizationInvitationService.class);
    private static final String REDIS_PREFIX = "invitation:";
    private static final long INVITATION_TTL_DAYS = 7;

    private final OrganizationInvitationRepository invitationRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final OrganizationService organizationService;
    private final EmailService emailService;
    private final RedisTemplate<String, Object> redisTemplate;
    private final TenantContext tenantContext;

    @Value("${FRONTEND_URL:http://localhost:3000}")
    private String frontendUrl;

    public OrganizationInvitationService(
            OrganizationInvitationRepository invitationRepository,
            OrganizationRepository organizationRepository,
            OrganizationMemberRepository memberRepository,
            UserRepository userRepository,
            OrganizationService organizationService,
            EmailService emailService,
            RedisTemplate<String, Object> redisTemplate,
            TenantContext tenantContext) {
        this.invitationRepository = invitationRepository;
        this.organizationRepository = organizationRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.organizationService = organizationService;
        this.emailService = emailService;
        this.redisTemplate = redisTemplate;
        this.tenantContext = tenantContext;
    }

    // ─── Envoyer une invitation ──────────────────────────────────────────────

    public InvitationDto sendInvitation(Long orgId, String email, String roleStr, Jwt jwt) {
        // 1. Valider les droits (ADMIN global ou MANAGER de l'org)
        User inviter = resolveUser(jwt);
        validateInvitePermission(inviter, orgId, jwt);

        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvee: " + orgId));

        // 2. Determiner le role
        OrgMemberRole role = OrgMemberRole.MEMBER;
        if (roleStr != null && !roleStr.isBlank()) {
            try {
                role = OrgMemberRole.valueOf(roleStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                log.warn("Role invalide '{}', utilisation de MEMBER par defaut", roleStr);
            }
        }
        // Interdire d'inviter en tant que OWNER
        if (role == OrgMemberRole.OWNER) {
            throw new IllegalArgumentException("Impossible d'inviter en tant que OWNER");
        }

        // 3. Verifier que l'email n'est pas deja membre
        String emailLower = email.toLowerCase().trim();
        if (isAlreadyMember(orgId, emailLower)) {
            throw new IllegalStateException("Cet utilisateur est deja membre de l'organisation");
        }

        // 4. Verifier qu'il n'y a pas deja une invitation pending
        if (invitationRepository.existsByOrganizationIdAndInvitedEmailAndStatus(
                orgId, emailLower, InvitationStatus.PENDING)) {
            throw new IllegalStateException("Une invitation est deja en attente pour cet email");
        }

        // 5. Generer le token
        String rawToken = UUID.randomUUID().toString();
        String tokenHash = sha256(rawToken);

        // 6. Sauvegarder en base
        OrganizationInvitation invitation = new OrganizationInvitation();
        invitation.setOrganization(org);
        invitation.setInvitedEmail(emailLower);
        invitation.setTokenHash(tokenHash);
        invitation.setRoleInvited(role);
        invitation.setStatus(InvitationStatus.PENDING);
        invitation.setInvitedBy(inviter);
        invitation.setExpiresAt(LocalDateTime.now().plusDays(INVITATION_TTL_DAYS));
        invitation = invitationRepository.save(invitation);

        // 7. Stocker dans Redis (TTL 7 jours)
        try {
            redisTemplate.opsForValue().set(
                    REDIS_PREFIX + rawToken,
                    Map.of(
                            "invitationId", invitation.getId(),
                            "organizationId", orgId,
                            "email", emailLower,
                            "role", role.name()
                    ),
                    INVITATION_TTL_DAYS, TimeUnit.DAYS
            );
        } catch (Exception e) {
            log.warn("Impossible de stocker l'invitation dans Redis, fallback DB only: {}", e.getMessage());
        }

        // 8. Envoyer l'email
        String invitationLink = frontendUrl + "/accept-invitation?token=" + rawToken;
        String inviterName = inviter.getFirstName() + " " + inviter.getLastName();
        try {
            emailService.sendInvitationEmail(emailLower, org.getName(), inviterName, role.name(), invitationLink, invitation.getExpiresAt());
            log.info("Invitation envoyee: email={}, org={}, role={}, by={}", emailLower, org.getName(), role, inviterName);
        } catch (Exception e) {
            log.error("Erreur envoi email d'invitation a {}: {}", emailLower, e.getMessage());
            // L'invitation est quand meme creee, le lien peut etre copie
        }

        // 9. Retourner le DTO avec le lien
        return toDto(invitation, org, inviterName, invitationLink);
    }

    // ─── Informations publiques d'une invitation (pas de JWT) ─────────────────

    @Transactional(readOnly = true)
    public InvitationDto getInvitationInfo(String rawToken) {
        String tokenHash = sha256(rawToken);
        OrganizationInvitation invitation = invitationRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Invitation non trouvee ou expiree"));

        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new IllegalStateException("Cette invitation a deja ete " +
                    (invitation.getStatus() == InvitationStatus.ACCEPTED ? "acceptee" : "annulee"));
        }
        if (invitation.isExpired()) {
            throw new IllegalStateException("Cette invitation a expire");
        }

        Organization org = invitation.getOrganization();
        InvitationDto dto = new InvitationDto();
        dto.setId(invitation.getId());
        dto.setOrganizationName(org.getName());
        dto.setInvitedEmail(invitation.getInvitedEmail());
        dto.setRoleInvited(invitation.getRoleInvited().name());
        dto.setStatus(invitation.getStatus().name());
        dto.setExpiresAt(invitation.getExpiresAt());
        return dto;
    }

    // ─── Accepter une invitation (JWT requis) ─────────────────────────────────

    public InvitationDto acceptInvitation(String rawToken, Jwt jwt) {
        String tokenHash = sha256(rawToken);

        // 1. Trouver l'invitation
        OrganizationInvitation invitation = invitationRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Invitation non trouvee"));

        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new IllegalStateException("Cette invitation n'est plus valide");
        }
        if (invitation.isExpired()) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitationRepository.save(invitation);
            throw new IllegalStateException("Cette invitation a expire");
        }

        // 2. Resoudre l'utilisateur depuis le JWT
        String keycloakId = jwt.getSubject();
        User user = userRepository.findByKeycloakId(keycloakId).orElse(null);

        if (user == null) {
            // Auto-provisioner si necessaire
            String email = jwt.getClaimAsString("email");
            String firstName = jwt.getClaimAsString("given_name");
            String lastName = jwt.getClaimAsString("family_name");
            user = new User();
            user.setKeycloakId(keycloakId);
            user.setEmail(email != null ? email : invitation.getInvitedEmail());
            user.setFirstName(firstName != null ? firstName : "");
            user.setLastName(lastName != null ? lastName : "");
            user.setRole(UserRole.HOST);
            user.setStatus(UserStatus.ACTIVE);
            user.setEmailVerified(true);
            user.setPassword(UUID.randomUUID().toString().replace("-", "") + "Aa1!");
            user.setOrganizationId(invitation.getOrganization().getId());
            user = userRepository.save(user);
            log.info("Auto-provisioning via invitation: userId={}, email={}", user.getId(), user.getEmail());
        }

        // 3. Rattacher a l'organisation
        Long orgId = invitation.getOrganization().getId();
        if (!memberRepository.existsByOrganizationIdAndUserId(orgId, user.getId())) {
            organizationService.addMember(orgId, user.getId(), invitation.getRoleInvited());
        } else {
            // Deja membre — mettre a jour l'org id si null
            if (user.getOrganizationId() == null) {
                user.setOrganizationId(orgId);
                userRepository.save(user);
            }
        }

        // 4. Marquer comme acceptee
        invitation.setStatus(InvitationStatus.ACCEPTED);
        invitation.setAcceptedByUser(user);
        invitation.setAcceptedAt(LocalDateTime.now());
        invitationRepository.save(invitation);

        // 5. Nettoyer Redis
        try {
            redisTemplate.delete(REDIS_PREFIX + rawToken);
        } catch (Exception e) {
            log.debug("Erreur suppression Redis invitation: {}", e.getMessage());
        }

        log.info("Invitation acceptee: invitationId={}, userId={}, orgId={}", invitation.getId(), user.getId(), orgId);

        InvitationDto dto = new InvitationDto();
        dto.setId(invitation.getId());
        dto.setOrganizationId(orgId);
        dto.setOrganizationName(invitation.getOrganization().getName());
        dto.setStatus(InvitationStatus.ACCEPTED.name());
        dto.setAcceptedAt(invitation.getAcceptedAt());
        return dto;
    }

    // ─── Auto-accepter les invitations pending pour un email (hook /me) ───────

    public void autoAcceptPendingInvitations(String email, User user) {
        if (email == null || user == null) return;
        String emailLower = email.toLowerCase().trim();

        List<OrganizationInvitation> pending = invitationRepository.findPendingByEmail(emailLower);
        for (OrganizationInvitation inv : pending) {
            try {
                Long orgId = inv.getOrganization().getId();
                if (!memberRepository.existsByOrganizationIdAndUserId(orgId, user.getId())) {
                    organizationService.addMember(orgId, user.getId(), inv.getRoleInvited());
                }
                inv.setStatus(InvitationStatus.ACCEPTED);
                inv.setAcceptedByUser(user);
                inv.setAcceptedAt(LocalDateTime.now());
                invitationRepository.save(inv);
                log.info("Invitation auto-acceptee: email={}, orgId={}, role={}", emailLower, orgId, inv.getRoleInvited());
            } catch (Exception e) {
                log.warn("Erreur auto-acceptation invitation id={}: {}", inv.getId(), e.getMessage());
            }
        }
    }

    // ─── Lister les invitations d'une organisation ────────────────────────────

    @Transactional(readOnly = true)
    public List<InvitationDto> listByOrganization(Long orgId, Jwt jwt) {
        User user = resolveUser(jwt);
        validateInvitePermission(user, orgId, jwt);

        List<OrganizationInvitation> invitations = invitationRepository
                .findByOrganizationIdOrderByCreatedAtDesc(orgId);

        return invitations.stream()
                .map(inv -> {
                    String inviterName = inv.getInvitedBy() != null
                            ? inv.getInvitedBy().getFirstName() + " " + inv.getInvitedBy().getLastName()
                            : "Inconnu";
                    return toDto(inv, inv.getOrganization(), inviterName, null);
                })
                .collect(Collectors.toList());
    }

    // ─── Annuler une invitation ───────────────────────────────────────────────

    public void cancelInvitation(Long orgId, Long invitationId, Jwt jwt) {
        User user = resolveUser(jwt);
        validateInvitePermission(user, orgId, jwt);

        OrganizationInvitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new IllegalArgumentException("Invitation non trouvee"));

        if (!invitation.getOrganization().getId().equals(orgId)) {
            throw new AccessDeniedException("Cette invitation n'appartient pas a cette organisation");
        }
        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new IllegalStateException("Seules les invitations en attente peuvent etre annulees");
        }

        invitation.setStatus(InvitationStatus.CANCELLED);
        invitationRepository.save(invitation);
        log.info("Invitation annulee: id={}, email={}", invitationId, invitation.getInvitedEmail());
    }

    // ─── Renvoyer une invitation ──────────────────────────────────────────────

    public InvitationDto resendInvitation(Long orgId, Long invitationId, Jwt jwt) {
        User user = resolveUser(jwt);
        validateInvitePermission(user, orgId, jwt);

        OrganizationInvitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new IllegalArgumentException("Invitation non trouvee"));

        if (!invitation.getOrganization().getId().equals(orgId)) {
            throw new AccessDeniedException("Cette invitation n'appartient pas a cette organisation");
        }

        // Annuler l'ancienne et creer une nouvelle
        invitation.setStatus(InvitationStatus.CANCELLED);
        invitationRepository.save(invitation);

        return sendInvitation(orgId, invitation.getInvitedEmail(), invitation.getRoleInvited().name(), jwt);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private User resolveUser(Jwt jwt) {
        String keycloakId = jwt.getSubject();
        return userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new AccessDeniedException("Utilisateur non trouve"));
    }

    private void validateInvitePermission(User user, Long orgId, Jwt jwt) {
        // ADMIN global peut tout faire
        if (hasRole(jwt, "ADMIN")) return;

        // MANAGER de l'org peut inviter
        if (hasRole(jwt, "MANAGER") && user.getOrganizationId() != null && user.getOrganizationId().equals(orgId)) {
            return;
        }

        throw new AccessDeniedException("Vous n'avez pas le droit d'inviter dans cette organisation");
    }

    private boolean hasRole(Jwt jwt, String role) {
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null) {
            @SuppressWarnings("unchecked")
            List<String> roles = (List<String>) realmAccess.get("roles");
            if (roles != null && roles.contains(role)) return true;
        }
        return false;
    }

    private boolean isAlreadyMember(Long orgId, String email) {
        // Chercher par email hash en base (email est chiffre, lookup via SHA-256 hash)
        String emailHash = computeEmailHash(email);
        Optional<User> userOpt = userRepository.findByEmailHash(emailHash);
        if (userOpt.isEmpty()) return false;
        return memberRepository.existsByOrganizationIdAndUserId(orgId, userOpt.get().getId());
    }

    private static String computeEmailHash(String email) {
        return sha256(email.toLowerCase().trim());
    }

    private InvitationDto toDto(OrganizationInvitation inv, Organization org, String inviterName, String link) {
        InvitationDto dto = new InvitationDto();
        dto.setId(inv.getId());
        dto.setOrganizationId(org.getId());
        dto.setOrganizationName(org.getName());
        dto.setInvitedEmail(inv.getInvitedEmail());
        dto.setRoleInvited(inv.getRoleInvited().name());
        dto.setStatus(inv.getStatus().name());
        dto.setInvitedByName(inviterName);
        dto.setExpiresAt(inv.getExpiresAt());
        dto.setCreatedAt(inv.getCreatedAt());
        dto.setAcceptedAt(inv.getAcceptedAt());
        dto.setInvitationLink(link);
        return dto;
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 non disponible", e);
        }
    }
}
