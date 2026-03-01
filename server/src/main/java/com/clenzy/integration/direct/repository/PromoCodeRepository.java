package com.clenzy.integration.direct.repository;

import com.clenzy.integration.direct.model.PromoCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PromoCodeRepository extends JpaRepository<PromoCode, Long> {

    @Query("SELECT p FROM PromoCode p " +
           "WHERE p.code = :code AND p.organizationId = :orgId")
    Optional<PromoCode> findByCodeAndOrganizationId(
            @Param("code") String code,
            @Param("orgId") Long orgId);

    /**
     * Codes promo actifs pour une propriete donnee :
     * - actif, dans la plage de validite, pas encore au max d'utilisations
     * - soit specifique a la propriete, soit global (propertyId IS NULL)
     */
    @Query("SELECT p FROM PromoCode p WHERE p.organizationId = :orgId " +
           "AND p.active = true " +
           "AND (p.propertyId = :propertyId OR p.propertyId IS NULL) " +
           "AND (p.validFrom IS NULL OR p.validFrom <= :today) " +
           "AND (p.validUntil IS NULL OR p.validUntil >= :today) " +
           "AND (p.maxUses = 0 OR p.currentUses < p.maxUses) " +
           "ORDER BY p.code")
    List<PromoCode> findActiveByPropertyId(
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId,
            @Param("today") LocalDate today);

    @Query("SELECT p FROM PromoCode p WHERE p.organizationId = :orgId ORDER BY p.createdAt DESC")
    List<PromoCode> findAllByOrganizationId(@Param("orgId") Long orgId);
}
