package com.clenzy.repository;

import com.clenzy.model.SupervisionAutoRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupervisionAutoRuleRepository extends JpaRepository<SupervisionAutoRule, Long> {

    /** Règle d'auto-application d'un type pour une org (org explicite : le gate tourne hors HTTP). */
    Optional<SupervisionAutoRule> findByOrganizationIdAndActionType(Long organizationId, String actionType);

    /** Toutes les règles de l'org (écran Automatisation). */
    List<SupervisionAutoRule> findByOrganizationId(Long organizationId);
}
