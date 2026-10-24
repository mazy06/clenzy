package com.clenzy.integration.homeaway.repository;

import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

/**
 * Repository pour la gestion des entites {@link HomeAwayConnection}.
 */
@Repository
public interface HomeAwayConnectionRepository extends JpaRepository<HomeAwayConnection, Long> {

    Optional<HomeAwayConnection> findByOrganizationId(Long organizationId);

    Optional<HomeAwayConnection> findByListingId(String listingId);

    @Query("SELECT hc FROM HomeAwayConnection hc WHERE hc.status = 'ACTIVE'")
    List<HomeAwayConnection> findAllActive();

    List<HomeAwayConnection> findByStatus(HomeAwayConnection.HomeAwayConnectionStatus status);

    // Écritures partielles : ne jamais fusionner le snapshot du scheduler après un refresh OAuth.
    // Une déconnexion, un changement de listing ou un succès plus récent invalident ce résultat.
    @Modifying
    @Transactional
    @Query("UPDATE HomeAwayConnection c SET c.lastSyncAt = :at, c.errorMessage = NULL, c.updatedAt = CURRENT_TIMESTAMP "
            + "WHERE c.id = :id AND c.organizationId = :org AND c.status = 'ACTIVE' "
            + "AND (c.listingId = :listing OR (c.listingId IS NULL AND :listing IS NULL)) "
            + "AND (c.lastSyncAt IS NULL OR c.lastSyncAt <= :at)")
    int recordSyncSuccess(@Param("id") Long id, @Param("org") Long organizationId,
                          @Param("listing") String listingId, @Param("at") LocalDateTime at);

    @Modifying
    @Transactional
    @Query("UPDATE HomeAwayConnection c SET c.errorMessage = 'Synchronisation HomeAway indisponible', c.updatedAt = CURRENT_TIMESTAMP "
            + "WHERE c.id = :id AND c.organizationId = :org AND c.status = 'ACTIVE' "
            + "AND (c.listingId = :listing OR (c.listingId IS NULL AND :listing IS NULL)) "
            + "AND (c.lastSyncAt IS NULL OR c.lastSyncAt <= :at)")
    int recordSyncFailure(@Param("id") Long id, @Param("org") Long organizationId,
                          @Param("listing") String listingId, @Param("at") LocalDateTime at);
}
