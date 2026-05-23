package com.clenzy.integration.channex.repository;

import com.clenzy.integration.channex.model.ChannexOtaChannel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChannexOtaChannelRepository extends JpaRepository<ChannexOtaChannel, UUID> {

    /** Tous les channels OTA d'un mapping (Airbnb + Booking + Vrbo...). */
    @Query("SELECT c FROM ChannexOtaChannel c WHERE c.propertyMappingId = :mappingId ORDER BY c.otaType ASC")
    List<ChannexOtaChannel> findByMappingId(@Param("mappingId") UUID mappingId);

    /** Recherche d'un channel specifique par mapping + OTA type. */
    @Query("SELECT c FROM ChannexOtaChannel c WHERE c.propertyMappingId = :mappingId AND c.otaType = :otaType")
    Optional<ChannexOtaChannel> findByMappingAndOta(@Param("mappingId") UUID mappingId,
                                                      @Param("otaType") String otaType);

    /** Channels actifs avec erreurs (utilise pour les alertes). */
    @Query("SELECT c FROM ChannexOtaChannel c WHERE c.organizationId = :orgId AND c.enabled = true AND c.errorCount > 0 ORDER BY c.errorCount DESC")
    List<ChannexOtaChannel> findErrorsByOrgId(@Param("orgId") Long orgId);
}
