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

    /**
     * Lignes locales correspondant a un channel Channex, pour une organisation.
     *
     * <p>Renvoie une liste et non un {@code Optional} : rien n'empeche Channex de
     * rattacher un meme channel a plusieurs properties, donc a plusieurs mappings.
     * La contrainte UNIQUE porte sur (property_mapping_id, ota_type), pas sur
     * channex_channel_id.</p>
     */
    @Query("SELECT c FROM ChannexOtaChannel c WHERE c.organizationId = :orgId AND c.channexChannelId = :channelId")
    List<ChannexOtaChannel> findByOrgAndChannelId(@Param("orgId") Long orgId,
                                                  @Param("channelId") String channelId);

    /** Channels actifs avec erreurs (utilise pour les alertes). */
    @Query("SELECT c FROM ChannexOtaChannel c WHERE c.organizationId = :orgId AND c.enabled = true AND c.errorCount > 0 ORDER BY c.errorCount DESC")
    List<ChannexOtaChannel> findErrorsByOrgId(@Param("orgId") Long orgId);
}
