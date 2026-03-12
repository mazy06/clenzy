package com.clenzy.repository;

import com.clenzy.model.AiFeature;
import com.clenzy.model.AiTokenBudget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiTokenBudgetRepository extends JpaRepository<AiTokenBudget, Long> {

    Optional<AiTokenBudget> findByOrganizationIdAndFeature(Long organizationId, AiFeature feature);

    List<AiTokenBudget> findByOrganizationId(Long organizationId);

    boolean existsByOrganizationIdAndFeature(Long organizationId, AiFeature feature);
}
