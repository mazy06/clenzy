package com.clenzy.repository;

import com.clenzy.model.ExternalAutomation;
import com.clenzy.model.ExternalAutomation.AutomationEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ExternalAutomationRepository extends JpaRepository<ExternalAutomation, Long> {

    @Query("SELECT t FROM ExternalAutomation t WHERE t.organizationId = :orgId")
    List<ExternalAutomation> findAllByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT t FROM ExternalAutomation t WHERE t.id = :id AND t.organizationId = :orgId")
    Optional<ExternalAutomation> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    @Query("SELECT t FROM ExternalAutomation t WHERE t.triggerEvent = :event AND t.isActive = true AND t.organizationId = :orgId")
    List<ExternalAutomation> findActiveByEvent(@Param("event") AutomationEvent event, @Param("orgId") Long orgId);

    @Query("SELECT t FROM ExternalAutomation t WHERE t.isActive = true AND t.organizationId = :orgId")
    List<ExternalAutomation> findAllActive(@Param("orgId") Long orgId);
}
