package com.clenzy.integration.agoda.repository;

import com.clenzy.integration.agoda.model.AgodaConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour la gestion des entites {@link AgodaConnection}.
 */
@Repository
public interface AgodaConnectionRepository extends JpaRepository<AgodaConnection, Long> {

    Optional<AgodaConnection> findByOrganizationId(Long organizationId);

    Optional<AgodaConnection> findByPropertyId(String propertyId);

    @Query("SELECT ac FROM AgodaConnection ac WHERE ac.status = 'ACTIVE'")
    List<AgodaConnection> findAllActive();
}
