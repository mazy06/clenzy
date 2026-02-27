package com.clenzy.integration.expedia.repository;

import com.clenzy.integration.expedia.model.ExpediaConnection;
import com.clenzy.integration.expedia.model.ExpediaConnection.ExpediaConnectionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour la gestion des entites {@link ExpediaConnection}.
 */
@Repository
public interface ExpediaConnectionRepository extends JpaRepository<ExpediaConnection, Long> {

    Optional<ExpediaConnection> findByOrganizationIdAndPropertyId(Long organizationId, String propertyId);

    List<ExpediaConnection> findByStatus(ExpediaConnectionStatus status);

    List<ExpediaConnection> findByOrganizationId(Long organizationId);

    @Query("SELECT ec FROM ExpediaConnection ec " +
           "WHERE ec.status = 'ACTIVE' AND ec.organizationId = :orgId")
    List<ExpediaConnection> findActiveByOrganizationId(@Param("orgId") Long orgId);

    @Query("SELECT ec FROM ExpediaConnection ec WHERE ec.status = 'ACTIVE'")
    List<ExpediaConnection> findAllActive();

    boolean existsByOrganizationIdAndPropertyId(Long organizationId, String propertyId);
}
