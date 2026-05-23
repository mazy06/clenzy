package com.clenzy.integration.compliance.repository;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ComplianceConnectionRepository extends JpaRepository<ComplianceConnection, Long> {

    Optional<ComplianceConnection> findByOrganizationIdAndProviderType(Long organizationId,
                                                                          ComplianceProviderType providerType);
}
