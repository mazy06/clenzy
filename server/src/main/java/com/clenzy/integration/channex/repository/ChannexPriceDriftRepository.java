package com.clenzy.integration.channex.repository;

import com.clenzy.integration.channex.model.ChannexPriceDrift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ChannexPriceDriftRepository extends JpaRepository<ChannexPriceDrift, Long> {

    /** Drift courant (resolved_at NULL) pour une (property, date) — clef d'unicite. */
    @Query("SELECT d FROM ChannexPriceDrift d WHERE d.clenzyPropertyId = :propertyId "
        + "AND d.driftDate = :date AND d.resolvedAt IS NULL")
    Optional<ChannexPriceDrift> findActiveByPropertyAndDate(@Param("propertyId") Long propertyId,
                                                             @Param("date") LocalDate date);

    /** Tous les drifts actifs d'une organisation (UI dashboard conflicts). */
    @Query("SELECT d FROM ChannexPriceDrift d WHERE d.organizationId = :orgId "
        + "AND d.resolvedAt IS NULL ORDER BY d.driftDate ASC")
    List<ChannexPriceDrift> findActiveByOrg(@Param("orgId") Long orgId);

    /** Drifts actifs pour une property specifique. */
    @Query("SELECT d FROM ChannexPriceDrift d WHERE d.organizationId = :orgId "
        + "AND d.clenzyPropertyId = :propertyId AND d.resolvedAt IS NULL "
        + "ORDER BY d.driftDate ASC")
    List<ChannexPriceDrift> findActiveByProperty(@Param("orgId") Long orgId,
                                                  @Param("propertyId") Long propertyId);
}
