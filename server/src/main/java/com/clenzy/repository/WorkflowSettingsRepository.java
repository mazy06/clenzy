package com.clenzy.repository;

import com.clenzy.model.WorkflowSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WorkflowSettingsRepository extends JpaRepository<WorkflowSettings, Long> {

    Optional<WorkflowSettings> findByOrganizationId(Long organizationId);
}
