package com.clenzy.service.catalog;

import com.clenzy.exception.AssignmentConflictException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Une compétence d'exécution est une prestation déclarée, jamais un rôle de connexion. */
@Service
public class ServiceCapabilityPolicy {
    private final JdbcTemplate db;
    private final com.clenzy.marketplace.repository.MarketplaceProviderRepository providers;
    private final com.clenzy.marketplace.service.MarketplaceExposureService exposure;
    public ServiceCapabilityPolicy(JdbcTemplate db, com.clenzy.marketplace.repository.MarketplaceProviderRepository providers,
                                   com.clenzy.marketplace.service.MarketplaceExposureService exposure) {
        this.db=db; this.providers=providers; this.exposure=exposure;
    }

    public void requireResourceContext(Long organizationId, com.clenzy.model.Property property) {
        if (organizationId == null || (property != null && !organizationId.equals(property.getOrganizationId())))
            throw new org.springframework.security.access.AccessDeniedException("Ressource hors organisation");
    }

    /** L'organisation interne ou une offre externe visible détermine le droit de solliciter la ressource. */
    public boolean contextAllowed(String kind, Long id, String code, Long organizationId) {
        if (organizationId == null || id == null || !("team".equals(kind) || "user".equals(kind))) return false;
        String table = "team".equals(kind) ? "teams" : "users";
        boolean internal=Boolean.TRUE.equals(db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM "+table+" target JOIN organizations o ON o.id=target.organization_id WHERE target.id=? AND (o.id=? OR o.type='SYSTEM'))",
            Boolean.class,id,organizationId));
        if (internal) return true;
        if ("team".equals(kind) && Boolean.TRUE.equals(db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM teams t JOIN organization_members m ON m.user_id=t.personal_user_id WHERE t.id=? AND m.organization_id=?)",
            Boolean.class,id,organizationId))) return true;
        if ("user".equals(kind) && Boolean.TRUE.equals(db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM organization_members WHERE organization_id=? AND user_id=?)",Boolean.class,organizationId,id))) return true;
        var providerIds = "team".equals(kind)
            ? db.queryForList("SELECT DISTINCT p.id FROM marketplace_providers p JOIN team_members m ON m.user_id=p.user_id WHERE m.team_id=?",Long.class,id)
            : db.queryForList("SELECT id FROM marketplace_providers WHERE user_id=?",Long.class,id);
        for (Long providerId : providerIds) {
            var provider=providers.findById(providerId).orElse(null);
            if (provider == null || provider.getStatus()!=com.clenzy.marketplace.model.ProviderStatus.ACTIVE
                    || !exposure.isVisibleTo(provider,organizationId)) continue;
            try {
                com.clenzy.marketplace.service.MarketplaceOfferEligibility.requireOfferedService(provider,null,code);
                return true;
            } catch (IllegalArgumentException unavailableOffer) {
                // Une autre fiche membre peut porter l'offre de cette équipe.
            }
        }
        return false;
    }

    public void requireContext(String kind, Long id, String code, Long organizationId) {
        if (!contextAllowed(kind,id,code,organizationId))
            throw new AssignmentConflictException("Ce prestataire n'est pas disponible pour cette organisation et cette prestation");
    }

    /** Ne renvoie aucun identifiant d'équipe dont l'offre est inaccessible au client. */
    public java.util.List<Long> candidateTeamIds(String code, Long organizationId) {
        if (code == null || organizationId == null) return java.util.List.of();
        return db.queryForList("""
            SELECT c.team_id FROM team_service_capabilities c JOIN teams t ON t.id=c.team_id
            JOIN marketplace_service_items i ON i.code=c.service_item_code
            JOIN marketplace_service_categories cat ON cat.id=i.category_id
            WHERE c.service_item_code=? AND i.active AND cat.active
              AND (t.personal_user_id IS NULL OR EXISTS(SELECT 1 FROM personal_capability_owners owner WHERE owner.team_id=t.id))
            ORDER BY c.team_id
            """, Long.class, code).stream()
            .filter(id -> contextAllowed("team", id, code, organizationId)).toList();
    }

    public boolean supports(String kind, Long id, String code) {
        if (code == null || id == null) return false;
        if ("team".equals(kind)) {
            return Boolean.TRUE.equals(db.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM teams target JOIN team_service_capabilities c
                  ON c.team_id=CASE WHEN target.personal_user_id IS NULL THEN target.id ELSE
                    (SELECT owner.team_id FROM personal_capability_owners owner WHERE owner.user_id=target.personal_user_id) END
                  JOIN marketplace_service_items i ON i.code=c.service_item_code
                  JOIN marketplace_service_categories cat ON cat.id=i.category_id
                  WHERE target.id=? AND c.service_item_code=? AND i.active AND cat.active)
                """, Boolean.class, id, code));
        }
        if ("user".equals(kind)) {
            // Une personne n'hérite pas de toutes les compétences d'une équipe collective.
            return Boolean.TRUE.equals(db.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM teams t JOIN team_service_capabilities c ON c.team_id=t.id
                  JOIN marketplace_service_items i ON i.code=c.service_item_code
                  JOIN marketplace_service_categories cat ON cat.id=i.category_id
                  WHERE t.personal_user_id=? AND t.id=(SELECT owner.team_id FROM personal_capability_owners owner WHERE owner.user_id=t.personal_user_id)
                  AND c.service_item_code=? AND i.active AND cat.active)
                """, Boolean.class, id, code));
        }
        return false;
    }

    public void require(String kind, Long id, String code) {
        if (code == null) throw new AssignmentConflictException("La prestation doit être qualifiée avant attribution");
        if (!supports(kind, id, code))
            throw new AssignmentConflictException("Le prestataire ne possède pas la capacité déclarée pour cette prestation");
    }
}
