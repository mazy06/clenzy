package com.clenzy.repository;

import com.clenzy.model.HousekeeperRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HousekeeperRateRepository extends JpaRepository<HousekeeperRate, Long> {

    /** Forfait du pro pour CE logement (prime sur le taux horaire). */
    Optional<HousekeeperRate> findByOrganizationIdAndUserIdAndPropertyId(Long organizationId, Long userId, Long propertyId);

    /** Taux horaire général du pro (ligne property NULL). */
    Optional<HousekeeperRate> findByOrganizationIdAndUserIdAndPropertyIdIsNull(Long organizationId, Long userId);

    /** Tous les tarifs du pro dans l'org (taux général + forfaits). */
    List<HousekeeperRate> findByOrganizationIdAndUserId(Long organizationId, Long userId);
}
