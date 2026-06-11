package com.clenzy.repository;

import com.clenzy.model.PricingConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PricingConfigRepository extends JpaRepository<PricingConfig, Long> {

    /**
     * Derniere config toutes organisations confondues — reserve aux contextes
     * SANS tenant (landing publique / devis prospects). Dans un contexte
     * org-scope, utiliser {@link #findTopByOrganizationIdOrderByIdDesc(Long)}.
     */
    Optional<PricingConfig> findTopByOrderByIdDesc();

    /** Derniere config de l'organisation donnee (scoping explicite, audit Z5-BUGS-06). */
    Optional<PricingConfig> findTopByOrganizationIdOrderByIdDesc(Long organizationId);
}
