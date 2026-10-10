package com.clenzy.marketplace.service;

import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ManagerPropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.PortfolioRepository;
import com.clenzy.repository.PortfolioClientRepository;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Résout le logement depuis la base, avec le même périmètre que les décisions commerciales. */
@Service
public class MarketplacePropertyContext {
    private final PropertyRepository properties;
    private final ManagerPropertyRepository managers;
    private final UserRepository users;
    private final PortfolioRepository portfolios;
    private final PortfolioClientRepository clients;
    public MarketplacePropertyContext(PropertyRepository properties, ManagerPropertyRepository managers,
            UserRepository users, PortfolioRepository portfolios, PortfolioClientRepository clients) {
        this.properties=properties; this.managers=managers; this.users=users;
        this.portfolios=portfolios; this.clients=clients;
    }

    @Transactional(readOnly = true)
    public Property require(Long id, Long organizationId, Jwt jwt) {
        if (id == null) return null;
        if (organizationId == null || jwt == null || jwt.getSubject() == null)
            throw new AccessDeniedException("Compte non résolu");
        var property = properties.findByIdWithOwner(id, organizationId)
            .orElseThrow(() -> new AccessDeniedException("Logement introuvable"));
        var role = JwtRoleExtractor.extractUserRole(jwt);
        if (role != null && role.isPlatformStaff()) return property;
        if (property.getOwner()!=null && jwt.getSubject().equals(property.getOwner().getKeycloakId())) return property;
        // Un mandat de conciergerie autorise la gestion, sans ouvrir tout le parc de l'organisation.
        if (role==com.clenzy.model.UserRole.HOST) {
            var manager=users.findByKeycloakId(jwt.getSubject()).orElse(null);
            if (manager!=null) {
                if (managers.existsByManagerIdAndPropertyId(manager.getId(),id,organizationId)) return property;
                if (property.getOwner()!=null && portfolios.findByManagerIdAndIsActiveTrue(manager.getId(),organizationId)
                        .stream().anyMatch(p -> clients.existsByPortfolioIdAndClientIdAndIsActiveTrue(
                                p.getId(),property.getOwner().getId(),organizationId))) return property;
            }
        }
        throw new AccessDeniedException("Vous ne gérez pas ce logement");
    }
}
