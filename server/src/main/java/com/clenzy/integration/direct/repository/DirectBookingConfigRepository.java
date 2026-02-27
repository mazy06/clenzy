package com.clenzy.integration.direct.repository;

import com.clenzy.integration.direct.model.DirectBookingConfiguration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DirectBookingConfigRepository extends JpaRepository<DirectBookingConfiguration, Long> {

    @Query("SELECT c FROM DirectBookingConfiguration c " +
           "WHERE c.propertyId = :propertyId AND c.organizationId = :orgId")
    Optional<DirectBookingConfiguration> findByPropertyIdAndOrganizationId(
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);

    @Query("SELECT c FROM DirectBookingConfiguration c " +
           "WHERE c.organizationId = :orgId ORDER BY c.propertyId")
    List<DirectBookingConfiguration> findByOrganizationId(@Param("orgId") Long orgId);

    @Query("SELECT c FROM DirectBookingConfiguration c " +
           "WHERE c.propertyId = :propertyId AND c.organizationId = :orgId AND c.enabled = true")
    Optional<DirectBookingConfiguration> findEnabledByPropertyId(
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);
}
