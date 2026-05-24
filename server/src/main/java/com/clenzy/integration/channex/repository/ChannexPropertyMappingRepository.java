package com.clenzy.integration.channex.repository;

import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChannexPropertyMappingRepository extends JpaRepository<ChannexPropertyMapping, UUID> {

    /** Recupere le mapping d'une property Clenzy specifique dans une org. */
    @Query("SELECT m FROM ChannexPropertyMapping m WHERE m.clenzyPropertyId = :propertyId AND m.organizationId = :orgId")
    Optional<ChannexPropertyMapping> findByClenzyPropertyId(@Param("propertyId") Long propertyId,
                                                              @Param("orgId") Long orgId);

    /** Recupere le mapping via le Channex property ID (utilise par les webhooks). */
    @Query("SELECT m FROM ChannexPropertyMapping m WHERE m.channexPropertyId = :channexPropertyId AND m.organizationId = :orgId")
    Optional<ChannexPropertyMapping> findByChannexPropertyId(@Param("channexPropertyId") String channexPropertyId,
                                                               @Param("orgId") Long orgId);

    /**
     * Variante webhook : on ne connait pas forcement l'orgId avant de
     * resoudre le mapping. A utiliser uniquement par les handlers webhook
     * qui valident ensuite l'organisation par d'autres moyens.
     */
    @Query("SELECT m FROM ChannexPropertyMapping m WHERE m.channexPropertyId = :channexPropertyId")
    Optional<ChannexPropertyMapping> findByChannexPropertyIdAnyOrg(@Param("channexPropertyId") String channexPropertyId);

    /** Tous les mappings actifs d'une organisation (UI Settings). */
    @Query("SELECT m FROM ChannexPropertyMapping m WHERE m.organizationId = :orgId ORDER BY m.createdAt DESC")
    List<ChannexPropertyMapping> findAllByOrgId(@Param("orgId") Long orgId);

    /** Pour le scheduler de rattrapage : mappings avec sync_status='error' a re-tenter. */
    @Query("SELECT m FROM ChannexPropertyMapping m WHERE m.syncStatus = 'error' ORDER BY m.updatedAt ASC")
    List<ChannexPropertyMapping> findAllInError();

    /**
     * Cross-tenant : tous les mappings de toutes les orgs. Reserve aux jobs de
     * type watchdog/health-summary qui doivent calculer des agregats globaux.
     * <b>Ne PAS utiliser dans des endpoints user-facing</b> (bypass le filtre
     * d'organisation).
     */
    @Query("SELECT m FROM ChannexPropertyMapping m ORDER BY m.organizationId ASC, m.updatedAt DESC")
    List<ChannexPropertyMapping> findAllAcrossOrgs();
}
