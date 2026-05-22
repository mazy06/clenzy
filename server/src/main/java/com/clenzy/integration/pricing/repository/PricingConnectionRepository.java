package com.clenzy.integration.pricing.repository;

import com.clenzy.integration.pricing.model.PricingConnection;
import com.clenzy.integration.pricing.model.PricingProviderType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PricingConnectionRepository extends JpaRepository<PricingConnection, Long> {

    Optional<PricingConnection> findByOrganizationIdAndProviderType(Long organizationId,
                                                                       PricingProviderType providerType);
}
