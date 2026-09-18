package com.clenzy.marketplace.repository;

import com.clenzy.marketplace.model.MarketplaceExposureRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Regles d'exposition. Lectures PLATEFORME : aucune n'est bornee par le tenant
 * courant, puisqu'une regle nomme une organisation sans lui appartenir.
 */
@Repository
public interface MarketplaceExposureRuleRepository extends JpaRepository<MarketplaceExposureRule, Long> {

    List<MarketplaceExposureRule> findByProviderIdOrderByOrganizationIdAscIdAsc(Long providerId);

    Optional<MarketplaceExposureRule> findByProviderIdAndOrganizationId(Long providerId, Long organizationId);

    Optional<MarketplaceExposureRule> findByProviderIdAndOrganizationIdIsNull(Long providerId);

    /**
     * Fiches INVISIBLES pour une organisation donnee.
     *
     * <p>Rendue en une requete parce que la recherche du catalogue en a besoin
     * comme d'un ensemble a exclure : la resoudre fiche par fiche ferait une
     * requete par ligne de resultat.</p>
     *
     * <p>Un {@code ALLOW} nominatif retire la fiche de cet ensemble, meme
     * lorsqu'un {@code DENY} global existe — c'est l'exception a l'exception.</p>
     */
    @Query("""
        SELECT r.providerId FROM MarketplaceExposureRule r
         WHERE r.effect = com.clenzy.marketplace.model.ExposureEffect.DENY
           AND (r.organizationId IS NULL OR r.organizationId = :orgId)
           AND NOT EXISTS (
               SELECT 1 FROM MarketplaceExposureRule a
                WHERE a.providerId = r.providerId
                  AND a.organizationId = :orgId
                  AND a.effect = com.clenzy.marketplace.model.ExposureEffect.ALLOW)
        """)
    List<Long> findHiddenProviderIdsFor(@Param("orgId") Long orgId);
}
