package com.clenzy.integration.kyc.repository;

import com.clenzy.integration.kyc.model.KycConnection;
import com.clenzy.integration.kyc.model.KycProviderType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface KycConnectionRepository extends JpaRepository<KycConnection, Long> {

    Optional<KycConnection> findByOrganizationIdAndProviderType(Long organizationId,
                                                                  KycProviderType providerType);
}
