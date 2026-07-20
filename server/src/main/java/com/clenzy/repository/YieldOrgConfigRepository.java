package com.clenzy.repository;

import com.clenzy.model.YieldOrgConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface YieldOrgConfigRepository extends JpaRepository<YieldOrgConfig, Long> {

    Optional<YieldOrgConfig> findByOrganizationId(Long organizationId);

    /**
     * Orgs dont le yield est activé (kill-switch ON). Requête CROSS-ORG :
     * réservée au scheduler (hors contexte tenant, filtre Hibernate inactif).
     */
    List<YieldOrgConfig> findByEnabledTrue();

    /** Orgs ayant au moins une automatisation R2 active (orphan gap ou min-stay auto). */
    List<YieldOrgConfig> findByOrphanGapEnabledTrueOrMinStayAutoEnabledTrue();
}
