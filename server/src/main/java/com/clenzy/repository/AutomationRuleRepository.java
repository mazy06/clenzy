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

    Optional<AutomationRule> findByIdAndOrganizationId(Long id, Long organizationId);
}
