package com.clenzy.repository;

import com.clenzy.model.UpsellOffer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UpsellOfferRepository extends JpaRepository<UpsellOffer, Long> {

    List<UpsellOffer> findByOrganizationIdOrderBySortOrderAscIdAsc(Long organizationId);

    Optional<UpsellOffer> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Offres actives de l'org (le filtrage par propriété — spécifique OU org-wide
     * property_id NULL — est fait côté service car {@code IN} ne matche pas NULL).
     */
    List<UpsellOffer> findByOrganizationIdAndActiveTrueOrderBySortOrderAscIdAsc(Long organizationId);
}
