package com.clenzy.repository;

import com.clenzy.model.MarketingIntegration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Acces a la configuration d'integration marketing (niveau plateforme).
 * Une seule ligne par provider (contrainte unique).
 */
public interface MarketingIntegrationRepository extends JpaRepository<MarketingIntegration, Long> {

    Optional<MarketingIntegration> findByProvider(MarketingIntegration.Provider provider);
}
