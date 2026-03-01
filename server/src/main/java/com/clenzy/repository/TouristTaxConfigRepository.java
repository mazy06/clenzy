package com.clenzy.repository;

import com.clenzy.model.TouristTaxConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TouristTaxConfigRepository extends JpaRepository<TouristTaxConfig, Long> {

    @Query("SELECT t FROM TouristTaxConfig t WHERE t.propertyId = :propertyId AND t.organizationId = :orgId")
    Optional<TouristTaxConfig> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT t FROM TouristTaxConfig t WHERE t.organizationId = :orgId")
    List<TouristTaxConfig> findByOrgId(@Param("orgId") Long orgId);
}
