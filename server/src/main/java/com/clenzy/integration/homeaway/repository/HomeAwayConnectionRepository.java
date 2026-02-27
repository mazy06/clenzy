package com.clenzy.integration.homeaway.repository;

import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

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
}
