package com.clenzy.repository;

import com.clenzy.model.SplitConfiguration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SplitConfigurationRepository extends JpaRepository<SplitConfiguration, Long> {

    List<SplitConfiguration> findByOrganizationId(Long organizationId);

    Optional<SplitConfiguration> findByOrganizationIdAndIsDefaultTrue(Long organizationId);

    List<SplitConfiguration> findByOrganizationIdAndActiveTrue(Long organizationId);
}
