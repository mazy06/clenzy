package com.clenzy.repository;

import com.clenzy.model.NoiseDevice;
import com.clenzy.model.NoiseDevice.DeviceStatus;
import com.clenzy.model.NoiseDevice.DeviceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface NoiseDeviceRepository extends JpaRepository<NoiseDevice, Long> {

    List<NoiseDevice> findByUserId(String userId);

    List<NoiseDevice> findByUserIdAndStatus(String userId, DeviceStatus status);

    List<NoiseDevice> findByUserIdAndDeviceType(String userId, DeviceType deviceType);

    List<NoiseDevice> findByPropertyId(Long propertyId);

    Optional<NoiseDevice> findByIdAndUserId(Long id, String userId);

    boolean existsByUserIdAndPropertyIdAndRoomName(String userId, Long propertyId, String roomName);

    long countByUserId(String userId);

    Optional<NoiseDevice> findByExternalDeviceId(String externalDeviceId);

    List<NoiseDevice> findByPropertyIdAndStatus(Long propertyId, DeviceStatus status);

    /** Org-scoped : le filtre Hibernate organizationFilter assure l'isolation */
    List<NoiseDevice> findByStatus(DeviceStatus status);

    /**
     * F7b — borne d'EPISODE hors-ligne : transition {@code online → offline} par
     * UPDATE conditionnel (CAS, audit n°8 — jamais de check-then-act sur une
     * re-livraison Kafka). 1 ligne modifiee = debut d'episode (on notifie) ;
     * 0 = deja hors ligne (episode en cours, pas de re-notification).
     */
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("UPDATE NoiseDevice d SET d.online = false "
            + "WHERE d.id = :id AND (d.online IS NULL OR d.online = true)")
    int markOffline(@Param("id") Long id);

    /** F7b — retour en ligne : clot l'episode (le prochain offline re-notifiera). */
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("UPDATE NoiseDevice d SET d.online = true, d.lastSeenAt = :now WHERE d.id = :id")
    int markOnline(@Param("id") Long id, @Param("now") LocalDateTime now);
}
