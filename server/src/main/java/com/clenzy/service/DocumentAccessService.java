package com.clenzy.service;

import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.UserRole;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        final UserRole role = JwtRoleExtractor.extractUserRole(jwt);

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
