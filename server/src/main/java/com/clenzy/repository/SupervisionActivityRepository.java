package com.clenzy.repository;

import com.clenzy.model.SupervisionActivity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface SupervisionActivityRepository extends JpaRepository<SupervisionActivity, Long> {

    /** Dernières entrées d'une propriété (chrono inversé). Limiter via {@link Pageable}. */
    List<SupervisionActivity> findByOrganizationIdAndPropertyIdOrderByCreatedAtDesc(
            Long organizationId, Long propertyId, Pageable pageable);

    /**
     * Feed d'une propriété SANS les outils exclus (read-only hérités), filtré en SQL —
     * remplace le sur-fetch de 200 lignes filtré en mémoire (audit perf accordéon).
     * Les entrées sans toolName (automatisations déterministes) sont conservées.
     */
    @Query("SELECT a FROM SupervisionActivity a WHERE a.organizationId = :orgId AND a.propertyId = :propertyId "
        + "AND (a.toolName IS NULL OR a.toolName NOT IN :excludedTools) ORDER BY a.createdAt DESC")
    List<SupervisionActivity> findFeedExcludingTools(
            @Param("orgId") Long organizationId,
            @Param("propertyId") Long propertyId,
            @Param("excludedTools") Collection<String> excludedTools,
            Pageable pageable);

    /** Nb d'actions d'un type depuis un instant (compteur « actions récentes »). */
    long countByOrganizationIdAndPropertyIdAndKindAndCreatedAtAfter(
            Long organizationId, Long propertyId, String kind, Instant since);

    /** Dernières entrées de TOUTE l'organisation (vue portefeuille, chrono inversé). */
    List<SupervisionActivity> findByOrganizationIdOrderByCreatedAtDesc(
            Long organizationId, Pageable pageable);

    /** Nb d'actions d'un type sur toute l'org depuis un instant (métrique portefeuille). */
    long countByOrganizationIdAndKindAndCreatedAtAfter(
            Long organizationId, String kind, Instant since);
}
