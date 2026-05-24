package com.clenzy.repository;

import com.clenzy.model.AmenityAlias;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AmenityAliasRepository extends JpaRepository<AmenityAlias, Long> {

    List<AmenityAlias> findByOrganizationIdOrderByRawOtaNameAsc(Long organizationId);

    /** Lookup case-insensitive (les noms OTA varient en casse selon les versions). */
    @Query("SELECT a FROM AmenityAlias a "
        + "WHERE a.organizationId = :orgId "
        + "AND LOWER(a.rawOtaName) = LOWER(:rawName)")
    Optional<AmenityAlias> findByOrgAndRawNameIgnoreCase(@Param("orgId") Long orgId,
                                                          @Param("rawName") String rawName);

    boolean existsByOrganizationIdAndRawOtaName(Long organizationId, String rawOtaName);

    /** Toutes les aliases qui pointent sur un code donne (utile au DELETE custom_amenity). */
    List<AmenityAlias> findByOrganizationIdAndClenzyCode(Long organizationId, String clenzyCode);
}
