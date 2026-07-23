package com.clenzy.integration.partner.repository;

import com.clenzy.integration.partner.model.PartnerServiceConnection;
import com.clenzy.integration.partner.model.PartnerServiceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PartnerServiceConnectionRepository extends JpaRepository<PartnerServiceConnection, Long> {

    Optional<PartnerServiceConnection> findByOrganizationIdAndProviderType(
            Long organizationId, PartnerServiceType providerType);
}
