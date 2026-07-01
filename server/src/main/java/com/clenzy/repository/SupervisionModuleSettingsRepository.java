package com.clenzy.repository;

import com.clenzy.model.SupervisionModuleSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupervisionModuleSettingsRepository extends JpaRepository<SupervisionModuleSettings, Long> {

    List<SupervisionModuleSettings> findByOrganizationId(Long organizationId);

    Optional<SupervisionModuleSettings> findByOrganizationIdAndModuleKey(Long organizationId, String moduleKey);
}
