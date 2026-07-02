package com.clenzy.repository;

import com.clenzy.model.AgentTrustRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AgentTrustRuleRepository extends JpaRepository<AgentTrustRule, Long> {

    boolean existsByOrganizationIdAndToolName(Long organizationId, String toolName);

    boolean existsByOrganizationIdAndToolNameAndStatus(Long organizationId, String toolName, String status);

    Optional<AgentTrustRule> findByIdAndOrganizationId(Long id, Long organizationId);

    List<AgentTrustRule> findByOrganizationIdOrderBySuggestedAtDesc(Long organizationId);
}
