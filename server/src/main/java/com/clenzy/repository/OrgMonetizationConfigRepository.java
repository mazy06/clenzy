package com.clenzy.repository;

import com.clenzy.model.OrgMonetizationConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrgMonetizationConfigRepository extends JpaRepository<OrgMonetizationConfig, Long> {

    Optional<OrgMonetizationConfig> findByOrganizationId(Long organizationId);
}
