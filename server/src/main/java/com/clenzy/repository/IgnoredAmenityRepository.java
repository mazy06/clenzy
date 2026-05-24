package com.clenzy.repository;

import com.clenzy.model.IgnoredAmenity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface IgnoredAmenityRepository extends JpaRepository<IgnoredAmenity, Long> {

    List<IgnoredAmenity> findByOrganizationIdOrderByRawOtaNameAsc(Long organizationId);

    @Query("SELECT i FROM IgnoredAmenity i "
        + "WHERE i.organizationId = :orgId "
        + "AND LOWER(i.rawOtaName) = LOWER(:rawName)")
    Optional<IgnoredAmenity> findByOrgAndRawNameIgnoreCase(@Param("orgId") Long orgId,
                                                            @Param("rawName") String rawName);

    boolean existsByOrganizationIdAndRawOtaName(Long organizationId, String rawOtaName);
}
