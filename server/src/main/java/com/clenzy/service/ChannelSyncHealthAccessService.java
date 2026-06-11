package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Validation d'acces aux proprietes pour l'agregation de sante de sync
 * multi-canaux. Logique deplacee depuis {@code ChannelSyncHealthController}
 * (refactor T-ARCH-01 — controller mince).
 *
 * <h2>Securite</h2>
 * <p>{@code findById} contourne le filtre Hibernate multi-tenant : l'appartenance
 * de chaque propriete a l'organisation du requester est validee explicitement
 * (regle 3 des lecons d'audit 2026-06), avec bypass platform staff
 * (SUPER_ADMIN / SUPER_MANAGER) et acces proprietaire.</p>
 */
@Service
public class ChannelSyncHealthAccessService {

    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public ChannelSyncHealthAccessService(PropertyRepository propertyRepository,
                                          UserRepository userRepository,
                                          TenantContext tenantContext) {
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Valide l'acces du requester a chacune des proprietes (anti-fuite cross-org).
     *
     * @throws NotFoundException     propriete inexistante
     * @throws AccessDeniedException propriete hors org, ou requester ni platform
     *                               staff ni proprietaire
     */
    @Transactional(readOnly = true)
    public void requireAccessToProperties(List<Long> propertyIds, String keycloakId) {
        for (Long pid : propertyIds) {
            validatePropertyAccess(pid, keycloakId);
        }
    }

    private void validatePropertyAccess(Long propertyId, String keycloakId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + propertyId));

        if (property.getOrganizationId() != null && !property.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException("Acces refuse : propriete hors de votre organisation");
        }
        if (tenantContext.isSuperAdmin()) return;

        User user = userRepository.findByKeycloakId(keycloakId).orElse(null);
        if (user != null && user.getRole() != null && user.getRole().isPlatformStaff()) return;

        if (user != null && property.getOwner() != null
                && property.getOwner().getId().equals(user.getId())) return;

        throw new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete");
    }
}
