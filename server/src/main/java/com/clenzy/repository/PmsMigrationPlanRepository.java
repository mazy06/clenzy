package com.clenzy.repository;

import com.clenzy.model.PmsMigrationPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface PmsMigrationPlanRepository extends JpaRepository<PmsMigrationPlan, UUID> {
    Optional<PmsMigrationPlan> findByOrganizationIdAndCreatedBy(Long organizationId, String createdBy);
}
