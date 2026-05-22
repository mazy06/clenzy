package com.clenzy.integration.external.repository;

import com.clenzy.integration.external.model.ExternalServiceConnection;
import com.clenzy.service.signature.SignatureProviderType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExternalServiceConnectionRepository
        extends JpaRepository<ExternalServiceConnection, Long> {

    Optional<ExternalServiceConnection> findByOrganizationIdAndProviderType(
            Long organizationId, SignatureProviderType providerType);

    List<ExternalServiceConnection> findByOrganizationId(Long organizationId);
}
