package com.clenzy.repository;

import com.clenzy.model.AutomationExecution;
import com.clenzy.model.AutomationExecutionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    boolean existsByDurableKey(String key);

    boolean existsByAutomationRuleIdAndOrganizationIdAndSubjectTypeAndSubjectIdAndStatusAndDurableStateIsNull(
        Long rule, Long org, String type, Long subject, AutomationExecutionStatus status);

    boolean existsByAutomationRuleIdAndOrganizationIdAndSubjectTypeAndSubjectIdAndDurableStateIn(
        Long rule, Long org, String type, Long subject, List<String> states);

    /** Échecs et résultats incertains à réconcilier, jamais une preuve d'absence d'effet. */
    @Query("""
            SELECT e FROM AutomationExecution e
            WHERE e.organizationId = :orgId
              AND e.status = com.clenzy.model.AutomationExecutionStatus.FAILED
              AND e.createdAt >= :since
            ORDER BY e.createdAt DESC
            """)
    List<AutomationExecution> findFailedForOrg(@Param("orgId") Long orgId,
                                               @Param("since") LocalDateTime since);
}
