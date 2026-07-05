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

    /** Barème par défaut de l'org ({@code propertyId} null). */
    @Query("SELECT t FROM TouristTaxConfig t WHERE t.propertyId IS NULL AND t.organizationId = :orgId")
    Optional<TouristTaxConfig> findDefaultForOrg(@Param("orgId") Long orgId);

    /** Chargement par id borné à l'org (jamais de findById nu dans un flux utilisateur). */
    @Query("SELECT t FROM TouristTaxConfig t WHERE t.id = :id AND t.organizationId = :orgId")
    Optional<TouristTaxConfig> findByIdAndOrganizationId(@Param("id") Long id, @Param("orgId") Long orgId);
}
