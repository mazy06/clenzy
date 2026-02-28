package com.clenzy.repository;

import com.clenzy.model.RegulatoryConfig;
import com.clenzy.model.RegulatoryConfig.RegulatoryType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RegulatoryConfigRepository extends JpaRepository<RegulatoryConfig, Long> {

    @Query("SELECT c FROM RegulatoryConfig c WHERE c.organizationId = :orgId")
    List<RegulatoryConfig> findAllByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT c FROM RegulatoryConfig c WHERE c.propertyId = :propertyId AND c.organizationId = :orgId")
    List<RegulatoryConfig> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT c FROM RegulatoryConfig c WHERE c.propertyId = :propertyId AND c.regulatoryType = :type AND c.organizationId = :orgId")
    Optional<RegulatoryConfig> findByPropertyAndType(@Param("propertyId") Long propertyId,
                                                      @Param("type") RegulatoryType type,
                                                      @Param("orgId") Long orgId);

    @Query("SELECT c FROM RegulatoryConfig c WHERE c.regulatoryType = 'ALUR_120_DAYS' AND c.isEnabled = true AND c.organizationId = :orgId")
    List<RegulatoryConfig> findAlurEnabled(@Param("orgId") Long orgId);
}
