package com.clenzy.repository;

import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AutomationRuleRepository extends JpaRepository<AutomationRule, Long> {

    List<AutomationRule> findByOrganizationIdAndEnabledTrueOrderBySortOrderAsc(Long organizationId);

    List<AutomationRule> findByOrganizationIdOrderBySortOrderAsc(Long organizationId);

    List<AutomationRule> findByOrganizationIdAndTriggerTypeAndEnabledTrue(
        Long organizationId, AutomationTrigger triggerType);

    /** Toutes orgs confondues — reserve au sweep du scheduler (regroupe ensuite par org). */
    List<AutomationRule> findByEnabledTrue();

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select r from AutomationRule r where r.id = :id and r.organizationId = :org")
    Optional<AutomationRule> lockForAdmission(@org.springframework.data.repository.query.Param("id") Long id,
                                             @org.springframework.data.repository.query.Param("org") Long org);

    Optional<AutomationRule> findByIdAndOrganizationId(Long id, Long organizationId);
}
