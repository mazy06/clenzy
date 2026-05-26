package com.clenzy.repository;

import com.clenzy.model.PropertyElasticityEstimate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PropertyElasticityEstimateRepository extends JpaRepository<PropertyElasticityEstimate, Long> {

    /**
     * Cache lookup pour SimulationService. Une seule ligne par propriete (UNIQUE).
     */
    Optional<PropertyElasticityEstimate> findByPropertyId(Long propertyId);

    /**
     * Liste des couples (propertyId, organizationId) pour permettre au scheduler
     * de re-estimer toutes les proprietes actives sans bypasser le filtre tenant
     * (on appelle l'estimator par tuple (orgId, propertyId)).
     *
     * <p>Status filtre : seulement les proprietes ACTIVE (les UNDER_MAINTENANCE
     * et ARCHIVED ne sont pas pertinentes a re-estimer).</p>
     */
    @Query("SELECT new com.clenzy.repository.PropertyElasticityEstimateRepository$PropertyTenantRow(" +
            "p.id, p.organizationId) " +
            "FROM Property p WHERE p.status = com.clenzy.model.PropertyStatus.ACTIVE")
    List<PropertyTenantRow> listActivePropertyIds();

    /** Projection (propertyId, organizationId) pour le scheduler. */
    record PropertyTenantRow(Long propertyId, Long organizationId) {}
}
