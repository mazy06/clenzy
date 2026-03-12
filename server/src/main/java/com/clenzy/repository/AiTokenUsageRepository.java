package com.clenzy.repository;

import com.clenzy.model.AiFeature;
import com.clenzy.model.AiTokenUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiTokenUsageRepository extends JpaRepository<AiTokenUsage, Long> {

    /**
     * Somme des tokens utilises pour une org/feature/mois.
     * Retourne 0 si aucun usage.
     */
    @Query("SELECT COALESCE(SUM(u.totalTokens), 0) FROM AiTokenUsage u " +
            "WHERE u.organizationId = :orgId AND u.feature = :feature AND u.monthYear = :monthYear")
    long sumTokensByOrgAndFeatureAndMonth(
            @Param("orgId") Long organizationId,
            @Param("feature") AiFeature feature,
            @Param("monthYear") String monthYear
    );

    /**
     * Tous les usages d'une org pour un mois donne (pour le dashboard).
     */
    List<AiTokenUsage> findByOrganizationIdAndMonthYear(Long organizationId, String monthYear);

    /**
     * Tous les usages d'une org/feature pour un mois (detail par appel).
     */
    List<AiTokenUsage> findByOrganizationIdAndFeatureAndMonthYear(
            Long organizationId, AiFeature feature, String monthYear
    );
}
