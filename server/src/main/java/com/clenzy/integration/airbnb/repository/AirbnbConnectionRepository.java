package com.clenzy.integration.airbnb.repository;

import com.clenzy.integration.airbnb.model.AirbnbConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;

/**
 * Repository for managing {@link AirbnbConnection} entities.
 */
@Repository
public interface AirbnbConnectionRepository extends JpaRepository<AirbnbConnection, Long> {

    Optional<AirbnbConnection> findByUserId(String userId);

    Optional<AirbnbConnection> findByAirbnbUserId(String airbnbUserId);

    List<AirbnbConnection> findByStatus(AirbnbConnection.AirbnbConnectionStatus status);

    boolean existsByUserId(String userId);

    /**
     * Connexions muettes : révoquées, en erreur, ou dont le jeton a expiré.
     *
     * <p>L'organisation est filtrée explicitement — elle est nullable sur cette
     * table, et une connexion sans organisation ne doit apparaître dans la file
     * d'aucun tenant.</p>
     */
    @Query("""
            SELECT c FROM AirbnbConnection c
            WHERE c.organizationId = :orgId
              AND (c.status <> com.clenzy.integration.airbnb.model.AirbnbConnection$AirbnbConnectionStatus.ACTIVE
                   OR (c.tokenExpiresAt IS NOT NULL AND c.tokenExpiresAt < :now))
            """)
    List<AirbnbConnection> findBrokenForOrg(@Param("orgId") Long orgId,
                                            @Param("now") LocalDateTime now);
}
