package com.clenzy.repository;

import com.clenzy.model.OrgIntegrationConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrgIntegrationConfigRepository extends JpaRepository<OrgIntegrationConfig, Long> {
    Optional<OrgIntegrationConfig> findByOrganizationId(Long organizationId);
}
