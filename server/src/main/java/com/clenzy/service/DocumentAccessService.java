package com.clenzy.service;

import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.UserRole;
import com.clenzy.dto.DocumentGenerationDto;
import com.clenzy.model.ReferenceType;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Politique d'acces aux documents generes : isolation d'organisation et
 * ownership intervention. Extraite de DocumentController (audit T-ARCH-01,
 * regle 4 « Lecons de l'audit 2026-06 » : controller mince, l'acces donnees
 * passe par la couche service).
 */
@Service
public class DocumentAccessService {

    private final InterventionRepository interventionRepository;
    private final OrganizationAccessGuard organizationAccessGuard;

    public DocumentAccessService(InterventionRepository interventionRepository,
                                 OrganizationAccessGuard organizationAccessGuard) {
        this.interventionRepository = interventionRepository;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    /**
     * Refuse l'acces si la generation appartient a une autre organisation.
     * getGeneration() repose sur findById, qui ne passe PAS par le filtre
     * Hibernate organizationFilter → l'isolation org doit etre verifiee
     * explicitement. Delegue a {@link OrganizationAccessGuard} (fail-closed,
     * bypass platform staff + org SYSTEM, memes exemptions que le filtre Hibernate).
     */
    public void requireSameOrganization(DocumentGeneration generation) {
        organizationAccessGuard.requireSameOrganization(
                generation.getOrganizationId(), "Document hors de votre organisation");
    }

    /** A missing/unknown role must never inherit the legacy HOST fallback. */
    public UserRole requireReader(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new AccessDeniedException("Identite documentaire requise");
        }
        Object realm = jwt.getClaim("realm_access");
        Object roles = realm instanceof Map<?, ?> claims ? claims.get("roles") : null;
        if ((realm != null && !(realm instanceof Map<?, ?>))
                || (roles != null && !(roles instanceof List<?>))
                || (jwt.getClaim("role") != null && !(jwt.getClaim("role") instanceof String))) {
            throw new AccessDeniedException("Role documentaire invalide");
        }
        UserRole role = JwtRoleExtractor.extractUserRole(jwt);
        if (role == UserRole.HOST) {
            boolean explicitHost = roles instanceof List<?> values && values.stream()
                    .anyMatch(value -> value instanceof String name && "HOST".equalsIgnoreCase(name));
            if (!explicitHost && !"HOST".equalsIgnoreCase(jwt.getClaimAsString("role"))) {
                throw new AccessDeniedException("Role documentaire requis");
            }
        }
        return role;
    }

    /** Check every direct read before mapping metadata or loading the binary. */
    @Transactional(readOnly = true)
    public void requireReadAccess(Jwt jwt, DocumentGeneration generation) {
        requireSameOrganization(generation);
        UserRole role = requireReader(jwt);
        if (generation.getReferenceType() == ReferenceType.INTERVENTION) {
            if (generation.getReferenceId() == null && !managesDocuments(role)) {
                throw new AccessDeniedException("Intervention documentaire requise");
            }
            if (generation.getReferenceId() != null) {
                validateInterventionOwnership(jwt, generation.getReferenceId());
            }
        }
        if (!managesDocuments(role) && !matchesRecipient(jwt, generation.getEmailTo())) {
            throw new AccessDeniedException("Document non adresse a cet utilisateur");
        }
    }

    /** Preserve the existing reference-list scope, with no fail-open email case. */
    public List<DocumentGenerationDto> filterReferenceResults(Jwt jwt, List<DocumentGenerationDto> documents) {
        UserRole role = requireReader(jwt);
        if (role.isPlatformStaff() || role == UserRole.SUPERVISOR) return documents;
        return documents.stream().filter(document -> matchesRecipient(jwt, document.emailTo())).toList();
    }

    private boolean managesDocuments(UserRole role) {
        return role.isPlatformStaff() || role == UserRole.SUPERVISOR || role == UserRole.HOST;
    }

    private boolean matchesRecipient(Jwt jwt, String recipient) {
        String email = jwt.getClaimAsString("email");
        return email != null && !email.isBlank() && recipient != null && !recipient.isBlank()
                && email.strip().equalsIgnoreCase(recipient.strip());
    }

    /**
     * Verifie que l'utilisateur a le droit d'acceder aux documents d'une intervention.
     * Staff plateforme et superviseurs voient tout (dans leur org via le filtre Hibernate).
     * Les roles operationnels (HOUSEKEEPER, TECHNICIAN, etc.) ne voient que les documents
     * des interventions qui leur sont assignees.
     *
     * <p>Utilise une projection JPQL scalaire pour eviter toute
     * LazyInitializationException (pas de session Hibernate ouverte cote controller).</p>
     */
    @Transactional(readOnly = true)
    public void validateInterventionOwnership(Jwt jwt, Long interventionId) {
        final UserRole role = requireReader(jwt);

        // Staff plateforme + superviseurs : acces a toute l'org
        if (role.isPlatformStaff() || role == UserRole.SUPERVISOR || role == UserRole.HOST) return;

        // Roles operationnels : verifier l'assignation
        final String keycloakId = jwt.getSubject();
        final String assignedKeycloakId = interventionRepository.findAssignedUserKeycloakIdById(interventionId);

        if (assignedKeycloakId == null || !keycloakId.equals(assignedKeycloakId)) {
            throw new AccessDeniedException("Acces refuse : vous n'etes pas assigne a cette intervention");
        }
    }
}
