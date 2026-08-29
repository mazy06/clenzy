package com.clenzy.service;

import com.clenzy.exception.UnauthorizedException;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

@Service
public class InterventionAccessPolicy {

    private static final Logger log = LoggerFactory.getLogger(InterventionAccessPolicy.class);

    private final TenantContext tenantContext;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;

    public InterventionAccessPolicy(TenantContext tenantContext,
                                    UserRepository userRepository,
                                    TeamRepository teamRepository) {
        this.tenantContext = tenantContext;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
    }

    /**
     * Validates that the authenticated user has access to the given intervention.
     * Checks: tenant isolation, role-based access, ownership (HOST), assignment (TECHNICIAN/HOUSEKEEPER).
     */
    public void assertCanAccess(Intervention intervention, Jwt jwt) {
        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);

        // Tenant isolation: verify the intervention belongs to the caller's organization
        // Les utilisateurs d'une organisation SYSTEM ont accès cross-org (ils fournissent des services à toutes les orgs)
        if (!tenantContext.isSystemOrg()) {
            Long callerOrgId = tenantContext.getRequiredOrganizationId();
            if (intervention.getOrganizationId() != null
                    && !intervention.getOrganizationId().equals(callerOrgId)) {
                log.warn("Cross-tenant access attempt: intervention orgId={} vs caller orgId={}",
                        intervention.getOrganizationId(), callerOrgId);
                throw new UnauthorizedException("Acces refuse : intervention hors de votre organisation");
            }
        }

        // Pour les admins et managers, acces complet au sein de leur organisation
        if (userRole.isPlatformStaff()) {
            return;
        }

        // Pour les autres roles, identifier l'utilisateur depuis le JWT
        String keycloakId = jwt.getSubject();
        String email = jwt.getClaimAsString("email");

        User currentUser = null;
        if (keycloakId != null) {
            currentUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
        }
        if (currentUser == null && email != null) {
            currentUser = userRepository.findByEmailHash(StringUtils.computeEmailHash(email)).orElse(null);
        }

        if (currentUser == null) {
            throw new UnauthorizedException("Impossible d'identifier l'utilisateur depuis le JWT");
        }

        Long userId = currentUser.getId();

        if (userRole == UserRole.HOST) {
            Property prop = intervention.getProperty();
            if (prop != null && prop.getOwner() != null && prop.getOwner().getId().equals(userId)) {
                return;
            }
        } else {
            if (intervention.getAssignedUser() != null
                    && intervention.getAssignedUser().getId().equals(userId)) {
                return;
            }
            if (intervention.getTeamId() != null) {
                Team team = teamRepository.findById(intervention.getTeamId())
                        .orElse(null);
                if (team != null) {
                    boolean isTeamMember = team.getMembers().stream()
                            .anyMatch(member -> member.getUser().getId().equals(userId));
                    if (isTeamMember) {
                        return;
                    }
                }
            }
        }

        throw new UnauthorizedException("Acces non autorise a cette intervention");
    }

    /**
     * Verifie que l'appelant est bien l'intervenant DESIGNE, et renvoie son
     * utilisateur.
     *
     * <p>{@link #assertCanAccess} est plus large : un gestionnaire y passe, un
     * proprietaire aussi. Accepter ou refuser une mission est en revanche un
     * geste strictement personnel — personne ne repond a la place de celui qui
     * se deplacera.</p>
     */
    public User requireAssignee(Intervention intervention, Jwt jwt) {
        User currentUser = resolveUser(jwt);

        if (intervention.getAssignedUser() != null
                && intervention.getAssignedUser().getId().equals(currentUser.getId())) {
            return currentUser;
        }
        if (intervention.getTeamId() != null) {
            Team team = teamRepository.findById(intervention.getTeamId()).orElse(null);
            if (team != null && team.getMembers().stream()
                    .anyMatch(member -> member.getUser().getId().equals(currentUser.getId()))) {
                return currentUser;
            }
        }
        throw new UnauthorizedException("Cette mission ne vous est pas assignee");
    }

    /** Utilisateur du JWT — par keycloakId, a defaut par empreinte d'email. */
    private User resolveUser(Jwt jwt) {
        String keycloakId = jwt != null ? jwt.getSubject() : null;
        String email = jwt != null ? jwt.getClaimAsString("email") : null;

        User currentUser = null;
        if (keycloakId != null) {
            currentUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
        }
        if (currentUser == null && email != null) {
            currentUser = userRepository.findByEmailHash(StringUtils.computeEmailHash(email)).orElse(null);
        }
        if (currentUser == null) {
            throw new UnauthorizedException("Impossible d'identifier l'utilisateur depuis le JWT");
        }
        return currentUser;
    }
}
