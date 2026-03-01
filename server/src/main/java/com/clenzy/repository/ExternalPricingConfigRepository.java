package com.clenzy.repository;

import com.clenzy.model.ExternalPricingConfig;
import com.clenzy.model.PricingProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ExternalPricingConfigRepository extends JpaRepository<ExternalPricingConfig, Long> {

    @Query("SELECT c FROM ExternalPricingConfig c WHERE c.organizationId = :orgId")
    List<ExternalPricingConfig> findByOrganizationId(@Param("orgId") Long orgId);

    @Query("SELECT c FROM ExternalPricingConfig c WHERE c.provider = :provider AND c.organizationId = :orgId")
    Optional<ExternalPricingConfig> findByProvider(@Param("provider") PricingProvider provider, @Param("orgId") Long orgId);

    @Query("SELECT c FROM ExternalPricingConfig c WHERE c.enabled = true")
    List<ExternalPricingConfig> findEnabledConfigs();
}
