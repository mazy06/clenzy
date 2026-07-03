package com.clenzy.repository;

import com.clenzy.model.AutomationExecution;
import com.clenzy.model.AutomationExecutionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AutomationExecutionRepository extends JpaRepository<AutomationExecution, Long> {

    /**
     * Cle d'idempotence generique du moteur : au plus une execution par
     * (regle x subject_type x subject_id) — types = constantes TYPE_* de
     * {@code AutomationSubject}.
     */
    boolean existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
        Long ruleId, String subjectType, Long subjectId);

    List<AutomationExecution> findByStatusAndScheduledAtBefore(
        AutomationExecutionStatus status, LocalDateTime before);

    Page<AutomationExecution> findByAutomationRuleIdAndOrganizationIdOrderByCreatedAtDesc(
        Long ruleId, Long organizationId, Pageable pageable);
}
