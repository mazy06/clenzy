package com.clenzy.integration.hotelscom.repository;

import com.clenzy.integration.hotelscom.model.HotelsComConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour la gestion des entites {@link HotelsComConnection}.
 */
@Repository
public interface HotelsComConnectionRepository extends JpaRepository<HotelsComConnection, Long> {

    Optional<HotelsComConnection> findByOrganizationId(Long organizationId);

    Optional<HotelsComConnection> findByPropertyId(String propertyId);

    @Query("SELECT hc FROM HotelsComConnection hc WHERE hc.status = 'ACTIVE'")
    List<HotelsComConnection> findAllActive();
}
