package com.clenzy.marketplace.service;

import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Résout le logement depuis la base, avec le même périmètre que les décisions commerciales. */
@Service
public class MarketplacePropertyContext {
    private final PropertyRepository properties;
    public MarketplacePropertyContext(PropertyRepository properties) { this.properties = properties; }

    @Transactional(readOnly = true)
    public Property require(Long id, Long organizationId, Jwt jwt) {
        if (id == null) return null;
        if (organizationId == null || jwt == null || jwt.getSubject() == null)
            throw new AccessDeniedException("Compte non résolu");
        var property = properties.findByIdWithOwner(id, organizationId)
            .orElseThrow(() -> new AccessDeniedException("Logement introuvable"));
        var role = JwtRoleExtractor.extractUserRole(jwt);
        if (role != null && role.isPlatformStaff()) return property;
        if (property.getOwner() == null || !jwt.getSubject().equals(property.getOwner().getKeycloakId()))
            throw new AccessDeniedException("Ce logement ne vous appartient pas");
        return property;
    }
}
